namespace AkordishKeit.Services
{
    public interface IAzureBlobService
    {
        Task<string?> UploadAsync(Stream stream, string fileName, string contentType, string? folder = null);
        Task<string?> UploadStringAsync(string content, string fileName, string? folder = null);
        Task<string?> DownloadStringAsync(string blobPath);
        Task<bool> DeleteAsync(string url);
    }
}
