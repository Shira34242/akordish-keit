using System;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using AkordishKeit.Models.DTOs;
using Microsoft.Extensions.Configuration;

namespace AkordishKeit.Services;

public interface IYouTubeService
{
    Task<YouTubeMetadataDto> GetVideoMetadataAsync(string youtubeUrl);
    string? ExtractVideoId(string youtubeUrl);
}

public class YouTubeService : IYouTubeService
{
    private readonly HttpClient _httpClient;
    private readonly string? _apiKey;

    public YouTubeService(HttpClient httpClient, IConfiguration configuration)
    {
        _httpClient = httpClient;
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
                // אם אין API Key, נחזיר מידע בסיסי בלבד
                return new YouTubeMetadataDto
                {
                    Success = true,
                    ThumbnailUrl = $"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg",
                    ErrorMessage = "API Key לא מוגדר - רק תמונה זמינה"
                };
            }

            // 3. קריאה ל-YouTube Data API
            var apiUrl = $"https://www.googleapis.com/youtube/v3/videos?id={videoId}&key={_apiKey}&part=snippet,contentDetails";

            var response = await _httpClient.GetAsync(apiUrl);

            if (!response.IsSuccessStatusCode)
            {
                return new YouTubeMetadataDto
                {
                    Success = false,
                    ThumbnailUrl = $"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg",
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

            return new YouTubeMetadataDto
            {
                Success = true,
                Title = snippet?.Title,
                ChannelTitle = snippet?.ChannelTitle,
                ThumbnailUrl = snippet?.Thumbnails?.Maxres?.Url
                    ?? snippet?.Thumbnails?.High?.Url
                    ?? $"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg",
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
            return new YouTubeMetadataDto
            {
                Success = false,
                ThumbnailUrl = !string.IsNullOrEmpty(videoId)
                    ? $"https://img.youtube.com/vi/{videoId}/maxresdefault.jpg"
                    : null,
                ErrorMessage = $"שגיאה: {ex.Message}"
            };
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
            @"youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})"
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

    // ============================================
    // YouTube API Response Classes
    // ============================================

    private class YouTubeApiResponse
    {
        public List<YouTubeVideoItem>? Items { get; set; }
    }

    private class YouTubeVideoItem
    {
        public VideoSnippet? Snippet { get; set; }
        public VideoContentDetails? ContentDetails { get; set; }
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