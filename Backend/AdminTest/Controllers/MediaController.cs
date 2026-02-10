using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class MediaController : ControllerBase
    {
        // TODO: For production with thousands of files, consider migrating to cloud storage:
        // - Azure Blob Storage
        // - AWS S3
        // - Cloudinary (optimized for images/videos)
        // This will provide better scalability, CDN, and automatic backups

        private readonly IWebHostEnvironment _environment;

        public MediaController(IWebHostEnvironment environment)
        {
            _environment = environment;
        }

        [HttpPost("upload")]
        public async Task<ActionResult<string>> UploadMedia(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file uploaded" });
            }

            // Validate file type
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".mp4", ".webm", ".webp" };
            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();

            if (!allowedExtensions.Contains(fileExtension))
            {
                return BadRequest(new { message = "Invalid file type. Allowed: JPG, PNG, GIF, MP4, WEBM, WEBP" });
            }

            // Validate file size (max 10MB)
            if (file.Length > 10 * 1024 * 1024)
            {
                return BadRequest(new { message = "File size exceeds 10MB limit" });
            }

            // Get or create wwwroot path
            var webRootPath = _environment.WebRootPath;
            if (string.IsNullOrEmpty(webRootPath))
            {
                webRootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            }

            // Organize files by year and month to prevent huge directories
            var now = DateTime.Now;
            var yearMonth = $"{now.Year}/{now.Month:D2}";
            var uploadsPath = Path.Combine(webRootPath, "uploads", "campaigns", yearMonth);

            if (!Directory.Exists(uploadsPath))
            {
                Directory.CreateDirectory(uploadsPath);
            }

            // Generate unique filename with timestamp prefix for better organization
            var timestamp = now.ToString("yyyyMMdd_HHmmss");
            var fileName = $"{timestamp}_{Guid.NewGuid()}{fileExtension}";
            var filePath = Path.Combine(uploadsPath, fileName);

            // Save file
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Return URL with year/month path
            var fileUrl = $"{Request.Scheme}://{Request.Host}/uploads/campaigns/{yearMonth}/{fileName}";
            return Ok(new { url = fileUrl });
        }

        [HttpDelete("delete")]
        public ActionResult DeleteMedia([FromQuery] string url)
        {
            if (string.IsNullOrEmpty(url))
            {
                return BadRequest(new { message = "URL is required" });
            }

            try
            {
                // Get or create wwwroot path
                var webRootPath = _environment.WebRootPath;
                if (string.IsNullOrEmpty(webRootPath))
                {
                    webRootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
                }

                // Extract the full path after /uploads/ from URL
                var uri = new Uri(url);
                var pathParts = uri.LocalPath.Split(new[] { "/uploads/" }, StringSplitOptions.None);
                if (pathParts.Length < 2)
                {
                    return BadRequest(new { message = "Invalid file URL format" });
                }

                // Reconstruct the relative path (e.g., "campaigns/2025/12/filename.jpg")
                var relativePath = pathParts[1];
                var filePath = Path.Combine(webRootPath, "uploads", relativePath);

                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                    return Ok(new { message = "File deleted successfully" });
                }

                return NotFound(new { message = "File not found" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Error deleting file: {ex.Message}" });
            }
        }
    }
}
