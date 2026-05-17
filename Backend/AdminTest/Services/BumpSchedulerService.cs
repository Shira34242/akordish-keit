using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AkordishKeit.Services;

public class BumpSchedulerService : BackgroundService
{
    private readonly ILogger<BumpSchedulerService> _logger;
    private readonly IServiceProvider _serviceProvider;
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(60);

    public BumpSchedulerService(
        ILogger<BumpSchedulerService> logger,
        IServiceProvider serviceProvider)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Bump Scheduler Service started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessDueBumpsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing scheduled bumps.");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }

        _logger.LogInformation("Bump Scheduler Service stopped.");
    }

    private async Task ProcessDueBumpsAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AkordishKeitDbContext>();

        var now = DateTime.UtcNow;

        var dueSchedules = await context.BumpSchedules
            .Where(s => s.NextBumpAt <= now && s.RemainingTimes > 0)
            .ToListAsync(stoppingToken);

        foreach (var schedule in dueSchedules)
        {
            try
            {
                await BumpEntityAsync(context, schedule.EntityType, schedule.EntityId, now, stoppingToken);

                schedule.RemainingTimes--;

                if (schedule.RemainingTimes > 0)
                {
                    schedule.NextBumpAt = now.AddHours(schedule.IntervalHours);
                }
                else
                {
                    context.BumpSchedules.Remove(schedule);
                }

                _logger.LogInformation(
                    "Scheduled bump: {EntityType}#{EntityId}, remaining: {Remaining}",
                    schedule.EntityType,
                    schedule.EntityId,
                    schedule.RemainingTimes);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to bump {EntityType}#{EntityId}",
                    schedule.EntityType,
                    schedule.EntityId);
            }
        }

        if (dueSchedules.Count > 0)
            await context.SaveChangesAsync(stoppingToken);
    }

    private static async Task BumpEntityAsync(AkordishKeitDbContext context, string entityType, int entityId, DateTime bumpedAt, CancellationToken ct)
    {
        switch (entityType)
        {
            case "Song":
                await context.Songs
                    .Where(e => e.Id == entityId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(e => e.BumpedAt, bumpedAt)
                        .SetProperty(e => e.BumpCount, e => e.BumpCount + 1), ct);
                break;
            case "Article":
                await context.Articles
                    .Where(e => e.Id == entityId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(e => e.BumpedAt, bumpedAt)
                        .SetProperty(e => e.BumpCount, e => e.BumpCount + 1), ct);
                break;
            case "Playlist":
                await context.Playlists
                    .Where(e => e.Id == entityId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(e => e.BumpedAt, bumpedAt)
                        .SetProperty(e => e.BumpCount, e => e.BumpCount + 1), ct);
                break;
            case "ServiceProvider":
                await context.ServiceProviders
                    .Where(e => e.Id == entityId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(e => e.BumpedAt, bumpedAt)
                        .SetProperty(e => e.BumpCount, e => e.BumpCount + 1), ct);
                break;
            case "Artist":
                await context.Artists
                    .Where(e => e.Id == entityId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(e => e.BumpedAt, bumpedAt)
                        .SetProperty(e => e.BumpCount, e => e.BumpCount + 1), ct);
                break;
            default:
                throw new InvalidOperationException($"Unknown bump entity type: {entityType}");
        }
    }
}
