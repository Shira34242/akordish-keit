using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SiteInterestController : ControllerBase
{
    private readonly IEmailService _emailService;

    public SiteInterestController(IEmailService emailService)
    {
        _emailService = emailService;
    }

    /// <summary>
    /// Public endpoint — called from the pre-launch landing page to register interest.
    /// No authentication required.
    /// </summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterSiteInterestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Email) || !dto.Email.Contains('@'))
            return BadRequest(new { message = "כתובת מייל לא תקינה" });

        await _emailService.RegisterSiteInterestAsync(dto.Email.Trim(), dto.Source);
        return Ok(new { message = "תודה! נעדכן אותך כשהאתר ייפתח" });
    }
}
