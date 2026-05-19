using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MediaController : ControllerBase
    {
        private readonly IAzureBlobService _blobService;
        private readonly HttpClient _httpClient;
        private readonly ILogger<MediaController> _logger;

        private static readonly string[] VideoExtensions = { ".mp4", ".webm" };
        private static readonly string[] AudioExtensions = { ".mp3", ".wav", ".m4a", ".aac", ".ogg" };
        private static readonly string[] DocumentExtensions = { ".pdf" };
        private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".gif", ".mp4", ".webm", ".webp", ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".pdf" };
        private const long MaxFileSizeBytes = 30 * 1024 * 1024; // 30MB

        public MediaController(IAzureBlobService blobService, IHttpClientFactory httpClientFactory, ILogger<MediaController> logger)
        {
            _blobService = blobService;
            _httpClient = httpClientFactory.CreateClient();
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
                return BadRequest(new { message = "Invalid file type. Allowed: JPG, PNG, GIF, MP4, WEBM, WEBP, MP3, WAV, M4A, AAC, OGG, PDF" });
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

        private static string GetContentType(string extension) => extension switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png"            => "image/png",
            ".gif"            => "image/gif",
            ".webp"           => "image/webp",
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

        private static bool IsPdfContent(byte[] bytes) =>
            bytes.Length >= 4 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D' && bytes[3] == 'F';
    }
}
