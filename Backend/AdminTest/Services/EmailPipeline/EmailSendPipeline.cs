using System.Text;
using System.Text.Json;
using System.Collections.Concurrent;
using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services.EmailPipeline;

public class EmailSendPipeline : IEmailSendPipeline
{
    // Brevo rejects bursts above the account's throughput allowance. A conservative
    // limit keeps a large campaign progressing instead of producing hundreds of 429s.
    private const int MaxConcurrentBrevoSends = 5;
    private static readonly ConcurrentDictionary<string, DateTime> RecentTransientSends = new();
    private static readonly TimeSpan TransientDuplicateWindow = TimeSpan.FromMinutes(2);
    private readonly IBrevoEmailSender _brevoSender;
    private readonly IMessageTracker _messageTracker;
    private readonly IEmailPersonalizationStep _personalization;
    private readonly IEmailUtmStep _utm;
    private readonly AkordishKeitDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailSendPipeline> _logger;
    private readonly IServiceProvider _serviceProvider;

    public EmailSendPipeline(
        IBrevoEmailSender brevoSender,
        IMessageTracker messageTracker,
        IEmailPersonalizationStep personalization,
        IEmailUtmStep utm,
        AkordishKeitDbContext context,
        IConfiguration configuration,
        ILogger<EmailSendPipeline> logger,
        IServiceProvider serviceProvider)
    {
        _brevoSender = brevoSender;
        _messageTracker = messageTracker;
        _personalization = personalization;
        _utm = utm;
        _context = context;
        _configuration = configuration;
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    public async Task<EmailSendResultDto> SendCampaignAsync(SendEmailRequestDto request, int campaignId, bool isTest = false)
    {
        var apiKey = _configuration["Brevo:ApiKey"];
        if (string.IsNullOrEmpty(apiKey) || apiKey.StartsWith("REPLACE"))
            return new EmailSendResultDto { Success = false, Message = "Brevo API key not configured" };

        var fromEmail = MarketingEmailSender.FromEmail;
        var fromName = MarketingEmailSender.FromName;

        // Claim the draft atomically before resolving recipients or calling Brevo.  This
        // protects against double-clicks and concurrent admin sessions sending the same
        // V2 campaign twice (including when the app runs on more than one instance).
        var claimed = await _context.EmailCampaigns
            .Where(c => c.Id == campaignId && c.Status == "draft")
            .ExecuteUpdateAsync(s => s
                .SetProperty(c => c.Status, "in_progress")
                .SetProperty(c => c.UpdatedAt, DateTime.UtcNow));
        if (claimed == 0)
            return new EmailSendResultDto { Success = false, Message = "Campaign is not available for sending" };

        var campaign = await _context.EmailCampaigns.FindAsync(campaignId);
        if (campaign == null)
            return new EmailSendResultDto { Success = false, Message = "Campaign not found" };

        List<(string Email, string? Name)> recipients;
        if (request.RecipientGroup == EmailRecipientGroup.ManualOneTime)
        {
            recipients = (request.ManualRecipients ?? [])
                .Select(e => (e, (string?)null))
                .ToList();
        }
        else
        {
            var emailService = _serviceProvider.GetRequiredService<IEmailService>();
            if (request.RecipientGroup == EmailRecipientGroup.CustomGroup && request.EmailGroupId.HasValue)
            {
                recipients = await ResolveCustomGroupAsync(request.EmailGroupId.Value);
            }
            else
            {
                recipients = await ResolveRecipientsAsync(emailService, request.RecipientGroup, request.EmailGroupId);
            }
        }

        if (request.ExcludedEmails is { Count: > 0 })
        {
            var excluded = new HashSet<string>(request.ExcludedEmails.Select(e => e.ToLowerInvariant()));
            recipients = recipients.Where(r => !excluded.Contains(r.Email.ToLowerInvariant())).ToList();
        }

        recipients = await ExcludeUnsubscribedAsync(recipients);

        if (recipients.Count == 0)
        {
            campaign.Status = "failed";
            campaign.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return new EmailSendResultDto { Success = false, Message = "no recipients found" };
        }

        var subject = isTest ? $"[TEST] {request.Subject}" : request.Subject;
        var html = request.HtmlBody;

        var utmSettings = ResolveUtmSettings(campaignId);
        html = _utm.Apply(html, utmSettings);

        var tags = new List<string> { $"campaign_{campaignId}" };
        if (isTest) tags.Add("test_send");

        int sentCount = 0, failedCount = 0;
        var semaphore = new SemaphoreSlim(MaxConcurrentBrevoSends);

        var tasks = recipients.Select(async r =>
        {
            await semaphore.WaitAsync();
            try
            {
                var variables = await BuildPersonalizationVariables(r.Email, campaignId);
                var personalized = _personalization.Apply(html, variables);

                var unsubscribeUrl = BuildUnsubscribeUrl(r.Email);
                personalized = ReplaceUnsubscribePlaceholder(personalized, unsubscribeUrl);

                var sendRequest = new BrevoSendRequest
                {
                    ApiKey = apiKey,
                    FromEmail = fromEmail,
                    FromName = fromName,
                    ReplyToEmail = MarketingEmailSender.ReplyToEmail,
                    ToEmail = r.Email,
                    ToName = r.Name,
                    Subject = subject,
                    HtmlContent = personalized,
                    Tags = tags,
                    Params = new Dictionary<string, object>
                    {
                        ["unsubscribe_url"] = unsubscribeUrl
                    }
                };

                var result = await _brevoSender.SendAsync(sendRequest);

                if (result.Success && result.MessageId != null)
                {
                    await _messageTracker.SaveSentMessageAsync(new EmailTrackingMessage
                    {
                        CampaignId = campaignId,
                        MessageId = result.MessageId,
                        RecipientEmail = r.Email,
                        SendType = isTest ? "test" : "real",
                        SentAt = DateTime.UtcNow,
                        Status = "sent",
                        LastUpdatedAt = DateTime.UtcNow
                    });
                    Interlocked.Increment(ref sentCount);
                }
                else
                {
                    Interlocked.Increment(ref failedCount);
                    _logger.LogWarning("Brevo send failed for {Email}: {Error}", r.Email, result.Error);
                }
            }
            catch (Exception ex)
            {
                Interlocked.Increment(ref failedCount);
                _logger.LogError(ex, "Send exception for {Email}", r.Email);
            }
            finally { semaphore.Release(); }
        });

        await Task.WhenAll(tasks);

        campaign.SentCount = sentCount;
        campaign.FailedCount = failedCount;
        campaign.Status = sentCount > 0 ? "sent" : "failed";
        campaign.SentAt = DateTime.UtcNow;
        campaign.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return new EmailSendResultDto
        {
            Success = sentCount > 0,
            SentCount = sentCount,
            FailedCount = failedCount,
            Message = failedCount > 0
                ? $"sent to {sentCount}, {failedCount} failed"
                : $"sent to {sentCount}"
        };
    }

    public async Task<EmailV2ConversionResultDto> SendTestEmailAsync(EmailV2SendTestDto dto, string htmlBody)
    {
        var apiKey = _configuration["Brevo:ApiKey"];
        if (string.IsNullOrEmpty(apiKey) || apiKey.StartsWith("REPLACE"))
            return new EmailV2ConversionResultDto { Success = false, Error = "Brevo API key not configured" };

        var campaign = await _context.EmailCampaigns.FindAsync(dto.CampaignId);
        if (campaign == null)
            return new EmailV2ConversionResultDto { Success = false, Error = "Campaign not found" };

        var fromEmail = MarketingEmailSender.FromEmail;
        var fromName = MarketingEmailSender.FromName;
        var unsubscribeUrl = BuildUnsubscribeUrl(dto.RecipientEmail);

        var utmSettings = ResolveUtmSettings(dto.CampaignId);
        var html = _utm.Apply(htmlBody, utmSettings);

        var variables = await BuildPersonalizationVariables(dto.RecipientEmail, dto.CampaignId);
        html = _personalization.Apply(html, variables);
        html = ReplaceUnsubscribePlaceholder(html, unsubscribeUrl);

        var result = await _brevoSender.SendAsync(new BrevoSendRequest
        {
            ApiKey = apiKey,
            FromEmail = fromEmail,
            FromName = fromName,
            ReplyToEmail = MarketingEmailSender.ReplyToEmail,
            ToEmail = dto.RecipientEmail,
            ToName = dto.RecipientEmail,
            Subject = $"[TEST] {campaign.Subject}",
            HtmlContent = html,
            Tags = [$"campaign_{dto.CampaignId}", "test_send"],
            Params = new Dictionary<string, object>
            {
                ["unsubscribe_url"] = unsubscribeUrl
            }
        });

        if (result.Success && result.MessageId != null)
        {
            await _messageTracker.SaveSentMessageAsync(new EmailTrackingMessage
            {
                CampaignId = dto.CampaignId,
                MessageId = result.MessageId,
                RecipientEmail = dto.RecipientEmail,
                SendType = "test",
                SentAt = DateTime.UtcNow,
                Status = "sent",
                LastUpdatedAt = DateTime.UtcNow
            });
        }

        return result.Success
            ? new EmailV2ConversionResultDto { Success = true }
            : new EmailV2ConversionResultDto { Success = false, Error = result.Error };
    }

    public async Task<EmailSendResultDto> SendTransientCampaignAsync(SendEmailRequestDto request, Action<int, EmailRecipientSendResultDto>? onRecipientCompleted = null)
    {
        var apiKey = _configuration["Brevo:ApiKey"];
        if (string.IsNullOrEmpty(apiKey) || apiKey.StartsWith("REPLACE"))
            return new EmailSendResultDto { Success = false, Message = "Brevo API key not configured" };

        try
        {
            var fromEmail = MarketingEmailSender.FromEmail;
            var fromName = MarketingEmailSender.FromName;

            List<(string Email, string? Name)> recipients;
            if (request.RecipientGroup == EmailRecipientGroup.ManualOneTime)
            {
                recipients = (request.ManualRecipients ?? [])
                    .Select(e => (e, (string?)null))
                    .ToList();
            }
            else
            {
                var emailService = _serviceProvider.GetRequiredService<IEmailService>();
                recipients = request.RecipientGroup == EmailRecipientGroup.CustomGroup && request.EmailGroupId.HasValue
                    ? await ResolveCustomGroupAsync(request.EmailGroupId.Value)
                    : await ResolveRecipientsAsync(emailService, request.RecipientGroup, request.EmailGroupId);
            }

            if (request.ExcludedEmails is { Count: > 0 })
            {
                var excluded = new HashSet<string>(request.ExcludedEmails, StringComparer.OrdinalIgnoreCase);
                recipients = recipients.Where(r => !excluded.Contains(r.Email)).ToList();
            }

            recipients = await ExcludeUnsubscribedAsync(recipients);
            if (recipients.Count == 0)
                return new EmailSendResultDto { Success = false, Message = "no recipients found" };

            var html = _utm.Apply(request.HtmlBody, ResolveTransientUtmSettings());
            var sentCount = 0;
            var failedCount = 0;
            var recipientResults = new ConcurrentBag<EmailRecipientSendResultDto>();
            using var semaphore = new SemaphoreSlim(MaxConcurrentBrevoSends);

            var tasks = recipients.Select(async recipient =>
            {
                await semaphore.WaitAsync();
                try
                {
                    var variables = await BuildPersonalizationVariables(recipient.Email, 0);
                    var personalized = _personalization.Apply(html, variables);
                    var unsubscribeUrl = BuildUnsubscribeUrl(recipient.Email);
                    personalized = ReplaceUnsubscribePlaceholder(personalized, unsubscribeUrl);

                    var result = await _brevoSender.SendAsync(new BrevoSendRequest
                    {
                        ApiKey = apiKey,
                        FromEmail = fromEmail,
                        FromName = fromName,
                        ReplyToEmail = MarketingEmailSender.ReplyToEmail,
                        ToEmail = recipient.Email,
                        ToName = recipient.Name,
                        Subject = request.Subject,
                        HtmlContent = personalized,
                        Tags = ["email_v2_transient"],
                        Params = new Dictionary<string, object> { ["unsubscribe_url"] = unsubscribeUrl }
                    });

                    if (result.Success)
                    {
                        Interlocked.Increment(ref sentCount);
                        var recipientResult = new EmailRecipientSendResultDto
                        {
                            Email = recipient.Email,
                            AcceptedByBrevo = true,
                            MessageId = result.MessageId
                        };
                        recipientResults.Add(recipientResult);
                        onRecipientCompleted?.Invoke(recipients.Count, recipientResult);
                    }
                    else
                    {
                        Interlocked.Increment(ref failedCount);
                        var recipientResult = new EmailRecipientSendResultDto
                        {
                            Email = recipient.Email,
                            AcceptedByBrevo = false,
                            Error = result.Error ?? "Brevo rejected the message"
                        };
                        recipientResults.Add(recipientResult);
                        onRecipientCompleted?.Invoke(recipients.Count, recipientResult);
                        _logger.LogWarning("Transient Email V2 send failed for {Email}: {Error}", recipient.Email, result.Error);
                    }
                }
                catch (Exception ex)
                {
                    Interlocked.Increment(ref failedCount);
                    var recipientResult = new EmailRecipientSendResultDto
                    {
                        Email = recipient.Email,
                        AcceptedByBrevo = false,
                        Error = "The message could not be submitted to Brevo."
                    };
                    recipientResults.Add(recipientResult);
                    onRecipientCompleted?.Invoke(recipients.Count, recipientResult);
                    _logger.LogError(ex, "Transient Email V2 send exception for {Email}", recipient.Email);
                }
                finally
                {
                    semaphore.Release();
                }
            });

            await Task.WhenAll(tasks);
            return new EmailSendResultDto
            {
                Success = sentCount > 0,
                AttemptedCount = recipients.Count,
                SentCount = sentCount,
                FailedCount = failedCount,
                Recipients = recipientResults.OrderBy(r => r.Email, StringComparer.OrdinalIgnoreCase).ToList(),
                Message = failedCount > 0
                    ? $"sent to {sentCount}, {failedCount} failed"
                    : $"sent to {sentCount}"
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Transient Email V2 campaign send failed");
            return new EmailSendResultDto { Success = false, Message = "The email could not be sent." };
        }
    }

    public async Task<EmailV2TransientRecipientPreviewDto> PreviewTransientRecipientsAsync(SendEmailRequestDto request)
    {
        var recipients = await ResolveTransientRecipientsAsync(request);
        var eligible = recipients.Count;
        var excluded = request.ExcludedEmails is { Count: > 0 }
            ? new HashSet<string>(request.ExcludedEmails, StringComparer.OrdinalIgnoreCase) : [];
        var finalCount = recipients.Count(r => !excluded.Contains(r.Email));
        return new EmailV2TransientRecipientPreviewDto { EligibleCount = eligible, ExcludedCount = eligible - finalCount, FinalCount = finalCount };
    }

    public async Task<EmailV2ConversionResultDto> SendTransientTestEmailAsync(EmailV2TransientTestDto dto)
    {
        var apiKey = _configuration["Brevo:ApiKey"];
        if (string.IsNullOrEmpty(apiKey) || apiKey.StartsWith("REPLACE"))
            return new EmailV2ConversionResultDto { Success = false, Error = "Brevo API key not configured" };

        try
        {
            var fromEmail = MarketingEmailSender.FromEmail;
            var fromName = MarketingEmailSender.FromName;
            var html = _utm.Apply(dto.HtmlBody, ResolveTransientUtmSettings());
            var variables = await BuildPersonalizationVariables(dto.RecipientEmail, 0);
            html = _personalization.Apply(html, variables);
            var unsubscribeUrl = BuildUnsubscribeUrl(dto.RecipientEmail);
            html = ReplaceUnsubscribePlaceholder(html, unsubscribeUrl);

            var result = await _brevoSender.SendAsync(new BrevoSendRequest
            {
                ApiKey = apiKey,
                FromEmail = fromEmail,
                FromName = fromName,
                ReplyToEmail = MarketingEmailSender.ReplyToEmail,
                ToEmail = dto.RecipientEmail,
                ToName = dto.RecipientEmail,
                Subject = $"[TEST] {dto.Subject}",
                HtmlContent = html,
                Tags = ["email_v2_transient", "test_send"],
                Params = new Dictionary<string, object> { ["unsubscribe_url"] = unsubscribeUrl }
            });

            return result.Success
                ? new EmailV2ConversionResultDto { Success = true }
                : new EmailV2ConversionResultDto { Success = false, Error = result.Error };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Transient Email V2 test send failed");
            return new EmailV2ConversionResultDto { Success = false, Error = "The test email could not be sent." };
        }
    }

    private UtmSettings ResolveUtmSettings(int campaignId)
    {
        return new UtmSettings
        {
            Enabled = true,
            Source = "akordishkayt",
            Medium = "email",
            Campaign = $"campaign-{campaignId}"
        };
    }

    private static UtmSettings ResolveTransientUtmSettings() => new()
    {
        Enabled = true,
        Source = "akordishkayt",
        Medium = "email",
        Campaign = "email-v2-transient"
    };

    private static bool TryClaimTransientSend(SendEmailRequestDto request)
    {
        var value = $"{request.Subject}\n{request.HtmlBody}\n{request.RecipientGroup}\n{request.EmailGroupId}\n{request.FromEmail}";
        var fingerprint = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(Encoding.UTF8.GetBytes(value)));
        var now = DateTime.UtcNow;

        foreach (var entry in RecentTransientSends)
        {
            if (now - entry.Value > TransientDuplicateWindow)
                RecentTransientSends.TryRemove(entry.Key, out _);
        }

        while (true)
        {
            if (RecentTransientSends.TryAdd(fingerprint, now)) return true;
            if (!RecentTransientSends.TryGetValue(fingerprint, out var previous)) continue;
            if (now - previous < TransientDuplicateWindow) return false;
            if (RecentTransientSends.TryUpdate(fingerprint, now, previous)) return true;
        }
    }

    private async Task<Dictionary<string, string>> BuildPersonalizationVariables(string email, int campaignId)
    {
        var variables = new Dictionary<string, string>
        {
            ["email"] = email
        };

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email.ToLower() == email.ToLowerInvariant() && !u.IsDeleted);

        if (user != null)
        {
            variables["username"] = user.Username;
            variables["promotionPoints"] = user.Points.ToString();

            var referralService = _serviceProvider.GetRequiredService<IReferralService>();
            var refSummary = await referralService.GetSummaryAsync(user.Id, null);
            variables["referralUrl"] = refSummary.ReferralUrl;
            variables["referralCount"] = refSummary.JoinedCount.ToString();
            variables["unsubscribeUrl"] = BuildUnsubscribeUrl(email);
        }

        return variables;
    }

