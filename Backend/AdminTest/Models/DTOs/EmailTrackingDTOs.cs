namespace AkordishKeit.Models.DTOs;

public class EmailTrackingMessage
{
    public int SchemaVersion { get; set; } = 2;
    public int CampaignId { get; set; }
    public string MessageId { get; set; } = string.Empty;
    public string RecipientEmail { get; set; } = string.Empty;
    public string SendType { get; set; } = "real";
    public DateTime SentAt { get; set; }
    public string Status { get; set; } = "sent";
    public DateTime? DeliveredAt { get; set; }
    public DateTime? FirstOpenedAt { get; set; }
    public DateTime? LastOpenedAt { get; set; }
    public int OpenCount { get; set; }
    public DateTime? FirstClickedAt { get; set; }
    public DateTime? LastClickedAt { get; set; }
    public int ClickCount { get; set; }
    public Dictionary<string, int> LinkClicks { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public string? BounceType { get; set; }
    public DateTime? UnsubscribedAt { get; set; }
    public DateTime? ComplaintAt { get; set; }
    public bool IsBlocked { get; set; }
    public DateTime? DeferredAt { get; set; }
    public DateTime LastUpdatedAt { get; set; }
}

public class EmailCampaignAnalyticsDto
{
    public int CampaignId { get; set; }
    public int SentCount { get; set; }
    public int DeliveredCount { get; set; }
    public int UniqueOpens { get; set; }
    public int TotalOpens { get; set; }
    public int UniqueClicks { get; set; }
    public int TotalClicks { get; set; }
    public int HardBounces { get; set; }
    public int SoftBounces { get; set; }
    public int Unsubscribes { get; set; }
    public int SpamComplaints { get; set; }
    public int Blocked { get; set; }
    public int Deferred { get; set; }
    public int FailedCount { get; set; }
    public double DeliveryRate { get; set; }
    public double OpenRate { get; set; }
    public double ClickRate { get; set; }
    public double CtorRate { get; set; }
    public List<EmailLinkClickDto> TopLinks { get; set; } = [];
    public string CampaignStatus { get; set; } = string.Empty;
    public DateTime? SentAt { get; set; }
    public DateTime LastUpdatedAt { get; set; }
}

public class EmailLinkClickDto
{
    public string Url { get; set; } = string.Empty;
    public int UniqueClicks { get; set; }
    public int TotalClicks { get; set; }
}

public class BrevoWebhookPayload
{
    public string Event { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public long Id { get; set; }
    public string Date { get; set; } = string.Empty;
    public long Ts { get; set; }
    public string MessageId { get; set; } = string.Empty;
    public long TsEvent { get; set; }
    public string? Subject { get; set; }
    public string? XMailinCustom { get; set; }
    public long TsEpoch { get; set; }
    public long? TemplateId { get; set; }
    public List<string>? Tags { get; set; }
    public string? Link { get; set; }
    public string? UserAgent { get; set; }
    public string? DeviceUsed { get; set; }
    public string? Reason { get; set; }
    public long? ContactId { get; set; }
    public string? SendingIp { get; set; }
    public string? MirrorLink { get; set; }
}

public class EmailSendRequestV2Dto
{
    public int CampaignId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;
    public string? FromName { get; set; }
    public string? FromEmail { get; set; }
    public EmailRecipientGroup RecipientGroup { get; set; }
    public int? EmailGroupId { get; set; }
    public bool UtmEnabled { get; set; }
    public string? UtmSource { get; set; }
    public string? UtmMedium { get; set; }
    public string? UtmCampaign { get; set; }
}

public class EmailDesignVersionDto
{
    public int CampaignId { get; set; }
    public int Version { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string? Preheader { get; set; }
    public string? FromName { get; set; }
    public string DesignJson { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public string? Reason { get; set; }
}
