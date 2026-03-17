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

        private static readonly string[] VideoExtensions = { ".mp4", ".webm" };
        private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".gif", ".mp4", ".webm", ".webp" };

        public MediaController(IConfiguration configuration)
        {
            var account = new Account(
                configuration["Cloudinary:CloudName"],
                configuration["Cloudinary:ApiKey"],
                configuration["Cloudinary:ApiSecret"]
            );
            _cloudinary = new Cloudinary(account);
            _cloudinary.Api.Secure = true;
        }

        [HttpPost("upload")]
        public async Task<ActionResult<string>> UploadMedia(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded" });

            var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();

            if (!AllowedExtensions.Contains(fileExtension))
                return BadRequest(new { message = "Invalid file type. Allowed: JPG, PNG, GIF, MP4, WEBM, WEBP" });

            if (file.Length > 10 * 1024 * 1024)
                return BadRequest(new { message = "File size exceeds 10MB limit" });

            var now = DateTime.UtcNow;
            var folder = $"uploads/{now.Year}/{now.Month:D2}";
            var publicId = $"{folder}/{now:yyyyMMdd_HHmmss}_{Guid.NewGuid()}";

            using var stream = file.OpenReadStream();
            var fileDescription = new FileDescription(file.FileName, stream);

            UploadResult uploadResult;

            if (VideoExtensions.Contains(fileExtension))
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
                return StatusCode(500, new { message = uploadResult.Error.Message });

            return Ok(new { url = uploadResult.SecureUrl.ToString() });
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

                var resourceType = uri.AbsolutePath.Contains("/video/") ? ResourceType.Video : ResourceType.Image;

                var deleteResult = await _cloudinary.DestroyAsync(new DeletionParams(publicId)
                {
                    ResourceType = resourceType
                });

                if (deleteResult.Result == "ok" || deleteResult.Result == "not found")
                    return Ok(new { message = "File deleted successfully" });

                return StatusCode(500, new { message = "Failed to delete file" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = $"Error deleting file: {ex.Message}" });
            }
        }
    }
}
