using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;

namespace AkordishKeit.Services
{
    public class AzureBlobService : IAzureBlobService
    {
        private readonly BlobContainerClient? _container;
        private readonly string _containerName;
        private readonly IWebHostEnvironment _environment;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AzureBlobService> _logger;

        public AzureBlobService(
            IConfiguration configuration,
            IWebHostEnvironment environment,
            IHttpContextAccessor httpContextAccessor,
            ILogger<AzureBlobService> logger)
        {
            _configuration = configuration;
            _environment = environment;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
            _containerName = configuration["AzureBlobStorage:ContainerName"] ?? "media";
            var connectionString = configuration["BlobConnectionString"]
                ?? configuration.GetConnectionString("BlobConnectionString")
                ?? configuration.GetConnectionString("AzureBlobStorage:ConnectionString")
                ?? configuration.GetConnectionString("AzureBlobStorage__ConnectionString")
                ?? configuration["AzureBlobStorage:ConnectionString"];

            if (string.IsNullOrWhiteSpace(connectionString)
                || connectionString.StartsWith("REPLACE_WITH_", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("Azure Blob storage is not configured. Media uploads will be skipped.");
                return;
            }

            try
            {
                _container = new BlobServiceClient(connectionString).GetBlobContainerClient(_containerName);
            }
            catch (FormatException ex)
            {
                _logger.LogWarning(ex, "Azure Blob storage connection string is invalid. Media uploads will be skipped.");
            }
        }

        public async Task<string?> UploadAsync(Stream stream, string fileName, string contentType, string? folder = null)
        {
            if (_container == null)
            {
                _logger.LogWarning("Azure Blob upload skipped because storage is not configured. Falling back to local upload: {FileName}", fileName);
                return await UploadLocalAsync(stream, fileName, folder);
            }

            try
            {
                await _container!.CreateIfNotExistsAsync(PublicAccessType.Blob);

                var now = DateTime.UtcNow;
                var blobFolder = folder ?? $"uploads/{now.Year}/{now.Month:D2}";
                var ext = Path.GetExtension(fileName).ToLowerInvariant();
                var originalName = SanitizeFileName(Path.GetFileNameWithoutExtension(fileName));
                var originalSuffix = string.IsNullOrWhiteSpace(originalName) ? string.Empty : $"_{originalName}";
                var blobName = $"{blobFolder}/{now:yyyyMMdd_HHmmss}_{Guid.NewGuid()}{originalSuffix}{ext}";

                var blobClient = _container.GetBlobClient(blobName);
                await blobClient.UploadAsync(stream, new BlobUploadOptions
                {
                    HttpHeaders = new BlobHttpHeaders
                    {
                        ContentType = contentType,
                        CacheControl = "public, max-age=31536000"
                    }
                });

                return blobClient.Uri.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Azure Blob upload failed. Falling back to local upload: {FileName}", fileName);
                if (stream.CanSeek)
                    stream.Position = 0;

                return await UploadLocalAsync(stream, fileName, folder);
            }
        }

        public async Task<DirectUploadTarget?> CreateDirectUploadTargetAsync(string fileName, string contentType, string? folder = null)
        {
            if (_container == null || !_container.CanGenerateSasUri)
                return null;

            try
            {
                await _container.CreateIfNotExistsAsync(PublicAccessType.Blob);

                var blobName = BuildBlobName(fileName, folder);
                var blobClient = _container.GetBlobClient(blobName);
                var sas = new BlobSasBuilder
                {
                    BlobContainerName = _containerName,
                    BlobName = blobName,
                    Resource = "b",
                    ExpiresOn = DateTimeOffset.UtcNow.AddMinutes(10)
                };
                sas.SetPermissions(BlobSasPermissions.Create | BlobSasPermissions.Write);

                return new DirectUploadTarget(
                    blobClient.GenerateSasUri(sas).ToString(),
                    blobClient.Uri.ToString(),
                    contentType);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not create a direct upload target for: {FileName}", fileName);
                return null;
            }
        }

        public async Task<string?> UploadStringAsync(string content, string fileName, string? folder = null)
        {
            var bytes = System.Text.Encoding.UTF8.GetBytes(content);
            using var stream = new MemoryStream(bytes);
            return await UploadAsync(stream, fileName, "application/json", folder);
        }

        public async Task<string?> DownloadStringAsync(string blobPath)
        {
            if (_container == null)
            {
                _logger.LogWarning("Azure Blob download skipped (not configured): {Path}", blobPath);
                return null;
            }

            try
            {
                var blobClient = _container.GetBlobClient(blobPath);
                var response = await blobClient.DownloadContentAsync();
                return response.Value.Content.ToString();
            }
            catch (Azure.RequestFailedException ex) when (ex.Status == 404)
            {
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to download blob: {Path}", blobPath);
                return null;
            }
        }

        public async Task<bool> DeleteAsync(string url)
        {
            if (_container == null)
            {
                _logger.LogWarning("Azure Blob delete skipped because storage is not configured. Trying local delete: {Url}", url);
                return DeleteLocal(url);
            }

            var blobName = ExtractBlobName(url);
            if (blobName == null)
                return DeleteLocal(url);

            try
            {
                var blobClient = _container!.GetBlobClient(blobName);
                var result = await blobClient.DeleteIfExistsAsync();
                return result.Value;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Azure Blob delete failed: {Url}", url);
                return false;
            }
        }

        private string? ExtractBlobName(string url)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return null;
            if (!uri.Host.EndsWith("blob.core.windows.net", StringComparison.OrdinalIgnoreCase)) return null;
            var prefix = $"/{_containerName}/";
            var idx = uri.AbsolutePath.IndexOf(prefix, StringComparison.OrdinalIgnoreCase);
            if (idx < 0) return null;
            return uri.AbsolutePath[(idx + prefix.Length)..];
        }

