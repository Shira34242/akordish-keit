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
