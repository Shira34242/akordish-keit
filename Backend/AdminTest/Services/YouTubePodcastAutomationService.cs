using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace AkordishKeit.Services;

public sealed class YouTubePodcastAutomationOptions
{
    public const string SectionName = "YouTubePodcastAutomation";

    public bool Enabled { get; set; }
    public int PollIntervalMinutes { get; set; } = 15;
    public List<YouTubePodcastSourceOptions> Sources { get; set; } = new();
}

public sealed class YouTubePodcastSourceOptions
{
    public string PodcastName { get; set; } = string.Empty;
    public string PlaylistId { get; set; } = string.Empty;
    public List<string> RequiredTerms { get; set; } = new();
    public DateTime? PublishedAfterUtc { get; set; }
}

public sealed class YouTubePodcastAutomationService : BackgroundService
{
    private static readonly Regex EpisodeNumberRegex = new(
        @"(?:פרק|episode)\s*[-:#|]?\s*(\d{1,4})",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly YouTubePodcastAutomationOptions _options;
    private readonly IConfiguration _configuration;
    private readonly ILogger<YouTubePodcastAutomationService> _logger;

    public YouTubePodcastAutomationService(
        IServiceScopeFactory scopeFactory,
        IHttpClientFactory httpClientFactory,
        IOptions<YouTubePodcastAutomationOptions> options,
        IConfiguration configuration,
        ILogger<YouTubePodcastAutomationService> logger)
    {
        _scopeFactory = scopeFactory;
        _httpClientFactory = httpClientFactory;
        _options = options.Value;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_options.Enabled)
        {
            _logger.LogInformation("YouTube podcast automation is disabled");
            return;
        }

        var interval = TimeSpan.FromMinutes(Math.Clamp(_options.PollIntervalMinutes, 5, 1440));

        await SyncAllSourcesSafelyAsync(stoppingToken);

        using var timer = new PeriodicTimer(interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await SyncAllSourcesSafelyAsync(stoppingToken);
        }
    }

    private async Task SyncAllSourcesSafelyAsync(CancellationToken cancellationToken)
    {
        try
        {
            foreach (var source in _options.Sources)
            {
                cancellationToken.ThrowIfCancellationRequested();
                await SyncSourceAsync(source, cancellationToken);
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "YouTube podcast automation cycle failed");
        }
    }

    private async Task SyncSourceAsync(
        YouTubePodcastSourceOptions source,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(source.PodcastName) || string.IsNullOrWhiteSpace(source.PlaylistId))
        {
            _logger.LogWarning("Skipping an incomplete YouTube podcast source configuration");
            return;
        }

        var apiKey = _configuration["YouTube:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("YouTube podcast automation cannot run because the YouTube API key is missing");
            return;
        }

