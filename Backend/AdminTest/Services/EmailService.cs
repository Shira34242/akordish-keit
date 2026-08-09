using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
using System.Net.Mail;
using Ganss.Xss;
using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class EmailService : IEmailService
{
    private const string BrevoApiUrl = "https://api.brevo.com/v3/smtp/email";
    private const int MaxManualRecipients = 5000;

    private readonly IConfiguration _configuration;
    private readonly AkordishKeitDbContext _context;
    private readonly ILogger<EmailService> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    public EmailService(
        IConfiguration configuration,
        AkordishKeitDbContext context,
        ILogger<EmailService> logger,
        IHttpClientFactory httpClientFactory)
    {
        _configuration = configuration;
        _context = context;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    // ── Campaign send ──────────────────────────────────────────────────────────

    public async Task<EmailSendResultDto> SendCampaignAsync(SendEmailRequestDto request)
    {
        var apiKey = _configuration["Brevo:ApiKey"];
        if (string.IsNullOrEmpty(apiKey) || apiKey.StartsWith("REPLACE"))
            return new EmailSendResultDto { Success = false, Message = "Brevo API key לא מוגדר — יש להגדיר אותו ב-appsettings.json" };

        List<(string Email, string? Name)> recipients;
        if (request.RecipientGroup == EmailRecipientGroup.ManualOneTime)
        {
            if (!request.ConfirmedManualRecipientPermission)
                return new EmailSendResultDto { Success = false, Message = "יש לאשר שקיימת הרשאה לשלוח לנמענים החד־פעמיים" };

            var validation = await ValidateManualRecipientsInternalAsync(request.ManualRecipients ?? []);
            if (validation.InvalidEmails.Count > 0)
                return new EmailSendResultDto { Success = false, Message = $"נמצאו {validation.InvalidEmails.Count} כתובות מייל לא תקינות" };
            if (validation.UniqueValidCount > MaxManualRecipients)
                return new EmailSendResultDto { Success = false, Message = $"ניתן לשלוח לעד {MaxManualRecipients} כתובות בכל שליחה חד־פעמית" };

            recipients = validation.EligibleEmails.Select(email => (email, (string?)null)).ToList();
        }
        else
        {
            recipients = await GetRecipientsAsync(request.RecipientGroup, request.EmailGroupId);
        }

        if (request.ExcludedEmails is { Count: > 0 })
        {
            var excluded = new HashSet<string>(request.ExcludedEmails.Select(e => e.ToLowerInvariant()));
            recipients = recipients.Where(r => !excluded.Contains(r.Email.ToLowerInvariant())).ToList();
        }

        if (recipients.Count == 0)
            return new EmailSendResultDto { Success = false, Message = "לא נמצאו נמענים עם כתובת מייל" };

        var fromEmail = MarketingEmailSender.FromEmail;
        var fromName  = MarketingEmailSender.FromName;
        var sanitizedContent = SanitizeEmailContent(request.HtmlBody);
        int sentCount = 0, failedCount = 0;

        var semaphore = new SemaphoreSlim(5);
        var tasks = recipients.Select(async r =>
        {
            await semaphore.WaitAsync();
            try
            {
                var unsubscribeUrl = BuildUnsubscribeUrl(r.Email);
                var htmlBody = WrapInEmailTemplate(sanitizedContent, request.Subject, unsubscribeUrl);
                var plainText = string.IsNullOrWhiteSpace(request.PlainTextBody)
                    ? null
                    : $"{request.PlainTextBody.Trim()}\n\nלהסרה מדיוור שיווקי: {unsubscribeUrl}";
                return await SendBrevoEmailAsync(apiKey, fromEmail, fromName,
                    r.Email, r.Name, request.Subject, htmlBody, plainText, MarketingEmailSender.ReplyToEmail);
            }
            finally { semaphore.Release(); }
        });

        var results = await Task.WhenAll(tasks);
        sentCount   = results.Count(ok => ok);
        failedCount = results.Count(ok => !ok);

        var result = new EmailSendResultDto
        {
            Success  = sentCount > 0,
            Message  = failedCount > 0
                ? $"נשלח ל-{sentCount} נמענים, {failedCount} נכשלו"
                : $"נשלח בהצלחה ל-{sentCount} נמענים",
            SentCount   = sentCount,
            FailedCount = failedCount
        };
        _context.EmailCampaigns.Add(new EmailCampaign
        {
            Subject = request.Subject.Trim(), HtmlBody = sanitizedContent, FromName = fromName,
            RecipientGroup = (int)request.RecipientGroup, EmailGroupId = request.EmailGroupId,
            Status = result.Success ? "sent" : "failed", SentAt = DateTime.UtcNow,
            SentCount = sentCount, FailedCount = failedCount
        });
        await _context.SaveChangesAsync();
        return result;
    }

    // ── Password reset email ───────────────────────────────────────────────────

    public async Task<bool> SendPasswordResetEmailAsync(string toEmail, string toName, string code)
    {
        var apiKey = _configuration["Brevo:ApiKey"];
        if (string.IsNullOrEmpty(apiKey) || apiKey.StartsWith("REPLACE"))
        {
            _logger.LogWarning("Brevo API key לא מוגדר — לא נשלח מייל איפוס סיסמא ל-{Email}", toEmail);
            return false;
        }

        var fromEmail = _configuration["Brevo:FromEmail"] ?? "noreply@akordishkeit.com";
        var fromName  = _configuration["Brevo:FromName"]  ?? "אקורדישקייט";

        return await SendBrevoEmailAsync(
            apiKey, fromEmail, fromName,
            toEmail, toName,
            "איפוס סיסמא — אקורדישקייט",
            BuildPasswordResetEmail(toName, code),
            plainText: $"קוד האימות שלך: {code}\nהקוד תקף ל-15 דקות.");
    }

    // ── Recipient count ────────────────────────────────────────────────────────

    public async Task<int> GetRecipientCountAsync(EmailRecipientGroup group, int? emailGroupId = null)
        => (await GetRecipientsAsync(group, emailGroupId)).Count;

    public async Task<List<EmailRecipientDto>> GetRecipientsPreviewAsync(EmailRecipientGroup group, int? emailGroupId = null)
    {
        var recipients = await GetRecipientsAsync(group, emailGroupId);
        return recipients
            .Select(r => new EmailRecipientDto { Email = r.Email, Name = r.Name })
            .OrderBy(r => r.Name ?? r.Email)
            .ToList();
    }

    public string BuildPreviewHtml(string subject, string htmlBody) =>
        WrapInEmailTemplate(SanitizeEmailContent(htmlBody), subject, "https://akordishkayt.com/unsubscribe");

    public async Task<MarketingUnsubscribeResultDto> UnsubscribeAsync(string token)
    {
        if (!TryReadUnsubscribeToken(token, out var email))
        {
            return new MarketingUnsubscribeResultDto
            {
                Success = false,
                Message = "קישור ההסרה אינו תקין. אפשר לפנות אלינו ונשמח להסיר את הכתובת ידנית."
            };
        }

        var normalizedEmail = NormalizeEmail(email);
        var existing = await _context.MarketingUnsubscribes
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail);

        if (existing == null)
        {
            _context.MarketingUnsubscribes.Add(new MarketingUnsubscribe
            {
                Email = normalizedEmail,
                UnsubscribedAt = DateTime.UtcNow,
                Source = "email-link"
            });
        }

        var matchingUsers = await _context.Users
            .Where(u => u.Email.ToLower() == normalizedEmail && !u.IsDeleted)
            .ToListAsync();

        foreach (var user in matchingUsers)
        {
            user.MarketingConsent = false;
            user.MarketingConsentRevokedAt ??= DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;
        }

        var subscriber = await _context.EmailSubscribers
            .FirstOrDefaultAsync(s => s.Email == normalizedEmail);
        if (subscriber != null)
        {
            subscriber.IsSubscribed = false;
            subscriber.UnsubscribedAt = DateTime.UtcNow;
            subscriber.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return new MarketingUnsubscribeResultDto
        {
            Success = true,
            Message = "הוסרת בהצלחה מרשימת הדיוור השיווקי."
        };
    }

    public async Task<EmailSendResultDto> SendTestEmailAsync(SendEmailRequestDto request, string recipientEmail)
    {
        var apiKey = _configuration["Brevo:ApiKey"];
        if (string.IsNullOrEmpty(apiKey) || apiKey.StartsWith("REPLACE"))
            return new EmailSendResultDto { Success = false, Message = "Brevo API key לא מוגדר" };

        var fromEmail = MarketingEmailSender.FromEmail;
        var fromName = MarketingEmailSender.FromName;
        var html = WrapInEmailTemplate(SanitizeEmailContent(request.HtmlBody), request.Subject, BuildUnsubscribeUrl(recipientEmail));
        var sent = await SendBrevoEmailAsync(apiKey, fromEmail, fromName, recipientEmail, null,
            $"[בדיקה] {request.Subject}", html, replyToEmail: MarketingEmailSender.ReplyToEmail);
        return new EmailSendResultDto { Success = sent, SentCount = sent ? 1 : 0, FailedCount = sent ? 0 : 1,
            Message = sent ? "מייל בדיקה נשלח" : "שליחת מייל הבדיקה נכשלה" };
    }

    // ── Email Groups ───────────────────────────────────────────────────────────

    public async Task<List<EmailGroupDto>> GetEmailGroupsAsync()
    {
        return await _context.EmailGroups
            .Where(g => !g.IsDeleted)
            .OrderByDescending(g => g.CreatedAt)
            .Select(g => new EmailGroupDto
            {
                Id          = g.Id,
                Name        = g.Name,
                Description = g.Description,
                MemberCount = g.Members.Count,
                CreatedAt   = g.CreatedAt,
                Members     = g.Members.Select(m => new EmailGroupMemberDto
                {
                    SubscriberId = m.SubscriberId,
                    UserId       = m.Subscriber!.UserId,
                    Username     = m.Subscriber.Name ?? m.Subscriber.Email,
                    Email        = m.Subscriber.Email
                }).ToList()
            })
            .ToListAsync();
    }

    public async Task<EmailGroupDto?> CreateEmailGroupAsync(SaveEmailGroupDto dto, int adminUserId)
    {
        var group = new EmailGroup
        {
            Name            = dto.Name.Trim(),
            Description     = dto.Description?.Trim(),
            CreatedByUserId = adminUserId,
            CreatedAt       = DateTime.UtcNow
        };

        _context.EmailGroups.Add(group);
        await _context.SaveChangesAsync();

        if (dto.SubscriberIds.Count > 0)
        {
            var members = dto.SubscriberIds.Distinct().Select(subscriberId => new EmailGroupMember
            {
                EmailGroupId = group.Id,
                SubscriberId = subscriberId,
                AddedAt      = DateTime.UtcNow
            });
            _context.EmailGroupMembers.AddRange(members);
            await _context.SaveChangesAsync();
        }

        return await GetEmailGroupByIdAsync(group.Id);
    }

    public async Task<EmailGroupDto?> UpdateEmailGroupAsync(int id, SaveEmailGroupDto dto)
    {
        var group = await _context.EmailGroups
            .Include(g => g.Members)
            .FirstOrDefaultAsync(g => g.Id == id && !g.IsDeleted);

        if (group == null) return null;

        group.Name        = dto.Name.Trim();
        group.Description = dto.Description?.Trim();
        group.UpdatedAt   = DateTime.UtcNow;

        // Replace members
        _context.EmailGroupMembers.RemoveRange(group.Members);
        var newMembers = dto.SubscriberIds.Distinct().Select(subscriberId => new EmailGroupMember
        {
            EmailGroupId = group.Id,
            SubscriberId = subscriberId,
            AddedAt      = DateTime.UtcNow
        });
        _context.EmailGroupMembers.AddRange(newMembers);
        await _context.SaveChangesAsync();

        return await GetEmailGroupByIdAsync(id);
    }

    public async Task<bool> DeleteEmailGroupAsync(int id)
    {
        var group = await _context.EmailGroups.FirstOrDefaultAsync(g => g.Id == id && !g.IsDeleted);
        if (group == null) return false;

        group.IsDeleted = true;
        group.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    // ── Site Interest ──────────────────────────────────────────────────────────

    public async Task<EmailSubscriberPageDto> GetSubscribersAsync(
        string? search, string? status, int? groupId, int page, int pageSize)
    {
        await SyncKnownSubscribersAsync();

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 100);
        var query = _context.EmailSubscribers.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(s => s.Email.ToLower().Contains(term) ||
                                     (s.Name != null && s.Name.ToLower().Contains(term)));
        }

        query = status?.ToLowerInvariant() switch
        {
            "subscribed" => query.Where(s => s.IsSubscribed),
            "unsubscribed" => query.Where(s => !s.IsSubscribed),
            _ => query
        };

        if (groupId.HasValue)
            query = query.Where(s => s.Groups.Any(g => g.EmailGroupId == groupId.Value));

        var totalCount = await query.CountAsync();
        var subscribedCount = await _context.EmailSubscribers.CountAsync(s => s.IsSubscribed);
        var unsubscribedCount = await _context.EmailSubscribers.CountAsync(s => !s.IsSubscribed);

        var items = await query
            .OrderByDescending(s => s.UpdatedAt ?? s.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new EmailSubscriberDto
            {
                Id = s.Id,
                Email = s.Email,
                Name = s.Name,
                UserId = s.UserId,
                IsSubscribed = s.IsSubscribed,
                Source = s.Source,
                SubscribedAt = s.SubscribedAt,
                UnsubscribedAt = s.UnsubscribedAt,
                Groups = s.Groups.Where(g => !g.EmailGroup!.IsDeleted)
                    .Select(g => new EmailSubscriberGroupDto
                    {
                        Id = g.EmailGroupId,
                        Name = g.EmailGroup!.Name
                    }).ToList()
            })
            .ToListAsync();

        return new EmailSubscriberPageDto
        {
            Items = items,
            TotalCount = totalCount,
            SubscribedCount = subscribedCount,
            UnsubscribedCount = unsubscribedCount
        };
    }

    public async Task<EmailSubscriberDto?> CreateSubscriberAsync(SaveEmailSubscriberDto dto)
    {
        var email = NormalizeEmail(dto.Email);
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) return null;

        var subscriber = await _context.EmailSubscribers
            .Include(s => s.Groups)
            .FirstOrDefaultAsync(s => s.Email == email);

        if (subscriber == null)
        {
            subscriber = new EmailSubscriber
            {
                Email = email,
                Name = dto.Name?.Trim(),
                IsSubscribed = dto.IsSubscribed,
                Source = "admin",
                SubscribedAt = DateTime.UtcNow,
                UnsubscribedAt = dto.IsSubscribed ? null : DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };
            _context.EmailSubscribers.Add(subscriber);
            await _context.SaveChangesAsync();
        }

        await ApplySubscriberUpdateAsync(subscriber, dto.Name, dto.IsSubscribed, dto.GroupIds);
        return await GetSubscriberByIdAsync(subscriber.Id);
    }

    public async Task<EmailSubscriberDto?> UpdateSubscriberAsync(int id, UpdateEmailSubscriberDto dto)
    {
        var subscriber = await _context.EmailSubscribers
            .Include(s => s.Groups)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (subscriber == null) return null;

        await ApplySubscriberUpdateAsync(subscriber, dto.Name, dto.IsSubscribed, dto.GroupIds);
        return await GetSubscriberByIdAsync(id);
    }

    public async Task SyncUserSubscriptionAsync(int userId)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);
        if (user == null || string.IsNullOrWhiteSpace(user.Email)) return;

        var email = NormalizeEmail(user.Email);
        var subscriber = await _context.EmailSubscribers
            .FirstOrDefaultAsync(s => s.UserId == user.Id || s.Email == email);
        if (subscriber == null)
        {
            subscriber = new EmailSubscriber { Email = email, UserId = user.Id, CreatedAt = DateTime.UtcNow };
            _context.EmailSubscribers.Add(subscriber);
        }

        subscriber.Email = email;
        subscriber.UserId = user.Id;
        subscriber.Name = user.Username;
        subscriber.IsSubscribed = user.MarketingConsent;
        subscriber.Source = user.MarketingConsentSource ?? "user";
        subscriber.SubscribedAt = user.MarketingConsentAt ?? user.CreatedAt;
        subscriber.UnsubscribedAt = user.MarketingConsent ? null : user.MarketingConsentRevokedAt;
        subscriber.UpdatedAt = DateTime.UtcNow;

        var suppression = await _context.MarketingUnsubscribes
            .FirstOrDefaultAsync(u => u.Email == email);
        if (user.MarketingConsent && suppression != null)
        {
            _context.MarketingUnsubscribes.Remove(suppression);
        }
        else if (!user.MarketingConsent && suppression == null)
        {
            _context.MarketingUnsubscribes.Add(new MarketingUnsubscribe
            {
                Email = email,
                UnsubscribedAt = user.MarketingConsentRevokedAt ?? DateTime.UtcNow,
                Source = "profile"
            });
        }
        await _context.SaveChangesAsync();
    }

    public async Task<List<SiteInterestDto>> GetSiteInterestsAsync()
    {
        var fromTable = await _context.SiteInterestRegistrations
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new SiteInterestDto
            {
                Id         = s.Id,
                Email      = s.Email,
                Source     = s.Source,
                CreatedAt  = s.CreatedAt,
                IsReadOnly = false
            })
            .ToListAsync();

        var fromComingSoon = (await GetComingSoonSubscribersAsync())
            .Select((cs, i) => new SiteInterestDto
            {
                Id         = -(i + 1),
                Email      = cs.Email,
                Source     = "coming_soon",
                CreatedAt  = cs.CreatedAt,
                IsReadOnly = true
            })
            .Where(cs => !fromTable.Any(t => t.Email.Equals(cs.Email, StringComparison.OrdinalIgnoreCase)))
            .ToList();

        return fromTable.Concat(fromComingSoon)
            .OrderByDescending(s => s.CreatedAt)
            .ToList();
    }

    public async Task<bool> RegisterSiteInterestAsync(string email, string? source)
    {
        email = email.Trim().ToLowerInvariant();
        if (!await _context.SiteInterestRegistrations.AnyAsync(s => s.Email == email))
        {
            _context.SiteInterestRegistrations.Add(new SiteInterestRegistration
            {
                Email     = email,
                Source    = source,
                CreatedAt = DateTime.UtcNow
            });
        }

        var subscriber = await _context.EmailSubscribers.FirstOrDefaultAsync(s => s.Email == email);
        if (subscriber == null)
        {
            _context.EmailSubscribers.Add(new EmailSubscriber
            {
                Email = email,
                IsSubscribed = true,
                Source = source?.Trim() ?? "site-interest",
                SubscribedAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            });
        }
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteSiteInterestAsync(int id)
    {
        var entry = await _context.SiteInterestRegistrations.FindAsync(id);
        if (entry == null) return false;

        _context.SiteInterestRegistrations.Remove(entry);
        await _context.SaveChangesAsync();
        return true;
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    private async Task ApplySubscriberUpdateAsync(
        EmailSubscriber subscriber, string? name, bool isSubscribed, IReadOnlyCollection<int> groupIds)
    {
        var now = DateTime.UtcNow;
        subscriber.Name = string.IsNullOrWhiteSpace(name) ? subscriber.Name : name.Trim();
        subscriber.IsSubscribed = isSubscribed;
        subscriber.UpdatedAt = now;

        if (isSubscribed)
        {
            subscriber.SubscribedAt = now;
            subscriber.UnsubscribedAt = null;

            var suppression = await _context.MarketingUnsubscribes
                .FirstOrDefaultAsync(u => u.Email == subscriber.Email);
            if (suppression != null) _context.MarketingUnsubscribes.Remove(suppression);
        }
        else
        {
            subscriber.UnsubscribedAt = now;
            if (!await _context.MarketingUnsubscribes.AnyAsync(u => u.Email == subscriber.Email))
            {
                _context.MarketingUnsubscribes.Add(new MarketingUnsubscribe
                {
                    Email = subscriber.Email,
                    UnsubscribedAt = now,
                    Source = "admin"
                });
            }
        }

        var users = await _context.Users
            .Where(u => !u.IsDeleted && u.Email.ToLower() == subscriber.Email)
            .ToListAsync();
        foreach (var user in users)
        {
            user.MarketingConsent = isSubscribed;
            user.UpdatedAt = now;
            if (isSubscribed)
            {
                user.MarketingConsentAt = now;
                user.MarketingConsentRevokedAt = null;
                user.MarketingConsentSource = "admin";
            }
            else
            {
                user.MarketingConsentRevokedAt = now;
            }
        }

        _context.EmailGroupMembers.RemoveRange(subscriber.Groups);
        var validGroupIds = await _context.EmailGroups
            .Where(g => groupIds.Contains(g.Id) && !g.IsDeleted)
            .Select(g => g.Id)
            .ToListAsync();
        _context.EmailGroupMembers.AddRange(validGroupIds.Distinct().Select(groupId => new EmailGroupMember
        {
            EmailGroupId = groupId,
            SubscriberId = subscriber.Id,
            AddedAt = now
        }));

        await _context.SaveChangesAsync();
    }

    private async Task<EmailSubscriberDto?> GetSubscriberByIdAsync(int id)
    {
        return await _context.EmailSubscribers.AsNoTracking()
            .Where(s => s.Id == id)
            .Select(s => new EmailSubscriberDto
            {
                Id = s.Id,
                Email = s.Email,
                Name = s.Name,
                UserId = s.UserId,
                IsSubscribed = s.IsSubscribed,
                Source = s.Source,
                SubscribedAt = s.SubscribedAt,
                UnsubscribedAt = s.UnsubscribedAt,
                Groups = s.Groups.Where(g => !g.EmailGroup!.IsDeleted)
                    .Select(g => new EmailSubscriberGroupDto { Id = g.EmailGroupId, Name = g.EmailGroup!.Name })
                    .ToList()
            })
            .FirstOrDefaultAsync();
    }

    private async Task SyncKnownSubscribersAsync()
    {
        var existing = (await _context.EmailSubscribers.Include(s => s.Groups).ToListAsync())
            .ToDictionary(s => s.Email, StringComparer.OrdinalIgnoreCase);
        var existingByUserId = existing.Values
            .Where(s => s.UserId.HasValue)
            .ToDictionary(s => s.UserId!.Value);
        var suppressed = (await _context.MarketingUnsubscribes.ToListAsync())
            .ToDictionary(s => s.Email, StringComparer.OrdinalIgnoreCase);

        var users = await _context.Users
            .Where(u => !u.IsDeleted && u.Email != string.Empty)
            .Select(u => new
            {
                u.Id, u.Email, u.Username, u.MarketingConsent, u.MarketingConsentSource,
                u.MarketingConsentAt, u.MarketingConsentRevokedAt, u.CreatedAt
            })
            .ToListAsync();

        foreach (var user in users)
        {
            var email = NormalizeEmail(user.Email);
            existing.TryGetValue(email, out var subscriber);
            existingByUserId.TryGetValue(user.Id, out var linkedSubscriber);

            if (subscriber != null && linkedSubscriber != null && subscriber.Id != linkedSubscriber.Id)
            {
                var existingGroupIds = subscriber.Groups.Select(g => g.EmailGroupId).ToHashSet();
                _context.EmailGroupMembers.AddRange(linkedSubscriber.Groups
                    .Where(g => !existingGroupIds.Contains(g.EmailGroupId))
                    .Select(g => new EmailGroupMember
                    {
                        EmailGroupId = g.EmailGroupId,
                        SubscriberId = subscriber.Id,
                        AddedAt = g.AddedAt
                    }));
                _context.EmailSubscribers.Remove(linkedSubscriber);
                existing.Remove(linkedSubscriber.Email);
                subscriber.UserId = user.Id;
                existingByUserId[user.Id] = subscriber;
            }
            else if (subscriber == null && linkedSubscriber != null)
            {
                existing.Remove(linkedSubscriber.Email);
                linkedSubscriber.Email = email;
                linkedSubscriber.Name = user.Username;
                subscriber = linkedSubscriber;
                existing[email] = linkedSubscriber;
            }

            if (subscriber == null)
            {
                suppressed.TryGetValue(email, out var suppression);
                subscriber = new EmailSubscriber
                {
                    Email = email,
                    Name = user.Username,
                    UserId = user.Id,
                    IsSubscribed = user.MarketingConsent && suppression == null,
                    Source = user.MarketingConsentSource ?? "user",
                    SubscribedAt = user.MarketingConsentAt ?? user.CreatedAt,
                    UnsubscribedAt = user.MarketingConsent ? suppression?.UnsubscribedAt : user.MarketingConsentRevokedAt,
                    CreatedAt = user.CreatedAt
                };
                _context.EmailSubscribers.Add(subscriber);
                existing[email] = subscriber;
                existingByUserId[user.Id] = subscriber;
            }
            else if (subscriber.UserId == null)
            {
                subscriber.UserId = user.Id;
                subscriber.Name ??= user.Username;
            }
        }

        var interests = await _context.SiteInterestRegistrations.ToListAsync();
        foreach (var interest in interests)
        {
            var email = NormalizeEmail(interest.Email);
            if (existing.ContainsKey(email)) continue;
            suppressed.TryGetValue(email, out var suppression);
            var subscriber = new EmailSubscriber
            {
                Email = email,
                IsSubscribed = suppression == null,
                Source = interest.Source ?? "site-interest",
                SubscribedAt = interest.CreatedAt,
                UnsubscribedAt = suppression?.UnsubscribedAt,
                CreatedAt = interest.CreatedAt
            };
            _context.EmailSubscribers.Add(subscriber);
            existing[email] = subscriber;
        }

        foreach (var legacy in await GetComingSoonSubscribersAsync())
        {
            var email = NormalizeEmail(legacy.Email);
            if (existing.ContainsKey(email)) continue;
            suppressed.TryGetValue(email, out var suppression);
            var subscriber = new EmailSubscriber
            {
                Email = email,
                IsSubscribed = suppression == null,
                Source = "coming_soon",
                SubscribedAt = legacy.CreatedAt,
                UnsubscribedAt = suppression?.UnsubscribedAt,
                CreatedAt = legacy.CreatedAt
            };
            _context.EmailSubscribers.Add(subscriber);
            existing[email] = subscriber;
        }

        await _context.SaveChangesAsync();
    }

    private async Task<EmailGroupDto?> GetEmailGroupByIdAsync(int id)
    {
        return await _context.EmailGroups
            .Where(g => g.Id == id && !g.IsDeleted)
            .Select(g => new EmailGroupDto
            {
                Id          = g.Id,
                Name        = g.Name,
                Description = g.Description,
                MemberCount = g.Members.Count,
                CreatedAt   = g.CreatedAt,
                Members     = g.Members.Select(m => new EmailGroupMemberDto
                {
                    SubscriberId = m.SubscriberId,
                    UserId       = m.Subscriber!.UserId,
                    Username     = m.Subscriber.Name ?? m.Subscriber.Email,
                    Email        = m.Subscriber.Email
                }).ToList()
            })
            .FirstOrDefaultAsync();
    }

    private async Task<List<(string Email, string? Name)>> GetRecipientsAsync(
        EmailRecipientGroup group, int? emailGroupId = null)
    {
        List<(string Email, string? Name)> recipients;

        if (group == EmailRecipientGroup.ManualOneTime)
        {
            recipients = [];
        }
        else if (group == EmailRecipientGroup.InterestedInSite)
        {
            recipients = await GetInterestedInSiteRecipientsAsync();
        }
        else if (group == EmailRecipientGroup.CustomGroup && emailGroupId.HasValue)
        {
            var groupMembers = await _context.EmailGroupMembers
                .Where(m => m.EmailGroupId == emailGroupId.Value &&
                            m.Subscriber!.IsSubscribed)
                .Select(m => new { m.Subscriber!.Email, m.Subscriber.Name })
                .ToListAsync();
            recipients = groupMembers
                .Select(u => (u.Email, u.Name))
                .ToList();
        }
        else if (group is EmailRecipientGroup.AllServiceProviders or EmailRecipientGroup.AllTeachers)
        {
            recipients = await GetProviderRecipientsAsync(group);
        }
        else
        {
            var query = _context.Users
                .Where(u => !u.IsDeleted && u.Email != string.Empty && u.MarketingConsent);
            query = ApplyGroupFilter(query, group);

            var users = await query
                .Select(u => new { u.Email, u.Username })
                .ToListAsync();
            recipients = users
                .Select(u => (u.Email, (string?)u.Username))
                .ToList();
        }

        return await ExcludeUnsubscribedAsync(recipients);
    }

    private async Task<List<(string Email, string? Name)>> GetProviderRecipientsAsync(EmailRecipientGroup group)
    {
        bool teachersOnly = group == EmailRecipientGroup.AllTeachers;

        // משתמשים עם פרופיל מקצועי מחובר → email מהמשתמש
        var fromUsers = await _context.Users
            .Where(u => !u.IsDeleted && u.Email != string.Empty && u.MarketingConsent)
            .Where(u => _context.ServiceProviders.Any(sp =>
                sp.UserId == u.Id && !sp.IsDeleted &&
                (!teachersOnly || _context.Teachers.Any(t => t.Id == sp.Id))))
            .Select(u => new { u.Email, Name = u.Username })
            .ToListAsync();

        return fromUsers.Select(u => (u.Email, (string?)u.Name))
            .GroupBy(e => e.Item1.ToLowerInvariant())
            .Select(g => g.First())
            .ToList();
    }

    private async Task<List<(string Email, string? Name)>> GetInterestedInSiteRecipientsAsync()
    {
        var fromTable = await _context.SiteInterestRegistrations
            .Select(s => s.Email)
            .ToListAsync();

        var fromComingSoon = (await GetComingSoonSubscribersAsync())
            .Select(cs => cs.Email);

        return fromTable.Concat(fromComingSoon)
            .GroupBy(e => e.ToLowerInvariant())
            .Select(g => (g.First(), (string?)null))
            .ToList();
    }

    private static readonly JsonSerializerOptions _comingSoonJsonOptions = new()
    {
        PropertyNamingPolicy        = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private async Task<List<ComingSoonSubscriptionDto>> GetComingSoonSubscribersAsync()
    {
        var raw = await _context.SystemSettings
            .Where(s => s.Key == "coming_soon_subscribers")
            .Select(s => s.Value)
            .FirstOrDefaultAsync();

        if (string.IsNullOrWhiteSpace(raw)) return [];

        try
        {
            var list = JsonSerializer.Deserialize<List<ComingSoonSubscriptionDto>>(raw, _comingSoonJsonOptions);
            return list?.Where(s => s.IsActive).ToList() ?? [];
        }
        catch { return []; }
    }

    private IQueryable<Models.Entities.User> ApplyGroupFilter(
        IQueryable<Models.Entities.User> query, EmailRecipientGroup group)
    {
        return group switch
        {
            EmailRecipientGroup.ActiveOnly =>
                query.Where(u => u.IsActive),
            EmailRecipientGroup.MarketingConsentOnly =>
                query.Where(u => u.IsActive && u.MarketingConsent),
            EmailRecipientGroup.AllArtists =>
                query.Where(u => _context.Artists.Any(a => a.UserId == u.Id)),
            EmailRecipientGroup.NoProfessionalProfile =>
                query.Where(u =>
                    !_context.Artists.Any(a => a.UserId == u.Id && !a.IsDeleted) &&
                    !_context.ServiceProviders.Any(sp => sp.UserId == u.Id && !sp.IsDeleted)),
            _ => query
        };
    }

    private async Task<List<(string Email, string? Name)>> ExcludeUnsubscribedAsync(
        List<(string Email, string? Name)> recipients)
    {
        if (recipients.Count == 0) return recipients;

        var unsubscribed = (await _context.MarketingUnsubscribes
                .Select(u => u.Email)
                .ToListAsync())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return recipients
            .Where(r => !unsubscribed.Contains(NormalizeEmail(r.Email)))
            .GroupBy(r => NormalizeEmail(r.Email))
            .Select(g => g.First())
            .ToList();
    }

    public async Task<ManualRecipientValidationResultDto> ValidateManualRecipientsAsync(List<string> emails)
    {
        var validation = await ValidateManualRecipientsInternalAsync(emails);
        return new ManualRecipientValidationResultDto
        {
            EligibleCount = validation.EligibleEmails.Count,
            SuppressedCount = validation.SuppressedCount,
            DuplicateCount = validation.DuplicateCount,
            MaxAllowed = MaxManualRecipients,
            InvalidEmails = validation.InvalidEmails
        };
    }

    private async Task<ManualRecipientValidation> ValidateManualRecipientsInternalAsync(List<string> emails)
    {
        var invalidEmails = new List<string>();
        var uniqueEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var duplicateCount = 0;

        foreach (var rawEmail in emails)
        {
            var email = NormalizeEmail(rawEmail ?? string.Empty);
            if (!IsValidEmail(email))
            {
                if (!string.IsNullOrWhiteSpace(rawEmail) &&
                    !invalidEmails.Contains(rawEmail.Trim(), StringComparer.OrdinalIgnoreCase))
                    invalidEmails.Add(rawEmail.Trim());
                continue;
            }

            if (!uniqueEmails.Add(email)) duplicateCount++;
        }

        if (uniqueEmails.Count > MaxManualRecipients)
        {
            return new ManualRecipientValidation(
                uniqueEmails.ToList(), invalidEmails, uniqueEmails.Count, duplicateCount, 0);
        }

        var suppressed = (await _context.MarketingUnsubscribes
                .Where(u => uniqueEmails.Contains(u.Email))
                .Select(u => u.Email)
                .ToListAsync())
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return new ManualRecipientValidation(
            uniqueEmails.Where(email => !suppressed.Contains(email)).ToList(),
            invalidEmails,
            uniqueEmails.Count,
            duplicateCount,
            suppressed.Count);
    }

    private static bool IsValidEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email) || email.Length > 254) return false;
        var atIndex = email.LastIndexOf('@');
        if (atIndex <= 0 || email.IndexOf('.', atIndex) <= atIndex + 1) return false;
        try
        {
            var parsed = new MailAddress(email);
            return string.Equals(parsed.Address, email, StringComparison.OrdinalIgnoreCase);
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private sealed record ManualRecipientValidation(
        List<string> EligibleEmails,
        List<string> InvalidEmails,
        int UniqueValidCount,
        int DuplicateCount,
        int SuppressedCount);

    private string BuildUnsubscribeUrl(string email)
    {
        var baseUrl = (_configuration["Backend:BaseUrl"] ?? "https://api.akordishkayt.com").TrimEnd('/');
        return $"{baseUrl}/api/Email/unsubscribe-page?token={Uri.EscapeDataString(CreateUnsubscribeToken(email))}";
    }

    private string CreateUnsubscribeToken(string email)
    {
        var payload = Base64UrlEncode(Encoding.UTF8.GetBytes(NormalizeEmail(email)));
        using var hmac = new HMACSHA256(GetUnsubscribeSecret());
        var signature = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        return $"{payload}.{Base64UrlEncode(signature)}";
    }

    private bool TryReadUnsubscribeToken(string token, out string email)
    {
        email = string.Empty;
        if (string.IsNullOrWhiteSpace(token)) return false;

        var parts = token.Split('.', 2);
        if (parts.Length != 2) return false;

        try
        {
            using var hmac = new HMACSHA256(GetUnsubscribeSecret());
            var expected = hmac.ComputeHash(Encoding.UTF8.GetBytes(parts[0]));
            var actual = Base64UrlDecode(parts[1]);
            if (!CryptographicOperations.FixedTimeEquals(expected, actual)) return false;

            email = Encoding.UTF8.GetString(Base64UrlDecode(parts[0]));
            return !string.IsNullOrWhiteSpace(email) && email.Contains('@');
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private byte[] GetUnsubscribeSecret()
    {
        var secret = _configuration["EmailUnsubscribe:Secret"] ?? _configuration["Jwt:Key"];
        if (string.IsNullOrWhiteSpace(secret))
            throw new InvalidOperationException("Email unsubscribe signing secret is not configured.");
        return Encoding.UTF8.GetBytes(secret);
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    /// <summary>
    /// Campaign content is authored as rich HTML by administrators. Keep only email-safe markup
    /// and inline presentation attributes before it is sent or rendered in a preview.
    /// </summary>
    private static string SanitizeEmailContent(string content)
    {
        if (string.IsNullOrWhiteSpace(content)) return string.Empty;

        var sanitizer = new HtmlSanitizer();
        sanitizer.AllowedTags.Clear();
        foreach (var tag in new[]
        {
            "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "strike", "font", "span",
            "a", "h1", "h2", "h3", "h4", "ul", "ol", "li", "div", "img",
            "table", "tbody", "thead", "tr", "td", "th"
        }) sanitizer.AllowedTags.Add(tag);

        sanitizer.AllowedAttributes.Clear();
        foreach (var attribute in new[]
        {
            "href", "src", "alt", "title", "target", "rel", "style", "width", "height",
            "border", "cellpadding", "cellspacing", "align", "role", "face", "color", "bgcolor"
        }) sanitizer.AllowedAttributes.Add(attribute);

        sanitizer.AllowedSchemes.Clear();
        sanitizer.AllowedSchemes.Add("https");
        sanitizer.AllowedSchemes.Add("http");
        sanitizer.AllowedSchemes.Add("mailto");
        sanitizer.AllowedSchemes.Add("tel");

        sanitizer.AllowedCssProperties.Clear();
        foreach (var property in new[]
        {
            "background", "background-color", "background-image", "border", "border-top",
            "border-right", "border-bottom", "border-left", "border-collapse", "border-radius",
            "border-spacing", "box-sizing", "color", "display", "direction", "font-family",
            "font-size", "font-style", "font-weight", "height", "left", "letter-spacing",
            "line-height", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
            "max-height", "max-width", "min-height", "min-width",
            "opacity", "overflow", "object-fit", "object-position",
            "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
            "position", "right", "text-align", "text-decoration", "text-overflow",
            "text-transform", "top",
            "transform", "vertical-align", "white-space", "width",
            "z-index", "aspect-ratio"
        }) sanitizer.AllowedCssProperties.Add(property);

        var protectedContent = ProtectCssFunctions(content);
        var sanitized = sanitizer.Sanitize(protectedContent);
        return RestoreCssFunctions(sanitized);
    }

    private static readonly string[] CssFunctionsToProtect =
    {
        "linear-gradient", "radial-gradient", "repeating-linear-gradient",
        "rgba", "rgb", "hsl", "hsla", "var"
    };

    private static string ProtectCssFunctions(string html)
    {
        return Regex.Replace(html,
            @"style\s*=\s*(""|')([^""']*)\1",
            match =>
            {
                var quote = match.Groups[1].Value;
                var css = match.Groups[2].Value;
                var protectedCss = CssFunctionsToProtect.Aggregate(css, (current, func) =>
                {
                    var pattern = $@"{Regex.Escape(func)}\(([^()]*(\([^()]*\)[^()]*)*)\)";
                    return Regex.Replace(current, pattern, m =>
                        $"__CSSFN_{Convert.ToBase64String(Encoding.UTF8.GetBytes(m.Value))}__",
                        RegexOptions.IgnoreCase);
                });
                return $"style={quote}{protectedCss}{quote}";
            },
            RegexOptions.IgnoreCase);
    }

    private static string RestoreCssFunctions(string html)
    {
        return Regex.Replace(html,
            @"__CSSFN_([A-Za-z0-9+/=]+)__",
            match =>
            {
                try
                {
                    var bytes = Convert.FromBase64String(match.Groups[1].Value);
                    return Encoding.UTF8.GetString(bytes);
                }
                catch
                {
                    return match.Value;
                }
            });
    }

    private static string Base64UrlEncode(byte[] value) =>
        Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        padded += (padded.Length % 4) switch { 2 => "==", 3 => "=", _ => string.Empty };
        return Convert.FromBase64String(padded);
    }

    private async Task<bool> SendBrevoEmailAsync(
        string apiKey,
        string fromEmail, string fromName,
        string toEmail,   string? toName,
        string subject,   string htmlContent,
        string? plainText = null,
        string? replyToEmail = null)
    {
        var payload = new
        {
            sender      = new { email = fromEmail, name = fromName },
            to          = new[] { new { email = toEmail, name = toName ?? toEmail } },
            subject,
            htmlContent,
            textContent = plainText,
            replyTo = string.IsNullOrWhiteSpace(replyToEmail) ? null : new { email = replyToEmail, name = fromName }
        };

        try
        {
            var client = _httpClientFactory.CreateClient();
            using var req = new HttpRequestMessage(HttpMethod.Post, BrevoApiUrl);
            req.Headers.Add("api-key", apiKey);
            req.Headers.Add("accept", "application/json");
            req.Content = new StringContent(
                JsonSerializer.Serialize(payload, new JsonSerializerOptions
                {
                    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
                }),
                Encoding.UTF8,
                "application/json");

            var response = await client.SendAsync(req);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogError("Brevo error {Status} ל-{Email}: {Body}", response.StatusCode, toEmail, body);
            }

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "שגיאה בשליחת מייל Brevo ל-{Email}", toEmail);
            return false;
        }
    }

    // ── Email templates ────────────────────────────────────────────────────────

    private static string BuildPasswordResetEmail(string name, string code) => $"""
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>איפוס סיסמא — אקורדישקייט</title>
        </head>
        <body style="font-family: Arial, Helvetica, sans-serif; direction: rtl; text-align: right; background-color: #F2F2F2; margin: 0; padding: 32px 16px;">
          <div style="max-width: 520px; margin: 0 auto;">

            <!-- Logo bar -->
            <div style="background-color: #000000; border-radius: 20px 20px 0 0; padding: 28px 32px; text-align: center;">
              <div style="font-size: 26px; font-weight: 900; color: #ddff53; letter-spacing: 2px; margin-bottom: 4px;">אקורדישקייט</div>
              <div style="font-size: 13px; color: rgba(255,255,255,0.55); letter-spacing: 1px;">AKORDISHKEIT</div>
            </div>

            <!-- Yellow accent bar -->
            <div style="background-color: #ddff53; height: 6px;"></div>

            <!-- Body -->
            <div style="background: #ffffff; padding: 40px 40px 32px; color: #000000;">

              <p style="margin: 0 0 6px; font-size: 13px; color: #404040; text-transform: uppercase; letter-spacing: 1px;">איפוס סיסמא</p>
              <h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 800; color: #000000;">שלום {name} 👋</h2>

              <p style="margin: 0 0 28px; font-size: 15px; line-height: 1.75; color: #404040;">
                קיבלנו בקשה לאיפוס הסיסמא שלך באקורדישקייט.<br>
                הנה קוד האימות שלך — הקלד אותו במסך האיפוס:
              </p>

              <!-- OTP box -->
              <div style="background: #000000; border-radius: 16px; padding: 28px 24px; text-align: center; margin: 0 0 28px;">
                <div style="font-size: 48px; font-weight: 900; letter-spacing: 14px; color: #ddff53; font-family: 'Courier New', monospace; padding-right: 14px;">
                  {code}
                </div>
                <div style="margin-top: 12px; font-size: 13px; color: rgba(255,255,255,0.6);">
                  ⏱ הקוד תקף ל-15 דקות בלבד
                </div>
              </div>

              <!-- Steps -->
              <div style="background: #F2F2F2; border-radius: 12px; padding: 20px 24px; margin: 0 0 28px;">
                <p style="margin: 0 0 10px; font-weight: 700; font-size: 14px; color: #000000;">איך ממשיכים?</p>
                <ol style="margin: 0; padding-right: 20px; color: #404040; font-size: 14px; line-height: 2;">
                  <li>חזור למסך איפוס הסיסמא באקורדישקייט</li>
                  <li>הזן את הקוד הזה</li>
                  <li>בחר סיסמא חדשה</li>
                </ol>
              </div>

              <p style="margin: 0; font-size: 13px; color: #404040; line-height: 1.7; padding-top: 4px; border-top: 1px solid #F2F2F2;">
                לא ביקשת איפוס סיסמא? אפשר להתעלם מהמייל הזה — החשבון שלך בטוח ולא ייעשה שום שינוי.
              </p>
            </div>

            <!-- Footer -->
            <div style="background-color: #000000; border-radius: 0 0 20px 20px; padding: 18px 32px; text-align: center;">
              <p style="color: rgba(255,255,255,0.5); margin: 0; font-size: 12px;">
                © אקורדישקייט — כל הזכויות שמורות
              </p>
            </div>

          </div>
        </body>
        </html>
        """;

    private static string WrapInEmailTemplate(string content, string subject, string unsubscribeUrl) => $"""
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>{subject}</title>
        </head>
        <body style="font-family: Arial, Helvetica, sans-serif; direction: rtl; text-align: right; background-color: #F2F2F2; margin: 0; padding: 32px 16px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden;">

            <!-- Content -->
            <div style="padding: 32px 40px; color: #000000; font-size: 15px; line-height: 1.75;">
              {content}
            </div>

            <!-- Footer -->
            <div style="background-color: #F2F2F2; padding: 18px 32px; text-align: center;">
              <p style="color: #404040; margin: 0; font-size: 12px;">
                © אקורדישקייט — כל הזכויות שמורות
              </p>
              <p style="color: #404040; margin: 10px 0 0; font-size: 12px; line-height: 1.5;">
                לא רוצה לקבל מאיתנו דיוור שיווקי?
                <a href="{System.Net.WebUtility.HtmlEncode(unsubscribeUrl)}" style="color: #000000; font-weight: 700; text-decoration: underline;">להסרה מרשימת התפוצה</a>
              </p>
            </div>

          </div>
        </body>
        </html>
        """;
}
