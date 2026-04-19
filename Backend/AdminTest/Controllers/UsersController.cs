using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class UsersController : ControllerBase
{
    private readonly IUserService _service;

    public UsersController(IUserService service)
    {
        _service = service;
    }

    // GET: api/Users/with-profiles?q=שם&limit=20
    // מחזיר משתמשים בעלי פרופיל ציבורי פעיל (אמן / מורה / בעל מקצוע) — לשימוש בתיוג מעלה תוכן
    [HttpGet("with-profiles")]
    public async Task<ActionResult<List<UserWithProfileDto>>> GetUsersWithProfiles(
        [FromQuery] string? q = null,
        [FromQuery] int limit = 20)
    {
        var results = await _service.SearchUsersWithProfilesAsync(q, limit);
        return Ok(results);
    }

    // GET: api/Users/me
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<MyProfileDto>> GetMyProfile()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var profile = await _service.GetMyProfileAsync(userId.Value);
        if (profile == null) return NotFound();
        return Ok(profile);
    }

    // PUT: api/Users/me
    [HttpPut("me")]
    [Authorize]
    public async Task<ActionResult<MyProfileDto>> UpdateMyProfile([FromBody] UpdateMyProfileDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var profile = await _service.UpdateMyProfileAsync(userId.Value, dto);
        if (profile == null) return NotFound();
        return Ok(profile);
    }

    // GET: api/Users/me/uploader-profile
    // מחזיר את פרופיל המעלה של המשתמש המחובר (אמן / מורה / בעל מקצוע) — או 204 אם אין
    [HttpGet("me/uploader-profile")]
    [Authorize]
    public async Task<ActionResult<UserWithProfileDto>> GetMyUploaderProfile()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var profile = await _service.GetUploaderProfileByUserIdAsync(userId.Value);
        if (profile == null) return NoContent();

        return Ok(profile);
    }

    // GET: api/Users/me/all-pages
    // מחזיר את כל הדפים של המשתמש המחובר (אמן + בעלי מקצוע)
    [HttpGet("me/all-pages")]
    [Authorize]
    public async Task<ActionResult<List<UserWithProfileDto>>> GetMyAllPages()
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var pages = await _service.GetMyAllPagesAsync(userId.Value);
        return Ok(pages);
    }

    // POST: api/Users/me/pages/revoke
    // מנתק את המשתמש מהדף — הדף עובר לניהול המערכת, לא נמחק
    [HttpPost("me/pages/revoke")]
    [Authorize]
    public async Task<ActionResult> RevokePage([FromBody] RevokePageDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var success = await _service.RevokePageAsync(userId.Value, dto);
        if (!success) return NotFound();
        return Ok();
    }

    // ─── Helper ──────────────────────────────────────────────────────────────────

    private int? GetCurrentUserId()
    {
        if (User.Identity?.IsAuthenticated != true) return null;
        var claim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return claim != null && int.TryParse(claim.Value, out var id) ? id : null;
    }

    // GET: api/Users
    [HttpGet]
    public async Task<ActionResult<PagedResult<UserListDto>>> GetUsers(
        [FromQuery] string? search = null,
        [FromQuery] int? role = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] int? contentTag = null,
        [FromQuery] int? preferredInstrumentId = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10)
    {
        var result = await _service.GetUsersAsync(
            search, role, isActive, contentTag, preferredInstrumentId, pageNumber, pageSize);

        return Ok(result);
    }

}
