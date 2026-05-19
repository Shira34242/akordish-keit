using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface ISmartContentImportService
{
    Task<ImportContentFromUrlResponseDto> ImportFromUrlAsync(string sourceUrl, string contentType);
}
