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
    private readonly ILogger<AgenciesController> _logger;

    public AgenciesController(IAgencyService service, ILogger<AgenciesController> logger)
    {
        _service = service;
        _logger = logger;
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
    [Authorize(Policy = "content.manage")]
    public async Task<ActionResult<AgencyDto>> CreateAgency([FromBody] CreateAgencyDto dto)
    {
        try
        {
            var agency = await _service.CreateAgencyAsync(dto);
            _logger.LogInformation("Agency created: AgencyId={AgencyId} Name={Name}", agency.Id, agency.Name);
            return CreatedAtAction(nameof(GetAgency), new { id = agency.Id }, agency);
        }
        catch (Exception ex) when (ex is KeyNotFoundException or InvalidOperationException)
        {
            _logger.LogWarning("Create agency failed: {Error}", ex.Message);
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    [Authorize(Policy = "content.manage")]
    public async Task<ActionResult<AgencyDto>> UpdateAgency(int id, [FromBody] UpdateAgencyDto dto)
    {
        try
        {
            var agency = await _service.UpdateAgencyAsync(id, dto);
            _logger.LogInformation("Agency updated: AgencyId={AgencyId}", id);
            return Ok(agency);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    [Authorize(Policy = "content.manage")]
    public async Task<IActionResult> DeleteAgency(int id)
    {
        var deleted = await _service.DeleteAgencyAsync(id);
        if (deleted)
            _logger.LogInformation("Agency deleted: AgencyId={AgencyId}", id);
        return deleted ? NoContent() : NotFound(new { message = "הסוכנות לא נמצאה" });
    }

    [HttpPost("{agencyId:int}/profiles")]
    [Authorize(Policy = "content.manage")]
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
    [Authorize(Policy = "content.manage")]
    public async Task<IActionResult> RemoveProfile(int agencyId, int profileLinkId)
    {
        var removed = await _service.RemoveProfileAsync(agencyId, profileLinkId);
        return removed ? NoContent() : NotFound(new { message = "השייכות לא נמצאה" });
    }

    [HttpPost("{agencyId:int}/contents")]
    [Authorize(Policy = "content.manage")]
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
    [Authorize(Policy = "content.manage")]
    public async Task<IActionResult> RemoveContent(int agencyId, int contentLinkId)
    {
        var removed = await _service.RemoveContentAsync(agencyId, contentLinkId);
        return removed ? NoContent() : NotFound(new { message = "שיוך התוכן לא נמצא" });
    }

    [HttpGet("{agencyId:int}/gallery")]
    public async Task<ActionResult<List<AgencyGalleryImageDto>>> GetGalleryImages(int agencyId)
    {
        return Ok(await _service.GetGalleryImagesAsync(agencyId));
    }

    [HttpPost("{agencyId:int}/gallery")]
    [Authorize(Policy = "content.manage")]
    public async Task<ActionResult<AgencyGalleryImageDto>> AddGalleryImage(int agencyId, [FromBody] AgencyGalleryImageDto dto)
    {
        try
        {
            return Ok(await _service.AddGalleryImageAsync(agencyId, dto.ImageUrl, dto.Caption, dto.DisplayOrder));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("{agencyId:int}/gallery/{imageId:int}")]
    [Authorize(Policy = "content.manage")]
    public async Task<IActionResult> RemoveGalleryImage(int agencyId, int imageId)
    {
        var removed = await _service.RemoveGalleryImageAsync(agencyId, imageId);
        return removed ? NoContent() : NotFound(new { message = "התמונה לא נמצאה" });
    }

    [HttpGet("{agencyId:int}/social-links")]
    public async Task<ActionResult<List<AgencySocialLinkDto>>> GetSocialLinks(int agencyId)
    {
        return Ok(await _service.GetSocialLinksAsync(agencyId));
    }

    [HttpPost("{agencyId:int}/social-links")]
    [Authorize(Policy = "content.manage")]
    public async Task<ActionResult<AgencySocialLinkDto>> UpsertSocialLink(int agencyId, [FromBody] AgencySocialLinkDto dto)
    {
        try
        {
            return Ok(await _service.UpsertSocialLinkAsync(agencyId, dto));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpDelete("{agencyId:int}/social-links/{linkId:int}")]
    [Authorize(Policy = "content.manage")]
    public async Task<IActionResult> RemoveSocialLink(int agencyId, int linkId)
    {
        var removed = await _service.RemoveSocialLinkAsync(agencyId, linkId);
        return removed ? NoContent() : NotFound(new { message = "הקישור לא נמצא" });
    }
}
