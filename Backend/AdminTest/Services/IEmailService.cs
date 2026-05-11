using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IEmailService
{
    Task<EmailSendResultDto> SendCampaignAsync(SendEmailRequestDto request);
    Task<int> GetRecipientCountAsync(EmailRecipientGroup group);
    Task<bool> SendPasswordResetEmailAsync(string toEmail, string toName, string code);
}
