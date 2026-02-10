using AkordishKeit.Data;
using AkordishKeit.Extensions;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class ReportService : IReportService
{
    private readonly AkordishKeitDbContext _context;

    public ReportService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public async Task<int> CreateReportAsync(CreateReportDto dto, int? userId, string? ipAddress)
    {
        var report = new ContentReport
        {
            UserId = userId,
            ContentType = dto.ContentType,
            ContentId = dto.ContentId,
            ReportType = dto.ReportType,
            Description = dto.Description,
            ReportedAt = DateTime.UtcNow,
            Status = "Pending"
        };

        _context.ContentReports.Add(report);
        await _context.SaveChangesAsync();

        // Send email notification to admins
        await SendReportNotificationEmailAsync(report);

        return report.Id;
    }

    public async Task<PagedResult<ReportDto>> GetReportsAsync(
        int pageNumber,
        int pageSize,
        string? status,
        string? contentType,
        string? reportType)
    {
        var query = _context.ContentReports
            .Include(r => r.User)
            .Include(r => r.ResolvedByUser)
            .AsQueryable();

        // Apply filters
        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(r => r.Status == status);
        }

        if (!string.IsNullOrEmpty(contentType))
        {
            query = query.Where(r => r.ContentType == contentType);
        }

        if (!string.IsNullOrEmpty(reportType))
        {
            query = query.Where(r => r.ReportType == reportType);
        }

        // Order by newest first
        query = query.OrderByDescending(r => r.ReportedAt);

        // Get paginated results
        var pagedEntities = await query.ToPagedResultAsync(pageNumber, pageSize);

        // Map to DTOs
        var dtos = new List<ReportDto>();
        foreach (var report in pagedEntities.Items)
        {
            var dto = await MapToDtoAsync(report);
            dtos.Add(dto);
        }

        return new PagedResult<ReportDto>
        {
            Items = dtos,
            TotalCount = pagedEntities.TotalCount,
            PageNumber = pagedEntities.PageNumber,
            PageSize = pagedEntities.PageSize
        };
    }

    public async Task<ReportDto?> GetReportByIdAsync(int id)
    {
        var report = await _context.ContentReports
            .Include(r => r.User)
            .Include(r => r.ResolvedByUser)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (report == null)
            return null;

        return await MapToDtoAsync(report);
    }

    public async Task<bool> UpdateReportStatusAsync(int id, UpdateReportStatusDto dto, int resolvedByUserId)
    {
        var report = await _context.ContentReports.FindAsync(id);

        if (report == null)
            return false;

        report.Status = dto.Status;
        report.AdminNotes = dto.AdminNotes;
        report.ResolvedAt = DateTime.UtcNow;
        report.ResolvedByUserId = resolvedByUserId;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteReportAsync(int id)
    {
        var report = await _context.ContentReports.FindAsync(id);

        if (report == null)
            return false;

        // Hard delete - no soft delete as requested
        _context.ContentReports.Remove(report);
        await _context.SaveChangesAsync();
        return true;
    }

    // ========================================
    // Private Helper Methods
    // ========================================

    private async Task<ReportDto> MapToDtoAsync(ContentReport report)
    {
        var (contentTitle, contentUrl) = await GetContentInfoAsync(report.ContentType, report.ContentId);

        return new ReportDto
        {
            Id = report.Id,
            ContentType = report.ContentType,
            ContentId = report.ContentId,
            ContentTitle = contentTitle,
            ContentUrl = contentUrl,
            ReportType = report.ReportType,
            Description = report.Description,
            ReportedAt = report.ReportedAt,
            Status = report.Status,
            ReporterUsername = report.User?.Username,
            ResolvedAt = report.ResolvedAt,
            ResolvedByUsername = report.ResolvedByUser?.Username,
            AdminNotes = report.AdminNotes
        };
    }

    private async Task<(string title, string url)> GetContentInfoAsync(string contentType, int contentId)
    {
        switch (contentType)
        {
            case "Song":
                var song = await _context.Songs
                    .Include(s => s.SongArtists)
                        .ThenInclude(sa => sa.Artist)
                    .FirstOrDefaultAsync(s => s.Id == contentId);

                if (song != null)
                {
                    var artistNames = string.Join(", ", song.SongArtists.Select(sa => sa.Artist.Name));
                    return ($"{song.Title} - {artistNames}", $"/song/{song.Id}");
                }
                break;

            case "Article":
            case "BlogPost":
                var article = await _context.Articles
                    .FirstOrDefaultAsync(a => a.Id == contentId);

                if (article != null)
                {
                    var route = article.ContentType == 0 ? "news" : "blog";
                    return (article.Title, $"/{route}/{article.Slug}");
                }
                break;

            case "General":
                return ("הודעה כללית למערכת", "/");
        }

        return ("תוכן לא נמצא", "#");
    }

    private async Task SendReportNotificationEmailAsync(ContentReport report)
    {
        // TODO: Implement email sending to admins
        // This should:
        // 1. Get all admin emails from Users table where Role = Admin
        // 2. Compose email with report details
        // 3. Send email using email service (SendGrid, SMTP, etc.)
        // 4. Log the notification

        await Task.CompletedTask; // Placeholder
    }
}
