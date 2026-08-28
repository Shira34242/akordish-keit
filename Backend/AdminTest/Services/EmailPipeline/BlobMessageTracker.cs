using System.Text;
using System.Text.Json;
using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services.EmailPipeline;

public class BlobMessageTracker : IMessageTracker
{
    private readonly IAzureBlobService _blobService;
    private readonly ILogger<BlobMessageTracker> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    public BlobMessageTracker(IAzureBlobService blobService, ILogger<BlobMessageTracker> logger)
    {
        _blobService = blobService;
        _logger = logger;
    }

    public async Task SaveSentMessageAsync(EmailTrackingMessage message)
    {
        var json = JsonSerializer.Serialize(message, JsonOptions);
        var sanitizedMsgId = SanitizeMessageId(message.MessageId);
        await _blobService.UploadStringAsync(
            json,
            $"{sanitizedMsgId}.json",
            $"email-tracking/{message.CampaignId}/messages");

        await AppendToManifestAsync(message.CampaignId, message.MessageId);

        _logger.LogInformation("Tracking saved: campaign={CampaignId} msgId={MessageId}",
            message.CampaignId, message.MessageId);
    }

    public async Task<EmailTrackingMessage?> GetMessageAsync(int campaignId, string messageId)
    {
        try
        {
            var sanitized = SanitizeMessageId(messageId);
            var path = $"email-tracking/{campaignId}/messages/{sanitized}.json";
            var json = await _blobService.DownloadStringAsync(path);
            if (json == null) return null;

            return JsonSerializer.Deserialize<EmailTrackingMessage>(json, JsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load tracking blob for {CampaignId}/{MessageId}", campaignId, messageId);
            return null;
        }
    }

    public async Task<List<EmailTrackingMessage>> GetCampaignMessagesAsync(int campaignId, string? sendType = null)
    {
        var manifest = await LoadManifestAsync(campaignId);
        if (manifest == null) return [];

        var messages = new List<EmailTrackingMessage>();
        foreach (var msgId in manifest.MessageIds)
        {
            var sanitized = SanitizeMessageId(msgId);
            var path = $"email-tracking/{campaignId}/messages/{sanitized}.json";
            var json = await _blobService.DownloadStringAsync(path);
            if (json == null) continue;

            try
            {
                var msg = JsonSerializer.Deserialize<EmailTrackingMessage>(json, JsonOptions);
                if (msg != null)
                {
                    if (string.IsNullOrEmpty(sendType) || msg.SendType == sendType)
                        messages.Add(msg);
                }
            }
            catch { }
        }

        return messages.OrderByDescending(m => m.SentAt).ToList();
    }

    public async Task<bool> UpdateMessageAsync(int campaignId, string messageId, Action<EmailTrackingMessage> update)
    {
        var message = await GetMessageAsync(campaignId, messageId);
        if (message == null) return false;

        update(message);
        message.LastUpdatedAt = DateTime.UtcNow;

        var json = JsonSerializer.Serialize(message, JsonOptions);
        var sanitized = SanitizeMessageId(messageId);
        await _blobService.UploadStringAsync(
            json,
            $"{sanitized}.json",
            $"email-tracking/{campaignId}/messages");

        return true;
    }

    public async Task<EmailCampaignAnalyticsDto> GetCampaignAnalyticsAsync(int campaignId)
    {
        var messages = await GetCampaignMessagesAsync(campaignId, "real");

        var analytics = new EmailCampaignAnalyticsDto
        {
            CampaignId = campaignId,
            SentCount = messages.Count,
            DeliveredCount = messages.Count(m => m.DeliveredAt.HasValue),
            UniqueOpens = messages.Count(m => m.OpenCount > 0),
            TotalOpens = messages.Sum(m => m.OpenCount),
            UniqueClicks = messages.Count(m => m.ClickCount > 0),
            TotalClicks = messages.Sum(m => m.ClickCount),
            HardBounces = messages.Count(m => m.BounceType == "hard"),
            SoftBounces = messages.Count(m => m.BounceType == "soft"),
            Unsubscribes = messages.Count(m => m.UnsubscribedAt.HasValue),
            SpamComplaints = messages.Count(m => m.ComplaintAt.HasValue),
            Blocked = messages.Count(m => m.IsBlocked),
            Deferred = messages.Count(m => m.DeferredAt.HasValue),
            LastUpdatedAt = messages.Any() ? messages.Max(m => m.LastUpdatedAt) : DateTime.UtcNow
        };

        analytics.DeliveryRate = analytics.SentCount > 0
            ? Math.Round((double)analytics.DeliveredCount / analytics.SentCount * 100, 1)
            : 0;

        analytics.OpenRate = analytics.DeliveredCount > 0
            ? Math.Round((double)analytics.UniqueOpens / analytics.DeliveredCount * 100, 1)
            : 0;

        analytics.ClickRate = analytics.DeliveredCount > 0
            ? Math.Round((double)analytics.UniqueClicks / analytics.DeliveredCount * 100, 1)
            : 0;

        analytics.CtorRate = analytics.UniqueOpens > 0
            ? Math.Round((double)analytics.UniqueClicks / analytics.UniqueOpens * 100, 1)
            : 0;

        // Build top links from all messages
        var linkClicks = new Dictionary<string, (int Unique, int Total)>();
        foreach (var msg in messages)
        {
            foreach (var (url, count) in msg.LinkClicks ?? [])
            {
                if (string.IsNullOrWhiteSpace(url) || count <= 0) continue;
                var current = linkClicks.GetValueOrDefault(url);
                linkClicks[url] = (current.Unique + 1, current.Total + count);
            }
        }

        analytics.TopLinks = linkClicks
            .OrderByDescending(entry => entry.Value.Total)
            .ThenByDescending(entry => entry.Value.Unique)
            .Take(50)
            .Select(entry => new EmailLinkClickDto
            {
                Url = entry.Key,
                UniqueClicks = entry.Value.Unique,
                TotalClicks = entry.Value.Total
            })
            .ToList();

        return analytics;
    }

    private async Task AppendToManifestAsync(int campaignId, string messageId)
    {
        var manifest = await LoadManifestAsync(campaignId)
            ?? new MessageManifest { CampaignId = campaignId, MessageIds = [] };

        if (!manifest.MessageIds.Contains(messageId, StringComparer.OrdinalIgnoreCase))
        {
            manifest.MessageIds.Add(messageId);
            await SaveManifestAsync(manifest);
        }
    }

    public async Task<bool> MessageExistsAsync(int campaignId, string messageId)
    {
        var sanitized = SanitizeMessageId(messageId);
        var path = $"email-tracking/{campaignId}/messages/{sanitized}.json";
        var json = await _blobService.DownloadStringAsync(path);
        return json != null;
    }

    private async Task<MessageManifest?> LoadManifestAsync(int campaignId)
    {
        var json = await _blobService.DownloadStringAsync($"email-tracking/{campaignId}/manifest.json");
        if (json == null) return null;

        try { return JsonSerializer.Deserialize<MessageManifest>(json, JsonOptions); }
        catch { return null; }
    }

    private async Task SaveManifestAsync(MessageManifest manifest)
    {
        var json = JsonSerializer.Serialize(manifest, JsonOptions);
        await _blobService.UploadStringAsync(json, "manifest.json", $"email-tracking/{manifest.CampaignId}");
    }

    private static string SanitizeMessageId(string messageId)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var sb = new StringBuilder();
        foreach (var c in messageId)
        {
            if (Array.IndexOf(invalid, c) < 0 && c != '<' && c != '>')
                sb.Append(c);
            else
                sb.Append('_');
        }
        var result = sb.ToString();
        return result.Length > 100 ? result[..100] : result;
    }

    private class MessageManifest
    {
        public int CampaignId { get; set; }
        public List<string> MessageIds { get; set; } = [];
    }
}
