using System.Security.Claims;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
}
