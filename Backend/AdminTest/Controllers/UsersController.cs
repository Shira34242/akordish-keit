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
    private readonly ILogger<UsersController> _logger;

    public UsersController(IUserService service, ILogger<UsersController> logger)
    {
        _service = service;
        _logger = logger;
    }

    // GET: api/Users/with-profiles?q=שם&limit=20
    // מחזיר משתמשים בעלי פרופיל ציבורי פעיל (אמן / מורה / בעל מקצוע) — לשימוש בתיוג מעלה תוכן
    [HttpGet("with-profiles")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<List<UserWithProfileDto>>> GetUsersWithProfiles(
        [FromQuery] string? q = null,
        [FromQuery] int limit = 20,
        [FromQuery] string? profileKind = null,
        [FromQuery] bool includeAgencies = false)
    {
        var results = await _service.SearchUsersWithProfilesAsync(q, limit, profileKind, includeAgencies);
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
        _logger.LogInformation("User profile updated: UserId={UserId}", userId);
        return Ok(profile);
    }

    // GET: api/Users/{id}/details
    [HttpGet("{id:int}/details")]
    [Authorize(Roles = "Admin,Manager")]
    public async Task<ActionResult<AdminUserDetailDto>> GetAdminUserDetail(int id)
    {
        var detail = await _service.GetAdminUserDetailAsync(id);
        if (detail == null)
            return NotFound();

        return Ok(detail);
    }

    // PUT: api/Users/{id}
    [HttpPut("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<UserListDto>> AdminUpdateUser(int id, [FromBody] AdminUpdateUserDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Email))
            return BadRequest(new { message = "שם משתמש ואימייל הם שדות חובה" });

        var updated = await _service.AdminUpdateUserAsync(id, dto);
        if (updated == null)
            return NotFound();

        _logger.LogInformation("Admin updated user: UserId={UserId} Role={Role} IsActive={IsActive}", id, dto.Role, dto.IsActive);
        return Ok(updated);
    }

    // DELETE: api/Users/{id}
    [HttpDelete("{id:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AdminDeleteUser(int id)
    {
        var currentUserId = GetCurrentUserId();
        if (currentUserId == id)
            return BadRequest(new { message = "לא ניתן למחוק את המשתמש המחובר" });

        var deleted = await _service.AdminDeleteUserAsync(id);
        if (!deleted)
            return NotFound();

        _logger.LogInformation("Admin deleted user: UserId={UserId} DeletedByUserId={DeletedByUserId}", id, currentUserId);
        return NoContent();
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
        _logger.LogInformation("User revoked page: UserId={UserId} ProfileType={ProfileType} ProfileId={ProfileId}",
            userId, dto.ProfileType, dto.ProfileId);
        return Ok();
    }

    // ─── Helper ──────────────────────────────────────────────────────────────────

    // POST: api/Users/me/pages/delete-request
    // שולח למנהלים בקשה למחיקת דף. הדף לא נמחק אוטומטית.
    [HttpPost("me/pages/delete-request")]
    [Authorize]
    public async Task<ActionResult> RequestPageDeletion([FromBody] DeletePageRequestDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var success = await _service.RequestPageDeletionAsync(userId.Value, dto);
        if (!success) return NotFound();

        _logger.LogInformation("User requested page deletion: UserId={UserId} ProfileType={ProfileType} ProfileId={ProfileId}",
            userId, dto.ProfileType, dto.ProfileId);
        return Ok();
    }

    // POST: api/Users/me/delete-request
    // שולח בקשה למחיקת חשבון למנהלים. המחיקה מבוצעת רק לאחר בדיקה.
    [HttpPost("me/delete-request")]
    [Authorize]
    public async Task<ActionResult> RequestAccountDeletion([FromBody] DeleteAccountRequestDto dto)
    {
        if (!dto.Confirmed)
            return BadRequest(new { message = "נדרש אישור מפורש לבקשת מחיקת החשבון" });

        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var success = await _service.RequestAccountDeletionAsync(userId.Value);
        if (!success) return NotFound();

        _logger.LogInformation("User requested account deletion: UserId={UserId}", userId);
        return Ok();
    }

    // POST: api/Users/me/pages/visibility
    // מציג או מסתיר דף ציבורי מהאינדקס בלי למחוק אותו
    [HttpPost("me/pages/visibility")]
    [Authorize]
    public async Task<ActionResult<UserWithProfileDto>> SetPageVisibility([FromBody] SetPageVisibilityDto dto)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();

        var page = await _service.SetPageVisibilityAsync(userId.Value, dto);
        if (page == null) return BadRequest(new { message = "לא ניתן לשנות סטטוס לדף הזה כרגע" });

        _logger.LogInformation("User changed page visibility: UserId={UserId} ProfileType={ProfileType} ProfileId={ProfileId} IsActive={IsActive}",
            userId, dto.ProfileType, dto.ProfileId, dto.IsActive);
        return Ok(page);
    }

    private int? GetCurrentUserId()
    {
        if (User.Identity?.IsAuthenticated != true) return null;
        var claim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return claim != null && int.TryParse(claim.Value, out var id) ? id : null;
    }

    // GET: api/Users
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<PagedResult<UserListDto>>> GetUsers(
        [FromQuery] string? search = null,
        [FromQuery] int? role = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] int? contentTag = null,
        [FromQuery] int? preferredInstrumentId = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? sortBy = null)
    {
        var result = await _service.GetUsersAsync(
            search, role, isActive, contentTag, preferredInstrumentId, pageNumber, pageSize, sortBy);

        return Ok(result);
    }

}
