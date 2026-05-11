namespace AkordishKeit.Models.DTOs;

public class SendEmailRequestDto
{
    public string Subject { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;
    public string? PlainTextBody { get; set; }
    public EmailRecipientGroup RecipientGroup { get; set; } = EmailRecipientGroup.AllUsers;
    public string? FromName { get; set; }
    public string? FromEmail { get; set; }
}

public enum EmailRecipientGroup
{
    AllUsers = 0,
    ActiveOnly = 1,
    MarketingConsentOnly = 2
}

public class EmailSendResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int SentCount { get; set; }
    public int FailedCount { get; set; }
}
