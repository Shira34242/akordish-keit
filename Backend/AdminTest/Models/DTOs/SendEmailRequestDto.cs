namespace AkordishKeit.Models.DTOs;

public class SendEmailRequestDto
{
    public string Subject { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;
    public string? PlainTextBody { get; set; }
    public EmailRecipientGroup RecipientGroup { get; set; } = EmailRecipientGroup.AllUsers;
    public int? EmailGroupId { get; set; }
    public string? FromName { get; set; }
    public string? FromEmail { get; set; }
    public List<string>? ExcludedEmails { get; set; }
    public List<string>? ManualRecipients { get; set; }
    public bool ConfirmedManualRecipientPermission { get; set; }
}

public enum EmailRecipientGroup
{
    AllUsers             = 0,
    ActiveOnly           = 1,
    MarketingConsentOnly = 2,
    AllTeachers          = 3,
    AllArtists           = 4,
    AllServiceProviders  = 5,
    InterestedInSite     = 6,
    CustomGroup          = 7,
    NoProfessionalProfile = 8,
    ManualOneTime         = 9
}

public class EmailSendResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int AttemptedCount { get; set; }
    public int SentCount { get; set; }
    public int FailedCount { get; set; }
    public List<EmailRecipientSendResultDto> Recipients { get; set; } = [];
}

public class EmailRecipientSendResultDto
{
    public string Email { get; set; } = string.Empty;
    public bool AcceptedByBrevo { get; set; }
    public string? MessageId { get; set; }
    public string? Error { get; set; }
}

public class SendTestEmailRequestDto : SendEmailRequestDto
{
    public string RecipientEmail { get; set; } = string.Empty;
}

public class MarketingUnsubscribeResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class MarketingUnsubscribeRequestDto
{
    public string Token { get; set; } = string.Empty;
}

public class ManualRecipientValidationRequestDto
{
    public List<string> Emails { get; set; } = [];
}

public class ManualRecipientValidationResultDto
{
    public int EligibleCount { get; set; }
    public int SuppressedCount { get; set; }
    public int DuplicateCount { get; set; }
    public int MaxAllowed { get; set; }
    public List<string> InvalidEmails { get; set; } = [];
}
