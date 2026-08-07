using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using AkordishKeit.Services.EmailPipeline;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/Email/v2")]
[Authorize(Roles = "Admin")]
public class EmailV2Controller : ControllerBase
{
    private readonly IEmailV2Service _emailV2Service;
    private readonly IEmailSendPipeline _pipeline;
    private readonly IMessageTracker _messageTracker;

    public EmailV2Controller(
        IEmailV2Service emailV2Service,
        IEmailSendPipeline pipeline,
        IMessageTracker messageTracker)
    {
        _emailV2Service = emailV2Service;
        _pipeline = pipeline;
        _messageTracker = messageTracker;
    }

    [HttpPost("templates")]
    public async Task<ActionResult<EmailV2TemplateDto>> SaveTemplate(
        [FromBody] SaveEmailV2TemplateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Subject))
            return BadRequest("is required");
        if (string.IsNullOrWhiteSpace(dto.Mjml))
            return BadRequest("MJML is required");

        try
        {
            var result = await _emailV2Service.SaveTemplateAsync(dto);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (DbUpdateException ex)
        {
            var msg = UnwrapException(ex);
            return StatusCode(500, new { message = msg });
        }
        catch (Exception ex)
        {
            var msg = UnwrapException(ex);
            return StatusCode(500, new { message = msg });
        }
    }

    [HttpGet("templates")]
    public async Task<ActionResult<List<EmailV2TemplateDto>>> GetTemplates()
    {
        var templates = await _emailV2Service.GetTemplatesAsync();
        return Ok(templates);
    }

    [HttpGet("templates/{campaignId}")]
    public async Task<ActionResult<EmailV2TemplateDto>> GetTemplate(int campaignId)
    {
        var template = await _emailV2Service.GetTemplateAsync(campaignId);
        if (template == null) return NotFound();
        return Ok(template);
    }

    [HttpPost("convert")]
    public async Task<ActionResult<EmailV2ConversionResultDto>> ConvertToHtml(
        [FromBody] SaveEmailV2TemplateDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Mjml))
            return BadRequest("MJML is required");

        var result = await _emailV2Service.ConvertToHtmlAsync(dto.Mjml);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("send-test")]
    public async Task<ActionResult<EmailV2ConversionResultDto>> SendTest(
        [FromBody] EmailV2SendTestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.RecipientEmail) || !dto.RecipientEmail.Contains('@'))
            return BadRequest("invalid");

        var campaign = await _emailV2Service.GetTemplateAsync(dto.CampaignId);
        if (campaign == null) return NotFound();

        var result = await _pipeline.SendTestEmailAsync(dto, campaign.HtmlBody);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpDelete("templates/{campaignId}")]
    public async Task<IActionResult> DeleteTemplate(int campaignId)
    {
        var ok = await _emailV2Service.DeleteTemplateAsync(campaignId);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("send-campaign")]
    public async Task<ActionResult<EmailSendResultDto>> SendCampaign(
        [FromBody] EmailSendRequestV2Dto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Subject))
            return BadRequest("subject required");
        if (string.IsNullOrWhiteSpace(dto.HtmlBody))
            return BadRequest("content required");

        var request = new SendEmailRequestDto
        {
            Subject = dto.Subject,
            HtmlBody = dto.HtmlBody,
            RecipientGroup = dto.RecipientGroup,
            EmailGroupId = dto.EmailGroupId,
            FromName = dto.FromName,
            FromEmail = dto.FromEmail
        };

        var result = await _pipeline.SendCampaignAsync(request, dto.CampaignId);
        return Ok(result);
    }

    [HttpGet("{campaignId}/analytics")]
    public async Task<ActionResult<EmailCampaignAnalyticsDto>> GetAnalytics(int campaignId)
    {
        var template = await _emailV2Service.GetTemplateAsync(campaignId);
        if (template == null) return NotFound();

        var analytics = await _messageTracker.GetCampaignAnalyticsAsync(campaignId);
        analytics.CampaignStatus = template.Status;
        analytics.SentAt = null;

        return Ok(analytics);
    }

    [HttpGet("{campaignId}/versions")]
    public async Task<ActionResult<List<EmailDesignVersionDto>>> GetVersions(int campaignId)
    {
        var versions = await _emailV2Service.GetDesignVersionsAsync(campaignId);
        return Ok(versions);
    }

    [HttpGet("{campaignId}/versions/{version}")]
    public async Task<ActionResult<EmailDesignVersionDto>> GetVersion(int campaignId, int version)
    {
        var v = await _emailV2Service.GetDesignVersionAsync(campaignId, version);
        if (v == null) return NotFound();
        return Ok(v);
    }

    [HttpPost("{campaignId}/versions/{version}/restore")]
    public async Task<ActionResult<EmailV2TemplateDto>> RestoreVersion(int campaignId, int version)
    {
        try
        {
            var result = await _emailV2Service.RestoreDesignVersionAsync(campaignId, version);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(ex.Message);
        }
    }

    private static string UnwrapException(Exception ex)
    {
        var parts = new List<string>();
        var current = ex;
        while (current != null)
        {
            var msg = current.Message;
            if (parts.Count == 0 || msg != parts[^1])
                parts.Add(msg);
            current = current.InnerException;
        }
        return string.Join(" → ", parts);
    }
}