        using var scope = _scopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<AkordishKeitDbContext>();
        var podcastService = scope.ServiceProvider.GetRequiredService<IPodcastService>();
        var notificationService = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var podcast = await context.Podcasts
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => !item.IsDeleted && item.Name == source.PodcastName.Trim(),
                cancellationToken);

        if (podcast == null)
        {
            _logger.LogWarning(
                "YouTube podcast automation could not find podcast {PodcastName}",
                source.PodcastName);
            return;
        }

        var playlistItems = await GetPlaylistItemsAsync(source.PlaylistId.Trim(), apiKey, cancellationToken);
        if (playlistItems.Count == 0)
        {
            return;
        }

        var existingSourceUrls = await context.PodcastEpisodes
            .AsNoTracking()
            .Where(item => !item.IsDeleted && item.PodcastId == podcast.Id)
            .Select(item => item.SourceUrl)
            .ToListAsync(cancellationToken);

        var existingVideoIds = existingSourceUrls
            .Select(ExtractYouTubeVideoId)
            .Where(videoId => videoId != null)
            .Select(videoId => videoId!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var item in playlistItems
                     .Where(item => item.VideoPublishedAt.HasValue)
                     .OrderBy(item => item.VideoPublishedAt))
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (!IsEligible(item, source) || existingVideoIds.Contains(item.VideoId))
            {
                continue;
            }

            var sourceUrl = $"https://www.youtube.com/watch?v={item.VideoId}";
            var episode = await podcastService.CreateEpisodeAsync(new CreatePodcastEpisodeDto
            {
                PodcastId = podcast.Id,
                Title = Truncate(item.Title.Trim(), 250),
                EpisodeNumber = ExtractEpisodeNumber(item.Title),
                SourceUrl = sourceUrl,
                PublishedAt = item.VideoPublishedAt,
                IsActive = false,
                DisplayOrder = 0,
                Platform = "YouTube"
            });

            existingVideoIds.Add(item.VideoId);

            await notificationService.NotifyPodcastDraftCreatedAsync(
                episode.Id,
                podcast.Name,
                episode.Title);

            _logger.LogInformation(
                "Created podcast draft {EpisodeId} for {PodcastName} from YouTube video {VideoId}",
                episode.Id,
                podcast.Name,
                item.VideoId);
        }
    }

    private async Task<List<YouTubePlaylistVideo>> GetPlaylistItemsAsync(
        string playlistId,
        string apiKey,
        CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();
        var url = "https://www.googleapis.com/youtube/v3/playlistItems"
            + $"?part=snippet,contentDetails,status&maxResults=50&playlistId={Uri.EscapeDataString(playlistId)}"
            + $"&key={Uri.EscapeDataString(apiKey)}";

        using var response = await client.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning(
                "YouTube playlist request failed for {PlaylistId} with status {StatusCode}",
                playlistId,
                response.StatusCode);
            return new List<YouTubePlaylistVideo>();
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        var payload = await JsonSerializer.DeserializeAsync<YouTubePlaylistResponse>(
            stream,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true },
            cancellationToken);

        return payload?.Items?
            .Select(item => new YouTubePlaylistVideo
            {
                VideoId = item.ContentDetails?.VideoId ?? item.Snippet?.ResourceId?.VideoId ?? string.Empty,
                Title = item.Snippet?.Title ?? string.Empty,
                Description = item.Snippet?.Description ?? string.Empty,
                PrivacyStatus = item.Status?.PrivacyStatus ?? string.Empty,
                VideoPublishedAt = item.ContentDetails?.VideoPublishedAt
            })
            .Where(item => !string.IsNullOrWhiteSpace(item.VideoId) && !string.IsNullOrWhiteSpace(item.Title))
            .ToList() ?? new List<YouTubePlaylistVideo>();
    }

    private static bool IsEligible(
        YouTubePlaylistVideo item,
        YouTubePodcastSourceOptions source)
    {
        if (!item.PrivacyStatus.Equals("public", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (source.PublishedAfterUtc.HasValue
            && item.VideoPublishedAt < source.PublishedAfterUtc.Value.ToUniversalTime())
        {
            return false;
        }

        var requiredTerms = source.RequiredTerms
            .Where(term => !string.IsNullOrWhiteSpace(term))
            .Select(term => term.Trim())
            .ToList();

        if (requiredTerms.Count == 0)
        {
            return true;
        }

        var searchableText = $"{item.Title}\n{item.Description}";
        return requiredTerms.Any(term =>
            searchableText.Contains(term, StringComparison.OrdinalIgnoreCase));
    }

    private static int ExtractEpisodeNumber(string title)
    {
        var match = EpisodeNumberRegex.Match(title);
        return match.Success && int.TryParse(match.Groups[1].Value, out var episodeNumber)
            ? episodeNumber
            : 0;
    }

    private static string? ExtractYouTubeVideoId(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return null;
        }

        var patterns = new[]
        {
            @"[?&]v=([A-Za-z0-9_-]{11})",
            @"youtu\.be/([A-Za-z0-9_-]{11})",
            @"youtube\.com/embed/([A-Za-z0-9_-]{11})",
            @"youtube\.com/shorts/([A-Za-z0-9_-]{11})"
        };

        foreach (var pattern in patterns)
        {
            var match = Regex.Match(url, pattern, RegexOptions.IgnoreCase);
            if (match.Success)
            {
                return match.Groups[1].Value;
            }
        }

        return null;
    }

    private static string Truncate(string value, int maxLength) =>
        value.Length <= maxLength ? value : value[..maxLength];

    private sealed class YouTubePlaylistResponse
    {
        public List<YouTubePlaylistItem>? Items { get; set; }
    }

    private sealed class YouTubePlaylistItem
    {
        public YouTubePlaylistSnippet? Snippet { get; set; }
        public YouTubePlaylistContentDetails? ContentDetails { get; set; }
        public YouTubePlaylistStatus? Status { get; set; }
    }

    private sealed class YouTubePlaylistSnippet
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public YouTubeResourceId? ResourceId { get; set; }
    }

    private sealed class YouTubeResourceId
    {
        public string? VideoId { get; set; }
    }

    private sealed class YouTubePlaylistContentDetails
    {
        public string? VideoId { get; set; }
        public DateTime? VideoPublishedAt { get; set; }
    }

    private sealed class YouTubePlaylistStatus
    {
        public string? PrivacyStatus { get; set; }
    }

    private sealed class YouTubePlaylistVideo
    {
        public string VideoId { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string PrivacyStatus { get; set; } = string.Empty;
        public DateTime? VideoPublishedAt { get; set; }
    }
}
