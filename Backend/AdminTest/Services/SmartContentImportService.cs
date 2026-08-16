using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public class SmartContentImportService : ISmartContentImportService
{
    private readonly HttpClient _httpClient;
    private readonly IYouTubeService _youTubeService;

    public SmartContentImportService(HttpClient httpClient, IYouTubeService youTubeService)
    {
        _httpClient = httpClient;
        _youTubeService = youTubeService;
    }

    public async Task<ImportContentFromUrlResponseDto> ImportFromUrlAsync(string sourceUrl, string contentType)
    {
        if (!Uri.TryCreate(sourceUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return Fail(sourceUrl, "הקישור לא תקין", new[] { "url" });
        }

        var normalizedType = NormalizeContentType(contentType);
        if (normalizedType is null)
        {
            return Fail(sourceUrl, "סוג התוכן לא נתמך", new[] { "contentType" });
        }

        var draft = await ExtractDraftAsync(uri, normalizedType);
        var missingFields = GetMissingFields(draft);

        return new ImportContentFromUrlResponseDto
        {
            Success = missingFields.Count == 0,
            Message = missingFields.Count == 0
                ? "שלפנו נתונים לטיוטה. אפשר לפתוח את הטופס ולהשלים ידנית."
                : "שלפנו מה שאפשר, אבל חסרים פרטים שכדאי להשלים בטופס.",
            SourceUrl = sourceUrl,
            Draft = draft,
            MissingFields = missingFields
        };
    }

    private async Task<ImportedContentDraftDto> ExtractDraftAsync(Uri uri, string contentType)
    {
        var sourceUrl = uri.ToString();

        if (IsYouTubeUrl(uri))
        {
            var metadata = await _youTubeService.GetVideoMetadataAsync(sourceUrl);
            if (metadata.Success)
            {
                return new ImportedContentDraftDto
                {
                    ContentType = contentType,
                    Title = CleanTitle(metadata.Title) ?? "תוכן מיובא",
                    Description = CleanDescription(metadata.Description),
                    ImageUrl = metadata.ThumbnailUrl,
                    SourceUrl = sourceUrl,
                    Platform = "YouTube",
                    PublishedAt = metadata.PublishedAt
                };
            }
        }

        var html = await FetchHtmlAsync(uri);
        var eventDetails = contentType == "event" && IsTickchakUrl(uri)
            ? ExtractTickchakEventDetails(html)
            : null;
        var title = CleanTitle(
            eventDetails?.Title
            ?? ExtractMeta(html, "og:title")
            ?? ExtractMeta(html, "twitter:title")
            ?? ExtractTagText(html, "h1")
            ?? ExtractTitleTag(html)
            ?? uri.Host);
        var description = CleanDescription(
            ExtractMeta(html, "og:description")
            ?? ExtractMeta(html, "twitter:description")
            ?? ExtractMeta(html, "description")
            ?? ExtractFirstParagraph(html));
        var imageUrl = AbsolutizeUrl(
            eventDetails?.ImageUrl
            ?? ExtractMeta(html, "og:image")
            ?? ExtractMeta(html, "twitter:image"),
            uri);
        var publishedAt = eventDetails?.StartDate ?? ExtractPublishedAt(html);

        return new ImportedContentDraftDto
        {
            ContentType = contentType,
            Title = title ?? "תוכן מיובא",
            Description = description,
            ImageUrl = imageUrl,
            SourceUrl = sourceUrl,
            Platform = DetectPlatform(uri),
            PublishedAt = publishedAt,
            Location = eventDetails?.Location,
            ArtistName = eventDetails?.ArtistName
        };
    }

    private async Task<string> FetchHtmlAsync(Uri uri)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            request.Headers.Accept.ParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            request.Headers.AcceptLanguage.ParseAdd("he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7");

            using var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return string.Empty;
            }

            var contentType = response.Content.Headers.ContentType?.MediaType;
            if (!string.IsNullOrWhiteSpace(contentType) &&
                !contentType.Contains("html", StringComparison.OrdinalIgnoreCase))
            {
                return string.Empty;
            }

            var bytes = await response.Content.ReadAsByteArrayAsync();
            var html = DecodeHtml(bytes, response.Content.Headers.ContentType?.CharSet);
            return html.Length > 1_000_000 ? html[..1_000_000] : html;
        }
        catch
        {
            return string.Empty;
        }
    }

    private static string? NormalizeContentType(string value)
    {
        var normalized = value.Trim().ToLowerInvariant();
        return normalized switch
        {
            "article" => "article",
            "music-news" => "music-news",
            "event" => "event",
            "podcast" => "podcast",
            _ => null
        };
    }

    private static List<string> GetMissingFields(ImportedContentDraftDto draft)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(draft.Title)) missing.Add("כותרת");
        if (string.IsNullOrWhiteSpace(draft.Description)) missing.Add("תיאור");
        if (string.IsNullOrWhiteSpace(draft.ImageUrl)) missing.Add("תמונה");
        if (draft.ContentType == "event" && !draft.PublishedAt.HasValue) missing.Add("תאריך הופעה");
        return missing;
    }

    private static string DecodeHtml(byte[] bytes, string? charset)
    {
        if (!string.IsNullOrWhiteSpace(charset) &&
            (charset.Contains("1255", StringComparison.OrdinalIgnoreCase) ||
             charset.Contains("8859-8", StringComparison.OrdinalIgnoreCase) ||
             charset.Contains("hebrew", StringComparison.OrdinalIgnoreCase)))
        {
            return DecodeWindowsHebrew(bytes);
        }

        return Encoding.UTF8.GetString(bytes);
    }

    private static string DecodeWindowsHebrew(byte[] bytes)
    {
        var chars = new char[bytes.Length];
        for (var i = 0; i < bytes.Length; i++)
        {
            var b = bytes[i];
            chars[i] = b switch
            {
                >= 0xE0 and <= 0xFA => (char)('\u05D0' + (b - 0xE0)),
                0xAA => '\u00D7',
                0xBA => '\u00F7',
                0xDF => '\u2017',
                0xFD => '\u200E',
                0xFE => '\u200F',
                _ => (char)b
            };
        }

        return new string(chars);
    }

    private static string? ExtractMeta(string html, string name)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;

        var escaped = Regex.Escape(name);
        var patterns = new[]
        {
            $@"<meta\b[^>]*(?:property|name)=[""']{escaped}[""'][^>]*content=[""'](?<content>.*?)[""'][^>]*>",
            $@"<meta\b[^>]*content=[""'](?<content>.*?)[""'][^>]*(?:property|name)=[""']{escaped}[""'][^>]*>"
        };

        foreach (var pattern in patterns)
        {
            var match = Regex.Match(html, pattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (match.Success)
            {
                return WebUtility.HtmlDecode(match.Groups["content"].Value).Trim();
            }
        }

        return null;
    }

    private static string? ExtractTagText(string html, string tag)
    {
        var match = Regex.Match(html, $@"<{tag}\b[^>]*>(?<text>.*?)</{tag}>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        return match.Success ? HtmlToText(match.Groups["text"].Value) : null;
    }

    private static string? ExtractTitleTag(string html) => ExtractTagText(html, "title");

    private static string? ExtractFirstParagraph(string html)
    {
        var paragraphs = Regex.Matches(html, @"<p\b[^>]*>(?<text>.*?)</p>", RegexOptions.IgnoreCase | RegexOptions.Singleline)
            .Select(match => HtmlToText(match.Groups["text"].Value))
            .Where(text => text.Length >= 25)
            .ToList();

        return paragraphs.FirstOrDefault();
    }

    private static DateTime? ExtractPublishedAt(string html)
    {
        var value = ExtractMeta(html, "article:published_time")
            ?? ExtractMeta(html, "og:updated_time")
            ?? ExtractMeta(html, "date")
            ?? ExtractMeta(html, "pubdate");

        return DateTime.TryParse(value, out var parsed) ? parsed : null;
    }

    private static TickchakEventDetails? ExtractTickchakEventDetails(string html)
    {
        foreach (Match script in Regex.Matches(html,
                     @"<script\b[^>]*type=[""']application/ld\+json[""'][^>]*>(?<json>.*?)</script>",
                     RegexOptions.IgnoreCase | RegexOptions.Singleline))
        {
            try
            {
                using var document = JsonDocument.Parse(WebUtility.HtmlDecode(script.Groups["json"].Value));
                foreach (var item in EnumerateJsonLdItems(document.RootElement))
                {
                    if (!item.TryGetProperty("@type", out var type) ||
                        !string.Equals(type.GetString(), "Event", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    var title = GetJsonString(item, "name");
                    var startDate = GetJsonDate(item, "startDate");
                    var imageUrl = GetJsonImage(item);
                    var location = GetTickchakLocation(item);
                    var artistName = GetTickchakPerformers(item);

                    if (title is not null || startDate.HasValue || location is not null || artistName is not null)
                    {
                        return new TickchakEventDetails(title, startDate, imageUrl, location, artistName);
                    }
                }
            }
            catch (JsonException)
            {
                // A malformed JSON-LD block should not prevent the generic importer from working.
            }
        }

        return null;
    }

    private static IEnumerable<JsonElement> EnumerateJsonLdItems(JsonElement root) => root.ValueKind switch
    {
        JsonValueKind.Array => root.EnumerateArray(),
        JsonValueKind.Object => new[] { root },
        _ => Array.Empty<JsonElement>()
    };

    private static string? GetJsonString(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String
            ? property.GetString()?.Trim()
            : null;

    private static DateTime? GetJsonDate(JsonElement element, string propertyName)
    {
        var value = GetJsonString(element, propertyName);
        // Keep the event's published local date/time rather than converting it to the server timezone.
        return DateTimeOffset.TryParse(value, out var date) ? date.DateTime : null;
    }

    private static string? GetJsonImage(JsonElement eventData)
    {
        if (!eventData.TryGetProperty("image", out var image)) return null;
        return image.ValueKind switch
        {
            JsonValueKind.String => image.GetString(),
            JsonValueKind.Array => image.EnumerateArray().FirstOrDefault(item => item.ValueKind == JsonValueKind.String).GetString(),
            _ => null
        };
    }

    private static string? GetTickchakLocation(JsonElement eventData)
    {
        if (!eventData.TryGetProperty("location", out var location) || location.ValueKind != JsonValueKind.Object) return null;
        if (location.TryGetProperty("address", out var address) && address.ValueKind == JsonValueKind.Object)
        {
            return GetJsonString(address, "addressLocality") ?? GetJsonString(address, "streetAddress");
        }

        return GetJsonString(location, "name");
    }

    private static string? GetTickchakPerformers(JsonElement eventData)
    {
        if (!eventData.TryGetProperty("performer", out var performers)) return null;

        var names = performers.ValueKind == JsonValueKind.Array
            ? performers.EnumerateArray().Select(performer => GetJsonString(performer, "name"))
            : new[] { GetJsonString(performers, "name") };

        var joined = string.Join(" / ", names.Where(name => !string.IsNullOrWhiteSpace(name)).Distinct());
        return string.IsNullOrWhiteSpace(joined) ? null : joined;
    }

    private sealed record TickchakEventDetails(string? Title, DateTime? StartDate, string? ImageUrl, string? Location, string? ArtistName);

    private static string? CleanTitle(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var clean = WebUtility.HtmlDecode(value);
        clean = Regex.Replace(clean, @"\s+", " ").Trim();
        clean = clean.Split('|', StringSplitOptions.RemoveEmptyEntries)[0].Trim();
        return clean.Length > 180 ? clean[..180].Trim() : clean;
    }

    private static string? CleanDescription(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var clean = HtmlToText(value);
        clean = Regex.Replace(clean, @"\s+", " ").Trim();
        return clean.Length > 900 ? clean[..900].Trim() : clean;
    }

    private static string HtmlToText(string html)
    {
        var text = Regex.Replace(html, @"<script\b[^>]*>.*?</script>", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        text = Regex.Replace(text, @"<style\b[^>]*>.*?</style>", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        text = Regex.Replace(text, @"<(br|p|div|li|tr|h[1-6])\b[^>]*>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"<[^>]+>", " ");
        text = WebUtility.HtmlDecode(text);
        text = Regex.Replace(text, @"[ \t]+", " ");
        text = Regex.Replace(text, @"\n\s+", "\n");
        text = Regex.Replace(text, @"\n{3,}", "\n\n");
        return text.Trim();
    }

    private static string? AbsolutizeUrl(string? value, Uri baseUri)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        return Uri.TryCreate(baseUri, value, out var absolute) ? absolute.ToString() : value;
    }

    private static bool IsYouTubeUrl(Uri uri) =>
        uri.Host.Contains("youtube.com", StringComparison.OrdinalIgnoreCase) ||
        uri.Host.Contains("youtu.be", StringComparison.OrdinalIgnoreCase);

    private static bool IsTickchakUrl(Uri uri) =>
        uri.Host.Equals("tickchak.co.il", StringComparison.OrdinalIgnoreCase) ||
        uri.Host.EndsWith(".tickchak.co.il", StringComparison.OrdinalIgnoreCase);

    private static string DetectPlatform(Uri uri)
    {
        var host = uri.Host.ToLowerInvariant();
        if (host.Contains("youtube")) return "YouTube";
        if (host.Contains("youtu.be")) return "YouTube";
        if (host.Contains("spotify")) return "Spotify";
        if (host.Contains("apple")) return "Apple Podcasts";
        return uri.Host.Replace("www.", "", StringComparison.OrdinalIgnoreCase);
    }

    private static ImportContentFromUrlResponseDto Fail(string sourceUrl, string message, IEnumerable<string> missingFields) =>
        new()
        {
            Success = false,
            Message = message,
            SourceUrl = sourceUrl,
            MissingFields = missingFields.ToList()
        };
}
