using AkordishKeit.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace AkordishKeit.Services;

public class CleanupService : BackgroundService
{
    private readonly ILogger<CleanupService> _logger;
    private readonly IServiceProvider _serviceProvider;
    private readonly TimeSpan _cleanupInterval = TimeSpan.FromHours(24); // Run once per day
    private const int DAYS_TO_KEEP = 7; // Keep only last 7 days

    public CleanupService(
        ILogger<CleanupService> logger,
        IServiceProvider serviceProvider)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("View Cleanup Service is starting (Articles, Songs & Ad Campaigns).");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Calculate next run time (2:00 AM)
                var now = DateTime.Now;
                var nextRun = now.Date.AddDays(1).AddHours(2); // Tomorrow at 2:00 AM

                if (now.Hour < 2)
                {
                    // If it's before 2:00 AM today, run today at 2:00 AM
                    nextRun = now.Date.AddHours(2);
                }

                var delay = nextRun - now;

                _logger.LogInformation(
                    "Next View cleanup scheduled for {NextRun} (in {Hours} hours)",
                    nextRun,
                    delay.TotalHours);

                // Wait until next run time
                await Task.Delay(delay, stoppingToken);

                // Perform cleanup
                await CleanupOldViews(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred in View Cleanup Service.");

                // Wait 1 hour before retrying on error
                await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
            }
        }

        _logger.LogInformation("View Cleanup Service is stopping.");
    }

    private async Task CleanupOldViews(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AkordishKeitDbContext>();

        try
        {
            var cutoffDate = DateTime.UtcNow.AddDays(-DAYS_TO_KEEP);

            _logger.LogInformation(
                "Starting cleanup of views older than {CutoffDate} ({Days} days ago)",
                cutoffDate,
                DAYS_TO_KEEP);

            // Delete old ArticleViews
            var deletedArticleViewsCount = await context.ArticleViews
                .Where(av => av.ViewedAt < cutoffDate)
                .ExecuteDeleteAsync(stoppingToken);

            _logger.LogInformation(
                "Deleted {Count} old ArticleView records.",
                deletedArticleViewsCount);

            // Delete old SongViews
            var deletedSongViewsCount = await context.SongViews
                .Where(sv => sv.ViewedAt < cutoffDate)
                .ExecuteDeleteAsync(stoppingToken);

            _logger.LogInformation(
                "Deleted {Count} old SongView records.",
                deletedSongViewsCount);

            // Delete old AdCampaignViews
            var deletedAdViewsCount = await context.AdCampaignViews
                .Where(av => av.ViewedAt < cutoffDate)
                .ExecuteDeleteAsync(stoppingToken);

            _logger.LogInformation(
                "Deleted {Count} old AdCampaignView records.",
                deletedAdViewsCount);

            // Delete old AdCampaignClicks
            var deletedAdClicksCount = await context.AdCampaignClicks
                .Where(ac => ac.ClickedAt < cutoffDate)
                .ExecuteDeleteAsync(stoppingToken);

            _logger.LogInformation(
                "Deleted {Count} old AdCampaignClick records.",
                deletedAdClicksCount);

            var totalDeleted = deletedArticleViewsCount + deletedSongViewsCount + deletedAdViewsCount + deletedAdClicksCount;

            _logger.LogInformation(
                "Cleanup completed. Total deleted: {Total} records ({Articles} ArticleViews + {Songs} SongViews + {AdViews} AdCampaignViews + {AdClicks} AdCampaignClicks).",
                totalDeleted,
                deletedArticleViewsCount,
                deletedSongViewsCount,
                deletedAdViewsCount,
                deletedAdClicksCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred during View cleanup.");
            throw;
        }
    }
}
