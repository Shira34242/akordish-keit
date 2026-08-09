using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services.EmailPipeline;

public interface IEmailSendPipeline
{
    Task<EmailSendResultDto> SendCampaignAsync(SendEmailRequestDto request, int campaignId, bool isTest = false);
    Task<EmailV2ConversionResultDto> SendTestEmailAsync(EmailV2SendTestDto dto, string htmlBody);
    Task<EmailSendResultDto> SendTransientCampaignAsync(SendEmailRequestDto request, Action<int, EmailRecipientSendResultDto>? onRecipientCompleted = null);
    Task<EmailV2TransientRecipientPreviewDto> PreviewTransientRecipientsAsync(SendEmailRequestDto request);
    Task<EmailV2ConversionResultDto> SendTransientTestEmailAsync(EmailV2TransientTestDto dto);
}
