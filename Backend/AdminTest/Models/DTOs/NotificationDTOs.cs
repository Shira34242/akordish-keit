using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.DTOs;

public class NotificationDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public NotificationType Type { get; set; }
    public NotificationCategory Category { get; set; }
    public string? RelatedEntityType { get; set; }
    public int? RelatedEntityId { get; set; }
    public string? ActionUrl { get; set; }
    public string? MediaUrl { get; set; }
    public string? MediaType { get; set; }
    public string? MediaThumbnailUrl { get; set; }
    public string? MediaAltText { get; set; }
    public List<NotificationAttachmentDto> Attachments { get; set; } = new();
    public string? CampaignName { get; set; }
    public string? AudienceLabel { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ReadAt { get; set; }
    public int? CreatedByUserId { get; set; }
}

public class NotificationAttachmentDto
{
    public string Type { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string? Label { get; set; }
    public string? ClickUrl { get; set; }
}

public class CreateNotificationDto
{
    public int UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public NotificationType Type { get; set; }
    public NotificationCategory Category { get; set; }
    public string? RelatedEntityType { get; set; }
    public int? RelatedEntityId { get; set; }
    public string? ActionUrl { get; set; }
    public string? MediaUrl { get; set; }
    public string? MediaType { get; set; }
    public string? MediaThumbnailUrl { get; set; }
    public string? MediaAltText { get; set; }
    public List<NotificationAttachmentDto>? Attachments { get; set; }
    public string? CampaignName { get; set; }
    public string? AudienceLabel { get; set; }
    public int? CreatedByUserId { get; set; }
}

public class SendUserNotificationDto
{
    public int UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? ActionUrl { get; set; }
    public string? MediaUrl { get; set; }
    public string? MediaType { get; set; }
    public string? MediaThumbnailUrl { get; set; }
    public string? MediaAltText { get; set; }
    public List<NotificationAttachmentDto>? Attachments { get; set; }
    public bool IsMarketingContent { get; set; }
}

public class SendStatusNotificationDto
{
    public int UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public NotificationType Type { get; set; } = NotificationType.StatusUpdate;
    public NotificationCategory Category { get; set; } = NotificationCategory.System;
    public string? RelatedEntityType { get; set; }
    public int? RelatedEntityId { get; set; }
    public string? ActionUrl { get; set; }
}

public class SendBroadcastNotificationDto
{
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? ActionUrl { get; set; }
    public string? MediaUrl { get; set; }
    public string? MediaType { get; set; }
    public string? MediaThumbnailUrl { get; set; }
    public string? MediaAltText { get; set; }
    public List<NotificationAttachmentDto>? Attachments { get; set; }
    public string? CampaignName { get; set; }
    public bool IsMarketingContent { get; set; }
    public int? GroupId { get; set; }
    public bool SendToAll { get; set; }
    public List<int>? UserIds { get; set; }
    public int? Role { get; set; }
    public bool? IsActive { get; set; }
    public int? ContentTag { get; set; }
    public int? PreferredInstrumentId { get; set; }
    public DateTime? JoinedFrom { get; set; }
    public DateTime? JoinedTo { get; set; }
    public string? AddressContains { get; set; }
}

public class BroadcastNotificationResultDto
{
    public int SentCount { get; set; }
    public string AudienceLabel { get; set; } = string.Empty;
}

public class UnreadNotificationCountDto
{
    public int Count { get; set; }
}

public class NotificationGroupDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public bool SendToAll { get; set; }
    public int? Role { get; set; }
    public bool? IsActive { get; set; }
    public int? ContentTag { get; set; }
    public int? PreferredInstrumentId { get; set; }
    public DateTime? JoinedFrom { get; set; }
    public DateTime? JoinedTo { get; set; }
    public string? AddressContains { get; set; }
    public List<int>? MemberUserIds { get; set; }
    public int EstimatedUserCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class SaveNotificationGroupDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public bool SendToAll { get; set; }
    public int? Role { get; set; }
    public bool? IsActive { get; set; }
    public int? ContentTag { get; set; }
    public int? PreferredInstrumentId { get; set; }
    public DateTime? JoinedFrom { get; set; }
    public DateTime? JoinedTo { get; set; }
    public string? AddressContains { get; set; }
    public List<int>? MemberUserIds { get; set; }
}
