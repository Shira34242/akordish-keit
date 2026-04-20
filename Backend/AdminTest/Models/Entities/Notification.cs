using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities;

public class Notification
{
    public int Id { get; set; }
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
    public string? MediaDisplaySize { get; set; }
    public string? AttachmentsJson { get; set; }
    public string? CampaignName { get; set; }
    public string? AudienceLabel { get; set; }
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ReadAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }

    public virtual User User { get; set; } = null!;
    public virtual User? CreatedByUser { get; set; }
}
