using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IEmailService
{
    Task<EmailSendResultDto> SendCampaignAsync(SendEmailRequestDto request);
    Task<int> GetRecipientCountAsync(EmailRecipientGroup group, int? emailGroupId = null);
    Task<bool> SendPasswordResetEmailAsync(string toEmail, string toName, string code);

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
