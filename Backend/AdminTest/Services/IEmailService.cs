using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IEmailService
{
    Task<EmailSendResultDto> SendCampaignAsync(SendEmailRequestDto request);
    Task<EmailSendResultDto> SendTestEmailAsync(SendEmailRequestDto request, string recipientEmail);
    Task<int> GetRecipientCountAsync(EmailRecipientGroup group, int? emailGroupId = null);
    Task<List<EmailRecipientDto>> GetRecipientsPreviewAsync(EmailRecipientGroup group, int? emailGroupId = null);
    Task<ManualRecipientValidationResultDto> ValidateManualRecipientsAsync(List<string> emails);
    string BuildPreviewHtml(string subject, string htmlBody);
    Task<bool> SendPasswordResetEmailAsync(string toEmail, string toName, string code);
    Task<MarketingUnsubscribeResultDto> UnsubscribeAsync(string token);
    Task<EmailSubscriberPageDto> GetSubscribersAsync(string? search, string? status, int? groupId, int page, int pageSize);
    Task<EmailSubscriberDto?> CreateSubscriberAsync(SaveEmailSubscriberDto dto);
    Task<EmailSubscriberDto?> UpdateSubscriberAsync(int id, UpdateEmailSubscriberDto dto);
    Task SyncUserSubscriptionAsync(int userId);

    // Email Groups
    Task<List<EmailGroupDto>> GetEmailGroupsAsync();
    Task<EmailGroupDto?> CreateEmailGroupAsync(SaveEmailGroupDto dto, int adminUserId);
    Task<EmailGroupDto?> UpdateEmailGroupAsync(int id, SaveEmailGroupDto dto);
    Task<bool> DeleteEmailGroupAsync(int id);

    // Site Interest
    Task<List<SiteInterestDto>> GetSiteInterestsAsync();
    Task<bool> RegisterSiteInterestAsync(string email, string? source);
    Task<bool> DeleteSiteInterestAsync(int id);
}
