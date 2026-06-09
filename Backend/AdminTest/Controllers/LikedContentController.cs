using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class LikedContentController : ControllerBase
{
    private readonly ILikedContentService _likedContentService;
    private readonly ILogger<LikedContentController> _logger;

    public LikedContentController(ILikedContentService likedContentService, ILogger<LikedContentController> logger)
    {
        _likedContentService = likedContentService;
        _logger = logger;
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (int.TryParse(userIdClaim, out int userId))
        {
            return userId;
        }
        return null;
    }

    // ============================================
    // GET: api/LikedContent
    // קבלת כל התכנים האהובים של המשתמש
    // ============================================
    [HttpGet]
    public async Task<ActionResult<List<LikedContentDto>>> GetMyLikedContent()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var likedContent = await _likedContentService.GetUserLikedContentAsync(userId.Value);
        return Ok(likedContent);
    }

    // ============================================
    // GET: api/LikedContent/check/{contentType}/{contentId}
    // בדיקה האם תוכן מסוים במועדפים
    // ============================================
    [HttpGet("check/{contentType}/{contentId}")]
    public async Task<ActionResult<bool>> CheckIfLiked(string contentType, int contentId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var isLiked = await _likedContentService.IsContentLikedAsync(contentType, contentId, userId.Value);
        return Ok(new { isLiked });
    }

    [AllowAnonymous]
    [HttpGet("reactions/{contentType}/{contentId}")]
    public async Task<ActionResult<ContentReactionSummaryDto>> GetReactions(string contentType, int contentId)
    {
        var result = await _likedContentService.GetReactionSummaryAsync(contentType, contentId, GetCurrentUserId());
        return Ok(result);
    }

    [HttpPost("reactions/{contentType}/{contentId}")]
    public async Task<ActionResult<ContentReactionSummaryDto>> SetReaction(
        string contentType,
        int contentId,
        [FromBody] SetContentReactionDto dto)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized();

        if (!ModelState.IsValid)
            return ValidationProblem(ModelState);

        var result = await _likedContentService.SetReactionAsync(contentType, contentId, dto.Reaction, userId.Value);
        return Ok(result);
    }

    [HttpDelete("reactions/{contentType}/{contentId}")]
    public async Task<ActionResult<ContentReactionSummaryDto>> ClearReaction(string contentType, int contentId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized();

        var result = await _likedContentService.ClearReactionAsync(contentType, contentId, userId.Value);
        return Ok(result);
    }

    // ============================================
    // POST: api/LikedContent
    // הוספת תוכן למועדפים
    // ============================================
    [HttpPost]
    public async Task<ActionResult<LikedContentDto>> AddLikedContent([FromBody] AddLikedContentDto dto)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        if (!ModelState.IsValid)
        {
            var errors = string.Join(", ", ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage));
            return BadRequest(new { message = $"שגיאת ולידציה: {errors}" });
        }

        var likedContent = await _likedContentService.AddLikedContentAsync(dto, userId.Value);

        if (likedContent == null)
            return Conflict(new { message = "התוכן כבר במועדפים" });

        _logger.LogInformation("Liked content added: UserId={UserId} ContentType={ContentType} ContentId={ContentId}",
            userId.Value, dto.ContentType, dto.ContentId);
        return Ok(likedContent);
    }

    // ============================================
    // DELETE: api/LikedContent/{contentType}/{contentId}
    // הסרת תוכן מהמועדפים
    // ============================================
    [HttpDelete("{contentType}/{contentId}")]
    public async Task<ActionResult> RemoveLikedContent(string contentType, int contentId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var success = await _likedContentService.RemoveLikedContentAsync(contentType, contentId, userId.Value);

        if (!success)
            return NotFound(new { message = "התוכן לא נמצא במועדפים" });

        _logger.LogInformation("Liked content removed: UserId={UserId} ContentType={ContentType} ContentId={ContentId}",
            userId.Value, contentType, contentId);
        return Ok(new { message = "התוכן הוסר מהמועדפים בהצלחה" });
    }
}
