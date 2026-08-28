using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Services.EmailPipeline;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class EmailTrackingService
{
    private readonly IMessageTracker _messageTracker;
    private readonly AkordishKeitDbContext _context;
    private readonly ILogger<EmailTrackingService> _logger;

    private static readonly HashSet<string> ValidEvents =
    [
        "delivered", "opened", "unique_opened", "click",
        "hard_bounce", "soft_bounce", "blocked", "deferred",
        "spam", "unsubscribed", "invalid_email", "request", "error"
    ];

    public EmailTrackingService(
        IMessageTracker messageTracker,
        AkordishKeitDbContext context,
        ILogger<EmailTrackingService> logger)
    {
        _messageTracker = messageTracker;
        _context = context;
        _logger = logger;
    }

    public bool IsValidEvent(string eventType)
    {
        return ValidEvents.Contains(eventType);
    }

    public async Task<bool> ProcessWebhookEventAsync(BrevoWebhookPayload payload)
    {
        if (!IsValidEvent(payload.Event))
        {
            _logger.LogWarning("Unknown Brevo event type: {EventType}", payload.Event);
            return false;
        }

        if (string.IsNullOrWhiteSpace(payload.MessageId))
        {
            _logger.LogWarning("Webhook missing message-id for event {EventType}", payload.Event);
            return false;
        }

        var campaignId = ExtractCampaignId(payload);
        if (campaignId == null)
        {
            _logger.LogInformation("Webhook for message {MessageId} not associated with a campaign", payload.MessageId);
            return false;
        }

        return payload.Event switch
        {
            "delivered" => await HandleDeliveredAsync(campaignId.Value, payload),
            "opened" => await HandleOpenedAsync(campaignId.Value, payload),
            "unique_opened" => await HandleOpenedAsync(campaignId.Value, payload),
            "click" => await HandleClickAsync(campaignId.Value, payload),
            "hard_bounce" => await HandleBounceAsync(campaignId.Value, payload, "hard"),
            "soft_bounce" => await HandleBounceAsync(campaignId.Value, payload, "soft"),
            "blocked" => await HandleBlockedAsync(campaignId.Value, payload),
            "deferred" => await HandleDeferredAsync(campaignId.Value, payload),
            "spam" => await HandleSpamAsync(campaignId.Value, payload),
            "unsubscribed" => await HandleUnsubscribedAsync(campaignId.Value, payload),
            _ => true
        };
    }

    private static int? ExtractCampaignId(BrevoWebhookPayload payload)
    {
        if (payload.Tags is { Count: > 0 })
        {
            foreach (var tag in payload.Tags)
            {
                if (tag.StartsWith("campaign_") && int.TryParse(tag["campaign_".Length..], out var id))
                    return id;
            }
        }

        return null;
    }

    private async Task<bool> HandleDeliveredAsync(int campaignId, BrevoWebhookPayload payload)
    {
        return await _messageTracker.UpdateMessageAsync(campaignId, payload.MessageId, msg =>
        {
            if (msg.DeliveredAt == null)
            {
                msg.DeliveredAt = DateTime.UtcNow;
                msg.Status = "delivered";
            }
        });
    }

    private async Task<bool> HandleOpenedAsync(int campaignId, BrevoWebhookPayload payload)
    {
        return await _messageTracker.UpdateMessageAsync(campaignId, payload.MessageId, msg =>
        {
            if (msg.FirstOpenedAt == null)
                msg.FirstOpenedAt = DateTime.UtcNow;
            msg.LastOpenedAt = DateTime.UtcNow;
            msg.OpenCount++;
        });
    }

    private async Task<bool> HandleClickAsync(int campaignId, BrevoWebhookPayload payload)
    {
        return await _messageTracker.UpdateMessageAsync(campaignId, payload.MessageId, msg =>
        {
            if (msg.FirstClickedAt == null)
                msg.FirstClickedAt = DateTime.UtcNow;
            msg.LastClickedAt = DateTime.UtcNow;
            msg.ClickCount++;

            var link = NormalizeTrackedLink(payload.Link);
            if (link != null)
            {
                msg.LinkClicks ??= new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                msg.LinkClicks[link] = msg.LinkClicks.GetValueOrDefault(link) + 1;
            }
        });
    }

    private static string? NormalizeTrackedLink(string? value)
    {
        var link = value?.Trim();
        if (string.IsNullOrEmpty(link) || link.Length > 2_000) return null;
        return Uri.TryCreate(link, UriKind.Absolute, out var uri) &&
               (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
            ? link
            : null;
    }

    private async Task<bool> HandleBounceAsync(int campaignId, BrevoWebhookPayload payload, string type)
    {
        return await _messageTracker.UpdateMessageAsync(campaignId, payload.MessageId, msg =>
        {
            msg.BounceType = type;
            msg.Status = type == "hard" ? "bounced" : "soft_bounced";
        });
    }

    private async Task<bool> HandleBlockedAsync(int campaignId, BrevoWebhookPayload payload)
    {
        return await _messageTracker.UpdateMessageAsync(campaignId, payload.MessageId, msg =>
        {
            msg.IsBlocked = true;
            msg.Status = "blocked";
        });
    }

    private async Task<bool> HandleDeferredAsync(int campaignId, BrevoWebhookPayload payload)
    {
        return await _messageTracker.UpdateMessageAsync(campaignId, payload.MessageId, msg =>
        {
            msg.DeferredAt = DateTime.UtcNow;
        });
    }

    private async Task<bool> HandleSpamAsync(int campaignId, BrevoWebhookPayload payload)
    {
        var result = await _messageTracker.UpdateMessageAsync(campaignId, payload.MessageId, msg =>
        {
            msg.ComplaintAt = DateTime.UtcNow;
            msg.Status = "spam";
        });

        if (!string.IsNullOrWhiteSpace(payload.Email))
        {
            await SyncUnsubscribeAsync(payload.Email);
        }

        return result;
    }

    private async Task<bool> HandleUnsubscribedAsync(int campaignId, BrevoWebhookPayload payload)
    {
        var result = await _messageTracker.UpdateMessageAsync(campaignId, payload.MessageId, msg =>
        {
            msg.UnsubscribedAt = DateTime.UtcNow;
        });

        if (!string.IsNullOrWhiteSpace(payload.Email))
        {
            await SyncUnsubscribeAsync(payload.Email);
        }

        return result;
    }

    private async Task SyncUnsubscribeAsync(string email)
    {
        var normalized = email.Trim().ToLowerInvariant();

        if (!await _context.MarketingUnsubscribes.AnyAsync(u => u.Email == normalized))
        {
            _context.MarketingUnsubscribes.Add(new Models.Entities.MarketingUnsubscribe
            {
                Email = normalized,
                UnsubscribedAt = DateTime.UtcNow,
                Source = "brevo-webhook"
            });
        }

        var users = await _context.Users
            .Where(u => u.Email.ToLower() == normalized && !u.IsDeleted)
            .ToListAsync();

        foreach (var user in users)
        {
            user.MarketingConsent = false;
            user.MarketingConsentRevokedAt = DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;
        }

        var subscriber = await _context.EmailSubscribers
            .FirstOrDefaultAsync(s => s.Email == normalized);
        if (subscriber != null)
        {
            subscriber.IsSubscribed = false;
            subscriber.UnsubscribedAt = DateTime.UtcNow;
            subscriber.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
    }
}
