using System.Security.Claims;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _notificationService;

    public NotificationsController(INotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<ActionResult<List<NotificationDto>>> GetMyNotifications(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 30)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        var notifications = await _notificationService.GetUserNotificationsAsync(userId.Value, pageNumber, pageSize);
        return Ok(notifications);
    }

    [HttpGet("admin/user/{userId:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<List<NotificationDto>>> GetUserNotificationsForAdmin(
        int userId,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 50)
    {
        var notifications = await _notificationService.GetUserNotificationsForAdminAsync(userId, pageNumber, pageSize);
        return Ok(notifications);
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<UnreadNotificationCountDto>> GetUnreadCount()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        var count = await _notificationService.GetUnreadCountAsync(userId.Value);
        return Ok(new UnreadNotificationCountDto { Count = count });
    }

    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkAsRead(int id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        var success = await _notificationService.MarkAsReadAsync(id, userId.Value);
        return success ? NoContent() : NotFound();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllAsRead()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        await _notificationService.MarkAllAsReadAsync(userId.Value);
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteNotification(int id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        var success = await _notificationService.SoftDeleteAsync(id, userId.Value);
        return success ? NoContent() : NotFound();
    }

    [HttpPost("admin/send-user-message")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<NotificationDto>> SendUserMessage([FromBody] SendUserNotificationDto dto)
    {
        try
        {
            var adminUserId = GetCurrentUserId();
            if (!adminUserId.HasValue)
            {
                return Unauthorized();
            }

            if (dto.UserId <= 0 || string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Message))
            {
                return BadRequest(new { message = "חובה לבחור משתמש, כותרת והודעה" });
            }

            var notification = await _notificationService.SendAdminMessageAsync(
                dto.UserId,
                dto.Title,
                dto.Message,
                dto.ActionUrl,
                adminUserId.Value);

            return Ok(notification);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"שליחת ההודעה נכשלה: {ex.Message}" });
        }
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? User.FindFirst("id")?.Value
                       ?? User.FindFirst("sub")?.Value;

        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }
}
