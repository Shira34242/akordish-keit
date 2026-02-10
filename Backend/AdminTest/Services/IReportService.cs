using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IReportService
{
    Task<int> CreateReportAsync(CreateReportDto dto, int? userId, string? ipAddress);

    Task<PagedResult<ReportDto>> GetReportsAsync(
        int pageNumber,
        int pageSize,
        string? status,
        string? contentType,
        string? reportType);

    Task<ReportDto?> GetReportByIdAsync(int id);

    Task<bool> UpdateReportStatusAsync(int id, UpdateReportStatusDto dto, int resolvedByUserId);

    Task<bool> DeleteReportAsync(int id);
}