    private async Task<List<(string Email, string? Name)>> ResolveCustomGroupAsync(int emailGroupId)
    {
        return await _context.EmailGroupMembers
            .Where(m => m.EmailGroupId == emailGroupId && m.Subscriber!.IsSubscribed)
            .Select(m => new { m.Subscriber!.Email, m.Subscriber.Name })
            .ToListAsync()
            .ContinueWith(t => t.Result.Select(m => (m.Email, m.Name)).ToList());
    }

    private async Task<List<(string Email, string? Name)>> ResolveTransientRecipientsAsync(SendEmailRequestDto request)
    {
        List<(string Email, string? Name)> recipients;
        if (request.RecipientGroup == EmailRecipientGroup.ManualOneTime)
            recipients = (request.ManualRecipients ?? []).Select(e => (e, (string?)null)).ToList();
        else
        {
            var emailService = _serviceProvider.GetRequiredService<IEmailService>();
            recipients = request.RecipientGroup == EmailRecipientGroup.CustomGroup && request.EmailGroupId.HasValue
                ? await ResolveCustomGroupAsync(request.EmailGroupId.Value)
                : await ResolveRecipientsAsync(emailService, request.RecipientGroup, request.EmailGroupId);
        }
        return await ExcludeUnsubscribedAsync(recipients);
    }

