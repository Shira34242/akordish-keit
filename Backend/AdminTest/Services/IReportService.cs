using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IReportService
{
    Task<int> CreateReportAsync(CreateReportDto dto, int? userId, string? ipAddress);

    Task<PagedResult<ChordRequestDto>> GetChordRequestsAsync(int pageNumber, int pageSize, int userId);

    Task<ChordRequestMatchDto> FindChordRequestMatchesAsync(string songName, string? artistName);

    Task<bool> UpdateChordRequestGroupAsync(UpdateChordRequestGroupDto dto, int resolvedByUserId);

    Task<bool> CanAccessChordRequestsAsync(int userId);

    Task<PagedResult<ReportDto>> GetReportsAsync(
        int pageNumber,
        int pageSize,
        string? status,
        string? contentType,
        string? reportType);

    Task<ReportDto?> GetReportByIdAsync(int id);

    Task<ReportSummaryDto> GetReportSummaryAsync(string? status, string? contentType, string? reportType);

    Task<bool> UpdateReportStatusAsync(int id, UpdateReportStatusDto dto, int resolvedByUserId);

    Task<bool> DeleteReportAsync(int id);

    Task<int> BulkUpdateReportStatusAsync(BulkReportActionDto dto, int resolvedByUserId);

    Task<int> BulkDeleteReportsAsync(BulkReportDeleteDto dto);

    Task<(bool Success, string Message, int? ArtistId)> ApproveNewArtistAsync(int reportId, int adminUserId);

    Task<int> CleanupArtistDuplicatesAsync(int adminUserId);
}
