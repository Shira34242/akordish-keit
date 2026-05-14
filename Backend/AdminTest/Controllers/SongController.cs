using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Exceptions;
using AkordishKeit.Services;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SongsController : ControllerBase
{
    private readonly ISongService _songService;
    private readonly IYouTubeService _youTubeService;
    private readonly IUserTagService _userTagService;
    private readonly ISmartSongImportService _smartSongImportService;
    private readonly ILogger<SongsController> _logger;

    public SongsController(
        ISongService songService,
        IYouTubeService youTubeService,
        IUserTagService userTagService,
        ISmartSongImportService smartSongImportService,
        ILogger<SongsController> logger)
    {
        _songService = songService;
        _youTubeService = youTubeService;
        _userTagService = userTagService;
        _smartSongImportService = smartSongImportService;
        _logger = logger;
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
                _logger.LogWarning("Song creation failed: UserId={UserId} Reason={Reason}", userId, result.Message);
                return BadRequest(result);
            }

            // עדכון תג תרומת תוכן לאחר הוספת שיר מוצלחת
            await _userTagService.RecalculateTagAsync(userId.Value);

            _logger.LogInformation("Song created: SongId={SongId} UserId={UserId} Title={Title}",
                result.SongId, userId, dto.Title);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error adding song: Title={Title}", dto.Title);
            return StatusCode(500, new AddSongResponseDto
            {
                Success = false,
                Message = "אירעה שגיאה בהוספת השיר"
            });
        }
    }

    [HttpPost("import-from-url")]
    [AllowAnonymous]
    public async Task<ActionResult<ImportSongFromUrlResponseDto>> ImportSongFromUrl([FromBody] ImportSongFromUrlRequestDto dto)
    {
        try
        {
            var userId = GetCurrentUserId() ?? 0;
            if (false && userId < 0)
            {
                return Unauthorized(new ImportSongFromUrlResponseDto
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

                return Ok(new ImportSongFromUrlResponseDto
                {
                    Success = false,
                    Message = errors
                });
            }

            var result = await _smartSongImportService.ImportFromUrlAsync(dto.Url, userId);

            if (result.Success && userId > 0)
            {
                await _userTagService.RecalculateTagAsync(userId);
                _logger.LogInformation("Song imported from URL: UserId={UserId} Url={Url} Title={Title}",
                    userId, dto.Url, result.Draft?.Title);
            }
            else if (!result.Success)
            {
                _logger.LogWarning("Song import failed: UserId={UserId} Url={Url} Reason={Reason}",
                    userId, dto.Url, result.Message);
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error importing song from URL: Url={Url}", dto.Url);
            return Ok(new ImportSongFromUrlResponseDto
            {
                Success = false,
                SourceUrl = dto.Url,
                Draft = new ImportedSongDraftDto
                {
                    Title = "שיר מיובא",
                    Artists = new List<ArtistInputDto>
                    {
                        new() { Name = "אמן לא ידוע" }
                    },
                    LyricsWithChords = string.Empty,
                    OriginalKeyId = 1,
                    Tags = new List<TagInputDto>
                    {
                        new() { Name = "ייבוא חכם" }
                    }
                },
                MissingFields = new List<string> { "מילים ואקורדים" },
                Message = "אירעה שגיאה בייבוא השיר"
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
                    return NotFound(result);
                if (result.Message.Contains("הרשאה"))
                    return StatusCode(403, result);
                return BadRequest(result);
            }

            _logger.LogInformation("Song updated: SongId={SongId} UserId={UserId}", id, userId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating song: SongId={Id}", id);
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
        [FromQuery] int? tagId = null,
        [FromQuery] string? sortBy = "date")
    {
        try
        {
            var result = await _songService.GetSongsAsync(
                page, pageSize, search, artistId, genreId, keyId, tagId, sortBy, includeUnapproved: false);

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
            _logger.LogError(ex, "Error getting songs");
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
        [FromQuery] int? tagId = null,
        [FromQuery] string? sortBy = "date")
    {
        try
        {
            var result = await _songService.GetSongsAsync(
                page, pageSize, search, artistId, genreId, keyId, tagId, sortBy, includeUnapproved: true);

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
            _logger.LogError(ex, "Error getting songs for admin");
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
            var (userId, ipAddress) = GetUserIdentity();
            var limitStatus = await _songService.GetDailyLimitStatusAsync(userId, ipAddress);

            if (limitStatus.LimitExceeded)
            {
                return StatusCode(429, new
                {
                    message = "הגעת למגבלה היומית של צפייה באקורדים",
                    dailyViewCount = limitStatus.DailyViewCount,
                    dailyLimit = limitStatus.DailyLimit,
                    remainingViews = limitStatus.RemainingViews,
                    tagHebrew = limitStatus.TagHebrew
                });
            }

            var song = await _songService.GetSongByIdAsync(id, includeUnapproved: false);

            if (song == null)
            {
                return NotFound(new { message = "השיר לא נמצא" });
            }

            return Ok(song);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting song: SongId={Id}", id);
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
            _logger.LogError(ex, "Error getting song for admin: SongId={Id}", id);
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
            _logger.LogError(ex, "Error getting random song");
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
            _logger.LogError(ex, "Error checking duplicates: Title={Title}", title);
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
            _logger.LogWarning(ex, "Error getting YouTube metadata");
            return Ok(new YouTubeMetadataDto
            {
                Success = false,
                ErrorMessage = "שגיאה בשליפת מטא-דאטה"
            });
        }
    }

    // ============================================
    // GET: api/Songs/youtube-search
    // Search YouTube videos by song title
    // ============================================
    [HttpGet("youtube-search")]
    public async Task<ActionResult<List<YouTubeSearchResultDto>>> SearchYouTubeVideos(
        [FromQuery] string query,
        [FromQuery] int maxResults = 5)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2)
            {
                return Ok(new List<YouTubeSearchResultDto>());
            }

            var results = await _youTubeService.SearchVideosAsync(query, maxResults);
            return Ok(results);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error searching YouTube videos: Query={Query}", query);
            return Ok(new List<YouTubeSearchResultDto>());
        }
    }

    // ============================================
    // GET: api/Songs/autocomplete/artists
    // Autocomplete for artists
    // ============================================
    [HttpGet("autocomplete/artists")]
    [EnableRateLimiting("autocomplete")]
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
            _logger.LogWarning(ex, "Error in autocomplete artists");
            return Ok(new List<AutocompleteResultDto>());
        }
    }

    // ============================================
    // GET: api/Songs/autocomplete/genres
    // Autocomplete for genres
    // ============================================
    [HttpGet("autocomplete/genres")]
    [EnableRateLimiting("autocomplete")]
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
            _logger.LogWarning(ex, "Error in autocomplete genres");
            return Ok(new List<AutocompleteResultDto>());
        }
    }

    // ============================================
    // GET: api/Songs/autocomplete/people
    // Autocomplete for people (composers, lyricists, arrangers)
    // ============================================
    [HttpGet("autocomplete/people")]
    [EnableRateLimiting("autocomplete")]
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
            _logger.LogWarning(ex, "Error in autocomplete people");
            return Ok(new List<AutocompleteResultDto>());
        }
    }

    // ============================================
    // GET: api/Songs/autocomplete/tags
    // Autocomplete for tags
    // ============================================
    [HttpGet("autocomplete/tags")]
    [EnableRateLimiting("autocomplete")]
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
            _logger.LogWarning(ex, "Error in autocomplete tags");
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
            _logger.LogError(ex, "Error getting musical keys");
            return StatusCode(500, "אירעה שגיאה בטעינת הסולמות");
        }
    }

    // ============================================
    // POST: api/Songs/detect-key
    // זיהוי סולם אוטומטי מתוך מילים ואקורדים
    // ============================================
    [HttpPost("detect-key")]
    [AllowAnonymous]
    public ActionResult<DetectKeyResponseDto> DetectKey([FromBody] DetectKeyRequestDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.LyricsWithChords))
            return BadRequest("יש לספק מילים ואקורדים");

        var result = KeyDetectionService.Detect(dto.LyricsWithChords);

        if (result == null)
            return Ok(new DetectKeyResponseDto()); // לא נמצאו אקורדים — שדות null

        return Ok(new DetectKeyResponseDto
        {
            OriginalKeyId = result.OriginalKeyId,
            EasyKeyId = result.EasyKeyId
        });
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
            _logger.LogWarning(ex, "Error getting popular songs");
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
            _logger.LogWarning(ex, "Error getting genres");
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

            if (success && dto.IsApproved)
            {
                var songDto = await _songService.GetSongByIdAsync(id, includeUnapproved: true);
                if (songDto?.UploadedByUserId.HasValue == true)
                {
                    await _userTagService.RecalculateTagAsync(songDto.UploadedByUserId.Value);
                }
            }

            _logger.LogInformation("Song approval toggled: SongId={SongId} IsApproved={IsApproved} AdminUserId={AdminId}",
                id, dto.IsApproved, User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value);
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
            _logger.LogError(ex, "Error toggling song approval: SongId={Id}", id);
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
        catch (DailyLimitExceededException ex)
        {
            return StatusCode(429, new
            {
                message = "הגעת למגבלה היומית של צפייה באקורדים",
                dailyViewCount = ex.DailyViewCount,
                dailyLimit = ex.DailyLimit,
                tagHebrew = ex.TagHebrew
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error incrementing song view: SongId={Id}", id);
            return StatusCode(500, new { message = "שגיאה בעדכון צפיות" });
        }
    }

    // ============================================
    // GET: api/Songs/daily-limit-status
    // Check current daily song view limit status
    // ============================================
    [HttpGet("daily-limit-status")]
    public async Task<ActionResult<DailyLimitStatusDto>> GetDailyLimitStatus()
    {
        try
        {
            var (userId, ipAddress) = GetUserIdentity();
            var status = await _songService.GetDailyLimitStatusAsync(userId, ipAddress);
            return Ok(status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting daily limit status");
            return StatusCode(500, new { message = "שגיאה בבדיקת מגבלה יומית" });
        }
    }

    // ============================================
    // POST: api/Songs/{id}/duplicate
    // Duplicate a song (Admin only)
    // ============================================
    [HttpPost("{id}/duplicate")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SongDto>> DuplicateSong(int id)
    {
        try
        {
            var duplicate = await _songService.DuplicateSongAsync(id);
            _logger.LogInformation("Song duplicated: OriginalId={OriginalId} NewId={NewId}",
                id, duplicate.Id);
            return Ok(duplicate);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error duplicating song: SongId={Id}", id);
            return StatusCode(500, new { message = "שגיאה בשכפול השיר" });
        }
    }

    // ============================================
    // GET: api/Songs/my
    // Get songs uploaded by the current user
    // ============================================
    [HttpGet("my")]
    [Authorize]
    public async Task<ActionResult<PagedResult<SongBasicDto>>> GetMySongs([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 8)
    {
        try
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var result = await _songService.GetMySongsAsync(userId.Value, pageNumber, pageSize);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting my songs");
            return StatusCode(500, "אירעה שגיאה בטעינת השירים");
        }
    }

    // ============================================
    // POST: api/Songs/{id}/rate
    // שמירת דירוג שיר (מחייב התחברות)
    // ============================================
    [HttpPost("{id}/rate")]
    [Authorize]
    public async Task<ActionResult<SongRatingResponseDto>> RateSong(int id, [FromBody] RateSongDto dto)
    {
        try
        {
            if (!ModelState.IsValid)
                return BadRequest(new { message = "דירוג לא תקין" });

            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized(new { message = "נדרשת התחברות לדירוג" });

            var result = await _songService.RateSongAsync(id, userId.Value, dto.Rating);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error rating song: SongId={Id}", id);
            return StatusCode(500, new { message = "שגיאה בשמירת הדירוג" });
        }
    }

    // ============================================
    // GET: api/Songs/{id}/rating
    // קבלת ממוצע דירוגים + דירוג המשתמש הנוכחי
    // ============================================
    [HttpGet("{id}/rating")]
    public async Task<ActionResult<SongRatingResponseDto>> GetSongRating(int id)
    {
        try
        {
            var userId = GetCurrentUserId();
            var result = await _songService.GetSongRatingAsync(id, userId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error getting song rating: SongId={Id}", id);
            return Ok(new SongRatingResponseDto { AverageRating = 0, RatingCount = 0, UserRating = null });
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

    private (int? userId, string? ipAddress) GetUserIdentity()
    {
        int? userId = GetCurrentUserId();
        string? ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        return (userId, ipAddress);
    }
}
