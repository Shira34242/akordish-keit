using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PlaylistsController : ControllerBase
{
    private readonly IPlaylistService _playlistService;

    public PlaylistsController(IPlaylistService playlistService)
    {
        _playlistService = playlistService;
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
    // GET: api/Playlists
    // קבלת כל הרשימות של המשתמש המחובר
    // ============================================
    [HttpGet]
    public async Task<ActionResult<List<PlaylistDto>>> GetMyPlaylists()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var playlists = await _playlistService.GetUserPlaylistsAsync(userId.Value);
        return Ok(playlists);
    }

    // ============================================
    // GET: api/Playlists/{id}
    // קבלת רשימה ספציפית עם כל השירים
    // ============================================
    [HttpGet("{id}")]
    public async Task<ActionResult<PlaylistDetailDto>> GetPlaylistById(int id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var playlist = await _playlistService.GetPlaylistByIdAsync(id, userId.Value);

        if (playlist == null)
            return NotFound(new { message = "רשימת ההשמעה לא נמצאה" });

        return Ok(playlist);
    }

    // ============================================
    // GET: api/Playlists/recent
    // קבלת 2 הרשימות האחרונות (לפופאפ)
    // ============================================
    [HttpGet("recent")]
    public async Task<ActionResult<List<PlaylistDto>>> GetRecentPlaylists()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var playlists = await _playlistService.GetRecentPlaylistsAsync(userId.Value, 2);
        return Ok(playlists);
    }

    // ============================================
    // GET: api/Playlists/public
    // קבלת כל הרשימות הציבוריות (מאגר קהילתי)
    // ============================================
    [HttpGet("public")]
    [AllowAnonymous]  // ניתן לגשת גם ללא הזדהות
    public async Task<ActionResult<List<PlaylistDto>>> GetPublicPlaylists()
    {
        var playlists = await _playlistService.GetPublicPlaylistsAsync();
        return Ok(playlists);
    }

    // ============================================
    // POST: api/Playlists
    // יצירת רשימת השמעה חדשה
    // ============================================
    [HttpPost]
    public async Task<ActionResult<PlaylistDto>> CreatePlaylist([FromBody] CreatePlaylistDto dto)
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

        try
        {
            var playlist = await _playlistService.CreatePlaylistAsync(dto, userId.Value);
            return CreatedAtAction(nameof(GetPlaylistById), new { id = playlist.Id }, playlist);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "אירעה שגיאה ביצירת הרשימה" });
        }
    }

    // ============================================
    // PUT: api/Playlists/{id}
    // עדכון פרטי רשימת השמעה
    // ============================================
    [HttpPut("{id}")]
    public async Task<ActionResult<PlaylistDto>> UpdatePlaylist(int id, [FromBody] UpdatePlaylistDto dto)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        try
        {
            var playlist = await _playlistService.UpdatePlaylistAsync(id, dto, userId.Value);

            if (playlist == null)
                return NotFound(new { message = "רשימת ההשמעה לא נמצאה" });

            return Ok(playlist);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "אירעה שגיאה בעדכון הרשימה" });
        }
    }

    // ============================================
    // DELETE: api/Playlists/{id}
    // מחיקת רשימת השמעה
    // ============================================
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeletePlaylist(int id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var success = await _playlistService.DeletePlaylistAsync(id, userId.Value);

        if (!success)
            return NotFound(new { message = "רשימת ההשמעה לא נמצאה" });

        return Ok(new { message = "הרשימה נמחקה בהצלחה" });
    }

    // ============================================
    // POST: api/Playlists/{id}/songs/{songId}
    // הוספת שיר לרשימת השמעה
    // ============================================
    [HttpPost("{id}/songs/{songId}")]
    public async Task<ActionResult> AddSongToPlaylist(int id, int songId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var success = await _playlistService.AddSongToPlaylistAsync(id, songId, userId.Value);

        if (!success)
            return BadRequest(new { message = "לא ניתן להוסיף את השיר לרשימה" });

        return Ok(new { message = "השיר נוסף לרשימה בהצלחה" });
    }

    // ============================================
    // DELETE: api/Playlists/{id}/songs/{songId}
    // הסרת שיר מרשימת השמעה
    // ============================================
    [HttpDelete("{id}/songs/{songId}")]
    public async Task<ActionResult> RemoveSongFromPlaylist(int id, int songId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var success = await _playlistService.RemoveSongFromPlaylistAsync(id, songId, userId.Value);

        if (!success)
            return NotFound(new { message = "השיר לא נמצא ברשימה" });

        return Ok(new { message = "השיר הוסר מהרשימה בהצלחה" });
    }

    // ============================================
    // PUT: api/Playlists/{id}/reorder
    // שינוי סדר שירים ברשימה
    // ============================================
    [HttpPut("{id}/reorder")]
    public async Task<ActionResult> ReorderPlaylist(int id, [FromBody] ReorderPlaylistDto dto)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var success = await _playlistService.ReorderPlaylistAsync(id, dto.SongIds, userId.Value);

        if (!success)
            return BadRequest(new { message = "לא ניתן לשנות את סדר השירים" });

        return Ok(new { message = "סדר השירים עודכן בהצלחה" });
    }

    // ============================================
    // POST: api/Playlists/{id}/adopt
    // אימוץ רשימה מהמאגר הקהילתי
    // ============================================
    [HttpPost("{id}/adopt")]
    public async Task<ActionResult<PlaylistDto>> AdoptPlaylist(int id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var adoptedPlaylist = await _playlistService.AdoptPlaylistAsync(id, userId.Value);

        if (adoptedPlaylist == null)
            return NotFound(new { message = "הרשימה לא נמצאה או אינה ציבורית" });

        return Ok(adoptedPlaylist);
    }

    // ============================================
    // POST: api/Playlists/{id}/duplicate
    // שכפול רשימה קיימת
    // ============================================
    [HttpPost("{id}/duplicate")]
    public async Task<ActionResult<PlaylistDto>> DuplicatePlaylist(int id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var duplicatedPlaylist = await _playlistService.DuplicatePlaylistAsync(id, userId.Value);

        if (duplicatedPlaylist == null)
            return NotFound(new { message = "הרשימה לא נמצאה" });

        return Ok(duplicatedPlaylist);
    }
}
