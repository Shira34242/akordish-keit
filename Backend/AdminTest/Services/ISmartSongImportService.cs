using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface ISmartSongImportService
{
    Task<ImportSongFromUrlResponseDto> ImportFromUrlAsync(string sourceUrl, int userId);
}
