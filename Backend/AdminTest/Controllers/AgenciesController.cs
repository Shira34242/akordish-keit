using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AgenciesController : ControllerBase
{
    private readonly IAgencyService _service;

    public AgenciesController(IAgencyService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<AgencyListDto>>> GetAgencies(
        [FromQuery] string? search = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 20)
    {
        return Ok(await _service.GetAgenciesAsync(search, isActive, pageNumber, pageSize));
    }

    [HttpGet("index-banners")]
    public async Task<ActionResult<List<AgencyListDto>>> GetIndexBanners([FromQuery] int limit = 5)
    {
        return Ok(await _service.GetIndexBannersAsync(limit));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AgencyDto>> GetAgency(int id)
    {
        var agency = await _service.GetAgencyByIdAsync(id);
        return agency == null ? NotFound(new { message = "הסוכנות לא נמצאה" }) : Ok(agency);
    }

    [HttpGet("slug/{slug}")]
    public async Task<ActionResult<AgencyPublicDto>> GetAgencyBySlug(string slug)
    {
        var agency = await _service.GetAgencyBySlugAsync(slug);
        return agency == null ? NotFound(new { message = "הסוכנות לא נמצאה" }) : Ok(agency);
    }

    [HttpGet("profile-badge")]
    public async Task<ActionResult<AgencyBadgeDto>> GetProfileBadge([FromQuery] string profileType, [FromQuery] int profileId)
    {
        var badge = await _service.GetBadgeForProfileAsync(profileType, profileId);
        return badge == null ? NotFound(new { message = "אין שיוך סוכנות" }) : Ok(badge);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AgencyDto>> CreateAgency([FromBody] CreateAgencyDto dto)
    {
        try
        {
            var agency = await _service.CreateAgencyAsync(dto);
            return CreatedAtAction(nameof(GetAgency), new { id = agency.Id }, agency);
        }
        catch (Exception ex) when (ex is KeyNotFoundException or InvalidOperationException)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AgencyDto>> UpdateAgency(int id, [FromBody] UpdateAgencyDto dto)
    {
        try
        {
            return Ok(await _service.UpdateAgencyAsync(id, dto));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteAgency(int id)
    {
        var deleted = await _service.DeleteAgencyAsync(id);
        return deleted ? NoContent() : NotFound(new { message = "הסוכנות לא נמצאה" });
    }

    [HttpPost("{agencyId:int}/profiles")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AgencyProfileDto>> AddProfile(int agencyId, [FromBody] UpsertAgencyProfileDto dto)
    {
        try
        {
            return Ok(await _service.AddProfileAsync(agencyId, dto));
        }
        catch (Exception ex) when (ex is KeyNotFoundException or InvalidOperationException)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{agencyId:int}/profiles/{profileLinkId:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RemoveProfile(int agencyId, int profileLinkId)
    {
        var removed = await _service.RemoveProfileAsync(agencyId, profileLinkId);
        return removed ? NoContent() : NotFound(new { message = "השייכות לא נמצאה" });
    }

    [HttpPost("{agencyId:int}/contents")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<AgencyContentDto>> AddContent(int agencyId, [FromBody] UpsertAgencyContentDto dto)
    {
        try
        {
            return Ok(await _service.AddContentAsync(agencyId, dto));
        }
        catch (Exception ex) when (ex is KeyNotFoundException or InvalidOperationException)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{agencyId:int}/contents/{contentLinkId:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RemoveContent(int agencyId, int contentLinkId)
    {
        var removed = await _service.RemoveContentAsync(agencyId, contentLinkId);
        return removed ? NoContent() : NotFound(new { message = "שיוך התוכן לא נמצא" });
    }
}
