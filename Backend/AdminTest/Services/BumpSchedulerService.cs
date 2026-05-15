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
                BumpEntity(context, schedule.EntityType, schedule.EntityId, now);

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

    private static void BumpEntity(AkordishKeitDbContext context, string entityType, int entityId, DateTime bumpedAt)
    {
        switch (entityType)
        {
            case "Song":
                context.Songs
                    .Where(e => e.Id == entityId)
                    .ExecuteUpdate(s => s.SetProperty(e => e.BumpedAt, bumpedAt));
                break;
            case "Article":
                context.Articles
                    .Where(e => e.Id == entityId)
                    .ExecuteUpdate(s => s.SetProperty(e => e.BumpedAt, bumpedAt));
                break;
            case "Playlist":
                context.Playlists
                    .Where(e => e.Id == entityId)
                    .ExecuteUpdate(s => s.SetProperty(e => e.BumpedAt, bumpedAt));
                break;
            case "ServiceProvider":
                context.ServiceProviders
                    .Where(e => e.Id == entityId)
                    .ExecuteUpdate(s => s.SetProperty(e => e.BumpedAt, bumpedAt));
                break;
        }
    }
}
