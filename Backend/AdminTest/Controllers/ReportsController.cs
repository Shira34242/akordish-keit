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

    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
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

            return Ok(new { id = reportId, message = "הדיווח נשלח בהצלחה, תודה!" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "שגיאה בשליחת הדיווח", error = ex.Message });
        }
    }

    // GET: api/Reports
    [HttpGet]
    [Authorize(Roles = "Admin")]
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
    [Authorize(Roles = "Admin")]
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
    [Authorize(Roles = "Admin")]
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

            return Ok(new { message = "סטטוס הדיווח עודכן בהצלחה" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = "שגיאה בעדכון הדיווח", error = ex.Message });
        }
    }

    // DELETE: api/Reports/5
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteReport(int id)
    {
        var success = await _reportService.DeleteReportAsync(id);

        if (!success)
        {
            return NotFound(new { message = "דיווח לא נמצא" });
        }

        return Ok(new { message = "הדיווח נמחק לצמיתות" });
    }
}
