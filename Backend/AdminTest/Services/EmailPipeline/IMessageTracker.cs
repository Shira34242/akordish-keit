using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services.EmailPipeline;

public interface IMessageTracker
{
    Task SaveSentMessageAsync(EmailTrackingMessage message);
    Task<EmailTrackingMessage?> GetMessageAsync(int campaignId, string messageId);
    Task<List<EmailTrackingMessage>> GetCampaignMessagesAsync(int campaignId, string? sendType = null);
    Task<bool> UpdateMessageAsync(int campaignId, string messageId, Action<EmailTrackingMessage> update);
    Task<EmailCampaignAnalyticsDto> GetCampaignAnalyticsAsync(int campaignId);
}
