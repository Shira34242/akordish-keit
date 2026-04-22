using System.Security.Claims;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }

    [HttpGet]
    public async Task<ActionResult<List<PlaylistDto>>> GetMyPlaylists()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        try
        {
            var playlists = await _playlistService.GetUserPlaylistsAsync(userId.Value);
            return Ok(playlists);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

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

    [HttpGet("recent")]
    public async Task<ActionResult<List<PlaylistDto>>> GetRecentPlaylists()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var playlists = await _playlistService.GetRecentPlaylistsAsync(userId.Value, 2);
        return Ok(playlists);
    }

    [HttpGet("public")]
    [AllowAnonymous]
    public async Task<ActionResult<List<PlaylistDto>>> GetPublicPlaylists()
    {
        var playlists = await _playlistService.GetPublicPlaylistsAsync();
        return Ok(playlists);
    }

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
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

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
                return NotFound(new { message = "רשימת ההשמעה לא נמצאה או שאינה ניתנת לעריכה" });

            return Ok(playlist);
        }
        catch
        {
            return StatusCode(500, new { message = "אירעה שגיאה בעדכון הרשימה" });
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeletePlaylist(int id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var success = await _playlistService.DeletePlaylistAsync(id, userId.Value);
        if (!success)
            return BadRequest(new { message = "לא ניתן למחוק רשימה זו" });

        return Ok(new { message = "הרשימה נמחקה בהצלחה" });
    }

    [HttpPost("save-to-default/{songId}")]
    public async Task<ActionResult> SaveToDefault(int songId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var success = await _playlistService.SaveToDefaultPlaylistAsync(songId, userId.Value);
        if (!success)
            return BadRequest(new { message = "השיר כבר קיים ברשימה או שלא נמצא" });

        return Ok(new { message = "השיר נשמר ב\"השמורים שלי\"" });
    }

    [HttpDelete("save-to-default/{songId}")]
    public async Task<ActionResult> RemoveFromDefault(int songId, [FromBody] RemoveFromDefaultPlaylistDto? dto)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var success = await _playlistService.RemoveFromDefaultPlaylistAsync(
            songId,
            userId.Value,
            dto?.RemoveFromPersonalPlaylists ?? false);

        if (!success)
            return NotFound(new { message = "השיר לא נמצא ב\"השמורים שלי\"" });

        return Ok(new { message = "השיר הוסר מהשמורים" });
    }

    [HttpGet("song-state/{songId}")]
    public async Task<ActionResult<SongPlaylistStateDto>> GetSongState(int songId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        var state = await _playlistService.GetSongPlaylistStateAsync(songId, userId.Value);
        return Ok(state);
    }

    [HttpPost("{id}/songs/{songId}")]
    public async Task<ActionResult> AddSongToPlaylist(int id, int songId)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        try
        {
            var success = await _playlistService.AddSongToPlaylistAsync(id, songId, userId.Value);
            if (!success)
                return BadRequest(new { message = "לא ניתן להוסיף את השיר לרשימה" });

            return Ok(new { message = "השיר נוסף לרשימה בהצלחה" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

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

    [HttpPost("{id}/adopt")]
    public async Task<ActionResult<PlaylistDto>> AdoptPlaylist(int id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        try
        {
            var adoptedPlaylist = await _playlistService.AdoptPlaylistAsync(id, userId.Value);
            if (adoptedPlaylist == null)
                return NotFound(new { message = "הרשימה לא נמצאה או שאינה ציבורית" });

            return Ok(adoptedPlaylist);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/duplicate")]
    public async Task<ActionResult<PlaylistDto>> DuplicatePlaylist(int id)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });

        try
        {
            var duplicatedPlaylist = await _playlistService.DuplicatePlaylistAsync(id, userId.Value);
            if (duplicatedPlaylist == null)
                return NotFound(new { message = "הרשימה לא נמצאה" });

            return Ok(duplicatedPlaylist);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
