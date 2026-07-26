namespace AkordishKeit.Models.Entities;

public class MarketingUnsubscribe
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public DateTime UnsubscribedAt { get; set; } = DateTime.UtcNow;
    public string Source { get; set; } = "email-link";
}
