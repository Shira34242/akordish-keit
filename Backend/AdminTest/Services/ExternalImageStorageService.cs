using System.Text.RegularExpressions;

namespace AkordishKeit.Services;

public class ExternalImageStorageService : IExternalImageStorageService
{
    private const long MaxImageBytes = 10 * 1024 * 1024;

    private readonly HttpClient _httpClient;
    private readonly IAzureBlobService _blobService;
    private readonly ILogger<ExternalImageStorageService> _logger;

    public ExternalImageStorageService(
        HttpClient httpClient,
        IAzureBlobService blobService,
        ILogger<ExternalImageStorageService> logger)
    {
        _httpClient = httpClient;
        _blobService = blobService;
        _logger = logger;
    }

    public async Task<string?> StoreExternalImageIfNeededAsync(string? imageUrl, string folder, string fallbackFileNamePrefix)
    {
        var url = imageUrl?.Trim();
        if (string.IsNullOrWhiteSpace(url))
            return null;

        if (url.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
            return await StoreDataImageAsync(url, folder, fallbackFileNamePrefix);

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return url;

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            return url;

        if (IsAlreadyStoredMedia(uri))
            return url;

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.UserAgent.ParseAdd("AkordishKeit/1.0");
            request.Headers.Accept.ParseAdd("image/avif,image/webp,image/*,*/*;q=0.8");

            using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("External image import skipped. Status={StatusCode}, Url={Url}", response.StatusCode, url);
                return url;
            }

            var mediaType = response.Content.Headers.ContentType?.MediaType?.ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(mediaType) || !mediaType.StartsWith("image/"))
                return url;

            var contentLength = response.Content.Headers.ContentLength;
            if (contentLength.HasValue && contentLength.Value > MaxImageBytes)
            {
                _logger.LogWarning("External image import skipped because file is too large. Size={Size}, Url={Url}", contentLength.Value, url);
                return url;
            }

            await using var stream = await response.Content.ReadAsStreamAsync();
            var extension = GetExtension(mediaType, uri.AbsolutePath);
            var safePrefix = SanitizeFileNamePrefix(fallbackFileNamePrefix);
            var fileName = $"{safePrefix}_{DateTime.UtcNow:yyyyMMddHHmmss}{extension}";
            var storedUrl = await _blobService.UploadAsync(stream, fileName, mediaType, folder);

            return storedUrl ?? url;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "External image import failed. Url={Url}", url);
            return url;
        }
    }

    private async Task<string> StoreDataImageAsync(string dataUrl, string folder, string fallbackFileNamePrefix)
    {
        var commaIndex = dataUrl.IndexOf(',');
        if (commaIndex <= 5)
            throw new InvalidOperationException("תמונת Base64 אינה תקינה.");

        var metadata = dataUrl[..commaIndex];
        if (!metadata.EndsWith(";base64", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("פורמט תמונת Base64 אינו נתמך.");

        var mediaType = metadata[5..^7].ToLowerInvariant();
        if (!mediaType.StartsWith("image/", StringComparison.Ordinal))
            throw new InvalidOperationException("הקובץ שסופק אינו תמונה.");

        var base64 = dataUrl[(commaIndex + 1)..];
        if (base64.Length > ((MaxImageBytes + 2) / 3) * 4)
            throw new InvalidOperationException("התמונה גדולה מדי. הגודל המרבי הוא 10MB.");

        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(base64);
        }
        catch (FormatException)
        {
            throw new InvalidOperationException("תמונת Base64 אינה תקינה.");
        }

        if (bytes.LongLength > MaxImageBytes)
            throw new InvalidOperationException("התמונה גדולה מדי. הגודל המרבי הוא 10MB.");

        await using var stream = new MemoryStream(bytes, writable: false);
        var extension = GetExtension(mediaType, string.Empty);
        var safePrefix = SanitizeFileNamePrefix(fallbackFileNamePrefix);
        var fileName = $"{safePrefix}_{DateTime.UtcNow:yyyyMMddHHmmss}{extension}";
        var storedUrl = await _blobService.UploadAsync(stream, fileName, mediaType, folder);

        return storedUrl
            ?? throw new InvalidOperationException("לא ניתן היה לשמור את התמונה שהועלתה.");
    }

    private static bool IsAlreadyStoredMedia(Uri uri)
    {
        return uri.Host.EndsWith("blob.core.windows.net", StringComparison.OrdinalIgnoreCase)
            || uri.Host.Equals("akordishkaytmedia.blob.core.windows.net", StringComparison.OrdinalIgnoreCase);
    }

    private static string GetExtension(string mediaType, string path)
    {
        return mediaType switch
        {
            "image/png" => ".png",
            "image/webp" => ".webp",
            "image/avif" => ".avif",
            "image/gif" => ".gif",
            "image/svg+xml" => ".svg",
            _ => Path.GetExtension(path).ToLowerInvariant() switch
            {
                ".png" => ".png",
                ".webp" => ".webp",
                ".avif" => ".avif",
                ".gif" => ".gif",
                ".svg" => ".svg",
                _ => ".jpg"
            }
        };
    }

    private static string SanitizeFileNamePrefix(string value)
    {
        var clean = Regex.Replace(value.Trim().ToLowerInvariant(), @"[^a-z0-9_-]+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(clean) ? "external-image" : clean;
    }
}
