namespace AkordishKeit.Models.Entities;

public class EmailCampaign
{
    public int Id { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;
    public string FromName { get; set; } = string.Empty;
    public int RecipientGroup { get; set; }
    public int? EmailGroupId { get; set; }
    public string Status { get; set; } = "draft";
    public DateTime? ScheduledAt { get; set; }
    public DateTime? SentAt { get; set; }
    public int SentCount { get; set; }
    public int FailedCount { get; set; }
    public int OpenCount { get; set; }
    public int ClickCount { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
