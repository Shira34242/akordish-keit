namespace AkordishKeit.Models.Entities;

public class MarketingCampaign
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string TargetPath { get; set; } = "/";
    public bool IsActive { get; set; } = true;
    public int? CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public User? CreatedByUser { get; set; }
    public ICollection<MarketingCampaignEvent> Events { get; set; } = new List<MarketingCampaignEvent>();
}
