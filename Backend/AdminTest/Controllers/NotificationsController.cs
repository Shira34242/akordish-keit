using System.Security.Claims;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;
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
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(INotificationService notificationService, ILogger<NotificationsController> logger)
    {
        _notificationService = notificationService;
        _logger = logger;
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

    [HttpDelete("all")]
    public async Task<IActionResult> DeleteAllNotifications()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized();
        }

        await _notificationService.DeleteAllAsync(userId.Value);
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

        var success = await _notificationService.DeleteAsync(id, userId.Value);
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

            if (dto.UserId <= 0 || string.IsNullOrWhiteSpace(dto.Title) || !HasNotificationContent(dto.Message, dto.MediaUrl, dto.ActionUrl, dto.Attachments))
            {
                return BadRequest(new { message = "חובה לבחור משתמש ולהוסיף הודעה, תמונה או צירוף" });
            }

            var notification = await _notificationService.SendAdminMessageAsync(dto, adminUserId.Value);

            _logger.LogInformation("Admin sent user message: AdminId={AdminId} TargetUserId={TargetUserId} Title={Title}",
                adminUserId.Value, dto.UserId, dto.Title);
            return Ok(notification);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("SendUserMessage validation failed: {Error}", ex.Message);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SendUserMessage failed: TargetUserId={TargetUserId}", dto.UserId);
            return StatusCode(500, new { message = $"שליחת ההודעה נכשלה: {ex.Message}" });
        }
    }

    [HttpPost("admin/send-broadcast")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<BroadcastNotificationResultDto>> SendBroadcast([FromBody] SendBroadcastNotificationDto dto)
    {
        try
        {
            var adminUserId = GetCurrentUserId();
            if (!adminUserId.HasValue)
            {
                return Unauthorized();
            }

            if (string.IsNullOrWhiteSpace(dto.Title) || !HasNotificationContent(dto.Message, dto.MediaUrl, dto.ActionUrl, dto.Attachments))
            {
                return BadRequest(new { message = "חובה להוסיף הודעה, תמונה או צירוף" });
            }

            var result = await _notificationService.SendBroadcastAsync(dto, adminUserId.Value);
            _logger.LogInformation("Admin sent broadcast: AdminId={AdminId} Title={Title} SentCount={SentCount}",
                adminUserId.Value, dto.Title, result.SentCount);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("SendBroadcast validation failed: {Error}", ex.Message);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SendBroadcast failed: AdminId={AdminId}", GetCurrentUserId());
            return StatusCode(500, new { message = $"שליחת התפוצה נכשלה: {ex.Message}" });
        }
    }

    [HttpGet("admin/groups")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<List<NotificationGroupDto>>> GetGroups()
    {
        var groups = await _notificationService.GetGroupsAsync();
        return Ok(groups);
    }

    [HttpGet("admin/broadcast-analytics")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<BroadcastNotificationAnalyticsSummaryDto>> GetBroadcastAnalytics()
    {
        var analytics = await _notificationService.GetBroadcastAnalyticsAsync();
        return Ok(analytics);
    }

    [HttpPost("admin/groups")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<NotificationGroupDto>> CreateGroup([FromBody] SaveNotificationGroupDto dto)
    {
        try
        {
            var adminUserId = GetCurrentUserId();
            if (!adminUserId.HasValue)
            {
                return Unauthorized();
            }

            var group = await _notificationService.CreateGroupAsync(dto, adminUserId.Value);
            _logger.LogInformation("Notification group created: AdminId={AdminId} GroupId={GroupId} Name={Name}",
                adminUserId.Value, group.Id, group.Name);
            return Ok(group);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("admin/groups/{groupId:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<NotificationGroupDto>> UpdateGroup(int groupId, [FromBody] SaveNotificationGroupDto dto)
    {
        try
        {
            var group = await _notificationService.UpdateGroupAsync(groupId, dto);
            return group == null ? NotFound() : Ok(group);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("admin/groups/{groupId:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteGroup(int groupId)
    {
        var success = await _notificationService.DeleteGroupAsync(groupId);
        return success ? NoContent() : NotFound();
    }

    [HttpPost("admin/send-status-update")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<NotificationDto>> SendStatusUpdate([FromBody] SendStatusNotificationDto dto)
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
                return BadRequest(new { message = "חובה לבחור משתמש, כותרת והודעת סטטוס" });
            }

            if (!IsAllowedAdminStatusType(dto.Type))
            {
                return BadRequest(new { message = "סוג הסטטוס שנבחר לא תקין" });
            }

            var notification = await _notificationService.SendStatusUpdateAsync(
                dto.UserId,
                dto.Title,
                dto.Message,
                dto.Type,
                dto.Category,
                dto.RelatedEntityType,
                dto.RelatedEntityId,
                dto.ActionUrl,
                adminUserId.Value);

            _logger.LogInformation("Admin sent status update: AdminId={AdminId} TargetUserId={TargetUserId} Type={Type} Title={Title}",
                adminUserId.Value, dto.UserId, dto.Type, dto.Title);
            return Ok(notification);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("SendStatusUpdate validation failed: {Error}", ex.Message);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SendStatusUpdate failed: TargetUserId={TargetUserId}", dto.UserId);
            return StatusCode(500, new { message = $"שליחת עדכון הסטטוס נכשלה: {ex.Message}" });
        }
    }

    private static bool IsAllowedAdminStatusType(NotificationType type)
    {
        return type is NotificationType.StatusUpdate
            or NotificationType.Rejection
            or NotificationType.Approval
            or NotificationType.System;
    }

    private static bool HasNotificationContent(
        string? message,
        string? mediaUrl,
        string? actionUrl,
        List<NotificationAttachmentDto>? attachments)
    {
        return !string.IsNullOrWhiteSpace(message)
            || !string.IsNullOrWhiteSpace(mediaUrl)
            || !string.IsNullOrWhiteSpace(actionUrl)
            || attachments is { Count: > 0 };
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? User.FindFirst("id")?.Value
                       ?? User.FindFirst("sub")?.Value;

        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }
}
