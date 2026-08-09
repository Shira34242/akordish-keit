namespace AkordishKeit.Models.DTOs;

public class SaveEmailV2TemplateDto
{
    public string Subject { get; set; } = string.Empty;
    public string FromName { get; set; } = "אקורדישקייט";
    public string? FromEmail { get; set; }
    public string DesignJson { get; set; } = string.Empty;
    public string Mjml { get; set; } = string.Empty;
    public string? PreviewText { get; set; }
    public int? CampaignId { get; set; }
}

public class EmailV2TemplateDto
{
    public int CampaignId { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string FromName { get; set; } = string.Empty;
    public string? FromEmail { get; set; }
    public string DesignJson { get; set; } = string.Empty;
    public string? Mjml { get; set; }
    public string HtmlBody { get; set; } = string.Empty;
    public string? PreviewText { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class EmailV2SendTestDto
{
    public int CampaignId { get; set; }
    public string RecipientEmail { get; set; } = string.Empty;
}

public class EmailV2TransientSendDto
{
    public string Subject { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;
    public string? FromName { get; set; }
    public string? FromEmail { get; set; }
    public EmailRecipientGroup RecipientGroup { get; set; }
    public int? EmailGroupId { get; set; }
    public List<string>? ExcludedEmails { get; set; }
}

public class EmailTransientSendJobDto
{
    public string SendId { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public int PlannedCount { get; set; }
    public int ProcessedCount { get; set; }
    public int SentCount { get; set; }
    public int FailedCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public string? Error { get; set; }
    public List<EmailRecipientSendResultDto> Recipients { get; set; } = [];
}

public class EmailV2TransientRecipientPreviewDto
{
    public int EligibleCount { get; set; }
    public int ExcludedCount { get; set; }
    public int FinalCount { get; set; }
}

public class EmailV2TransientTestDto
{
    public string Subject { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;
    public string? FromName { get; set; }
    public string? FromEmail { get; set; }
    public string RecipientEmail { get; set; } = string.Empty;
}

public class EmailV2ConversionResultDto
{
    public bool Success { get; set; }
    public string? Html { get; set; }
    public string? Error { get; set; }
    public List<string> Warnings { get; set; } = [];
    public int SentCount { get; set; }
    public int FailedCount { get; set; }
    public string? Message { get; set; }
}
