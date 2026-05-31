using System;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using AkordishKeit.Models.DTOs;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace AkordishKeit.Services;

public interface IYouTubeService
{
    Task<YouTubeMetadataDto> GetVideoMetadataAsync(string youtubeUrl);
    Task<List<YouTubeSearchResultDto>> SearchVideosAsync(string query, int maxResults = 5);
    Task<string?> StoreYouTubeThumbnailAsync(string youtubeUrlOrThumbnailUrl);
    string? ExtractVideoId(string youtubeUrl);
}

public class YouTubeService : IYouTubeService
{
    private readonly HttpClient _httpClient;
    private readonly IAzureBlobService _blobService;
    private readonly ILogger<YouTubeService> _logger;
    private readonly string? _apiKey;

    public YouTubeService(
        HttpClient httpClient,
        IConfiguration configuration,
        IAzureBlobService blobService,
        ILogger<YouTubeService> logger)
    {
        _httpClient = httpClient;
        _blobService = blobService;
        _logger = logger;
        _apiKey = configuration["YouTube:ApiKey"];
    }

    /// <summary>
    /// שליפת מטא-דאטה מסרטון YouTube
    /// </summary>
    public async Task<YouTubeMetadataDto> GetVideoMetadataAsync(string youtubeUrl)
    {
        try
        {
            // 1. חילוץ Video ID מה-URL
            var videoId = ExtractVideoId(youtubeUrl);
            if (string.IsNullOrEmpty(videoId))
            {
                return new YouTubeMetadataDto
                {
                    Success = false,
                    ErrorMessage = "לא ניתן לחלץ Video ID מהקישור"
                };
            }

            // 2. בדיקה אם יש API Key
            if (string.IsNullOrEmpty(_apiKey))
            {
                var thumbnailUrl = await StoreYouTubeThumbnailAsync($"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg")
                    ?? await StoreYouTubeThumbnailAsync($"https://img.youtube.com/vi/{videoId}/hqdefault.jpg")
                    ?? $"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg";

                // אם אין API Key, נחזיר מידע בסיסי בלבד
                return new YouTubeMetadataDto
                {
                    Success = true,
                    ThumbnailUrl = thumbnailUrl,
                    ErrorMessage = "API Key לא מוגדר - רק תמונה זמינה"
                };
            }

            // 3. קריאה ל-YouTube Data API
            var apiUrl = $"https://www.googleapis.com/youtube/v3/videos?id={videoId}&key={_apiKey}&part=snippet,contentDetails";

            var response = await _httpClient.GetAsync(apiUrl);

            if (!response.IsSuccessStatusCode)
            {
                var thumbnailUrl = await StoreYouTubeThumbnailAsync($"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg")
                    ?? await StoreYouTubeThumbnailAsync($"https://img.youtube.com/vi/{videoId}/hqdefault.jpg")
                    ?? $"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg";

                return new YouTubeMetadataDto
                {
                    Success = false,
                    ThumbnailUrl = thumbnailUrl,
                    ErrorMessage = "שגיאה בקריאה ל-YouTube API"
                };
            }

            var jsonString = await response.Content.ReadAsStringAsync();
            var youtubeResponse = JsonSerializer.Deserialize<YouTubeApiResponse>(jsonString, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (youtubeResponse?.Items == null || youtubeResponse.Items.Count == 0)
            {
                return new YouTubeMetadataDto
                {
                    Success = false,
                    ErrorMessage = "הסרטון לא נמצא ב-YouTube"
                };
            }

            var item = youtubeResponse.Items[0];
            var snippet = item.Snippet;
            var contentDetails = item.ContentDetails;

            // 4. המרת Duration מפורמט ISO 8601
            var durationSeconds = ParseIsoDuration(contentDetails?.Duration);
            var rawThumbnailUrl = snippet?.Thumbnails?.Maxres?.Url
                ?? snippet?.Thumbnails?.High?.Url
                ?? $"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg";
            var storedThumbnailUrl = await StoreYouTubeThumbnailAsync(rawThumbnailUrl)
                ?? await StoreYouTubeThumbnailAsync($"https://img.youtube.com/vi/{videoId}/hqdefault.jpg")
                ?? rawThumbnailUrl;

            return new YouTubeMetadataDto
            {
                Success = true,
                Title = snippet?.Title,
                ChannelTitle = snippet?.ChannelTitle,
                ThumbnailUrl = storedThumbnailUrl,
                DurationSeconds = durationSeconds,
                Description = snippet?.Description,
                PublishedAt = snippet?.PublishedAt
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error fetching YouTube metadata: {ex.Message}");

            // במקרה של שגיאה, לפחות נחזיר תמונה
            var videoId = ExtractVideoId(youtubeUrl);
            var thumbnailUrl = !string.IsNullOrEmpty(videoId)
                ? await StoreYouTubeThumbnailAsync($"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg")
                    ?? await StoreYouTubeThumbnailAsync($"https://img.youtube.com/vi/{videoId}/hqdefault.jpg")
                    ?? $"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg"
                : null;

            return new YouTubeMetadataDto
            {
                Success = false,
                ThumbnailUrl = thumbnailUrl,
                ErrorMessage = $"שגיאה: {ex.Message}"
            };
        }
    }

    public async Task<string?> StoreYouTubeThumbnailAsync(string youtubeUrlOrThumbnailUrl)
    {
        var thumbnailUrl = BuildThumbnailUrl(youtubeUrlOrThumbnailUrl);
        if (string.IsNullOrWhiteSpace(thumbnailUrl))
            return null;

        if (!IsYouTubeThumbnailHost(thumbnailUrl))
            return thumbnailUrl;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, thumbnailUrl);
            request.Headers.UserAgent.ParseAdd("AkordishKeit/1.0");
            request.Headers.Accept.ParseAdd("image/avif,image/webp,image/*,*/*;q=0.8");

            using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            if (!response.IsSuccessStatusCode)
                return null;

            var mediaType = response.Content.Headers.ContentType?.MediaType?.ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(mediaType) || !mediaType.StartsWith("image/"))
                return null;

            var contentLength = response.Content.Headers.ContentLength;
            if (contentLength.HasValue && contentLength.Value > 10 * 1024 * 1024)
                return null;

            await using var stream = await response.Content.ReadAsStreamAsync();
            var videoId = ExtractVideoId(thumbnailUrl) ?? "youtube";
            var extension = mediaType switch
            {
                "image/png" => ".png",
                "image/webp" => ".webp",
                "image/gif" => ".gif",
                _ => ".jpg"
            };

            var fileName = $"youtube_{videoId}_{DateTime.UtcNow:yyyyMMddHHmmss}{extension}";
            return await _blobService.UploadAsync(stream, fileName, mediaType, "uploads/youtube-thumbnails");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not store YouTube thumbnail locally: {ThumbnailUrl}", thumbnailUrl);
            return null;
        }
    }

    /// <summary>
    /// חיפוש סרטונים ב-YouTube לפי שם שיר
    /// </summary>
    public async Task<List<YouTubeSearchResultDto>> SearchVideosAsync(string query, int maxResults = 5)
    {
        if (string.IsNullOrWhiteSpace(query) || string.IsNullOrWhiteSpace(_apiKey))
        {
            return new List<YouTubeSearchResultDto>();
        }

        try
        {
            var safeMaxResults = Math.Clamp(maxResults, 1, 8);
            var encodedQuery = Uri.EscapeDataString(query.Trim());
            var searchUrl =
                $"https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults={safeMaxResults}&q={encodedQuery}&key={_apiKey}";

            var searchResponse = await _httpClient.GetAsync(searchUrl);
            if (!searchResponse.IsSuccessStatusCode)
            {
                return new List<YouTubeSearchResultDto>();
            }

            var searchJson = await searchResponse.Content.ReadAsStringAsync();
            var searchResult = JsonSerializer.Deserialize<YouTubeSearchApiResponse>(searchJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            var videoIds = searchResult?.Items?
                .Select(item => item.Id?.VideoId)
                .Where(videoId => !string.IsNullOrWhiteSpace(videoId))
                .Distinct()
                .ToList();

            if (videoIds == null || videoIds.Count == 0)
            {
                return new List<YouTubeSearchResultDto>();
            }

            var videosUrl =
                $"https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id={string.Join(",", videoIds)}&key={_apiKey}";

            var videosResponse = await _httpClient.GetAsync(videosUrl);
            if (!videosResponse.IsSuccessStatusCode)
            {
                return new List<YouTubeSearchResultDto>();
            }

            var videosJson = await videosResponse.Content.ReadAsStringAsync();
            var videosResult = JsonSerializer.Deserialize<YouTubeApiResponse>(videosJson, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            var videosById = videosResult?.Items?
                .Where(item => !string.IsNullOrWhiteSpace(item.Id))
                .ToDictionary(item => item.Id!, item => item)
                ?? new Dictionary<string, YouTubeVideoItem>();

            var results = new List<YouTubeSearchResultDto>();

            foreach (var videoId in videoIds)
            {
                if (string.IsNullOrWhiteSpace(videoId) || !videosById.TryGetValue(videoId, out var item))
                {
                    continue;
                }

                var snippet = item.Snippet;

                results.Add(new YouTubeSearchResultDto
                {
                    VideoId = videoId,
                    YoutubeUrl = $"https://www.youtube.com/watch?v={videoId}",
                    Title = snippet?.Title,
                    ChannelTitle = snippet?.ChannelTitle,
                    ThumbnailUrl = snippet?.Thumbnails?.High?.Url
                        ?? snippet?.Thumbnails?.Medium?.Url
                        ?? snippet?.Thumbnails?.Default?.Url
                        ?? $"https://img.youtube.com/vi/{videoId}/hqdefault.jpg",
                    DurationSeconds = ParseIsoDuration(item.ContentDetails?.Duration),
                    Description = snippet?.Description,
                    PublishedAt = snippet?.PublishedAt,
                    SuggestedArtistName = ExtractSuggestedArtistName(snippet?.ChannelTitle, snippet?.Title)
                });
            }

            return results;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error searching YouTube videos: {ex.Message}");
            return new List<YouTubeSearchResultDto>();
        }
    }

    /// <summary>
    /// חילוץ Video ID מכתובת YouTube
    /// </summary>
    public string? ExtractVideoId(string youtubeUrl)
    {
        if (string.IsNullOrWhiteSpace(youtubeUrl))
            return null;

        // תבניות שונות של YouTube URLs:
        // 1. https://www.youtube.com/watch?v=VIDEO_ID
        // 2. https://youtu.be/VIDEO_ID
        // 3. https://www.youtube.com/embed/VIDEO_ID
        // 4. https://www.youtube.com/v/VIDEO_ID

        var patterns = new[]
        {
            @"(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})",
            @"youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})",
            @"(?:img\.youtube\.com|i\.ytimg\.com)\/vi\/([a-zA-Z0-9_-]{11})\/"
        };

        foreach (var pattern in patterns)
        {
            var match = Regex.Match(youtubeUrl, pattern);
            if (match.Success)
            {
                return match.Groups[1].Value;
            }
        }

        return null;
    }

    private string? BuildThumbnailUrl(string youtubeUrlOrThumbnailUrl)
    {
        if (string.IsNullOrWhiteSpace(youtubeUrlOrThumbnailUrl))
            return null;

        if (IsYouTubeThumbnailHost(youtubeUrlOrThumbnailUrl))
            return youtubeUrlOrThumbnailUrl;

        var videoId = ExtractVideoId(youtubeUrlOrThumbnailUrl);
        return string.IsNullOrWhiteSpace(videoId)
            ? null
            : $"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg";
    }

    private static bool IsYouTubeThumbnailHost(string url)
    {
        return Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && (uri.Host.Equals("img.youtube.com", StringComparison.OrdinalIgnoreCase)
                || uri.Host.Equals("i.ytimg.com", StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// המרת ISO 8601 Duration לשניות
    /// דוגמה: PT4M13S = 253 שניות (4*60 + 13)
    /// </summary>
    private int? ParseIsoDuration(string? duration)
    {
        if (string.IsNullOrEmpty(duration))
            return null;

        try
        {
            // דוגמה: PT1H2M30S = 1 hour, 2 minutes, 30 seconds
            var match = Regex.Match(duration, @"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?");

            if (!match.Success)
                return null;

            var hours = !string.IsNullOrEmpty(match.Groups[1].Value) ? int.Parse(match.Groups[1].Value) : 0;
            var minutes = !string.IsNullOrEmpty(match.Groups[2].Value) ? int.Parse(match.Groups[2].Value) : 0;
            var seconds = !string.IsNullOrEmpty(match.Groups[3].Value) ? int.Parse(match.Groups[3].Value) : 0;

            return (hours * 3600) + (minutes * 60) + seconds;
        }
        catch
        {
            return null;
        }
    }

    private string? ExtractSuggestedArtistName(string? channelTitle, string? videoTitle)
    {
        var candidate = channelTitle?.Trim();

        if (string.IsNullOrWhiteSpace(candidate) && !string.IsNullOrWhiteSpace(videoTitle))
        {
            candidate = videoTitle
                .Split(new[] { " - ", " – ", " — " }, StringSplitOptions.None)
                .FirstOrDefault()?.Trim();
        }

        if (string.IsNullOrWhiteSpace(candidate))
        {
            return null;
        }

        candidate = Regex.Replace(candidate, @"\s*-\s*Topic$", string.Empty, RegexOptions.IgnoreCase).Trim();
        candidate = Regex.Replace(candidate, @"\s*\(Official.*?\)$", string.Empty, RegexOptions.IgnoreCase).Trim();
        candidate = Regex.Replace(candidate, @"\s*\[Official.*?\]$", string.Empty, RegexOptions.IgnoreCase).Trim();

        return string.IsNullOrWhiteSpace(candidate) ? null : candidate;
    }

    // ============================================
    // YouTube API Response Classes
    // ============================================

    private class YouTubeApiResponse
    {
        public List<YouTubeVideoItem>? Items { get; set; }
    }

    private class YouTubeVideoItem
    {
        public string? Id { get; set; }
        public VideoSnippet? Snippet { get; set; }
        public VideoContentDetails? ContentDetails { get; set; }
    }

    private class YouTubeSearchApiResponse
    {
        public List<YouTubeSearchItem>? Items { get; set; }
    }

    private class YouTubeSearchItem
    {
        public SearchResourceId? Id { get; set; }
    }

    private class SearchResourceId
    {
        public string? VideoId { get; set; }
    }

    private class VideoSnippet
    {
        public string? Title { get; set; }
        public string? ChannelTitle { get; set; }
        public string? Description { get; set; }
        public DateTime? PublishedAt { get; set; }
        public ThumbnailSet? Thumbnails { get; set; }
    }

    private class VideoContentDetails
    {
        public string? Duration { get; set; } // ISO 8601 format
    }

    private class ThumbnailSet
    {
        public Thumbnail? Maxres { get; set; }
        public Thumbnail? High { get; set; }
        public Thumbnail? Medium { get; set; }
        public Thumbnail? Default { get; set; }
    }

    private class Thumbnail
    {
        public string? Url { get; set; }
    }
}
