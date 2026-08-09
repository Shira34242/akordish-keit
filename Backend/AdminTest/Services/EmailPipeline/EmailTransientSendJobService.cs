using System.Collections.Concurrent;
using System.Threading.Channels;
using AkordishKeit.Models.DTOs;
using Microsoft.Extensions.DependencyInjection;

namespace AkordishKeit.Services.EmailPipeline;

public interface IEmailTransientSendJobService
{
    EmailTransientSendJobDto Start(SendEmailRequestDto request);
    EmailTransientSendJobDto? Get(string sendId);
    Task ProcessAsync(string sendId, CancellationToken stoppingToken);
}

public sealed class EmailTransientSendJobService : IEmailTransientSendJobService
{
    private readonly ConcurrentDictionary<string, JobState> _jobs = new();
    private readonly ConcurrentDictionary<string, string> _fingerprints = new();
    private readonly Channel<string> _queue = Channel.CreateUnbounded<string>();
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<EmailTransientSendJobService> _logger;

    public EmailTransientSendJobService(IServiceScopeFactory scopeFactory, ILogger<EmailTransientSendJobService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public EmailTransientSendJobDto Start(SendEmailRequestDto request)
    {
        var fingerprint = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(
            $"{request.Subject}\n{request.HtmlBody}\n{request.RecipientGroup}\n{request.EmailGroupId}\n{request.FromEmail}\n{string.Join('|', request.ExcludedEmails ?? [])}")));
        if (_fingerprints.TryGetValue(fingerprint, out var existingId) && _jobs.TryGetValue(existingId, out var existing) && existing.Status is "pending" or "running")
            return existing.ToDto();

        var state = new JobState(Guid.NewGuid().ToString("N"), fingerprint, request);
        _jobs[state.SendId] = state;
        _fingerprints[fingerprint] = state.SendId;
        if (!_queue.Writer.TryWrite(state.SendId)) throw new InvalidOperationException("Could not queue email send.");
        _logger.LogInformation("Email V2 send queued {SendId} for {Group}", state.SendId, request.RecipientGroup);
        return state.ToDto();
    }

    public EmailTransientSendJobDto? Get(string sendId) => _jobs.TryGetValue(sendId, out var job) ? job.ToDto() : null;

    public async Task ProcessAsync(string sendId, CancellationToken stoppingToken)
    {
        if (!_jobs.TryGetValue(sendId, out var state)) return;
        lock (state.Gate) { state.Status = "running"; state.StartedAt = DateTime.UtcNow; }
        _logger.LogInformation("Email V2 send started {SendId}", sendId);
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var pipeline = scope.ServiceProvider.GetRequiredService<IEmailSendPipeline>();
            var result = await pipeline.SendTransientCampaignAsync(state.Request, (planned, recipient) =>
            {
                lock (state.Gate)
                {
                    state.PlannedCount = planned;
                    state.Recipients.Add(recipient);
                    if (recipient.AcceptedByBrevo) state.SentCount++; else state.FailedCount++;
                }
            });
            lock (state.Gate)
            {
                state.PlannedCount = result.AttemptedCount;
                state.Status = result.Success ? "completed" : "failed";
                state.Error = result.Success ? null : result.Message;
                state.CompletedAt = DateTime.UtcNow;
            }
            _logger.LogInformation("Email V2 send finished {SendId}: {Sent} sent, {Failed} failed", sendId, state.SentCount, state.FailedCount);
        }
        catch (Exception ex)
        {
            lock (state.Gate) { state.Status = "failed"; state.Error = "The email job stopped unexpectedly."; state.CompletedAt = DateTime.UtcNow; }
            _logger.LogError(ex, "Email V2 send job failed {SendId}", sendId);
        }
        finally { _fingerprints.TryRemove(state.Fingerprint, out _); }
    }

    internal async Task RunWorkerAsync(CancellationToken stoppingToken)
    {
        await foreach (var sendId in _queue.Reader.ReadAllAsync(stoppingToken))
            await ProcessAsync(sendId, stoppingToken);
    }

    private sealed class JobState
    {
        public object Gate { get; } = new();
        public string SendId { get; }
        public string Fingerprint { get; }
        public SendEmailRequestDto Request { get; }
        public string Status { get; set; } = "pending";
        public int PlannedCount { get; set; }
        public int SentCount { get; set; }
        public int FailedCount { get; set; }
        public DateTime CreatedAt { get; } = DateTime.UtcNow;
        public DateTime? StartedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string? Error { get; set; }
        public List<EmailRecipientSendResultDto> Recipients { get; } = [];
        public JobState(string sendId, string fingerprint, SendEmailRequestDto request) { SendId = sendId; Fingerprint = fingerprint; Request = request; }
        public EmailTransientSendJobDto ToDto() { lock (Gate) return new EmailTransientSendJobDto { SendId = SendId, Status = Status, PlannedCount = PlannedCount, ProcessedCount = SentCount + FailedCount, SentCount = SentCount, FailedCount = FailedCount, CreatedAt = CreatedAt, StartedAt = StartedAt, CompletedAt = CompletedAt, Error = Error, Recipients = Recipients.OrderBy(r => r.Email, StringComparer.OrdinalIgnoreCase).ToList() }; }
    }
}

public sealed class EmailTransientSendJobWorker : BackgroundService
{
    private readonly EmailTransientSendJobService _jobs;
    public EmailTransientSendJobWorker(EmailTransientSendJobService jobs) => _jobs = jobs;
    protected override Task ExecuteAsync(CancellationToken stoppingToken) => _jobs.RunWorkerAsync(stoppingToken);
}
