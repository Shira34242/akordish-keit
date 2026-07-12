using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Services;

public interface INotificationService
{
    Task<NotificationDto> CreateAsync(CreateNotificationDto dto);
    Task<List<NotificationDto>> GetUserNotificationsAsync(int userId, int pageNumber = 1, int pageSize = 30);
    Task<List<NotificationDto>> GetUserNotificationsForAdminAsync(int userId, int pageNumber = 1, int pageSize = 50);
    Task<int> GetUnreadCountAsync(int userId);
    Task<bool> MarkAsReadAsync(int notificationId, int userId);
    Task MarkAllAsReadAsync(int userId);
    Task<bool> DeleteAsync(int notificationId, int userId);
    Task DeleteAllAsync(int userId);
    Task<NotificationDto> SendAdminMessageAsync(SendUserNotificationDto dto, int createdByUserId);
    Task<BroadcastNotificationResultDto> SendBroadcastAsync(SendBroadcastNotificationDto dto, int createdByUserId);
    Task<List<NotificationGroupDto>> GetGroupsAsync();
    Task<NotificationGroupDto> CreateGroupAsync(SaveNotificationGroupDto dto, int createdByUserId);
    Task<NotificationGroupDto?> UpdateGroupAsync(int groupId, SaveNotificationGroupDto dto);
    Task<bool> DeleteGroupAsync(int groupId);
    Task<NotificationDto> SendStatusUpdateAsync(int userId, string title, string message, NotificationType type, NotificationCategory category, string? relatedEntityType, int? relatedEntityId, string? actionUrl, int createdByUserId);
    Task NotifySongSubmittedAsync(int userId, int songId, string songTitle);
    Task NotifySongApprovedAsync(int userId, int songId, string songTitle);
    Task NotifySongRejectedAsync(int userId, int songId, string songTitle);
    Task NotifyArticleSubmittedAsync(int userId, int articleId, string articleTitle);
    Task NotifyArticleApprovedAsync(int userId, int articleId, string articleTitle, string? slug, int contentType);
    Task NotifyEventSubmittedAsync(int userId, int eventId, string eventName);
    Task NotifyEventApprovedAsync(int userId, int eventId, string eventName);
    Task NotifyEventRejectedAsync(int userId, int eventId, string eventName);
    Task NotifyTeacherSubmittedAsync(int userId, int teacherId, string displayName);
    Task NotifyTeacherApprovedAsync(int userId, int teacherId, string displayName);
    Task NotifyServiceProviderSubmittedAsync(int userId, int providerId, string displayName);
    Task NotifyServiceProviderApprovedAsync(int userId, int providerId, string displayName);
    Task NotifyArtistSubmittedAsync(int userId, int artistId, string artistName);
    Task NotifyArtistApprovedAsync(int userId, int artistId, string artistName);
    Task NotifyArtistRejectedAsync(int userId, int artistId, string artistName);
    Task NotifyTeacherRejectedAsync(int userId, int teacherId, string displayName);
    Task NotifyServiceProviderRejectedAsync(int userId, int providerId, string displayName);
}
