using System.Text;
using System.Text.Json;
using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class EmailService : IEmailService
{
    private const string BrevoApiUrl = "https://api.brevo.com/v3/smtp/email";

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

        var recipients = await GetRecipientsAsync(request.RecipientGroup, request.EmailGroupId);
        if (recipients.Count == 0)
            return new EmailSendResultDto { Success = false, Message = "לא נמצאו נמענים עם כתובת מייל" };

        var fromEmail = request.FromEmail ?? _configuration["Brevo:FromEmail"] ?? "noreply@akordishkeit.com";
        var fromName  = request.FromName  ?? _configuration["Brevo:FromName"]  ?? "אקורדישקייט";
        var htmlBody  = WrapInEmailTemplate(request.HtmlBody, request.Subject);

        int sentCount = 0, failedCount = 0;

        var semaphore = new SemaphoreSlim(20);
        var tasks = recipients.Select(async r =>
        {
            await semaphore.WaitAsync();
            try
            {
                return await SendBrevoEmailAsync(apiKey, fromEmail, fromName,
                    r.Email, r.Name, request.Subject, htmlBody);
            }
            finally { semaphore.Release(); }
        });

        var results = await Task.WhenAll(tasks);
        sentCount   = results.Count(ok => ok);
        failedCount = results.Count(ok => !ok);

        return new EmailSendResultDto
        {
            Success  = sentCount > 0,
            Message  = failedCount > 0
                ? $"נשלח ל-{sentCount} נמענים, {failedCount} נכשלו"
                : $"נשלח בהצלחה ל-{sentCount} נמענים",
            SentCount   = sentCount,
            FailedCount = failedCount
        };
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
    {
        if (group == EmailRecipientGroup.InterestedInSite)
            return await _context.SiteInterestRegistrations.CountAsync();

        if (group == EmailRecipientGroup.CustomGroup && emailGroupId.HasValue)
            return await _context.EmailGroupMembers
                .Where(m => m.EmailGroupId == emailGroupId.Value)
                .CountAsync();

        var query = _context.Users.Where(u => !u.IsDeleted && u.Email != string.Empty);
        query = ApplyGroupFilter(query, group);
        return await query.CountAsync();
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
                    UserId   = m.UserId,
                    Username = m.User!.Username,
                    Email    = m.User!.Email
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

        if (dto.UserIds.Count > 0)
        {
            var members = dto.UserIds.Distinct().Select(uid => new EmailGroupMember
            {
                EmailGroupId = group.Id,
                UserId       = uid,
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
        var newMembers = dto.UserIds.Distinct().Select(uid => new EmailGroupMember
        {
            EmailGroupId = group.Id,
            UserId       = uid,
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

    public async Task<List<SiteInterestDto>> GetSiteInterestsAsync()
    {
        return await _context.SiteInterestRegistrations
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new SiteInterestDto
            {
                Id        = s.Id,
                Email     = s.Email,
                Source    = s.Source,
                CreatedAt = s.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<bool> RegisterSiteInterestAsync(string email, string? source)
    {
        email = email.Trim().ToLowerInvariant();
        if (await _context.SiteInterestRegistrations.AnyAsync(s => s.Email == email))
            return true; // already registered — silently succeed

        _context.SiteInterestRegistrations.Add(new SiteInterestRegistration
        {
            Email     = email,
            Source    = source,
            CreatedAt = DateTime.UtcNow
        });
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
                    UserId   = m.UserId,
                    Username = m.User!.Username,
                    Email    = m.User!.Email
                }).ToList()
            })
            .FirstOrDefaultAsync();
    }

    private async Task<List<(string Email, string? Name)>> GetRecipientsAsync(
        EmailRecipientGroup group, int? emailGroupId = null)
    {
        if (group == EmailRecipientGroup.InterestedInSite)
        {
            return await _context.SiteInterestRegistrations
                .Select(s => new { s.Email })
                .ToListAsync()
                .ContinueWith(t => t.Result.Select(s => (s.Email, (string?)null)).ToList());
        }

        if (group == EmailRecipientGroup.CustomGroup && emailGroupId.HasValue)
        {
            return await _context.EmailGroupMembers
                .Where(m => m.EmailGroupId == emailGroupId.Value)
                .Select(m => new { m.User!.Email, m.User.Username })
                .ToListAsync()
                .ContinueWith(t => t.Result.Select(u => (u.Email, (string?)u.Username)).ToList());
        }

        var query = _context.Users.Where(u => !u.IsDeleted && u.Email != string.Empty);
        query = ApplyGroupFilter(query, group);

        return await query
            .Select(u => new { u.Email, u.Username })
            .ToListAsync()
            .ContinueWith(t => t.Result.Select(u => (u.Email, (string?)u.Username)).ToList());
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
            EmailRecipientGroup.AllTeachers =>
                query.Where(u => _context.ServiceProviders.Any(sp => sp.UserId == u.Id
                              && _context.Teachers.Any(t => t.Id == sp.Id))),
            EmailRecipientGroup.AllArtists =>
                query.Where(u => _context.Artists.Any(a => a.UserId == u.Id)),
            EmailRecipientGroup.AllServiceProviders =>
                query.Where(u => _context.ServiceProviders.Any(sp => sp.UserId == u.Id)),
            _ => query
        };
    }

    private async Task<bool> SendBrevoEmailAsync(
        string apiKey,
        string fromEmail, string fromName,
        string toEmail,   string? toName,
        string subject,   string htmlContent,
        string? plainText = null)
    {
        var payload = new
        {
            sender      = new { email = fromEmail, name = fromName },
            to          = new[] { new { email = toEmail, name = toName ?? toEmail } },
            subject,
            htmlContent,
            textContent = plainText
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

    private static string WrapInEmailTemplate(string content, string subject) => $"""
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>{subject}</title>
        </head>
        <body style="font-family: Arial, Helvetica, sans-serif; direction: rtl; text-align: right; background-color: #F2F2F2; margin: 0; padding: 32px 16px;">
          <div style="max-width: 600px; margin: 0 auto;">

            <!-- Logo bar -->
            <div style="background-color: #000000; border-radius: 20px 20px 0 0; padding: 28px 32px; text-align: center;">
              <div style="font-size: 26px; font-weight: 900; color: #ddff53; letter-spacing: 2px; margin-bottom: 4px;">אקורדישקייט</div>
              <div style="font-size: 13px; color: rgba(255,255,255,0.55); letter-spacing: 1px;">AKORDISHKEIT</div>
            </div>

            <!-- Yellow accent bar -->
            <div style="background-color: #ddff53; height: 6px;"></div>

            <!-- Content -->
            <div style="background: #ffffff; padding: 40px 40px 32px; color: #000000; font-size: 15px; line-height: 1.75;">
              {content}
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
}
