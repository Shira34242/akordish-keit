using System.Text;
using System.Text.Json;
using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
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

        var recipients = await GetRecipientsAsync(request.RecipientGroup);
        if (recipients.Count == 0)
            return new EmailSendResultDto { Success = false, Message = "לא נמצאו נמענים עם כתובת מייל" };

        var fromEmail = request.FromEmail ?? _configuration["Brevo:FromEmail"] ?? "noreply@akordishkeit.com";
        var fromName  = request.FromName  ?? _configuration["Brevo:FromName"]  ?? "אקורדישקייט";
        var htmlBody  = WrapInEmailTemplate(request.HtmlBody, request.Subject);

        int sentCount = 0, failedCount = 0;

        // Send individually (privacy) — 20 concurrent requests at a time
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
        sentCount    = results.Count(ok => ok);
        failedCount  = results.Count(ok => !ok);

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

    public async Task<int> GetRecipientCountAsync(EmailRecipientGroup group)
    {
        var query = _context.Users.Where(u => !u.IsDeleted && u.Email != string.Empty);

        query = group switch
        {
            EmailRecipientGroup.ActiveOnly          => query.Where(u => u.IsActive),
            EmailRecipientGroup.MarketingConsentOnly => query.Where(u => u.IsActive && u.MarketingConsent),
            _                                        => query
        };

        return await query.CountAsync();
    }

    // ── Private helpers ────────────────────────────────────────────────────────

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
                JsonSerializer.Serialize(payload, new JsonSerializerOptions { DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull }),
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

    private async Task<List<(string Email, string? Name)>> GetRecipientsAsync(EmailRecipientGroup group)
    {
        var query = _context.Users.Where(u => !u.IsDeleted && u.Email != string.Empty);

        query = group switch
        {
            EmailRecipientGroup.ActiveOnly           => query.Where(u => u.IsActive),
            EmailRecipientGroup.MarketingConsentOnly => query.Where(u => u.IsActive && u.MarketingConsent),
            _                                        => query
        };

        return await query
            .Select(u => new { u.Email, u.Username })
            .ToListAsync()
            .ContinueWith(t => t.Result.Select(u => (u.Email, (string?)u.Username)).ToList());
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
        <body style="font-family: Arial, Helvetica, sans-serif; direction: rtl; text-align: right; background-color: #F2F2F2; margin: 0; padding: 20px;">
          <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #000000; padding: 24px; text-align: center;">
              <h1 style="color: #ddff53; margin: 0; font-size: 22px; letter-spacing: 1px;">אקורדישקייט</h1>
            </div>
            <div style="padding: 36px 32px; color: #000;">
              <h2 style="margin: 0 0 16px; font-size: 20px;">שלום {name},</h2>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.7; color: #404040;">
                קיבלנו בקשה לאיפוס הסיסמא שלך. השתמש בקוד הבא כדי להמשיך:
              </p>
              <div style="background: #F2F2F2; border-radius: 10px; padding: 24px; text-align: center; margin: 0 0 24px;">
                <div style="font-size: 42px; font-weight: 700; letter-spacing: 12px; color: #000; font-family: monospace;">
                  {code}
                </div>
                <p style="margin: 12px 0 0; font-size: 13px; color: #666;">הקוד תקף ל-15 דקות בלבד</p>
              </div>
              <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.6;">
                אם לא ביקשת איפוס סיסמא, ניתן להתעלם מהמייל הזה. החשבון שלך בטוח.
              </p>
            </div>
            <div style="background-color: #404040; padding: 16px; text-align: center;">
              <p style="color: #ffffff; margin: 0; font-size: 12px;">© אקורדישקייט — כל הזכויות שמורות</p>
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
        <body style="font-family: Arial, Helvetica, sans-serif; direction: rtl; text-align: right; background-color: #F2F2F2; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #000000; padding: 24px; text-align: center;">
              <h1 style="color: #ddff53; margin: 0; font-size: 22px; letter-spacing: 1px;">אקורדישקייט</h1>
            </div>
            <div style="padding: 32px; color: #000000; font-size: 15px; line-height: 1.7;">
              {content}
            </div>
            <div style="background-color: #404040; padding: 16px; text-align: center;">
              <p style="color: #ffffff; margin: 0; font-size: 12px;">© אקורדישקייט — כל הזכויות שמורות</p>
            </div>
          </div>
        </body>
        </html>
        """;
}
