using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SongsController : ControllerBase
{
    private readonly ISongService _songService;
    private readonly IYouTubeService _youTubeService;

    public SongsController(ISongService songService, IYouTubeService youTubeService)
    {
        _songService = songService;
        _youTubeService = youTubeService;
    }

    // ============================================
    // POST: api/Songs
    // Create a new song
    // ============================================
    [HttpPost]
    public async Task<ActionResult<AddSongResponseDto>> AddSong([FromBody] AddSongRequestDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new AddSongResponseDto
                {
                    Success = false,
                    Message = "לא ניתן לזהות משתמש"
                });
            }

            if (!ModelState.IsValid)
            {
                var errors = string.Join(", ", ModelState.Values
                    .SelectMany(v => v.Errors)
                    .Select(e => e.ErrorMessage));

                return BadRequest(new AddSongResponseDto
                {
                    Success = false,
                    Message = $"שגיאת ולידציה: {errors}"
                });
            }

            var result = await _songService.CreateSongAsync(dto, userId.Value);

            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error adding song: {ex.Message}");
            return StatusCode(500, new AddSongResponseDto
            {
                Success = false,
                Message = "אירעה שגיאה בהוספת השיר"
            });
        }
    }

    // ============================================
    // PUT: api/Songs/{id}
    // Update an existing song
    // ============================================
    [HttpPut("{id}")]
    [Authorize]
    public async Task<ActionResult<AddSongResponseDto>> UpdateSong(int id, [FromBody] UpdateSongRequestDto dto)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Unauthorized(new AddSongResponseDto
                {
                    Success = false,
                    Message = "לא ניתן לזהות משתמש"
                });
            }

            var result = await _songService.UpdateSongAsync(id, dto, userId.Value);

            if (!result.Success)
            {
                if (result.Message.Contains("לא נמצא"))
                {
                    return NotFound(result);
                }
                if (result.Message.Contains("הרשאה"))
                {
                    return StatusCode(403, result);
                }
                return BadRequest(result);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error updating song: {ex.Message}");
            return StatusCode(500, new AddSongResponseDto
            {
                Success = false,
                Message = "אירעה שגיאה בעדכון השיר"
            });
        }
    }

    // ============================================
    // GET: api/Songs/{id}/can-edit
    // Check if user can edit song
    // ============================================
    [HttpGet("{id}/can-edit")]
    [Authorize]
    public async Task<ActionResult<bool>> CanEditSong(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
            {
                return Ok(false);
            }

            var canEdit = await _songService.CanUserEditSongAsync(id, userId.Value);
            return Ok(canEdit);
        }
        catch
        {
            return Ok(false);
        }
    }

    // ============================================
    // GET: api/Songs
    // Get approved songs with filtering and paging
    // ============================================
    [HttpGet]
    public async Task<ActionResult<PagedResult<SongDto>>> GetApprovedSongs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] int? artistId = null,
        [FromQuery] int? genreId = null,
        [FromQuery] int? keyId = null,
        [FromQuery] string? sortBy = "date")
    {
        try
        {
            var result = await _songService.GetSongsAsync(
                page, pageSize, search, artistId, genreId, keyId, sortBy, includeUnapproved: false);

            return Ok(new
            {
                songs = result.Items,
                totalCount = result.TotalCount,
                page = result.PageNumber,
                pageSize = result.PageSize,
                totalPages = (int)Math.Ceiling(result.TotalCount / (double)result.PageSize)
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting songs: {ex.Message}");
            return StatusCode(500, "אירעה שגיאה בטעינת השירים");
        }
    }

    // ============================================
    // GET: api/Songs/admin/all
    // Get all songs for admin (including unapproved)
    // ============================================
    [HttpGet("admin/all")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<PagedResult<SongDto>>> GetAllSongsForAdmin(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] int? artistId = null,
        [FromQuery] int? genreId = null,
        [FromQuery] int? keyId = null,
        [FromQuery] string? sortBy = "date")
    {
        try
        {
            var result = await _songService.GetSongsAsync(
                page, pageSize, search, artistId, genreId, keyId, sortBy, includeUnapproved: true);

            return Ok(new
            {
                songs = result.Items,
                totalCount = result.TotalCount,
                page = result.PageNumber,
                pageSize = result.PageSize,
                totalPages = (int)Math.Ceiling(result.TotalCount / (double)result.PageSize)
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting songs for admin: {ex.Message}");
            return StatusCode(500, "אירעה שגיאה בטעינת השירים");
        }
    }

    // ============================================
    // GET: api/Songs/{id}
    // Get single approved song by ID
    // ============================================
    [HttpGet("{id}")]
    public async Task<ActionResult<SongDto>> GetSongById(int id)
    {
        try
        {
            var song = await _songService.GetSongByIdAsync(id, includeUnapproved: false);

            if (song == null)
            {
                return NotFound(new { message = "השיר לא נמצא" });
            }

            return Ok(song);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting song: {ex.Message}");
            return StatusCode(500, "אירעה שגיאה בטעינת השיר");
        }
    }

    // ============================================
    // GET: api/Songs/{id}/admin
    // Get single song by ID for admin (including unapproved)
    // ============================================
    [HttpGet("{id}/admin")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SongDto>> GetSongByIdForAdmin(int id)
    {
        try
        {
            var song = await _songService.GetSongByIdAsync(id, includeUnapproved: true);

            if (song == null)
            {
                return NotFound(new { message = "השיר לא נמצא" });
            }

            return Ok(song);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting song for admin: {ex.Message}");
            return StatusCode(500, "אירעה שגיאה בטעינת השיר");
        }
    }

    // ============================================
    // GET: api/Songs/random
    // Get random approved song
    // ============================================
    [HttpGet("random")]
    public async Task<ActionResult<SongDto>> GetRandomSong()
    {
        try
        {
            var song = await _songService.GetRandomSongAsync();

            if (song == null)
            {
                return NotFound(new { message = "לא נמצאו שירים מאושרים במערכת" });
            }

            return Ok(song);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting random song: {ex.Message}");
            return StatusCode(500, "אירעה שגיאה בטעינת שיר אקראי");
        }
    }

    // ============================================
    // GET: api/Songs/check-duplicate
    // Check for duplicate songs by title
    // ============================================
    [HttpGet("check-duplicate")]
    public async Task<ActionResult<DuplicateCheckResponseDto>> CheckDuplicate([FromQuery] string title)
    {
        try
        {
            var result = await _songService.CheckDuplicateAsync(title);
            return Ok(result);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error checking duplicates: {ex.Message}");
            return Ok(new DuplicateCheckResponseDto
            {
                IsPotentialDuplicate = false,
                SimilarSongs = new List<SongBasicDto>()
            });
        }
    }

    // ============================================
    // POST: api/Songs/youtube-metadata
    // Fetch YouTube metadata
    // ============================================
    [HttpPost("youtube-metadata")]
    public async Task<ActionResult<YouTubeMetadataDto>> GetYouTubeMetadata([FromBody] string youtubeUrl)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(youtubeUrl))
            {
                return BadRequest(new YouTubeMetadataDto
                {
                    Success = false,
                    ErrorMessage = "קישור YouTube לא תקין"
                });
            }

            var metadata = await _youTubeService.GetVideoMetadataAsync(youtubeUrl);
            return Ok(metadata);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting YouTube metadata: {ex.Message}");
            return Ok(new YouTubeMetadataDto
            {
                Success = false,
                ErrorMessage = "שגיאה בשליפת מטא-דאטה"
            });
        }
    }

    // ============================================
    // GET: api/Songs/autocomplete/artists
    // Autocomplete for artists
    // ============================================
    [HttpGet("autocomplete/artists")]
    public async Task<ActionResult<List<AutocompleteResultDto>>> AutocompleteArtists(
        [FromQuery] string query,
        [FromQuery] int maxResults = 15)
    {
        try
        {
            var results = await _songService.AutocompleteAsync("artists", query, maxResults);
            return Ok(results);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in autocomplete artists: {ex.Message}");
            return Ok(new List<AutocompleteResultDto>());
        }
    }

    // ============================================
    // GET: api/Songs/autocomplete/genres
    // Autocomplete for genres
    // ============================================
    [HttpGet("autocomplete/genres")]
    public async Task<ActionResult<List<AutocompleteResultDto>>> AutocompleteGenres(
        [FromQuery] string query,
        [FromQuery] int maxResults = 15)
    {
        try
        {
            var results = await _songService.AutocompleteAsync("genres", query, maxResults);
            return Ok(results);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in autocomplete genres: {ex.Message}");
            return Ok(new List<AutocompleteResultDto>());
        }
    }

    // ============================================
    // GET: api/Songs/autocomplete/people
    // Autocomplete for people (composers, lyricists, arrangers)
    // ============================================
    [HttpGet("autocomplete/people")]
    public async Task<ActionResult<List<AutocompleteResultDto>>> AutocompletePeople(
        [FromQuery] string query,
        [FromQuery] int maxResults = 15)
    {
        try
        {
            var results = await _songService.AutocompleteAsync("people", query, maxResults);
            return Ok(results);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in autocomplete people: {ex.Message}");
            return Ok(new List<AutocompleteResultDto>());
        }
    }

    // ============================================
    // GET: api/Songs/autocomplete/tags
    // Autocomplete for tags
    // ============================================
    [HttpGet("autocomplete/tags")]
    public async Task<ActionResult<List<AutocompleteResultDto>>> AutocompleteTags(
        [FromQuery] string query,
        [FromQuery] int maxResults = 15)
    {
        try
        {
            var results = await _songService.AutocompleteAsync("tags", query, maxResults);
            return Ok(results);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in autocomplete tags: {ex.Message}");
            return Ok(new List<AutocompleteResultDto>());
        }
    }

    // ============================================
    // GET: api/Songs/musical-keys
    // Get all musical keys
    // ============================================
    [HttpGet("musical-keys")]
    public async Task<ActionResult<List<MusicalKeyDto>>> GetMusicalKeys()
    {
        try
        {
            var keys = await _songService.GetMusicalKeysAsync();
            return Ok(keys);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting musical keys: {ex.Message}");
            return StatusCode(500, "אירעה שגיאה בטעינת הסולמות");
        }
    }

    // ============================================
    // GET: api/Songs/popular
    // Get popular songs by view count
    // ============================================
    [HttpGet("popular")]
    public async Task<ActionResult<List<SongBasicDto>>> GetPopularSongs([FromQuery] int limit = 5)
    {
        try
        {
            var songs = await _songService.GetPopularSongsAsync(limit);
            return Ok(songs);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting popular songs: {ex.Message}");
            return Ok(new List<SongBasicDto>());
        }
    }

    // ============================================
    // GET: api/Songs/genres
    // Get all genres for filtering
    // ============================================
    [HttpGet("genres")]
    public async Task<ActionResult<List<GenreDto>>> GetAllGenres()
    {
        try
        {
            var genres = await _songService.GetAllGenresAsync();
            return Ok(genres);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error getting genres: {ex.Message}");
            return Ok(new List<GenreDto>());
        }
    }

    // ============================================
    // PATCH: api/Songs/{id}/approval
    // Toggle song approval status (Admin only)
    // ============================================
    [HttpPatch("{id}/approval")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ToggleSongApproval(int id, [FromBody] ToggleApprovalDto dto)
    {
        try
        {
            var success = await _songService.ToggleSongApprovalAsync(id, dto.IsApproved);

            return Ok(new
            {
                success = true,
                message = dto.IsApproved ? "השיר אושר בהצלחה" : "אישור השיר בוטל",
                isApproved = dto.IsApproved
            });
        }
        catch (KeyNotFoundException)
        {
            return NotFound(new { message = "השיר לא נמצא" });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error toggling song approval: {ex.Message}");
            return StatusCode(500, new { message = "שגיאה בעדכון סטטוס האישור" });
        }
    }

    // ============================================
    // POST: api/Songs/{id}/increment-view
    // Increment unique view count with tracking
    // ============================================
    [HttpPost("{id}/increment-view")]
    public async Task<IActionResult> IncrementViewCount(int id)
    {
        try
        {
            // Extract HTTP-specific info
            int? userId = null;
            if (User.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out var parsedUserId))
                {
                    userId = parsedUserId;
                }
            }

            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
            var userAgent = Request.Headers["User-Agent"].ToString();
            var referrer = Request.Headers["Referer"].ToString();

            var viewCount = await _songService.IncrementViewCountAsync(id, userId, ipAddress, userAgent, referrer);

            return Ok(new { viewCount });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error incrementing song view: {ex.Message}");
            return StatusCode(500, new { message = "שגיאה בעדכון צפיות" });
        }
    }

    // ============================================
    // Helper: Get current user ID from token
    // ============================================
    private int? GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? User.FindFirst("id")?.Value
                       ?? User.FindFirst("sub")?.Value;

        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return null;
        }

        return userId;
    }
}
