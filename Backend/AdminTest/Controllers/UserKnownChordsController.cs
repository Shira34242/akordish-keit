using System.Security.Claims;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserKnownChordsController : ControllerBase
{
    private readonly IUserKnownChordService _knownChordService;
    private readonly ILogger<UserKnownChordsController> _logger;

    public UserKnownChordsController(IUserKnownChordService knownChordService, ILogger<UserKnownChordsController> logger)
    {
        _knownChordService = knownChordService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<UserKnownChordDto>>> GetMyKnownChords([FromQuery] string? instrument = null)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });
        }

        var chords = await _knownChordService.GetUserKnownChordsAsync(userId.Value, instrument);
        return Ok(chords);
    }

    [HttpPost]
    public async Task<ActionResult<UserKnownChordDto>> AddKnownChord([FromBody] AddUserKnownChordDto dto)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });
        }

        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var knownChord = await _knownChordService.AddKnownChordAsync(dto, userId.Value);
        if (knownChord == null)
        {
            return BadRequest(new { message = "האקורד או הכלי לא תקינים" });
        }

        _logger.LogInformation("Known chord added: UserId={UserId} Instrument={Instrument} Chord={Chord}",
            userId.Value, dto.Instrument, dto.ChordName);
        return Ok(knownChord);
    }

    [HttpDelete("{instrument}/{chordName}")]
    public async Task<IActionResult> RemoveKnownChord(string instrument, string chordName)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });
        }

        var removed = await _knownChordService.RemoveKnownChordAsync(instrument, chordName, userId.Value);
        if (!removed)
        {
            return NotFound(new { message = "האקורד לא נמצא ברשימה" });
        }

        _logger.LogInformation("Known chord removed: UserId={UserId} Instrument={Instrument} Chord={Chord}",
            userId.Value, instrument, chordName);
        return Ok(new { message = "האקורד הוסר מהרשימה" });
    }

    [HttpPost("summary")]
    public async Task<ActionResult<KnownChordSongSummaryDto>> BuildSummary([FromBody] KnownChordSongSummaryRequestDto dto)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "לא ניתן לזהות משתמש" });
        }

        var summary = await _knownChordService.BuildSummaryAsync(dto, userId.Value);
        return Ok(summary);
    }

    [HttpGet("matching-songs")]
    public async Task<ActionResult> GetMatchingSongs(
        [FromQuery] string instrument = "guitar",
        [FromQuery] int maxMissing = -1,
        [FromQuery] string sortBy = "closest",
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "׳׳ ׳ ׳™׳×׳ ׳׳–׳”׳•׳× ׳׳©׳×׳׳©" });
        }

        var result = await _knownChordService.GetMatchingSongsAsync(userId.Value, instrument, maxMissing, sortBy, page, pageSize);
        return Ok(new
        {
            songs = result.Items,
            totalCount = result.TotalCount,
            page = result.PageNumber,
            pageSize = result.PageSize,
            totalPages = (int)Math.Ceiling(result.TotalCount / (double)result.PageSize)
        });
    }

    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? User.FindFirst("id")?.Value
                       ?? User.FindFirst("sub")?.Value;

        return int.TryParse(userIdClaim, out var userId) ? userId : null;
    }
}
