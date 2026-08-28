using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/marketing-campaigns")]
[Authorize(Roles = "Admin,Manager")]
public class MarketingCampaignsController : ControllerBase
{
    private readonly IMarketingCampaignService _service;
    private readonly IConfiguration _configuration;

    public MarketingCampaignsController(IMarketingCampaignService service, IConfiguration configuration)
    {
        _service = service;
        _configuration = configuration;
    }

    [HttpGet]
    public async Task<IActionResult> GetDashboard([FromQuery] DateTime? dateFrom, [FromQuery] DateTime? dateTo)
    {
        try
        {
            return Ok(await _service.GetDashboardAsync(dateFrom, dateTo, GetFrontendBaseUrl(), GetBackendBaseUrl()));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMarketingCampaignRequest request)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        try
        {
            var created = await _service.CreateAsync(request, userId, GetFrontendBaseUrl(), GetBackendBaseUrl());
            return CreatedAtAction(nameof(GetDashboard), new { id = created.Id }, created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPatch("{id:int}/status")]
    public async Task<IActionResult> SetStatus(int id, [FromBody] UpdateMarketingCampaignStatusRequest request)
    {
        return await _service.SetStatusAsync(id, request.IsActive) ? NoContent() : NotFound();
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateMarketingCampaignRequest request)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        try
        {
            var updated = await _service.UpdateAsync(id, request, GetFrontendBaseUrl(), GetBackendBaseUrl());
            return updated == null ? NotFound() : Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        return await _service.DeleteAsync(id) ? NoContent() : NotFound();
    }

    [HttpPost("track")]
    [AllowAnonymous]
    [EnableRateLimiting("analytics-tracking")]
    public async Task<IActionResult> Track([FromBody] TrackMarketingCampaignVisitRequest request)
    {
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        int? userId = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var parsed) ? parsed : null;
        var tracked = await _service.TrackVisitAsync(
            request,
            userId,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers.UserAgent.ToString());
        return Ok(new { tracked });
    }

    [HttpGet("open/{code}")]
    [HttpGet("/r/{code}")]
    [AllowAnonymous]
    [EnableRateLimiting("analytics-tracking")]
    public async Task<IActionResult> OpenExternal(string code)
    {
        Response.Headers.CacheControl = "no-store, no-cache";
        Response.Headers.Pragma = "no-cache";
        const string visitorCookie = "ak_marketing_click_visitor";
        var visitorId = Request.Cookies[visitorCookie];
        if (string.IsNullOrWhiteSpace(visitorId) || visitorId.Length != 32 || !visitorId.All(Uri.IsHexDigit))
        {
            visitorId = Guid.NewGuid().ToString("N");
            Response.Cookies.Append(visitorCookie, visitorId, new CookieOptions
            {
                HttpOnly = true,
                Secure = Request.IsHttps,
                SameSite = SameSiteMode.Lax,
                IsEssential = true,
            Path = "/",
                Expires = DateTimeOffset.UtcNow.AddYears(1)
            });
        }

        var destination = await _service.ResolveTrackedClickAsync(
            code,
            visitorId,
            GetFrontendBaseUrl(),
            Request.Headers.Referer.ToString(),
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers.UserAgent.ToString());
        return destination == null ? NotFound() : Redirect(destination);
    }

    private string GetFrontendBaseUrl()
    {
        var value = _configuration["Frontend:BaseUrl"]?.Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(value) || !Uri.TryCreate(value, UriKind.Absolute, out _))
            throw new InvalidOperationException("Frontend base URL is not configured");
        return value;
    }

    private string GetBackendBaseUrl()
    {
        if (Request.Host.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
            Request.Host.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase))
            return $"{Request.Scheme}://{Request.Host.Value}".TrimEnd('/');

        var value = _configuration["Backend:BaseUrl"]?.Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(value) || !Uri.TryCreate(value, UriKind.Absolute, out _))
            throw new InvalidOperationException("Backend base URL is not configured");
        return value;
    }
}
