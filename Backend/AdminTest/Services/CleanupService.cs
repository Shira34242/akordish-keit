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
                var now = DateTime.UtcNow;
                var nextRun = now.Date.AddDays(1).AddHours(2); // Tomorrow at 2:00 AM UTC

                if (now.Hour < 2)
                {
                    nextRun = now.Date.AddHours(2);
                }

                var delay = nextRun - now;

                _logger.LogInformation(
                    "Next View cleanup scheduled for {NextRun} (in {Hours} hours)",
                    nextRun,
                    delay.TotalHours);

                // Wait until next run time
                await Task.Delay(delay, stoppingToken);

                // Analytics history is intentionally retained. The admin analytics dashboard
                // supports long date ranges, so view/click rows must never be removed here.
                await CleanupExpiredSubscriptions(stoppingToken);
                await CleanupOldNewsArticles(stoppingToken);
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

    private async Task CleanupExpiredSubscriptions(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var subscriptionService = scope.ServiceProvider.GetRequiredService<ISubscriptionService>();

        try
        {
            _logger.LogInformation("Starting expired subscriptions cleanup.");
            await subscriptionService.UpdateExpiredSubscriptionsAsync();
            _logger.LogInformation("Expired subscriptions cleanup completed.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred during expired subscriptions cleanup.");
        }
    }

    private async Task CleanupOldNewsArticles(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var articleService = scope.ServiceProvider.GetRequiredService<IArticleService>();

        try
        {
            var result = await articleService.RunAutomaticNewsCleanupAsync(stoppingToken);
            if (result == null)
            {
                _logger.LogInformation("Automatic old news cleanup is disabled.");
                return;
            }

            _logger.LogInformation(
                "Automatic old news cleanup completed. Deleted {DeletedCount} articles older than {OlderThanDays} days.",
                result.DeletedCount,
                result.OlderThanDays);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error occurred during automatic old news cleanup.");
        }
    }
}
