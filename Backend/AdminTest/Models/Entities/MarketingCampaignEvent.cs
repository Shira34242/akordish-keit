namespace AkordishKeit.Models.Entities;

public class MarketingCampaignEvent
{
    public long Id { get; set; }
    public int MarketingCampaignId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string VisitorId { get; set; } = string.Empty;
    public int? UserId { get; set; }
    public string? PagePath { get; set; }
    public string? Referrer { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;

    public MarketingCampaign MarketingCampaign { get; set; } = null!;
    public User? User { get; set; }
}
