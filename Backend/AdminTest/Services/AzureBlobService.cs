using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;

namespace AkordishKeit.Services
{
    public class AzureBlobService : IAzureBlobService
    {
        private readonly BlobContainerClient _container;
        private readonly string _containerName;
        private readonly ILogger<AzureBlobService> _logger;

        public AzureBlobService(IConfiguration configuration, ILogger<AzureBlobService> logger)
        {
            _logger = logger;
            _containerName = configuration["AzureBlobStorage:ContainerName"] ?? "media";
            var connectionString = configuration["AzureBlobStorage:ConnectionString"]
                ?? throw new InvalidOperationException("AzureBlobStorage:ConnectionString is not configured.");
            _container = new BlobServiceClient(connectionString).GetBlobContainerClient(_containerName);
        }

        public async Task<string?> UploadAsync(Stream stream, string fileName, string contentType, string? folder = null)
        {
            try
            {
                await _container.CreateIfNotExistsAsync(PublicAccessType.Blob);

                var now = DateTime.UtcNow;
                var blobFolder = folder ?? $"uploads/{now.Year}/{now.Month:D2}";
                var ext = Path.GetExtension(fileName).ToLowerInvariant();
                var blobName = $"{blobFolder}/{now:yyyyMMdd_HHmmss}_{Guid.NewGuid()}{ext}";

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
                _logger.LogError(ex, "Azure Blob upload failed: {FileName}", fileName);
                return null;
            }
        }

        public async Task<bool> DeleteAsync(string url)
        {
            var blobName = ExtractBlobName(url);
            if (blobName == null) return false;

            try
            {
                var blobClient = _container.GetBlobClient(blobName);
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
    }
}