    private async Task<List<(string Email, string? Name)>> ResolveRecipientsAsync(
        IEmailService emailService, EmailRecipientGroup group, int? emailGroupId)
    {
        var recipients = await emailService.GetRecipientsPreviewAsync(group, emailGroupId);
        return recipients.Select(r => (r.Email, r.Name)).ToList();
    }

    private async Task<List<(string Email, string? Name)>> ExcludeUnsubscribedAsync(
        List<(string Email, string? Name)> recipients)
    {
        if (recipients.Count == 0) return recipients;

        var unsubscribed = await _context.MarketingUnsubscribes
            .Select(u => u.Email)
            .ToListAsync();

        var suppressed = new HashSet<string>(unsubscribed, StringComparer.OrdinalIgnoreCase);

        return recipients
            .Where(r => !suppressed.Contains(r.Email.Trim().ToLowerInvariant()))
            .GroupBy(r => r.Email.Trim().ToLowerInvariant())
            .Select(g => g.First())
            .ToList();
    }

    private string BuildUnsubscribeUrl(string email)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var payload = Base64UrlEncode(Encoding.UTF8.GetBytes(normalizedEmail));
        var secret = _configuration["EmailUnsubscribe:Secret"]
            ?? _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("Email unsubscribe signing secret not configured.");
        using var hmac = new System.Security.Cryptography.HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var signature = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        var token = $"{payload}.{Base64UrlEncode(signature)}";
        var baseUrl = (_configuration["Backend:BaseUrl"] ?? "https://api.akordishkayt.com").TrimEnd('/');
        return $"{baseUrl}/api/Email/unsubscribe-page?token={Uri.EscapeDataString(token)}";
    }

    private static string Base64UrlEncode(byte[] value) =>
        Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static string ReplaceUnsubscribePlaceholder(string html, string unsubscribeUrl) =>
        System.Text.RegularExpressions.Regex.Replace(
            html,
            @"\{\{\s*params\.unsubscribe_url\s*\}\}",
            _ => unsubscribeUrl,
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
}
