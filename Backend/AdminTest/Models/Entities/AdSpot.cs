namespace AkordishKeit.Models.Entities;

public class AdSpot
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string TechnicalId { get; set; } = string.Empty;
    public string Dimensions { get; set; } = string.Empty;
    public string? MobileDimensions { get; set; }
    public bool IsActive { get; set; }
    public int RotationIntervalMs { get; set; } = 30000; // Default 30 seconds
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Navigation Properties
    public virtual ICollection<AdCampaign> Campaigns { get; set; } = new List<AdCampaign>();
}
