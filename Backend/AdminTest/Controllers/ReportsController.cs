using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;
    private readonly ILogger<ReportsController> _logger;

    public ReportsController(IReportService reportService, ILogger<ReportsController> logger)
    {
        _reportService = reportService;
        _logger = logger;
    }

    // POST: api/Reports
    // ניתן לדווח גם בלי התחברות (אורחים)
    [HttpPost]
    public async Task<IActionResult> CreateReport([FromBody] CreateReportDto dto)
    {
        try
        {
            // Get userId if user is authenticated
            int? userId = null;
            if (User.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (int.TryParse(userIdClaim, out int parsedUserId))
                {
                    userId = parsedUserId;
                }
            }

            // Get IP address for tracking
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

            var reportId = await _reportService.CreateReportAsync(dto, userId, ipAddress);

            _logger.LogInformation("Report created: ReportId={ReportId} ContentType={ContentType} UserId={UserId} IP={IP}",
                reportId, dto.ContentType, userId, ipAddress);
            return Ok(new { id = reportId, message = "הדיווח נשלח בהצלחה, תודה!" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Create report failed: ContentType={ContentType}", dto.ContentType);
            return BadRequest(new { message = "שגיאה בשליחת הדיווח", error = ex.Message });
        }
    }

    // GET: api/Reports/chord-requests
    [HttpGet("chord-requests")]
    [Authorize]
    public async Task<ActionResult<PagedResult<ChordRequestDto>>> GetChordRequests(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out int userId))
        {
            return Unauthorized(new { message = "משתמש לא מורשה" });
        }

        if (!await _reportService.CanAccessChordRequestsAsync(userId))
        {
            return Forbid();
        }

        var result = await _reportService.GetChordRequestsAsync(pageNumber, pageSize, userId);
        return Ok(result);
    }

    // GET: api/Reports/chord-requests/matches
    [HttpGet("chord-requests/matches")]
    [Authorize]
    public async Task<ActionResult<ChordRequestMatchDto>> FindChordRequestMatches(
        [FromQuery] string songName,
        [FromQuery] string? artistName = null)
    {
        var result = await _reportService.FindChordRequestMatchesAsync(songName, artistName);
        return Ok(result);
    }

    // PATCH: api/Reports/chord-requests/group
    [HttpPatch("chord-requests/group")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<IActionResult> UpdateChordRequestGroup([FromBody] UpdateChordRequestGroupDto dto)
    {
        try
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int resolvedByUserId))
            {
                return Unauthorized(new { message = "משתמש לא מורשה" });
            }

            var success = await _reportService.UpdateChordRequestGroupAsync(dto, resolvedByUserId);

            if (!success)
            {
                return NotFound(new { message = "בקשה לא נמצאה" });
            }

            return Ok(new { message = "בקשת האקורדים עודכנה בהצלחה" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "שגיאה בעדכון בקשת האקורדים", error = ex.Message });
        }
    }

    // GET: api/Reports
    [HttpGet]
    [Authorize(Policy = "reports.manage")]
    public async Task<ActionResult<PagedResult<ReportDto>>> GetReports(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? status = null,
        [FromQuery] string? contentType = null,
        [FromQuery] string? reportType = null)
    {
        var result = await _reportService.GetReportsAsync(pageNumber, pageSize, status, contentType, reportType);
        return Ok(result);
    }

    // GET: api/Reports/5
    [HttpGet("{id}")]
    [Authorize(Policy = "reports.manage")]
    public async Task<ActionResult<ReportDto>> GetReport(int id)
    {
        var report = await _reportService.GetReportByIdAsync(id);

        if (report == null)
        {
            return NotFound(new { message = "דיווח לא נמצא" });
        }

        return Ok(report);
    }

    // PATCH: api/Reports/5/status
    [HttpPatch("{id}/status")]
    [Authorize(Policy = "reports.manage")]
    public async Task<IActionResult> UpdateReportStatus(int id, [FromBody] UpdateReportStatusDto dto)
    {
        try
        {
            // Get current user ID
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int resolvedByUserId))
            {
                return Unauthorized(new { message = "משתמש לא מורשה" });
            }

            var success = await _reportService.UpdateReportStatusAsync(id, dto, resolvedByUserId);

            if (!success)
            {
                return NotFound(new { message = "דיווח לא נמצא" });
            }

            _logger.LogInformation("Report status updated: ReportId={ReportId} NewStatus={Status} ResolvedBy={AdminId}",
                id, dto.Status, resolvedByUserId);
            return Ok(new { message = "סטטוס הדיווח עודכן בהצלחה" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Update report status failed: ReportId={ReportId}", id);
            return BadRequest(new { message = "שגיאה בעדכון הדיווח", error = ex.Message });
        }
    }

    // POST: api/Reports/5/approve-artist
    [HttpPost("{id}/approve-artist")]
    [Authorize(Policy = "reports.manage")]
    public async Task<IActionResult> ApproveNewArtist(int id)
    {
        try
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int adminUserId))
                return Unauthorized(new { message = "משתמש לא מורשה" });

            var (success, message, artistId) = await _reportService.ApproveNewArtistAsync(id, adminUserId);

            if (!success)
                return BadRequest(new { message });

            _logger.LogInformation("New artist approved via report: ReportId={ReportId} ArtistId={ArtistId} AdminId={AdminId}",
                id, artistId, adminUserId);
            return Ok(new { message, artistId });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "שגיאה באישור האמן", error = ex.Message });
        }
    }

    // DELETE: api/Reports/5
    [HttpDelete("{id}")]
    [Authorize(Policy = "reports.manage")]
    public async Task<IActionResult> DeleteReport(int id)
    {
        var success = await _reportService.DeleteReportAsync(id);

        if (!success)
        {
            return NotFound(new { message = "דיווח לא נמצא" });
        }

        _logger.LogInformation("Report deleted: ReportId={ReportId}", id);
        return Ok(new { message = "הדיווח נמחק לצמיתות" });
    }
}
