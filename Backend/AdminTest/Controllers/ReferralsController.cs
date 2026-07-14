using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AkordishKeit.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public class ReferralsController : ControllerBase
{
    private readonly IReferralService _referralService;
    private readonly IConfiguration _configuration;

    public ReferralsController(IReferralService referralService, IConfiguration configuration)
    {
        _referralService = referralService;
        _configuration = configuration;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var frontendBaseUrl = _configuration["Frontend:BaseUrl"]?.Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(frontendBaseUrl))
            return StatusCode(500, new { message = "Frontend base URL is not configured" });

        if (!Uri.TryCreate(frontendBaseUrl, UriKind.Absolute, out _))
            return StatusCode(500, new { message = "Frontend base URL is invalid" });

        var summary = await _referralService.GetSummaryAsync(userId, frontendBaseUrl);
        return Ok(summary);
    }
}
