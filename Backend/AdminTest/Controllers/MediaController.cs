using AkordishKeit.Data;
using AkordishKeit.Models.Entities;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MediaController : ControllerBase
    {
        private readonly IAzureBlobService _blobService;
        private readonly HttpClient _httpClient;
        private readonly IWebHostEnvironment _environment;
        private readonly IConfiguration _configuration;
        private readonly AkordishKeitDbContext _context;
        private readonly IYouTubeService _youTubeService;
        private readonly ILogger<MediaController> _logger;

        private static readonly string[] VideoExtensions = { ".mp4", ".webm" };
        private static readonly string[] AudioExtensions = { ".mp3", ".wav", ".m4a", ".aac", ".ogg" };
        private static readonly string[] DocumentExtensions = { ".pdf" };
        private static readonly string[] AllowedExtensions =
        {
            ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".bmp",
            ".tif", ".tiff", ".ico", ".heic", ".heif", ".jxl",
            ".mp4", ".webm", ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".pdf"
        };
        private const long MaxFileSizeBytes = 30 * 1024 * 1024; // 30MB

        public MediaController(
            IAzureBlobService blobService,
            IHttpClientFactory httpClientFactory,
            IWebHostEnvironment environment,
            IConfiguration configuration,
            AkordishKeitDbContext context,
            IYouTubeService youTubeService,
            ILogger<MediaController> logger)
        {
            _blobService = blobService;
            _httpClient = httpClientFactory.CreateClient();
            _environment = environment;
            _configuration = configuration;
            _context = context;
            _youTubeService = youTubeService;
            _logger = logger;
        }

        [HttpPost("upload")]
        [Authorize]
        [RequestSizeLimit(31_457_280)]
        public async Task<ActionResult<string>> UploadMedia(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded" });

            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();

            if (!AllowedExtensions.Contains(fileExtension))
            {
                _logger.LogWarning("Upload rejected — invalid file type: {FileName} ({Extension}) IP={IP}",
                    file.FileName, fileExtension, HttpContext.Connection.RemoteIpAddress);
                return BadRequest(new { message = "Invalid file type" });
            }

            if (file.Length > MaxFileSizeBytes)
            {
                _logger.LogWarning("Upload rejected — file too large: {FileName} ({SizeMB:F1}MB) IP={IP}",
                    file.FileName, file.Length / 1024.0 / 1024.0, HttpContext.Connection.RemoteIpAddress);
                return BadRequest(new { message = "File size exceeds 30MB limit" });
            }

            var contentType = GetContentType(fileExtension);
            using var stream = file.OpenReadStream();
            var url = await _blobService.UploadAsync(stream, file.FileName, contentType);

            if (url == null)
                return StatusCode(500, new { message = "Upload failed. Please try again." });

            _logger.LogInformation("File uploaded: {FileName} ({Extension}, {SizeMB:F1}MB) → {Url} IP={IP}",
                file.FileName, fileExtension, file.Length / 1024.0 / 1024.0, url, HttpContext.Connection.RemoteIpAddress);

            return Ok(new { url });
        }

        [HttpGet("pdf-view")]
        public async Task<IActionResult> ViewPdf([FromQuery] string url)
        {
            if (TryGetLocalMediaPath(url, out var localPath, out var localExtension))
            {
                if (localExtension != ".pdf")
                    return BadRequest(new { message = "File is not a PDF" });

                return PhysicalFile(localPath, GetContentType(localExtension), enableRangeProcessing: true);
            }

            if (!IsSafePdfUrl(url, out var uri))
                return BadRequest(new { message = "Invalid PDF URL" });

            byte[]? pdfBytes = null;
            using var request = new HttpRequestMessage(System.Net.Http.HttpMethod.Get, uri.AbsoluteUri);
            request.Headers.UserAgent.ParseAdd("AkordishKeit/1.0");
            request.Headers.Accept.ParseAdd("application/pdf");

            using var response = await _httpClient.SendAsync(request);
            if (response.IsSuccessStatusCode)
                pdfBytes = await response.Content.ReadAsByteArrayAsync();

            if (pdfBytes == null || pdfBytes.Length == 0)
                return StatusCode(502, new { message = "PDF could not be loaded" });

            if (pdfBytes.Length > MaxFileSizeBytes)
                return BadRequest(new { message = "PDF file is too large" });

            if (!IsPdfContent(pdfBytes))
                return BadRequest(new { message = "File is not a PDF" });

            Response.Headers.ContentDisposition = "inline";
            Response.Headers.CacheControl = "public, max-age=3600";
            return File(pdfBytes, "application/pdf", enableRangeProcessing: true);
        }

        [HttpGet("audio")]
        public async Task<IActionResult> StreamAudio([FromQuery] string url)
        {
            if (TryGetLocalMediaPath(url, out var localPath, out var localExtension))
            {
                if (!AudioExtensions.Contains(localExtension))
                    return BadRequest(new { message = "Invalid audio URL" });

                Response.Headers.CacheControl = "public, max-age=3600";
                return PhysicalFile(localPath, GetContentType(localExtension), enableRangeProcessing: true);
            }

            if (!IsSafeAudioUrl(url, out var uri))
                return BadRequest(new { message = "Invalid audio URL" });

            var audioBytes = await FetchMediaBytes(uri, "audio/*");
            if (audioBytes == null || audioBytes.Length == 0)
                return StatusCode(502, new { message = "Audio could not be loaded" });

            if (audioBytes.Length > MaxFileSizeBytes)
                return BadRequest(new { message = "Audio file is too large" });

            Response.Headers.CacheControl = "public, max-age=3600";
            return File(audioBytes, GetContentType(Path.GetExtension(uri.AbsolutePath).ToLowerInvariant()), enableRangeProcessing: true);
        }

        [HttpGet("download")]
        public async Task<IActionResult> DownloadMedia([FromQuery] string url, [FromQuery] string? fileName = null)
        {
            if (TryGetLocalMediaPath(url, out var localPath, out var localExtension))
            {
                var localDownloadName = BuildDownloadFileNameFromPath(localPath, fileName, localExtension);
                Response.Headers.CacheControl = "private, max-age=300";
                return PhysicalFile(localPath, GetContentType(localExtension), localDownloadName, enableRangeProcessing: true);
            }

            if (!IsSafeDownloadUrl(url, out var uri))
                return BadRequest(new { message = "Invalid media URL" });

            var mediaBytes = await FetchMediaBytes(uri, "*/*");
            if (mediaBytes == null || mediaBytes.Length == 0)
                return StatusCode(502, new { message = "File could not be loaded" });

            if (mediaBytes.Length > MaxFileSizeBytes)
                return BadRequest(new { message = "File is too large" });

            var extension = Path.GetExtension(uri.AbsolutePath).ToLowerInvariant();
            var downloadName = BuildDownloadFileName(uri, fileName, extension);
            Response.Headers.CacheControl = "private, max-age=300";
            return File(mediaBytes, GetContentType(extension), downloadName, enableRangeProcessing: true);
        }

        [HttpDelete("delete")]
        [Authorize]
        public async Task<ActionResult> DeleteMedia([FromQuery] string url)
        {
            if (string.IsNullOrEmpty(url))
                return BadRequest(new { message = "URL is required" });

            var deleted = await _blobService.DeleteAsync(url);
            _logger.LogInformation("Delete requested: {Url} deleted={Deleted} IP={IP}",
                url, deleted, HttpContext.Connection.RemoteIpAddress);

            return Ok(new { message = deleted ? "File deleted successfully" : "File not found or already deleted" });
        }

        [HttpPost("maintenance/convert-youtube-thumbnails")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> ConvertYouTubeThumbnails([FromQuery] int limit = 100, [FromQuery] bool dryRun = false)
        {
            var result = await ConvertYouTubeThumbnailsBatchAsync(limit, dryRun);
            return Ok(result);
        }

        [HttpPost("maintenance/convert-all-youtube-thumbnails")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> ConvertAllYouTubeThumbnails([FromQuery] int batchSize = 100, [FromQuery] int maxBatches = 50)
        {
            batchSize = Math.Clamp(batchSize, 1, 500);
            maxBatches = Math.Clamp(maxBatches, 1, 500);

            var totalChecked = 0;
            var totalConverted = 0;
            var totalFailed = 0;
            var totalSkipped = 0;
            var batchesRun = 0;
            var stoppedBecauseNoProgress = false;
            var failures = new List<object>();

            for (var batch = 0; batch < maxBatches; batch++)
            {
                var result = await ConvertYouTubeThumbnailsBatchAsync(batchSize, dryRun: false);
                batchesRun++;
                totalChecked += result.CheckedCount;
                totalConverted += result.ConvertedCount;
                totalFailed += result.FailedCount;
                totalSkipped += result.SkippedCount;
                failures.AddRange(result.Failures);

                if (!result.HasMore)
                    break;

                if (result.ConvertedCount == 0)
                {
                    stoppedBecauseNoProgress = true;
                    break;
                }
            }

            return Ok(new
            {
                batchSize,
                maxBatches,
                batchesRun,
                checkedCount = totalChecked,
                convertedCount = totalConverted,
                failedCount = totalFailed,
                skippedCount = totalSkipped,
                stoppedBecauseNoProgress,
                reachedMaxBatches = batchesRun >= maxBatches,
                failures = failures.Take(50)
            });
        }

        private async Task<YouTubeThumbnailConversionResult> ConvertYouTubeThumbnailsBatchAsync(int limit, bool dryRun)
        {
            limit = Math.Clamp(limit, 1, 500);
            var checkedCount = 0;
            var convertedCount = 0;
            var failedCount = 0;
            var skippedCount = 0;
            var remaining = limit;
            var failures = new List<object>();

            async Task<string?> ConvertUrlAsync(string? url, string entity, int id, string field)
            {
                if (!IsYouTubeThumbnailUrl(url))
                {
                    skippedCount++;
                    return url;
                }

                checkedCount++;
                remaining--;
                if (dryRun)
                    return url;

                var storedUrl = await _youTubeService.StoreYouTubeThumbnailAsync(url!);
                if (string.IsNullOrWhiteSpace(storedUrl) || IsYouTubeThumbnailUrl(storedUrl))
                {
                    failedCount++;
                    failures.Add(new { entity, id, field, url });
                    return url;
                }

                convertedCount++;
                return storedUrl;
            }

            var songs = await _context.Songs
                .Where(s => !s.IsDeleted && s.ImageUrl != null &&
                    (s.ImageUrl.Contains("i.ytimg.com") || s.ImageUrl.Contains("img.youtube.com")))
                .OrderBy(s => s.Id)
                .Take(remaining)
                .ToListAsync();

            foreach (var song in songs)
            {
                song.ImageUrl = (await ConvertUrlAsync(song.ImageUrl, nameof(Song), song.Id, nameof(Song.ImageUrl))) ?? song.ImageUrl;
                if (remaining <= 0) break;
            }

            if (remaining > 0)
            {
                var articles = await _context.Articles
                    .Where(a => !a.IsDeleted &&
                        ((a.FeaturedImageUrl != null && (a.FeaturedImageUrl.Contains("i.ytimg.com") || a.FeaturedImageUrl.Contains("img.youtube.com"))) ||
                         (a.HeroBackgroundImageUrl != null && (a.HeroBackgroundImageUrl.Contains("i.ytimg.com") || a.HeroBackgroundImageUrl.Contains("img.youtube.com"))) ||
                         (a.OpenGraphImageUrl != null && (a.OpenGraphImageUrl.Contains("i.ytimg.com") || a.OpenGraphImageUrl.Contains("img.youtube.com")))))
                    .OrderBy(a => a.Id)
                    .Take(remaining)
                    .ToListAsync();

                foreach (var article in articles)
                {
                    article.FeaturedImageUrl = await ConvertUrlAsync(article.FeaturedImageUrl, nameof(Article), article.Id, nameof(Article.FeaturedImageUrl));
                    if (remaining <= 0) break;
                    article.HeroBackgroundImageUrl = await ConvertUrlAsync(article.HeroBackgroundImageUrl, nameof(Article), article.Id, nameof(Article.HeroBackgroundImageUrl));
                    if (remaining <= 0) break;
                    article.OpenGraphImageUrl = await ConvertUrlAsync(article.OpenGraphImageUrl, nameof(Article), article.Id, nameof(Article.OpenGraphImageUrl));
                    if (remaining <= 0) break;
                }
            }

            if (remaining > 0)
            {
                var episodes = await _context.PodcastEpisodes
                    .Where(e => !e.IsDeleted && e.ThumbnailUrl != null &&
                        (e.ThumbnailUrl.Contains("i.ytimg.com") || e.ThumbnailUrl.Contains("img.youtube.com")))
                    .OrderBy(e => e.Id)
                    .Take(remaining)
                    .ToListAsync();

                foreach (var episode in episodes)
                {
                    episode.ThumbnailUrl = await ConvertUrlAsync(episode.ThumbnailUrl, nameof(PodcastEpisode), episode.Id, nameof(PodcastEpisode.ThumbnailUrl));
                    if (remaining <= 0) break;
                }
            }

            if (remaining > 0)
            {
                var artistHits = await _context.ArtistHits
                    .Where(h => h.ImageUrl != null &&
                        (h.ImageUrl.Contains("i.ytimg.com") || h.ImageUrl.Contains("img.youtube.com")))
                    .OrderBy(h => h.Id)
                    .Take(remaining)
                    .ToListAsync();

                foreach (var hit in artistHits)
                {
                    hit.ImageUrl = await ConvertUrlAsync(hit.ImageUrl, nameof(ArtistHit), hit.Id, nameof(ArtistHit.ImageUrl));
                    if (remaining <= 0) break;
                }
            }

            if (!dryRun && convertedCount > 0)
                await _context.SaveChangesAsync();

            _logger.LogInformation("YouTube thumbnail conversion completed. dryRun={DryRun} checked={Checked} converted={Converted} failed={Failed} skipped={Skipped}",
                dryRun, checkedCount, convertedCount, failedCount, skippedCount);

            return new YouTubeThumbnailConversionResult
            {
                DryRun = dryRun,
                Limit = limit,
                CheckedCount = checkedCount,
                ConvertedCount = convertedCount,
                FailedCount = failedCount,
                SkippedCount = skippedCount,
                HasMore = remaining <= 0,
                Failures = failures.Take(20).ToList()
            };
        }

        private static string GetContentType(string extension) => extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png"            => "image/png",
            ".gif"            => "image/gif",
            ".webp"           => "image/webp",
            ".avif"           => "image/avif",
            ".svg"            => "image/svg+xml",
            ".bmp"            => "image/bmp",
            ".tif" or ".tiff" => "image/tiff",
            ".ico"            => "image/x-icon",
            ".heic"           => "image/heic",
            ".heif"           => "image/heif",
            ".jxl"            => "image/jxl",
            ".mp4"            => "video/mp4",
            ".webm"           => "video/webm",
            ".mp3"            => "audio/mpeg",
            ".wav"            => "audio/wav",
            ".m4a"            => "audio/mp4",
            ".aac"            => "audio/aac",
            ".ogg"            => "audio/ogg",
            ".pdf"            => "application/pdf",
            _                 => "application/octet-stream"
        };

        private async Task<byte[]?> FetchMediaBytes(Uri uri, string acceptHeader)
        {
            using var request = new HttpRequestMessage(System.Net.Http.HttpMethod.Get, uri.AbsoluteUri);
            request.Headers.UserAgent.ParseAdd("AkordishKeit/1.0");
            request.Headers.Accept.ParseAdd(acceptHeader);

            using var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
                return null;

            return await response.Content.ReadAsByteArrayAsync();
        }

        private static bool IsSafePdfUrl(string url, out Uri uri)
        {
            uri = null!;
            if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed))
                return false;
            if (parsed.Scheme != Uri.UriSchemeHttps && parsed.Scheme != Uri.UriSchemeHttp)
                return false;
            if (parsed.IsLoopback || string.IsNullOrWhiteSpace(parsed.Host))
                return false;
            uri = parsed;
            return true;
        }

        private static bool IsSafeAudioUrl(string url, out Uri uri)
        {
            if (!IsSafeDownloadUrl(url, out uri))
                return false;

            return AudioExtensions.Contains(Path.GetExtension(uri.AbsolutePath).ToLowerInvariant());
        }

        private static bool IsSafeDownloadUrl(string url, out Uri uri)
        {
            uri = null!;
            if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed))
                return false;
            if (parsed.Scheme != Uri.UriSchemeHttps && parsed.Scheme != Uri.UriSchemeHttp)
                return false;
            if (parsed.IsLoopback || string.IsNullOrWhiteSpace(parsed.Host))
                return false;

            var extension = Path.GetExtension(parsed.AbsolutePath).ToLowerInvariant();
            if (!AllowedExtensions.Contains(extension))
                return false;

            uri = parsed;
            return true;
        }

        private static string BuildDownloadFileName(Uri uri, string? requestedFileName, string extension)
        {
            var originalName = ExtractOriginalFileName(uri, extension);
            var baseName = !string.IsNullOrWhiteSpace(originalName) && !IsGeneratedBlobName(originalName)
                ? originalName
                : Path.GetFileNameWithoutExtension(requestedFileName ?? string.Empty);

            baseName = SanitizeFileName(baseName);
            if (string.IsNullOrWhiteSpace(baseName))
                baseName = "akordishkeit-media";

            return $"{baseName}{extension}";
        }

        private static string BuildDownloadFileNameFromPath(string path, string? requestedFileName, string extension)
        {
            var originalName = ExtractOriginalFileNameFromPath(path);
            var baseName = !string.IsNullOrWhiteSpace(originalName) && !IsGeneratedBlobName(originalName)
                ? originalName
                : Path.GetFileNameWithoutExtension(requestedFileName ?? string.Empty);

            baseName = SanitizeFileName(baseName);
            if (string.IsNullOrWhiteSpace(baseName))
                baseName = "akordishkeit-media";

            return $"{baseName}{extension}";
        }

        private static string ExtractOriginalFileName(Uri uri, string extension)
        {
            var segment = Uri.UnescapeDataString(Path.GetFileNameWithoutExtension(uri.AbsolutePath));
            var parts = segment.Split('_', 4, StringSplitOptions.RemoveEmptyEntries);
            return parts.Length == 4 && IsTimestampPrefix(parts[0], parts[1]) && Guid.TryParse(parts[2], out _)
                ? parts[3]
                : segment;
        }

        private static string ExtractOriginalFileNameFromPath(string path)
        {
            var segment = Path.GetFileNameWithoutExtension(path);
            var parts = segment.Split('_', 4, StringSplitOptions.RemoveEmptyEntries);
            return parts.Length == 4 && IsTimestampPrefix(parts[0], parts[1]) && Guid.TryParse(parts[2], out _)
                ? parts[3]
                : segment;
        }

        private bool TryGetLocalMediaPath(string url, out string localPath, out string extension)
        {
            localPath = string.Empty;
            extension = string.Empty;

            if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.RelativeOrAbsolute, out var uri))
                return false;

            var path = uri.IsAbsoluteUri ? uri.AbsolutePath : url;
            if (uri.IsAbsoluteUri && !IsCurrentHost(uri))
                return false;

            path = Uri.UnescapeDataString(path).TrimStart('/').Replace('\\', '/');
            if (string.IsNullOrWhiteSpace(path) || path.Contains("..") || !path.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase))
                return false;

            extension = Path.GetExtension(path).ToLowerInvariant();
            if (!AllowedExtensions.Contains(extension))
                return false;

            var webRoot = _environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot");
            var rootPath = Path.GetFullPath(webRoot);
            var candidatePath = Path.GetFullPath(Path.Combine(webRoot, Path.Combine(path.Split('/'))));

            if (!candidatePath.StartsWith(rootPath, StringComparison.OrdinalIgnoreCase) || !System.IO.File.Exists(candidatePath))
                return false;

            localPath = candidatePath;
            return true;
        }

        private bool IsCurrentHost(Uri uri)
        {
            var requestHost = Request.Host.Host;
            if (uri.Host.Equals(requestHost, StringComparison.OrdinalIgnoreCase))
                return true;

            if (Uri.TryCreate(_configuration["Backend:BaseUrl"], UriKind.Absolute, out var backendBaseUrl))
                return uri.Host.Equals(backendBaseUrl.Host, StringComparison.OrdinalIgnoreCase);

            return false;
        }

        private static bool IsGeneratedBlobName(string fileName)
        {
            var parts = fileName.Split('_', 3, StringSplitOptions.RemoveEmptyEntries);
            return parts.Length == 3 && IsTimestampPrefix(parts[0], parts[1]) && Guid.TryParse(parts[2], out _);
        }

        private static bool IsTimestampPrefix(string datePart, string timePart) =>
            datePart.Length == 8
            && timePart.Length == 6
            && datePart.All(char.IsDigit)
            && timePart.All(char.IsDigit);

        private static string SanitizeFileName(string fileName)
        {
            var invalidChars = Path.GetInvalidFileNameChars();
            var sanitized = new string(fileName
                .Trim()
                .Select(ch => invalidChars.Contains(ch) || ch == '/' || ch == '\\' ? '_' : ch)
                .ToArray());

            sanitized = string.Join("_", sanitized.Split(' ', StringSplitOptions.RemoveEmptyEntries));
            return sanitized.Length <= 100 ? sanitized : sanitized[..100];
        }

        private static bool IsPdfContent(byte[] bytes) =>
            bytes.Length >= 4 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F';

        private sealed class YouTubeThumbnailConversionResult
        {
            public bool DryRun { get; set; }
            public int Limit { get; set; }
            public int CheckedCount { get; set; }
            public int ConvertedCount { get; set; }
            public int FailedCount { get; set; }
            public int SkippedCount { get; set; }
            public bool HasMore { get; set; }
            public List<object> Failures { get; set; } = [];
        }

        private static bool IsYouTubeThumbnailUrl(string? url)
        {
            return Uri.TryCreate(url, UriKind.Absolute, out var uri)
                && (uri.Host.Equals("img.youtube.com", StringComparison.OrdinalIgnoreCase)
                    || uri.Host.Equals("i.ytimg.com", StringComparison.OrdinalIgnoreCase));
        }
    }
}
