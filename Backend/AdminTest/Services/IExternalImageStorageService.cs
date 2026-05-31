namespace AkordishKeit.Services;

public interface IExternalImageStorageService
{
    Task<string?> StoreExternalImageIfNeededAsync(string? imageUrl, string folder, string fallbackFileNamePrefix);
}
