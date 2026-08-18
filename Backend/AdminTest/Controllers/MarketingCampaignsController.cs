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
            return Ok(await _service.GetDashboardAsync(dateFrom, dateTo, GetFrontendBaseUrl()));
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
            var created = await _service.CreateAsync(request, userId, GetFrontendBaseUrl());
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
            var updated = await _service.UpdateAsync(id, request, GetFrontendBaseUrl());
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

    [HttpGet("resolve/{code}")]
    [AllowAnonymous]
    [EnableRateLimiting("analytics-tracking")]
    public async Task<IActionResult> Resolve(string code)
    {
        var result = await _service.ResolveAsync(code);
        return result == null ? NotFound() : Ok(result);
    }

    private string GetFrontendBaseUrl()
    {
        var value = _configuration["Frontend:BaseUrl"]?.Trim().TrimEnd('/');
        if (string.IsNullOrWhiteSpace(value) || !Uri.TryCreate(value, UriKind.Absolute, out _))
            throw new InvalidOperationException("Frontend base URL is not configured");
        return value;
    }
}
