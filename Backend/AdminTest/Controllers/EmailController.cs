using System.Security.Claims;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Net;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class EmailController : ControllerBase
{
    private readonly IEmailService _emailService;

    public EmailController(IEmailService emailService)
    {
        _emailService = emailService;
    }

    // ── Campaign ──────────────────────────────────────────────────────────────

    [HttpGet("recipient-count")]
    public async Task<ActionResult<int>> GetRecipientCount(
        [FromQuery] EmailRecipientGroup group = EmailRecipientGroup.AllUsers,
        [FromQuery] int? emailGroupId = null)
    {
        var count = await _emailService.GetRecipientCountAsync(group, emailGroupId);
        return Ok(count);
    }

    [HttpPost("send-campaign")]
    public async Task<ActionResult<EmailSendResultDto>> SendCampaign([FromBody] SendEmailRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Subject))
            return BadRequest("נושא המייל הוא שדה חובה");

        if (string.IsNullOrWhiteSpace(request.HtmlBody))
            return BadRequest("תוכן המייל הוא שדה חובה");

        var result = await _emailService.SendCampaignAsync(request);
        return Ok(result);
    }

    [HttpPost("validate-manual-recipients")]
    public async Task<ActionResult<ManualRecipientValidationResultDto>> ValidateManualRecipients(
        [FromBody] ManualRecipientValidationRequestDto request)
    {
        return Ok(await _emailService.ValidateManualRecipientsAsync(request.Emails ?? []));
    }

    [HttpPost("send-test")]
    public async Task<ActionResult<EmailSendResultDto>> SendTest([FromBody] SendTestEmailRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.RecipientEmail) || !request.RecipientEmail.Contains('@'))
            return BadRequest("כתובת מייל לא תקינה");
        if (string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.HtmlBody))
            return BadRequest("נושא ותוכן הם שדות חובה");

        return Ok(await _emailService.SendTestEmailAsync(request, request.RecipientEmail));
    }

    [HttpGet("recipients")]
    public async Task<ActionResult<List<EmailRecipientDto>>> GetRecipients(
        [FromQuery] EmailRecipientGroup group = EmailRecipientGroup.AllUsers,
        [FromQuery] int? emailGroupId = null)
    {
        var recipients = await _emailService.GetRecipientsPreviewAsync(group, emailGroupId);
        return Ok(recipients);
    }

    [HttpPost("preview")]
    public ActionResult<object> PreviewEmail([FromBody] EmailPreviewRequestDto request)
    {
        var html = _emailService.BuildPreviewHtml(request.Subject, request.HtmlBody);
        return Ok(new { html });
    }

    [AllowAnonymous]
    [HttpPost("unsubscribe")]
    public async Task<ActionResult<MarketingUnsubscribeResultDto>> Unsubscribe(
        [FromBody] MarketingUnsubscribeRequestDto request)
    {
        var result = await _emailService.UnsubscribeAsync(request.Token);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [AllowAnonymous]
    [HttpGet("unsubscribe-page")]
    public IActionResult UnsubscribePage([FromQuery] string? token)
    {
        Response.Headers.CacheControl = "no-store";
        if (string.IsNullOrWhiteSpace(token))
            return BuildUnsubscribeHtml(false, "קישור ההסרה חסר או אינו תקין.", StatusCodes.Status400BadRequest);

        var encodedToken = WebUtility.HtmlEncode(token);
        return new ContentResult
        {
            ContentType = "text/html; charset=utf-8",
            StatusCode = StatusCodes.Status200OK,
            Content = $"""
                <!doctype html>
                <html lang="he" dir="rtl">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <meta name="robots" content="noindex,nofollow">
                  <meta name="referrer" content="no-referrer">
                  <title>הסרה מרשימת התפוצה - אקורדישקייט</title>
                  <style>{UnsubscribePageStyles}</style>
                </head>
                <body>
                  <main class="page">
                    <section class="card" aria-live="polite">
                      <div class="brand">אקורדישקייט</div>
                      <div class="spinner" aria-hidden="true"></div>
                      <h1>מעדכנים את ההעדפות שלך</h1>
                      <p>מסירים אותך מרשימת התפוצה...</p>
                      <form id="unsubscribe-form" method="post" action="/api/Email/unsubscribe-form">
                        <input type="hidden" name="token" value="{encodedToken}">
                        <button type="submit">הסרה מרשימת התפוצה</button>
                      </form>
                      <noscript><p>יש ללחוץ על כפתור ההסרה כדי להשלים את הפעולה.</p></noscript>
                    </section>
                  </main>
                  <script>document.getElementById('unsubscribe-form').submit();</script>
                </body>
                </html>
                """
        };
    }

    [AllowAnonymous]
    [HttpPost("unsubscribe-form")]
    [Consumes("application/x-www-form-urlencoded")]
    public async Task<IActionResult> UnsubscribeForm([FromForm] string? token)
    {
        Response.Headers.CacheControl = "no-store";
        if (string.IsNullOrWhiteSpace(token))
            return BuildUnsubscribeHtml(false, "קישור ההסרה חסר או אינו תקין.", StatusCodes.Status400BadRequest);

        var result = await _emailService.UnsubscribeAsync(token);
        return BuildUnsubscribeHtml(
            result.Success,
            result.Message,
            result.Success ? StatusCodes.Status200OK : StatusCodes.Status400BadRequest);
    }

    // ── Email Groups ──────────────────────────────────────────────────────────

    [HttpGet("groups")]
    public async Task<ActionResult<List<EmailGroupDto>>> GetGroups()
    {
        var groups = await _emailService.GetEmailGroupsAsync();
        return Ok(groups);
    }

    [HttpPost("groups")]
    public async Task<ActionResult<EmailGroupDto>> CreateGroup([FromBody] SaveEmailGroupDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("שם הקבוצה הוא שדה חובה");

        var adminId = GetAdminUserId();
        if (adminId == null) return Unauthorized();

        var result = await _emailService.CreateEmailGroupAsync(dto, adminId.Value);
        return result == null ? StatusCode(500, "שגיאה ביצירת הקבוצה") : Ok(result);
    }

    [HttpPut("groups/{id}")]
    public async Task<ActionResult<EmailGroupDto>> UpdateGroup(int id, [FromBody] SaveEmailGroupDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest("שם הקבוצה הוא שדה חובה");

        var result = await _emailService.UpdateEmailGroupAsync(id, dto);
        return result == null ? NotFound() : Ok(result);
    }

    [HttpDelete("groups/{id}")]
    public async Task<IActionResult> DeleteGroup(int id)
    {
        var ok = await _emailService.DeleteEmailGroupAsync(id);
        return ok ? NoContent() : NotFound();
    }

    [HttpGet("subscribers")]
    public async Task<ActionResult<EmailSubscriberPageDto>> GetSubscribers(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] int? groupId = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25)
    {
        return Ok(await _emailService.GetSubscribersAsync(search, status, groupId, page, pageSize));
    }

    [HttpPost("subscribers")]
    public async Task<ActionResult<EmailSubscriberDto>> CreateSubscriber([FromBody] SaveEmailSubscriberDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email)) return BadRequest("כתובת המייל היא שדה חובה");
        var subscriber = await _emailService.CreateSubscriberAsync(dto);
        return subscriber == null ? BadRequest("כתובת המייל אינה תקינה") : Ok(subscriber);
    }

    [HttpPut("subscribers/{id}")]
    public async Task<ActionResult<EmailSubscriberDto>> UpdateSubscriber(
        int id, [FromBody] UpdateEmailSubscriberDto dto)
    {
        var subscriber = await _emailService.UpdateSubscriberAsync(id, dto);
        return subscriber == null ? NotFound() : Ok(subscriber);
    }

    // ── Site Interest ─────────────────────────────────────────────────────────

    [HttpGet("site-interests")]
    public async Task<ActionResult<List<SiteInterestDto>>> GetSiteInterests()
    {
        var list = await _emailService.GetSiteInterestsAsync();
        return Ok(list);
    }

    [HttpDelete("site-interests/{id}")]
    public async Task<IActionResult> DeleteSiteInterest(int id)
    {
        var ok = await _emailService.DeleteSiteInterestAsync(id);
        return ok ? NoContent() : NotFound();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private int? GetAdminUserId()
    {
        var value = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                 ?? User.FindFirst("id")?.Value
                 ?? User.FindFirst("sub")?.Value;
        return int.TryParse(value, out var id) ? id : null;
    }

    private static ContentResult BuildUnsubscribeHtml(bool success, string message, int statusCode)
    {
        var encodedMessage = WebUtility.HtmlEncode(message);
        var title = success ? "ההסרה הושלמה" : "לא הצלחנו להשלים את ההסרה";
        var icon = success ? "✓" : "!";
        var iconClass = success ? "status success" : "status error";

        return new ContentResult
        {
            ContentType = "text/html; charset=utf-8",
            StatusCode = statusCode,
            Content = $"""
                <!doctype html>
                <html lang="he" dir="rtl">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <meta name="robots" content="noindex,nofollow">
                  <meta name="referrer" content="no-referrer">
                  <title>{title} - אקורדישקייט</title>
                  <style>{UnsubscribePageStyles}</style>
                </head>
                <body>
                  <main class="page">
                    <section class="card">
                      <a class="brand" href="https://akordishkayt.com">אקורדישקייט</a>
                      <div class="{iconClass}" aria-hidden="true">{icon}</div>
                      <h1>{title}</h1>
                      <p>{encodedMessage}</p>
                      <a class="button" href="https://akordishkayt.com">חזרה לאתר</a>
                    </section>
                  </main>
                </body>
                </html>
                """
        };
    }

    private const string UnsubscribePageStyles = """
        :root{font-family:Arial,Helvetica,sans-serif;color:#000;background:#f2f2f2}
        *{box-sizing:border-box}body{margin:0}.page{min-height:100vh;display:grid;place-items:center;padding:28px}
        .card{width:min(100%,512px);display:flex;flex-direction:column;align-items:center;gap:20px;padding:40px;border-radius:24px;background:#fff;text-align:center}
        .brand{color:#000;font-size:28px;font-weight:800;text-decoration:none}.status{width:64px;height:64px;display:grid;place-items:center;border-radius:50%;font-size:32px;font-weight:800}
        .success{background:#ddff53;color:#000}.error{background:#404040;color:#fff}.spinner{width:52px;height:52px;border:4px solid #f2f2f2;border-top-color:#000;border-radius:50%;animation:spin .8s linear infinite}
        h1{margin:0;font-size:28px;line-height:1.2}p{margin:0;color:#404040;font-size:16px;line-height:1.6}
        form{margin:0}button,.button{min-height:38px;display:inline-flex;align-items:center;justify-content:center;padding:0 20px;border:0;border-radius:999px;background:#000;color:#ddff53;font:inherit;font-weight:800;text-decoration:none;cursor:pointer}
        @keyframes spin{to{transform:rotate(360deg)}}@media(max-width:600px){.page{padding:14px}.card{padding:28px 20px;border-radius:20px}}
        """;
}
