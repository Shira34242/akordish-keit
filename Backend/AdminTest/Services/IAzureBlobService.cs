namespace AkordishKeit.Services
{
    public interface IAzureBlobService
    {
        Task<string?> UploadAsync(Stream stream, string fileName, string contentType, string? folder = null);
        Task<bool> DeleteAsync(string url);
    }
}
