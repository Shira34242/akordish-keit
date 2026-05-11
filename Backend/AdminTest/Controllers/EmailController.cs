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

    [HttpGet("recipient-count")]
    public async Task<ActionResult<int>> GetRecipientCount([FromQuery] EmailRecipientGroup group = EmailRecipientGroup.AllUsers)
    {
        var count = await _emailService.GetRecipientCountAsync(group);
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
}
