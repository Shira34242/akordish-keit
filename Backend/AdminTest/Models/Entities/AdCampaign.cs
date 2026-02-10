using AkordishKeit.Models.Enums;

namespace AkordishKeit.Models.Entities;

public class AdCampaign
{
    public int Id { get; set; }
    public string Name { get; set; }
    public int AdSpotId { get; set; }
    public int ClientId { get; set; }
    public string? KnownUrl { get; set; }
    public string? MediaUrl { get; set; }
    public string? MobileMediaUrl { get; set; }
    public int Priority { get; set; }
    public AdCampaignStatus Status { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal Budget { get; set; }
    public int ViewCount { get; set; }
    public int ClickCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? CreatedByUserId { get; set; }
    public int? UpdatedByUserId { get; set; }

    // Navigation Properties
    public virtual AdSpot AdSpot { get; set; }
    public virtual Client Client { get; set; }
    public virtual User? CreatedByUser { get; set; }
    public virtual User? UpdatedByUser { get; set; }
}
