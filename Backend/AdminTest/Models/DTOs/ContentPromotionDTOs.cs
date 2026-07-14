using System.ComponentModel.DataAnnotations;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.DTOs;

public class ContentPromotionDto
{
    public int Id { get; set; }
    public ContentPromotionTargetType TargetType { get; set; }
    public int TargetId { get; set; }
    public ContentPromotionPlacement Placement { get; set; }
    public int Priority { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime? EndsAt { get; set; }
    public bool IsActive { get; set; }
    public bool ShowOnHome { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsCurrentlyActive { get; set; }
}

public class UpsertContentPromotionDto
{
    [Required]
    public ContentPromotionTargetType TargetType { get; set; }

    [Required]
    public int TargetId { get; set; }

    [Required]
    public ContentPromotionPlacement Placement { get; set; } = ContentPromotionPlacement.General;

    [Range(0, 10000)]
    public int Priority { get; set; } = 100;

    public DateTime? StartsAt { get; set; }

    public DateTime? EndsAt { get; set; }

    public bool IsActive { get; set; } = true;

    public bool ShowOnHome { get; set; }

    [StringLength(500)]
    public string? Note { get; set; }
}

public class BulkUpsertContentPromotionDto
{
    [Required]
    public ContentPromotionTargetType TargetType { get; set; }

    [Required]
    public List<int> TargetIds { get; set; } = new();

    [Required]
    public ContentPromotionPlacement Placement { get; set; } = ContentPromotionPlacement.General;

    [Range(0, 10000)]
    public int Priority { get; set; } = 100;

    public DateTime? StartsAt { get; set; }

    public DateTime? EndsAt { get; set; }

    public bool IsActive { get; set; } = true;

    public bool ShowOnHome { get; set; }

    [StringLength(500)]
    public string? Note { get; set; }
}
