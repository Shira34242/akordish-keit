using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities;

public class ContentPromotion
{
    public int Id { get; set; }

    public ContentPromotionTargetType TargetType { get; set; }

    public int TargetId { get; set; }

    public ContentPromotionPlacement Placement { get; set; } = ContentPromotionPlacement.General;

    public int Priority { get; set; } = 100;

    public DateTime? StartsAt { get; set; }

    public DateTime? EndsAt { get; set; }

    public bool IsActive { get; set; } = true;

    public bool ShowOnHome { get; set; }

    public string? Note { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public string? UpdatedBy { get; set; }
}
