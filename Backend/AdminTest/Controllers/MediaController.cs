using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MediaController : ControllerBase
    {
        private readonly Cloudinary _cloudinary;
        private readonly HttpClient _httpClient;
        private readonly ILogger<MediaController> _logger;

        private static readonly string[] VideoExtensions = { ".mp4", ".webm" };
        private static readonly string[] AudioExtensions = { ".mp3", ".wav", ".m4a", ".aac", ".ogg" };
        private static readonly string[] DocumentExtensions = { ".pdf" };
        private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".gif", ".mp4", ".webm", ".webp", ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".pdf" };
        private const long MaxPdfViewBytes = 30 * 1024 * 1024;

        public MediaController(IConfiguration configuration, IHttpClientFactory httpClientFactory, ILogger<MediaController> logger)
        {
            var account = new Account(
                configuration["Cloudinary:CloudName"],
                configuration["Cloudinary:ApiKey"],
                configuration["Cloudinary:ApiSecret"]
            );
            _cloudinary = new Cloudinary(account);
            _cloudinary.Api.Secure = true;
            _httpClient = httpClientFactory.CreateClient();
            _logger = logger;
        }

        [HttpPost("upload")]
        public async Task<ActionResult<string>> UploadMedia(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded" });

            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();

            if (!AllowedExtensions.Contains(fileExtension))
            {
                _logger.LogWarning("Upload rejected — invalid file type: {FileName} ({Extension}) IP={IP}",
                    file.FileName, fileExtension, HttpContext.Connection.RemoteIpAddress);
                return BadRequest(new { message = "Invalid file type. Allowed: JPG, PNG, GIF, MP4, WEBM, WEBP, MP3, WAV, M4A, AAC, OGG, PDF" });
            }

            if (file.Length > 30 * 1024 * 1024)
            {
                _logger.LogWarning("Upload rejected — file too large: {FileName} ({SizeMB:F1}MB) IP={IP}",
                    file.FileName, file.Length / 1024.0 / 1024.0, HttpContext.Connection.RemoteIpAddress);
                return BadRequest(new { message = "File size exceeds 30MB limit" });
            }

            var now = DateTime.UtcNow;
            var folder = $"uploads/{now.Year}/{now.Month:D2}";
            var publicId = $"{folder}/{now:yyyyMMdd_HHmmss}_{Guid.NewGuid()}";

            using var stream = file.OpenReadStream();
            var fileDescription = new FileDescription(file.FileName, stream);

            UploadResult uploadResult;

            if (DocumentExtensions.Contains(fileExtension))
            {
                uploadResult = await _cloudinary.UploadAsync(new RawUploadParams
                {
                    File = fileDescription,
                    PublicId = $"{publicId}{fileExtension}",
                    Overwrite = false
                });
            }
            else if (VideoExtensions.Contains(fileExtension) || AudioExtensions.Contains(fileExtension))
            {
                uploadResult = await _cloudinary.UploadAsync(new VideoUploadParams
                {
                    File = fileDescription,
                    PublicId = publicId,
                    Overwrite = false
                });
            }
            else
            {
                uploadResult = await _cloudinary.UploadAsync(new ImageUploadParams
                {
                    File = fileDescription,
                    PublicId = publicId,
                    Overwrite = false
                });
            }

            if (uploadResult.Error != null)
            {
                _logger.LogError("Cloudinary upload failed: {FileName} — {Error} IP={IP}",
                    file.FileName, uploadResult.Error.Message, HttpContext.Connection.RemoteIpAddress);
                return StatusCode(500, new { message = uploadResult.Error.Message });
            }

            _logger.LogInformation("File uploaded: {FileName} ({Extension}, {SizeMB:F1}MB) → {Url} IP={IP}",
                file.FileName, fileExtension, file.Length / 1024.0 / 1024.0,
                uploadResult.SecureUrl, HttpContext.Connection.RemoteIpAddress);
            return Ok(new { url = uploadResult.SecureUrl.ToString() });
        }

        [HttpGet("pdf-view")]
        public async Task<IActionResult> ViewPdf([FromQuery] string url)
        {
            if (!IsSafePdfUrl(url, out var uri))
                return BadRequest(new { message = "Invalid PDF URL" });

            var pdfBytes = await TryLoadPdfBytes(uri);
            if (pdfBytes == null)
                return StatusCode(502, new { message = "PDF could not be loaded" });

            if (pdfBytes.Length > MaxPdfViewBytes)
                return BadRequest(new { message = "PDF file is too large" });

            if (!IsPdfContent(pdfBytes))
                return BadRequest(new { message = "File is not a PDF" });

            Response.Headers.ContentDisposition = "inline";
            Response.Headers.CacheControl = "public, max-age=3600";
            return File(pdfBytes, "application/pdf", enableRangeProcessing: true);
        }

        private async Task<byte[]?> TryLoadPdfBytes(Uri uri)
        {
            foreach (var candidate in GetPdfFetchCandidates(uri).DistinctBy(candidate => candidate.AbsoluteUri))
            {
                using var request = new HttpRequestMessage(System.Net.Http.HttpMethod.Get, candidate.AbsoluteUri);
                request.Headers.UserAgent.ParseAdd("AkordishKeit/1.0");
                request.Headers.Accept.ParseAdd("application/pdf");

                using var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                    continue;

                if (response.Content.Headers.ContentLength > MaxPdfViewBytes)
                    return null;

                var bytes = await response.Content.ReadAsByteArrayAsync();
                if (bytes.Length > MaxPdfViewBytes)
                    return null;

                if (IsPdfContent(bytes))
                    return bytes;
            }

            return null;
        }

        private IEnumerable<Uri> GetPdfFetchCandidates(Uri uri)
        {
            yield return uri;

            if (!IsCloudinaryRawUrl(uri, out var publicId))
                yield break;

            if (!uri.AbsolutePath.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            {
                var withPdfExtension = new UriBuilder(uri)
                {
                    Path = $"{uri.AbsolutePath}.pdf"
                };
                yield return withPdfExtension.Uri;
            }

            var publicIdWithoutExtension = Path.ChangeExtension(publicId, null);
            var expiresAt = DateTimeOffset.UtcNow.AddMinutes(10).ToUnixTimeSeconds();
            var signedUrl = _cloudinary.DownloadPrivate(publicIdWithoutExtension, false, "pdf", "upload", expiresAt, "raw");
            if (Uri.TryCreate(signedUrl, UriKind.Absolute, out var signedUri))
                yield return signedUri;
        }

        [HttpDelete("delete")]
        public async Task<ActionResult> DeleteMedia([FromQuery] string url)
        {
            if (string.IsNullOrEmpty(url))
                return BadRequest(new { message = "URL is required" });

            try
            {
                // Cloudinary URL format: https://res.cloudinary.com/{cloud}/image/upload/v{version}/{public_id}.{ext}
                var uri = new Uri(url);
                var pathSegments = uri.AbsolutePath.Split("/upload/");
                if (pathSegments.Length < 2)
                    return BadRequest(new { message = "Invalid Cloudinary URL" });

                // Remove version prefix (v1234/) and file extension to get public_id
                var withoutVersion = System.Text.RegularExpressions.Regex.Replace(pathSegments[1], @"^v\d+/", "");
                var publicId = Path.ChangeExtension(withoutVersion, null);

                var resourceType = uri.AbsolutePath.Contains("/video/")
                    ? ResourceType.Video
                    : uri.AbsolutePath.Contains("/raw/")
                        ? ResourceType.Raw
                        : ResourceType.Image;

                var deleteResult = await _cloudinary.DestroyAsync(new DeletionParams(publicId)
                {
                    ResourceType = resourceType
                });

                if (deleteResult.Result == "ok" || deleteResult.Result == "not found")
                {
                    _logger.LogInformation("File deleted from Cloudinary: {PublicId} Result={Result} IP={IP}",
                        publicId, deleteResult.Result, HttpContext.Connection.RemoteIpAddress);
                    return Ok(new { message = "File deleted successfully" });
                }

                _logger.LogError("Cloudinary delete failed: {PublicId} Result={Result} IP={IP}",
                    publicId, deleteResult.Result, HttpContext.Connection.RemoteIpAddress);
                return StatusCode(500, new { message = "Failed to delete file" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Delete error: {Url} IP={IP}", url, HttpContext.Connection.RemoteIpAddress);
                return BadRequest(new { message = $"Error deleting file: {ex.Message}" });
            }
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

        private static bool IsCloudinaryRawUrl(Uri uri, out string publicId)
        {
            publicId = string.Empty;
            if (!uri.Host.EndsWith("res.cloudinary.com", StringComparison.OrdinalIgnoreCase))
                return false;

            var pathSegments = uri.AbsolutePath.Split("/raw/upload/", StringSplitOptions.None);
            if (pathSegments.Length < 2)
                return false;

            publicId = System.Text.RegularExpressions.Regex.Replace(pathSegments[1], @"^v\d+/", "");
            return !string.IsNullOrWhiteSpace(publicId);
        }

        private static bool IsPdfContent(byte[] bytes)
        {
            return bytes.Length >= 4
                && bytes[0] == '%'
                && bytes[1] == 'P'
                && bytes[2] == 'D'
                && bytes[3] == 'F';
        }
    }
}
