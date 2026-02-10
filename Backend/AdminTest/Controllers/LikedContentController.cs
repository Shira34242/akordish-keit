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

    public LikedContentController(ILikedContentService likedContentService)
    {
        _likedContentService = likedContentService;
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

        return Ok(new { message = "התוכן הוסר מהמועדפים בהצלחה" });
    }
}