        private static string BuildBlobName(string fileName, string? folder)
        {
            var now = DateTime.UtcNow;
            var blobFolder = folder ?? $"uploads/{now.Year}/{now.Month:D2}";
            var ext = Path.GetExtension(fileName).ToLowerInvariant();
            var originalName = SanitizeFileName(Path.GetFileNameWithoutExtension(fileName));
            var originalSuffix = string.IsNullOrWhiteSpace(originalName) ? string.Empty : $"_{originalName}";
            return $"{blobFolder}/{now:yyyyMMdd_HHmmss}_{Guid.NewGuid()}{originalSuffix}{ext}";
        }

        private async Task<string?> UploadLocalAsync(Stream stream, string fileName, string? folder)
        {
            try
            {
                var now = DateTime.UtcNow;
                var relativeFolder = NormalizeFolder(folder ?? $"uploads/{now.Year}/{now.Month:D2}");
                var ext = Path.GetExtension(fileName).ToLowerInvariant();
                var originalName = SanitizeFileName(Path.GetFileNameWithoutExtension(fileName));
                var originalSuffix = string.IsNullOrWhiteSpace(originalName) ? string.Empty : $"_{originalName}";
                var storedFileName = $"{now:yyyyMMdd_HHmmss}_{Guid.NewGuid()}{originalSuffix}{ext}";

                var webRoot = _environment.WebRootPath
                    ?? Path.Combine(_environment.ContentRootPath, "wwwroot");
                var targetDirectory = Path.Combine(webRoot, Path.Combine(relativeFolder.Split('/')));

                Directory.CreateDirectory(targetDirectory);

                var targetPath = Path.Combine(targetDirectory, storedFileName);
                await using (var fileStream = File.Create(targetPath))
                {
                    await stream.CopyToAsync(fileStream);
                }

                var relativeUrl = $"/{relativeFolder}/{storedFileName}".Replace("\\", "/");
                var baseUrl = GetCurrentBaseUrl();
                var url = string.IsNullOrWhiteSpace(baseUrl) ? relativeUrl : $"{baseUrl.TrimEnd('/')}{relativeUrl}";

                _logger.LogInformation("File uploaded locally: {FileName} -> {Url}", fileName, url);
                return url;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Local upload failed: {FileName}", fileName);
                return null;
            }
        }

        private bool DeleteLocal(string url)
        {
            if (!TryGetLocalRelativePath(url, out var relativePath))
                return false;

            try
            {
                var webRoot = _environment.WebRootPath
                    ?? Path.Combine(_environment.ContentRootPath, "wwwroot");
                var fullPath = Path.GetFullPath(Path.Combine(webRoot, relativePath));
                var rootPath = Path.GetFullPath(webRoot);

                if (!fullPath.StartsWith(rootPath, StringComparison.OrdinalIgnoreCase))
                    return false;

                if (!File.Exists(fullPath))
                    return false;

                File.Delete(fullPath);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Local delete failed: {Url}", url);
                return false;
            }
        }

        private bool TryGetLocalRelativePath(string url, out string relativePath)
        {
            relativePath = string.Empty;

            if (!Uri.TryCreate(url, UriKind.RelativeOrAbsolute, out var uri))
                return false;

            var path = uri.IsAbsoluteUri ? uri.AbsolutePath : url;
            path = Uri.UnescapeDataString(path).TrimStart('/').Replace('\\', '/');

            if (string.IsNullOrWhiteSpace(path) || path.Contains(".."))
                return false;

            relativePath = Path.Combine(path.Split('/'));
            return true;
        }

        private string GetCurrentBaseUrl()
        {
            var request = _httpContextAccessor.HttpContext?.Request;
            if (request != null)
                return $"{request.Scheme}://{request.Host}";

            return _configuration["Backend:BaseUrl"] ?? string.Empty;
        }

        private static string NormalizeFolder(string folder)
        {
            var parts = folder
                .Replace('\\', '/')
                .Split('/', StringSplitOptions.RemoveEmptyEntries)
                .Select(SanitizeFileName)
                .Where(part => !string.IsNullOrWhiteSpace(part));

            return string.Join("/", parts);
        }

        private static string SanitizeFileName(string fileName)
        {
            var invalidChars = Path.GetInvalidFileNameChars();
            var sanitized = new string(fileName
                .Trim()
                .Select(ch => invalidChars.Contains(ch) || ch == '/' || ch == '\\' ? '_' : ch)
                .ToArray());

            sanitized = string.Join("_", sanitized.Split(' ', StringSplitOptions.RemoveEmptyEntries));
            return sanitized.Length <= 80 ? sanitized : sanitized[..80];
        }
    }
}
