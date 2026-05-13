using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using AkordishKeit.Data;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;
using AkordishKeit.Services;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ArtistsController : ControllerBase
{
    private readonly AkordishKeitDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly ISongService _songService;
    private readonly IArticleService _articleService;

    public ArtistsController(
        AkordishKeitDbContext context,
        INotificationService notificationService,
        ISongService songService,
        IArticleService articleService)
    {
        _context = context;
        _notificationService = notificationService;
        _songService = songService;
        _articleService = articleService;
    }

    // ========================================
    // רשימות אומנים
    // ========================================

    /// <summary>
    /// קבלת כל האומנים עם פילטרים ו-Pagination
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<ArtistListDto>>> GetArtists(
        [FromQuery] bool? isPremium = null,
        [FromQuery] ArtistStatus? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string sortBy = "name",
        [FromQuery] string? search = null)
    {
        try
        {
            var query = _context.Artists
                .Where(a => !a.IsDeleted);

            if (status.HasValue)
                query = query.Where(a => a.Status == status.Value);

            if (isPremium.HasValue)
                query = query.Where(a => a.IsPremium == isPremium.Value);

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(a => a.Name.Contains(search));

            var totalCount = await query.CountAsync();

            // קדימות לפי Tier (Subscribed לפני Free), ואז לפי המיון שנבחר
            query = sortBy.ToLower() switch
            {
                "songcount" => query
                    .OrderByDescending(a => a.Tier)              // מנויים משלמים קודם
                    .ThenByDescending(a => a.SongArtists.Count), // ואז לפי מספר שירים
                "created" => query
                    .OrderByDescending(a => a.Tier)              // מנויים משלמים קודם
                    .ThenByDescending(a => a.CreatedAt),         // ואז לפי תאריך
                _ => query
                    .OrderByDescending(a => a.Tier)              // מנויים משלמים קודם
                    .ThenBy(a => a.Name)                         // ואז לפי שם
            };

            var artists = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new ArtistListDto
                {
                    Id = a.Id,
                    Name = a.Name,
                    ShortBio = a.ShortBio,
                    ImageUrl = a.ImageUrl,
                    IsVerified = a.IsVerified,
                    IsPremium = a.IsPremium,
                    SongCount = a.SongArtists.Count(sa => !sa.Song.IsDeleted && sa.Song.IsApproved),
                    Status = a.Status,
                    CreatedAt = a.CreatedAt
                })
                .ToListAsync();

            return Ok(new PagedResult<ArtistListDto>
            {
                Items = artists,
                TotalCount = totalCount,
                PageNumber = page,
                PageSize = pageSize
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה בטעינת אומנים: {ex.Message}");
        }
    }

    /// <summary>
    /// אומנים מומלצים (Premium + Boost)
    /// </summary>
    [HttpGet("featured")]
    public async Task<ActionResult<List<ArtistListDto>>> GetFeaturedArtists([FromQuery] int count = 10)
    {
        try
        {
            var artists = await _context.Artists
                .Where(a => !a.IsDeleted && a.Status == ArtistStatus.Active)
                .Where(a => a.IsPremium || a.LastBoostDate.HasValue)
                .OrderByDescending(a => a.IsPremium)
                .ThenByDescending(a => a.LastBoostDate)
                .ThenBy(a => a.DisplayOrder)
                .Take(count)
                .Select(a => new ArtistListDto
                {
                    Id = a.Id,
                    Name = a.Name,
                    ShortBio = a.ShortBio,
                    ImageUrl = a.ImageUrl,
                    IsVerified = a.IsVerified,
                    IsPremium = a.IsPremium,
                    SongCount = a.SongArtists.Count(sa => !sa.Song.IsDeleted && sa.Song.IsApproved),
                    Status = a.Status,
                    CreatedAt = a.CreatedAt
                })
                .ToListAsync();

            return Ok(artists);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה בטעינת אומנים מומלצים: {ex.Message}");
        }
    }

    /// <summary>
    /// Top Artists - תאימות לאחור
    /// </summary>
    [HttpGet("top")]
    public async Task<ActionResult<List<ArtistWithCountDto>>> GetTopArtists([FromQuery] int count = 10)
    {
        try
        {
            var artists = await _context.Artists
                .Where(a => !a.IsDeleted && a.Status == ArtistStatus.Active)
                .Select(a => new ArtistWithCountDto
                {
                    Id = a.Id,
                    Name = a.Name,
                    EnglishName = a.EnglishName,
                    ImageUrl = a.ImageUrl,
                    SongCount = a.SongArtists.Count(sa => !sa.Song.IsDeleted && sa.Song.IsApproved)
                })
                .OrderByDescending(a => a.SongCount)
                .Take(count)
                .ToListAsync();

            return Ok(artists);
        }
        catch (Exception ex)
        {
            return StatusCode(500, "אירעה שגיאה בטעינת האמנים המובילים");
        }
    }

    // ========================================
    // פרטי אומן
    // ========================================

    /// <summary>
    /// קבלת פרטי אומן מלאים
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<ArtistDetailDto>> GetArtistById(int id)
    {
        try
        {
            var artist = await _context.Artists
                .Include(a => a.GalleryImages.OrderBy(gi => gi.DisplayOrder))
                .Include(a => a.Videos.OrderBy(v => v.DisplayOrder))
                .Include(a => a.Hits.OrderBy(h => h.DisplayOrder))
                .Include(a => a.Albums.OrderBy(al => al.DisplayOrder))
                .Include(a => a.SocialLinks)
                .Include(a => a.PerformanceEvent)
                .Where(a => a.Id == id && !a.IsDeleted)
                .FirstOrDefaultAsync();

            if (artist == null)
                return NotFound("אומן לא נמצא");

            var songCount = await _context.SongArtists
                .Where(sa => sa.ArtistId == id && !sa.Song.IsDeleted && sa.Song.IsApproved)
                .CountAsync();

            var articleCount = await _context.ArticleArtists
                .Where(aa => aa.ArtistId == id && !aa.Article.IsDeleted)
                .CountAsync();

            var upcomingEventCount = await _context.EventArtists
                .Where(ea => ea.ArtistId == id && ea.Event.EventDate >= DateTime.UtcNow && !ea.Event.IsDeleted)
                .CountAsync();

            var result = new ArtistDetailDto
            {
                Id = artist.Id,
                Name = artist.Name,
                EnglishName = artist.EnglishName,
                ShortBio = artist.ShortBio,
                Biography = artist.Biography,
                ImageUrl = artist.ImageUrl,
                BannerImageUrl = artist.BannerImageUrl,
                BannerGifUrl = artist.BannerGifUrl,
                BannerMediaType = artist.BannerMediaType,
                BannerBlur = artist.BannerBlur,
                WebsiteUrl = artist.WebsiteUrl,
                IsVerified = artist.IsVerified,
                IsPremium = artist.IsPremium,
                Status = artist.Status,
                UserId = artist.UserId,
                PerformanceImageUrl = artist.PerformanceImageUrl,
                PerformanceTicketUrl = artist.PerformanceTicketUrl,
                PerformanceIsActive = artist.PerformanceIsActive,
                PerformanceEventId = artist.PerformanceEventId,
                PerformanceEvent = artist.PerformanceEvent == null ? null : new PerformanceEventDetailsDto
                {
                    Id = artist.PerformanceEvent.Id,
                    Name = artist.PerformanceEvent.Name,
                    Description = artist.PerformanceEvent.Description,
                    ImageUrl = artist.PerformanceEvent.ImageUrl,
                    BannerImageUrl = artist.PerformanceEvent.BannerImageUrl,
                    TicketUrl = artist.PerformanceEvent.TicketUrl,
                    EventDate = artist.PerformanceEvent.EventDate,
                    Location = artist.PerformanceEvent.Location,
                    Price = artist.PerformanceEvent.Price,
                    IsActive = artist.PerformanceEvent.IsActive
                },
                GalleryImages = artist.GalleryImages.Select(gi => new ArtistGalleryImageDto
                {
                    Id = gi.Id,
                    ImageUrl = gi.ImageUrl,
                    Caption = gi.Caption,
                    DisplayOrder = gi.DisplayOrder
                }).ToList(),
                Videos = artist.Videos.Select(v => new ArtistVideoDto
                {
                    Id = v.Id,
                    VideoUrl = v.VideoUrl,
                    Title = v.Title,
                    DisplayOrder = v.DisplayOrder
                }).ToList(),
                Hits = artist.Hits
                    .Where(h => h.IsActive)
                    .Select(h => new ArtistHitDto
                    {
                        Id = h.Id,
                        Title = h.Title,
                        ImageUrl = h.ImageUrl,
                        YouTubeUrl = h.YouTubeUrl,
                        DisplayOrder = h.DisplayOrder,
                        IsActive = h.IsActive
                    }).ToList(),
                Albums = artist.Albums
                    .Where(al => al.IsActive)
                    .Select(al => new ArtistAlbumDto
                    {
                        Id = al.Id,
                        Title = al.Title,
                        CoverImageUrl = al.CoverImageUrl,
                        ReleaseYear = al.ReleaseYear,
                        ExternalUrl = al.ExternalUrl,
                        DisplayOrder = al.DisplayOrder,
                        IsActive = al.IsActive
                    }).ToList(),
                SocialLinks = artist.SocialLinks.Select(sl => new SocialLinkDto
                {
                    Id = sl.Id,
                    Platform = sl.Platform,
                    Url = sl.Url
                }).ToList(),
                SongCount = songCount,
                ArticleCount = articleCount,
                UpcomingEventCount = upcomingEventCount,
                CreatedAt = artist.CreatedAt
            };

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה בטעינת פרטי אומן: {ex.Message}");
        }
    }

    /// <summary>
    /// קבלת שירים של אומן
    /// </summary>
    [HttpGet("{id}/songs")]
    public async Task<ActionResult<PagedResult<ArtistSongItemDto>>> GetArtistSongs(
        int id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        try
        {
            var query = _context.SongArtists
                .Where(sa => sa.ArtistId == id && !sa.Song.IsDeleted && sa.Song.IsApproved)
                .Select(sa => sa.Song);

            var totalCount = await query.CountAsync();

            var songs = await query
                .OrderByDescending(s => s.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(s => new ArtistSongItemDto
                {
                    Id = s.Id,
                    Title = s.Title,
                    ImageUrl = s.ImageUrl,
                    ViewCount = s.ViewCount,
                    // הוסף שדות נוספים לפי הצורך
                })
                .ToListAsync();

            return Ok(new PagedResult<ArtistSongItemDto>
            {
                Items = songs,
                TotalCount = totalCount,
                PageNumber = page,
                PageSize = pageSize
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה בטעינת שירים: {ex.Message}");
        }
    }

    /// <summary>
    /// קבלת כתבות של אומן
    /// </summary>
    [HttpGet("{id}/articles")]
    public async Task<ActionResult<PagedResult<ArticleDto>>> GetArtistArticles(
        int id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        try
        {
            var now = DateTime.UtcNow;
            var query = _context.Articles
                .AsNoTracking()
                .Include(a => a.ArticleCategories)
                    .ThenInclude(ac => ac.Category)
                .Where(a => a.ArticleArtists.Any(aa => aa.ArtistId == id)
                    && a.Status == (int)ArticleStatus.Published
                    && a.PublishDate <= now
                    && !a.IsDeleted);

            var totalCount = await query.CountAsync();

            var articles = await query
                .OrderByDescending(a => a.PublishDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(a => new ArticleDto
                {
                    Id = a.Id,
                    Title = a.Title,
                    Subtitle = a.Subtitle,
                    FeaturedImageUrl = a.FeaturedImageUrl,
                    PublishDate = a.PublishDate,
                    ShortDescription = a.ShortDescription,
                    Slug = a.Slug,
                    ContentType = a.ContentType,
                    ContentTypeName = ((ArticleContentType)a.ContentType).ToString(),
                    CategoryIds = a.ArticleCategories.Select(ac => ac.CategoryId).ToList(),
                    CategoryNames = a.ArticleCategories.Select(ac => ac.Category.DisplayName).ToList(),
                    Status = a.Status,
                    StatusName = ((ArticleStatus)a.Status).ToString()
                })
                .ToListAsync();

            return Ok(new PagedResult<ArticleDto>
            {
                Items = articles,
                TotalCount = totalCount,
                PageNumber = page,
                PageSize = pageSize
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה בטעינת כתבות: {ex.Message}");
        }
    }

    /// <summary>
    /// קבלת הופעות קרובות של אומן
    /// </summary>
    // GET: api/Artists/5/uploaded-songs
    [HttpGet("{id}/uploaded-songs")]
    public async Task<ActionResult<List<ArtistSongItemDto>>> GetArtistUploadedSongs(int id, [FromQuery] int limit = 12)
    {
        var exists = await _context.Artists
            .AnyAsync(a => a.Id == id && !a.IsDeleted);

        if (!exists)
        {
            return NotFound(new { message = "Artist not found" });
        }

        var songs = await _songService.GetApprovedSongsByUploaderProfileAsync("artist", id, limit);
        return Ok(songs);
    }

    // GET: api/Artists/5/uploaded-articles
    [HttpGet("{id}/uploaded-articles")]
    public async Task<ActionResult<List<ArticleDto>>> GetArtistUploadedArticles(int id, [FromQuery] int limit = 12)
    {
        var exists = await _context.Artists
            .AnyAsync(a => a.Id == id && !a.IsDeleted);

        if (!exists)
        {
            return NotFound(new { message = "Artist not found" });
        }

        var articles = await _articleService.GetPublishedArticlesByUploaderProfileAsync("artist", id, limit);
        return Ok(articles);
    }

    [HttpGet("{id}/events")]
    public async Task<ActionResult<List<ArtistEventItemDto>>> GetArtistEvents(int id)
    {
        try
        {
            var events = await _context.EventArtists
                .Where(ea => ea.ArtistId == id &&
                             ea.Event.EventDate >= DateTime.UtcNow &&
                             !ea.Event.IsDeleted &&
                             ea.Event.IsActive)
                .Select(ea => ea.Event)
                .OrderBy(e => e.EventDate)
                .Select(e => new ArtistEventItemDto
                {
                    Id = e.Id,
                    Name = e.Name,
                    ImageUrl = e.ImageUrl,
                    TicketUrl = e.TicketUrl,
                    EventDate = e.EventDate,
                    Location = e.Location
                })
                .ToListAsync();

            return Ok(events);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה בטעינת הופעות: {ex.Message}");
        }
    }

    // ========================================
    // עדכון פרטי אומן
    // ========================================

    /// <summary>
    /// עדכון פרטי אומן (Admin או האומן עצמו)
    /// </summary>
    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateArtist(int id, [FromBody] UpdateArtistDto dto)
    {
        try
        {
            var artist = await _context.Artists.FindAsync(id);
            if (artist == null)
                return NotFound("אומן לא נמצא");

            var isAdmin = User.IsInRole("Admin");
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            int.TryParse(userIdClaim, out var currentUserId);

            if (!isAdmin && artist.UserId != currentUserId)
                return Forbid();
            var wasActive = artist.Status == ArtistStatus.Active;

            var richMediaError = ValidateArtistRichMedia(dto);
            if (richMediaError != null)
                return BadRequest(new { message = richMediaError });

            // עדכון שדות בסיסיים
            if (!string.IsNullOrWhiteSpace(dto.Name))
                artist.Name = dto.Name.Trim();

            if (!string.IsNullOrWhiteSpace(dto.EnglishName))
                artist.EnglishName = dto.EnglishName;

            artist.ShortBio = dto.ShortBio;
            artist.Biography = dto.Biography;
            artist.ImageUrl = dto.ImageUrl;
            artist.BannerImageUrl = dto.BannerImageUrl;
            artist.BannerGifUrl = dto.BannerGifUrl;  // Admin יכול לעדכן לכולם
            artist.BannerMediaType = NormalizeBannerMediaType(dto.BannerMediaType);
            if (dto.BannerBlur.HasValue)
                artist.BannerBlur = Math.Clamp(dto.BannerBlur.Value, 0, 20);
            artist.WebsiteUrl = dto.WebsiteUrl;

            // עדכון באנר הופעה (legacy)
            artist.PerformanceImageUrl = dto.PerformanceImageUrl;
            artist.PerformanceTicketUrl = dto.PerformanceTicketUrl;
            if (dto.PerformanceIsActive.HasValue)
                artist.PerformanceIsActive = dto.PerformanceIsActive.Value;

            // עדכון אירוע מקושר לבאנר
            if (dto.PerformanceIsActive == true)
                await SyncPerformanceEventAsync(artist, dto.PerformanceEvent);
            else if (dto.PerformanceIsActive == false)
                await SyncPerformanceEventAsync(artist, null);

            // רק Admin יכול לעדכן סטטוס ו-Premium
            if (isAdmin)
            {
                if (dto.Status.HasValue)
                    artist.Status = dto.Status.Value;

                if (dto.IsPremium.HasValue)
                    artist.IsPremium = dto.IsPremium.Value;
            }

            // עדכון רשתות חברתיות (מחיקת הקיימים והוספה מחדש)
            if (dto.SocialLinks != null)
            {
                var existingLinks = await _context.ArtistSocialLinks
                    .Where(sl => sl.ArtistId == id)
                    .ToListAsync();
                _context.ArtistSocialLinks.RemoveRange(existingLinks);

                foreach (var link in dto.SocialLinks)
                {
                    _context.ArtistSocialLinks.Add(new ArtistSocialLink
                    {
                        ArtistId = id,
                        Platform = link.Platform,
                        Url = link.Url
                    });
                }
            }

            // עדכון גלריה (Admin יכול לעדכן לכולם)
            if (dto.GalleryImages != null)
            {
                var existingImages = await _context.ArtistGalleryImages
                    .Where(gi => gi.ArtistId == id)
                    .ToListAsync();
                _context.ArtistGalleryImages.RemoveRange(existingImages);

                foreach (var img in dto.GalleryImages)
                {
                    _context.ArtistGalleryImages.Add(new ArtistGalleryImage
                    {
                        ArtistId = id,
                        ImageUrl = img.ImageUrl,
                        Caption = img.Caption,
                        DisplayOrder = img.DisplayOrder
                    });
                }
            }

            // עדכון וידאו (Admin יכול לעדכן לכולם)
            if (dto.Videos != null)
            {
                var existingVideos = await _context.ArtistVideos
                    .Where(v => v.ArtistId == id)
                    .ToListAsync();
                _context.ArtistVideos.RemoveRange(existingVideos);

                foreach (var video in dto.Videos)
                {
                    _context.ArtistVideos.Add(new ArtistVideo
                    {
                        ArtistId = id,
                        VideoUrl = video.VideoUrl,
                        Title = video.Title,
                        DisplayOrder = video.DisplayOrder
                    });
                }
            }

            await SyncArtistHitsAsync(id, dto.Hits);
            await SyncArtistAlbumsAsync(id, dto.Albums);

            await _context.SaveChangesAsync();

            if (isAdmin && !wasActive && artist.Status == ArtistStatus.Active && artist.UserId.HasValue)
            {
                await _notificationService.NotifyArtistApprovedAsync(artist.UserId.Value, artist.Id, artist.Name);
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה בעדכון אומן: {ex.Message}");
        }
    }

    // ========================================
    // ניהול גלריה
    // ========================================

    /// <summary>
    /// הוספת תמונה לגלריה (משלם בלבד)
    /// </summary>
    [HttpPost("{id}/gallery")]
    [Authorize]
    public async Task<ActionResult<ArtistGalleryImageDto>> AddGalleryImage(int id, [FromBody] AddGalleryImageDto dto)
    {
        try
        {
            var artist = await _context.Artists
                .Include(a => a.GalleryImages)
                .FirstOrDefaultAsync(a => a.Id == id);

            if (artist == null)
                return NotFound("אומן לא נמצא");

            if (!artist.IsPremium)
                return BadRequest("רק אומן משלם יכול להוסיף גלריה");

            if (artist.GalleryImages.Count >= 10)
                return BadRequest("ניתן להוסיף עד 10 תמונות בלבד");

            var image = new ArtistGalleryImage
            {
                ArtistId = id,
                ImageUrl = dto.ImageUrl,
                Caption = dto.Caption,
                DisplayOrder = dto.DisplayOrder,
                CreatedAt = DateTime.UtcNow
            };

            _context.ArtistGalleryImages.Add(image);
            await _context.SaveChangesAsync();

            return Ok(new ArtistGalleryImageDto
            {
                Id = image.Id,
                ImageUrl = image.ImageUrl,
                Caption = image.Caption,
                DisplayOrder = image.DisplayOrder
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה בהוספת תמונה: {ex.Message}");
        }
    }

    /// <summary>
    /// מחיקת תמונה מהגלריה
    /// </summary>
    [HttpDelete("{artistId}/gallery/{imageId}")]
    [Authorize]
    public async Task<IActionResult> DeleteGalleryImage(int artistId, int imageId)
    {
        try
        {
            var image = await _context.ArtistGalleryImages
                .FirstOrDefaultAsync(gi => gi.Id == imageId && gi.ArtistId == artistId);

            if (image == null)
                return NotFound("תמונה לא נמצאה");

            _context.ArtistGalleryImages.Remove(image);
            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה במחיקת תמונה: {ex.Message}");
        }
    }

    // ========================================
    // ניהול וידאו
    // ========================================

    /// <summary>
    /// הוספת וידאו (משלם בלבד)
    /// </summary>
    [HttpPost("{id}/videos")]
    [Authorize]
    public async Task<ActionResult<ArtistVideoDto>> AddVideo(int id, [FromBody] AddVideoDto dto)
    {
        try
        {
            var artist = await _context.Artists.FindAsync(id);
            if (artist == null)
                return NotFound("אומן לא נמצא");

            if (!artist.IsPremium)
                return BadRequest("רק אומן משלם יכול להוסיף וידאו");

            var video = new ArtistVideo
            {
                ArtistId = id,
                VideoUrl = dto.VideoUrl,
                Title = dto.Title,
                DisplayOrder = dto.DisplayOrder,
                CreatedAt = DateTime.UtcNow
            };

            _context.ArtistVideos.Add(video);
            await _context.SaveChangesAsync();

            return Ok(new ArtistVideoDto
            {
                Id = video.Id,
                VideoUrl = video.VideoUrl,
                Title = video.Title,
                DisplayOrder = video.DisplayOrder
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה בהוספת וידאו: {ex.Message}");
        }
    }

    /// <summary>
    /// מחיקת וידאו
    /// </summary>
    [HttpDelete("{artistId}/videos/{videoId}")]
    [Authorize]
    public async Task<IActionResult> DeleteVideo(int artistId, int videoId)
    {
        try
        {
            var video = await _context.ArtistVideos
                .FirstOrDefaultAsync(v => v.Id == videoId && v.ArtistId == artistId);

            if (video == null)
                return NotFound("וידאו לא נמצא");

            _context.ArtistVideos.Remove(video);
            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה במחיקת וידאו: {ex.Message}");
        }
    }

    // ========================================
    // קידום ושדרוג
    // ========================================

    /// <summary>
    /// Boost - קידום חד פעמי (10₪)
    /// </summary>
    [HttpPost("{id}/boost")]
    [Authorize]
    public async Task<ActionResult<BoostArtistResponse>> BoostArtist(int id)
    {
        try
        {
            var artist = await _context.Artists.FindAsync(id);
            if (artist == null)
                return NotFound("אומן לא נמצא");

            // TODO: טיפול בתשלום

            artist.LastBoostDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new BoostArtistResponse
            {
                Success = true,
                Message = "האומן קודם בהצלחה!",
                BoostEndDate = DateTime.UtcNow.AddMonths(1) // לדוגמה
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה בקידום אומן: {ex.Message}");
        }
    }

    /// <summary>
    /// שדרוג לחשבון משלם
    /// </summary>
    [HttpPost("{id}/upgrade")]
    [Authorize]
    public async Task<ActionResult<UpgradeToPremiumResponse>> UpgradeToPremium(int id)
    {
        try
        {
            var artist = await _context.Artists.FindAsync(id);
            if (artist == null)
                return NotFound("אומן לא נמצא");

            if (artist.IsPremium)
                return BadRequest("אומן כבר משלם");

            // TODO: טיפול בתשלום והפניה לעמוד תשלום

            return Ok(new UpgradeToPremiumResponse
            {
                Success = true,
                Message = "נא להמתין להפניה לעמוד התשלום",
                PaymentUrl = "/payment/premium-artist" // לדוגמה
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה בשדרוג חשבון: {ex.Message}");
        }
    }

    // ========================================
    // יצירת פרופיל אומן - לציבור
    // ========================================

    /// <summary>
    /// יצירת פרופיל אומן חדש (משתמש מחובר עם מנוי פעיל)
    /// </summary>
    [HttpPost("create-profile")]
    [Authorize]
    public async Task<ActionResult<ArtistDetailDto>> CreateArtistProfile([FromBody] UpdateArtistDto dto)
    {
        try
        {
            // קבלת המשתמש המחובר
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                return Unauthorized("משתמש לא מזוהה");

            // וולידציה
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("שם האומן הוא שדה חובה");

            // בדיקה אם המשתמש כבר יצר אומן בשם זה
            var existingArtist = await _context.Artists
                .FirstOrDefaultAsync(a => a.UserId == userId && a.Name == dto.Name && !a.IsDeleted);

            if (existingArtist != null)
                return BadRequest("כבר יצרת אומן בשם זה");

            // בדיקת מנוי פעיל (אופציונלי - לקביעת Premium)
            var activeSubscription = await _context.Subscriptions
                .Where(s => s.UserId == userId)
                .Where(s => s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trial)
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            // קביעת האם זה הפרופיל הראשי (הראשון למשתמש)
            var existingArtistsByUser = await _context.Artists
                .Where(a => a.UserId == userId && !a.IsDeleted)
                .CountAsync();

            bool isPrimaryProfile = existingArtistsByUser == 0;

            // קביעת Premium לפי המנוי (אם קיים)
            bool isPremium = activeSubscription?.Plan == SubscriptionPlan.Premium;

            var richMediaError = ValidateArtistRichMedia(dto);
            if (richMediaError != null)
                return BadRequest(new { message = richMediaError });

            // יצירת אומן חדש
            var artist = new Artist
            {
                UserId = userId,
                Name = dto.Name,
                EnglishName = dto.EnglishName,
                ShortBio = dto.ShortBio,
                Biography = dto.Biography,
                ImageUrl = dto.ImageUrl,
                WebsiteUrl = dto.WebsiteUrl,
                IsPrimaryProfile = isPrimaryProfile,
                IsPremium = isPremium,
                Status = ArtistStatus.Pending, // ממתין לאישור
                IsVerified = false,
                DisplayOrder = 999,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

            // קישור למנוי אם קיים
            if (activeSubscription != null)
            {
                artist.SubscriptionId = activeSubscription.Id;
                artist.Tier = ProfileTier.Subscribed;
            }
            else
            {
                artist.Tier = ProfileTier.Free;
            }

            // Artist page media fields are saved for every artist profile.
            artist.BannerImageUrl = dto.BannerImageUrl;
            artist.BannerGifUrl = dto.BannerGifUrl;
            artist.BannerMediaType = NormalizeBannerMediaType(dto.BannerMediaType);
            if (dto.BannerBlur.HasValue)
                artist.BannerBlur = Math.Clamp(dto.BannerBlur.Value, 0, 20);
            artist.PerformanceIsActive = dto.PerformanceIsActive == true;
            artist.PerformanceImageUrl = FirstText(
                dto.PerformanceImageUrl,
                dto.PerformanceEvent?.BannerImageUrl,
                dto.PerformanceEvent?.ImageUrl);
            artist.PerformanceTicketUrl = FirstText(
                dto.PerformanceTicketUrl,
                dto.PerformanceEvent?.TicketUrl);

            _context.Artists.Add(artist);
            await _context.SaveChangesAsync();

            // Keep the artist performance banner and linked event in sync.
            await SyncPerformanceEventAsync(
                artist,
                artist.PerformanceIsActive ? dto.PerformanceEvent : null);
            await _context.SaveChangesAsync();

            // הוספת קישורים לרשתות חברתיות
            if (dto.SocialLinks != null && dto.SocialLinks.Any())
            {
                foreach (var link in dto.SocialLinks)
                {
                    _context.ArtistSocialLinks.Add(new ArtistSocialLink
                    {
                        ArtistId = artist.Id,
                        Platform = link.Platform,
                        Url = link.Url
                    });
                }
            }

            // הוספת גלריה - רק אם Premium
            if (isPremium && dto.GalleryImages != null && dto.GalleryImages.Any())
            {
                foreach (var img in dto.GalleryImages)
                {
                    _context.ArtistGalleryImages.Add(new ArtistGalleryImage
                    {
                        ArtistId = artist.Id,
                        ImageUrl = img.ImageUrl,
                        Caption = img.Caption,
                        DisplayOrder = img.DisplayOrder
                    });
                }
            }

            // הוספת וידאו - רק אם Premium
            if (isPremium && dto.Videos != null && dto.Videos.Any())
            {
                foreach (var video in dto.Videos)
                {
                    _context.ArtistVideos.Add(new ArtistVideo
                    {
                        ArtistId = artist.Id,
                        VideoUrl = video.VideoUrl,
                        Title = video.Title,
                        DisplayOrder = video.DisplayOrder
                    });
                }
            }

            await SyncArtistHitsAsync(artist.Id, dto.Hits);
            await SyncArtistAlbumsAsync(artist.Id, dto.Albums);

            await _context.SaveChangesAsync();

            await _notificationService.NotifyArtistSubmittedAsync(userId, artist.Id, artist.Name);

            // החזרת פרטי האומן המלאים
            var result = await _context.Artists
                .Where(a => a.Id == artist.Id)
                .Select(a => new ArtistDetailDto
                {
                    Id = a.Id,
                    Name = a.Name,
                    EnglishName = a.EnglishName,
                    ShortBio = a.ShortBio,
                    Biography = a.Biography,
                    ImageUrl = a.ImageUrl,
                    BannerImageUrl = a.BannerImageUrl,
                    BannerGifUrl = a.BannerGifUrl,
                    WebsiteUrl = a.WebsiteUrl,
                    IsVerified = a.IsVerified,
                    IsPremium = a.IsPremium,
                    Status = a.Status,
                    UserId = a.UserId,
                    PerformanceImageUrl = a.PerformanceImageUrl,
                    PerformanceTicketUrl = a.PerformanceTicketUrl,
                    PerformanceIsActive = a.PerformanceIsActive,
                    GalleryImages = a.GalleryImages.Select(gi => new ArtistGalleryImageDto
                    {
                        Id = gi.Id,
                        ImageUrl = gi.ImageUrl,
                        Caption = gi.Caption,
                        DisplayOrder = gi.DisplayOrder
                    }).ToList(),
                    Videos = a.Videos.Select(v => new ArtistVideoDto
                    {
                        Id = v.Id,
                        VideoUrl = v.VideoUrl,
                        Title = v.Title,
                        DisplayOrder = v.DisplayOrder
                    }).ToList(),
                    Hits = a.Hits
                        .Where(h => h.IsActive)
                        .OrderBy(h => h.DisplayOrder)
                        .Select(h => new ArtistHitDto
                        {
                            Id = h.Id,
                            Title = h.Title,
                            ImageUrl = h.ImageUrl,
                            YouTubeUrl = h.YouTubeUrl,
                            DisplayOrder = h.DisplayOrder,
                            IsActive = h.IsActive
                        }).ToList(),
                    Albums = a.Albums
                        .Where(al => al.IsActive)
                        .OrderBy(al => al.DisplayOrder)
                        .Select(al => new ArtistAlbumDto
                        {
                            Id = al.Id,
                            Title = al.Title,
                            CoverImageUrl = al.CoverImageUrl,
                            ReleaseYear = al.ReleaseYear,
                            ExternalUrl = al.ExternalUrl,
                            DisplayOrder = al.DisplayOrder,
                            IsActive = al.IsActive
                        }).ToList(),
                    SocialLinks = a.SocialLinks.Select(sl => new SocialLinkDto
                    {
                        Id = sl.Id,
                        Platform = sl.Platform,
                        Url = sl.Url
                    }).ToList(),
                    SongCount = 0,
                    ArticleCount = 0,
                    UpcomingEventCount = 0,
                    CreatedAt = a.CreatedAt
                })
                .FirstOrDefaultAsync();

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה ביצירת פרופיל אומן: {ex.Message}");
        }
    }

    // ========================================
    // Admin
    // ========================================

    /// <summary>
    /// יצירת אומן חדש (Admin בלבד)
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ArtistDetailDto>> CreateArtist([FromBody] UpdateArtistDto dto)
    {
        try
        {
            // וולידציה
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("שם האומן הוא שדה חובה");

            // בדיקה אם אומן בשם זה כבר קיים
            var existingArtist = await _context.Artists
                .FirstOrDefaultAsync(a => a.Name == dto.Name && !a.IsDeleted);

            if (existingArtist != null)
                return BadRequest("אומן בשם זה כבר קיים במערכת");

            // יצירת אומן חדש
            var richMediaError = ValidateArtistRichMedia(dto);
            if (richMediaError != null)
                return BadRequest(new { message = richMediaError });

            var artist = new Artist
            {
                Name = dto.Name,
                EnglishName = dto.EnglishName,
                ShortBio = dto.ShortBio,
                Biography = dto.Biography,
                ImageUrl = dto.ImageUrl,
                BannerImageUrl = dto.BannerImageUrl,
                BannerGifUrl = dto.BannerGifUrl,
                BannerMediaType = NormalizeBannerMediaType(dto.BannerMediaType),
                BannerBlur = dto.BannerBlur.HasValue ? Math.Clamp(dto.BannerBlur.Value, 0, 20) : 0,
                WebsiteUrl = dto.WebsiteUrl,
                Status = dto.Status ?? ArtistStatus.Pending,
                IsPremium = dto.IsPremium ?? false,
                IsVerified = false,
                DisplayOrder = 999,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false,
                PerformanceImageUrl = dto.PerformanceImageUrl,
                PerformanceTicketUrl = dto.PerformanceTicketUrl,
                PerformanceIsActive = dto.PerformanceIsActive ?? false
            };

            _context.Artists.Add(artist);
            await _context.SaveChangesAsync();

            // סנכרון אירוע מקושר (אחרי שמרנו את האמן כדי לקבל ID)
            await SyncPerformanceEventAsync(
                artist,
                artist.PerformanceIsActive ? dto.PerformanceEvent : null);
            await _context.SaveChangesAsync();

            // הוספת קישורים לרשתות חברתיות
            if (dto.SocialLinks != null && dto.SocialLinks.Any())
            {
                foreach (var link in dto.SocialLinks)
                {
                    _context.ArtistSocialLinks.Add(new ArtistSocialLink
                    {
                        ArtistId = artist.Id,
                        Platform = link.Platform,
                        Url = link.Url
                    });
                }
            }

            // הוספת תמונות לגלריה (Admin יכול להוסיף לכולם)
            if (dto.GalleryImages != null && dto.GalleryImages.Any())
            {
                foreach (var img in dto.GalleryImages)
                {
                    _context.ArtistGalleryImages.Add(new ArtistGalleryImage
                    {
                        ArtistId = artist.Id,
                        ImageUrl = img.ImageUrl,
                        Caption = img.Caption,
                        DisplayOrder = img.DisplayOrder
                    });
                }
            }

            // הוספת וידאו (Admin יכול להוסיף לכולם)
            if (dto.Videos != null && dto.Videos.Any())
            {
                foreach (var video in dto.Videos)
                {
                    _context.ArtistVideos.Add(new ArtistVideo
                    {
                        ArtistId = artist.Id,
                        VideoUrl = video.VideoUrl,
                        Title = video.Title,
                        DisplayOrder = video.DisplayOrder
                    });
                }
            }

            await SyncArtistHitsAsync(artist.Id, dto.Hits);
            await SyncArtistAlbumsAsync(artist.Id, dto.Albums);

            await _context.SaveChangesAsync();

            // החזרת פרטי האומן המלאים
            var result = await _context.Artists
                .Where(a => a.Id == artist.Id)
                .Select(a => new ArtistDetailDto
                {
                    Id = a.Id,
                    Name = a.Name,
                    EnglishName = a.EnglishName,
                    ShortBio = a.ShortBio,
                    Biography = a.Biography,
                    ImageUrl = a.ImageUrl,
                    BannerImageUrl = a.BannerImageUrl,
                    BannerGifUrl = a.BannerGifUrl,
                    WebsiteUrl = a.WebsiteUrl,
                    IsVerified = a.IsVerified,
                    IsPremium = a.IsPremium,
                    Status = a.Status,
                    UserId = a.UserId,
                    PerformanceImageUrl = a.PerformanceImageUrl,
                    PerformanceTicketUrl = a.PerformanceTicketUrl,
                    PerformanceIsActive = a.PerformanceIsActive,
                    GalleryImages = a.GalleryImages.Select(gi => new ArtistGalleryImageDto
                    {
                        Id = gi.Id,
                        ImageUrl = gi.ImageUrl,
                        Caption = gi.Caption,
                        DisplayOrder = gi.DisplayOrder
                    }).ToList(),
                    Videos = a.Videos.Select(v => new ArtistVideoDto
                    {
                        Id = v.Id,
                        VideoUrl = v.VideoUrl,
                        Title = v.Title,
                        DisplayOrder = v.DisplayOrder
                    }).ToList(),
                    Hits = a.Hits
                        .Where(h => h.IsActive)
                        .OrderBy(h => h.DisplayOrder)
                        .Select(h => new ArtistHitDto
                        {
                            Id = h.Id,
                            Title = h.Title,
                            ImageUrl = h.ImageUrl,
                            YouTubeUrl = h.YouTubeUrl,
                            DisplayOrder = h.DisplayOrder,
                            IsActive = h.IsActive
                        }).ToList(),
                    Albums = a.Albums
                        .Where(al => al.IsActive)
                        .OrderBy(al => al.DisplayOrder)
                        .Select(al => new ArtistAlbumDto
                        {
                            Id = al.Id,
                            Title = al.Title,
                            CoverImageUrl = al.CoverImageUrl,
                            ReleaseYear = al.ReleaseYear,
                            ExternalUrl = al.ExternalUrl,
                            DisplayOrder = al.DisplayOrder,
                            IsActive = al.IsActive
                        }).ToList(),
                    SocialLinks = a.SocialLinks.Select(sl => new SocialLinkDto
                    {
                        Id = sl.Id,
                        Platform = sl.Platform,
                        Url = sl.Url
                    }).ToList(),
                    SongCount = a.SongArtists.Count(sa => !sa.Song.IsDeleted && sa.Song.IsApproved),
                    ArticleCount = 0, // TODO: כשיהיה מודל כתבות
                    UpcomingEventCount = 0, // TODO: כשיהיה מודל אירועים
                    CreatedAt = a.CreatedAt
                })
                .FirstOrDefaultAsync();

            return CreatedAtAction(nameof(GetArtistById), new { id = artist.Id }, result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה ביצירת אומן: {ex.Message}");
        }
    }

    /// <summary>
    /// מחיקת אומן (Admin בלבד)
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteArtist(int id)
    {
        try
        {
            var artist = await _context.Artists.FindAsync(id);
            if (artist == null)
                return NotFound("אומן לא נמצא");

            artist.IsDeleted = true;
            await _context.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה במחיקת אומן: {ex.Message}");
        }
    }

    /// <summary>
    /// שכפול אומן (Admin בלבד)
    /// </summary>
    [HttpPost("{id}/duplicate")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ArtistDetailDto>> DuplicateArtist(int id)
    {
        try
        {
            var original = await _context.Artists
                .Include(a => a.GalleryImages)
                .Include(a => a.Videos)
                .Include(a => a.Hits)
                .Include(a => a.Albums)
                .Include(a => a.SocialLinks)
                .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

            if (original == null)
                return NotFound("אומן לא נמצא");

            var newArtist = new Artist
            {
                UserId = null,
                Name = original.Name + " - עותק",
                EnglishName = original.EnglishName,
                ShortBio = original.ShortBio,
                Biography = original.Biography,
                ImageUrl = original.ImageUrl,
                BannerImageUrl = original.BannerImageUrl,
                BannerGifUrl = original.BannerGifUrl,
                WebsiteUrl = original.WebsiteUrl,
                Status = ArtistStatus.Pending,
                IsPremium = false,
                IsVerified = false,
                IsPrimaryProfile = false,
                Tier = ProfileTier.Free,
                DisplayOrder = 999,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

            _context.Artists.Add(newArtist);
            await _context.SaveChangesAsync();

            // Copy social links
            foreach (var link in original.SocialLinks)
            {
                _context.ArtistSocialLinks.Add(new ArtistSocialLink
                {
                    ArtistId = newArtist.Id,
                    Platform = link.Platform,
                    Url = link.Url
                });
            }

            // Copy gallery images
            foreach (var img in original.GalleryImages)
            {
                _context.ArtistGalleryImages.Add(new ArtistGalleryImage
                {
                    ArtistId = newArtist.Id,
                    ImageUrl = img.ImageUrl,
                    Caption = img.Caption,
                    DisplayOrder = img.DisplayOrder,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // Copy videos
            foreach (var video in original.Videos)
            {
                _context.ArtistVideos.Add(new ArtistVideo
                {
                    ArtistId = newArtist.Id,
                    VideoUrl = video.VideoUrl,
                    Title = video.Title,
                    DisplayOrder = video.DisplayOrder,
                    CreatedAt = DateTime.UtcNow
                });
            }

            foreach (var hit in original.Hits)
            {
                _context.ArtistHits.Add(new ArtistHit
                {
                    ArtistId = newArtist.Id,
                    Title = hit.Title,
                    ImageUrl = hit.ImageUrl,
                    YouTubeUrl = hit.YouTubeUrl,
                    DisplayOrder = hit.DisplayOrder,
                    IsActive = hit.IsActive,
                    CreatedAt = DateTime.UtcNow
                });
            }

            foreach (var album in original.Albums)
            {
                _context.ArtistAlbums.Add(new ArtistAlbum
                {
                    ArtistId = newArtist.Id,
                    Title = album.Title,
                    CoverImageUrl = album.CoverImageUrl,
                    ReleaseYear = album.ReleaseYear,
                    ExternalUrl = album.ExternalUrl,
                    DisplayOrder = album.DisplayOrder,
                    IsActive = album.IsActive,
                    CreatedAt = DateTime.UtcNow
                });
            }

            await _context.SaveChangesAsync();

            var result = await _context.Artists
                .Include(a => a.GalleryImages.OrderBy(gi => gi.DisplayOrder))
                .Include(a => a.Videos.OrderBy(v => v.DisplayOrder))
                .Include(a => a.Hits.OrderBy(h => h.DisplayOrder))
                .Include(a => a.Albums.OrderBy(al => al.DisplayOrder))
                .Include(a => a.SocialLinks)
                .Where(a => a.Id == newArtist.Id)
                .Select(a => new ArtistDetailDto
                {
                    Id = a.Id,
                    Name = a.Name,
                    EnglishName = a.EnglishName,
                    ShortBio = a.ShortBio,
                    Biography = a.Biography,
                    ImageUrl = a.ImageUrl,
                    BannerImageUrl = a.BannerImageUrl,
                    BannerGifUrl = a.BannerGifUrl,
                    WebsiteUrl = a.WebsiteUrl,
                    IsVerified = a.IsVerified,
                    IsPremium = a.IsPremium,
                    Status = a.Status,
                    UserId = a.UserId,
                    PerformanceImageUrl = a.PerformanceImageUrl,
                    PerformanceTicketUrl = a.PerformanceTicketUrl,
                    PerformanceIsActive = a.PerformanceIsActive,
                    GalleryImages = a.GalleryImages.Select(gi => new ArtistGalleryImageDto
                    {
                        Id = gi.Id,
                        ImageUrl = gi.ImageUrl,
                        Caption = gi.Caption,
                        DisplayOrder = gi.DisplayOrder
                    }).ToList(),
                    Videos = a.Videos.Select(v => new ArtistVideoDto
                    {
                        Id = v.Id,
                        VideoUrl = v.VideoUrl,
                        Title = v.Title,
                        DisplayOrder = v.DisplayOrder
                    }).ToList(),
                    Hits = a.Hits
                        .Where(h => h.IsActive)
                        .OrderBy(h => h.DisplayOrder)
                        .Select(h => new ArtistHitDto
                        {
                            Id = h.Id,
                            Title = h.Title,
                            ImageUrl = h.ImageUrl,
                            YouTubeUrl = h.YouTubeUrl,
                            DisplayOrder = h.DisplayOrder,
                            IsActive = h.IsActive
                        }).ToList(),
                    Albums = a.Albums
                        .Where(al => al.IsActive)
                        .OrderBy(al => al.DisplayOrder)
                        .Select(al => new ArtistAlbumDto
                        {
                            Id = al.Id,
                            Title = al.Title,
                            CoverImageUrl = al.CoverImageUrl,
                            ReleaseYear = al.ReleaseYear,
                            ExternalUrl = al.ExternalUrl,
                            DisplayOrder = al.DisplayOrder,
                            IsActive = al.IsActive
                        }).ToList(),
                    SocialLinks = a.SocialLinks.Select(sl => new SocialLinkDto
                    {
                        Id = sl.Id,
                        Platform = sl.Platform,
                        Url = sl.Url
                    }).ToList(),
                    SongCount = 0,
                    ArticleCount = 0,
                    UpcomingEventCount = 0,
                    CreatedAt = a.CreatedAt
                })
                .FirstOrDefaultAsync();

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה בשכפול אומן: {ex.Message}");
        }
    }

    // ========================================
    // Helpers - באנר ואירוע מקושר
    // ========================================

    private static string? NormalizeBannerMediaType(string? type)
    {
        if (string.IsNullOrWhiteSpace(type)) return null;
        var t = type.Trim().ToLowerInvariant();
        return t switch
        {
            "image" or "gif" or "video" => t,
            _ => null
        };
    }

    private static string? FirstText(params string?[] values)
    {
        return values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim();
    }

    private static string? ValidateArtistRichMedia(UpdateArtistDto dto)
    {
        if (dto.PerformanceIsActive == true)
        {
            var performance = dto.PerformanceEvent;
            if (performance == null)
                return "יש למלא פרטי הופעה לפני שמירה";

            if (string.IsNullOrWhiteSpace(performance.ImageUrl) &&
                string.IsNullOrWhiteSpace(performance.BannerImageUrl) &&
                string.IsNullOrWhiteSpace(dto.PerformanceImageUrl))
                return "בבאנר הופעה יש להוסיף תמונה לפני שמירה";
        }

        if (dto.Hits != null)
        {
            for (var i = 0; i < dto.Hits.Count; i++)
            {
                var hit = dto.Hits[i];
                var isBlank = string.IsNullOrWhiteSpace(hit.Title) &&
                    string.IsNullOrWhiteSpace(hit.ImageUrl) &&
                    string.IsNullOrWhiteSpace(hit.YouTubeUrl);
                var isComplete = !string.IsNullOrWhiteSpace(hit.YouTubeUrl);

                if (!isBlank && !isComplete)
                    return $"להיט מספר {i + 1}: יש למלא קישור YouTube, או למחוק את השורה";
            }
        }

        if (dto.Albums != null)
        {
            for (var i = 0; i < dto.Albums.Count; i++)
            {
                var album = dto.Albums[i];
                var isBlank = string.IsNullOrWhiteSpace(album.Title) &&
                    string.IsNullOrWhiteSpace(album.CoverImageUrl) &&
                    string.IsNullOrWhiteSpace(album.ExternalUrl) &&
                    !album.ReleaseYear.HasValue;
                var isComplete = !string.IsNullOrWhiteSpace(album.CoverImageUrl);

                if (!isBlank && !isComplete)
                    return $"אלבום מספר {i + 1}: יש להוסיף תמונת עטיפה, או למחוק את השורה";
            }
        }

        return null;
    }

    private async Task SyncArtistHitsAsync(int artistId, List<AddArtistHitDto>? hits)
    {
        if (hits == null) return;

        var existingHits = await _context.ArtistHits
            .Where(hit => hit.ArtistId == artistId)
            .ToListAsync();
        _context.ArtistHits.RemoveRange(existingHits);

        foreach (var hit in hits.Where(h => !string.IsNullOrWhiteSpace(h.YouTubeUrl)))
        {
            _context.ArtistHits.Add(new ArtistHit
            {
                ArtistId = artistId,
                Title = string.IsNullOrWhiteSpace(hit.Title) ? "להיט גדול" : hit.Title.Trim(),
                ImageUrl = string.IsNullOrWhiteSpace(hit.ImageUrl) ? null : hit.ImageUrl.Trim(),
                YouTubeUrl = hit.YouTubeUrl.Trim(),
                DisplayOrder = hit.DisplayOrder,
                IsActive = hit.IsActive,
                CreatedAt = DateTime.UtcNow
            });
        }
    }

    private async Task SyncArtistAlbumsAsync(int artistId, List<AddArtistAlbumDto>? albums)
    {
        if (albums == null) return;

        var existingAlbums = await _context.ArtistAlbums
            .Where(album => album.ArtistId == artistId)
            .ToListAsync();
        _context.ArtistAlbums.RemoveRange(existingAlbums);

        foreach (var album in albums.Where(a => !string.IsNullOrWhiteSpace(a.CoverImageUrl)))
        {
            _context.ArtistAlbums.Add(new ArtistAlbum
            {
                ArtistId = artistId,
                Title = string.IsNullOrWhiteSpace(album.Title) ? "אלבום" : album.Title.Trim(),
                CoverImageUrl = album.CoverImageUrl.Trim(),
                ReleaseYear = album.ReleaseYear,
                ExternalUrl = string.IsNullOrWhiteSpace(album.ExternalUrl) ? string.Empty : album.ExternalUrl.Trim(),
                DisplayOrder = album.DisplayOrder,
                IsActive = album.IsActive,
                CreatedAt = DateTime.UtcNow
            });
        }
    }

    /// <summary>
    /// יצירה/עדכון/ניתוק של אירוע מקושר לבאנר אמן.
    /// כשהאירוע נוצר/מעודכן, מבטיחים שהוא מתויג כ-EventArtist של האמן
    /// כדי שיופיע גם בדף ההופעות הראשי וגם בדף האמן עצמו.
    /// </summary>
    private async Task SyncPerformanceEventAsync(Artist artist, PerformanceEventInputDto? input)
    {
        if (input == null)
        {
            // ניתוק האירוע (ללא מחיקה — האירוע עצמו נשמר במערכת)
            artist.PerformanceEventId = null;
            artist.PerformanceIsActive = false;
            artist.PerformanceImageUrl = null;
            artist.PerformanceTicketUrl = null;
            return;
        }

        var imageUrl = FirstText(input.ImageUrl, input.BannerImageUrl, artist.PerformanceImageUrl) ?? string.Empty;
        var bannerImageUrl = FirstText(input.BannerImageUrl, input.ImageUrl, artist.PerformanceImageUrl);
        var ticketUrl = FirstText(input.TicketUrl, artist.PerformanceTicketUrl) ?? string.Empty;
        var eventDate = input.EventDate == default ? DateTime.UtcNow : input.EventDate;
        Event? eventEntity = null;

        if (input.EventId.HasValue)
        {
            eventEntity = await _context.Events
                .Include(e => e.EventArtists)
                .FirstOrDefaultAsync(e => e.Id == input.EventId.Value && !e.IsDeleted);
        }

        if (eventEntity == null)
        {
            eventEntity = new Event
            {
                Name = string.IsNullOrWhiteSpace(input.Name) ? artist.Name : input.Name.Trim(),
                Description = input.Description?.Trim(),
                ImageUrl = imageUrl,
                BannerImageUrl = bannerImageUrl,
                TicketUrl = ticketUrl,
                EventDate = eventDate,
                Location = input.Location?.Trim(),
                Price = input.Price,
                ArtistName = artist.Name,
                IsActive = input.IsActive,
                CreatedAt = DateTime.UtcNow,
                EventArtists = new List<EventArtist>()
            };
            _context.Events.Add(eventEntity);
            await _context.SaveChangesAsync(); // לקבל Id
        }
        else
        {
            eventEntity.Name = string.IsNullOrWhiteSpace(input.Name) ? eventEntity.Name : input.Name.Trim();
            eventEntity.Description = input.Description?.Trim();
            eventEntity.ImageUrl = imageUrl;
            eventEntity.BannerImageUrl = bannerImageUrl;
            eventEntity.TicketUrl = ticketUrl;
            eventEntity.EventDate = eventDate;
            eventEntity.Location = input.Location?.Trim();
            eventEntity.Price = input.Price;
            eventEntity.IsActive = input.IsActive;
            eventEntity.UpdatedAt = DateTime.UtcNow;
        }

        // לוודא תיוג של האמן באירוע
        var alreadyTagged = await _context.EventArtists
            .AnyAsync(ea => ea.EventId == eventEntity.Id && ea.ArtistId == artist.Id);
        if (!alreadyTagged && artist.Id > 0)
        {
            _context.EventArtists.Add(new EventArtist
            {
                EventId = eventEntity.Id,
                ArtistId = artist.Id,
                CreatedAt = DateTime.UtcNow
            });
        }

        artist.PerformanceEventId = eventEntity.Id;
        artist.PerformanceIsActive = input.IsActive;
        artist.PerformanceImageUrl = bannerImageUrl ?? imageUrl;
        artist.PerformanceTicketUrl = ticketUrl;
    }

    /// <summary>
    /// שינוי סטטוס אומן (Admin בלבד)
    /// </summary>
    [HttpPut("{id}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateArtistStatus(int id, [FromBody] ArtistStatus status)
    {
        try
        {
            var artist = await _context.Artists.FindAsync(id);
            if (artist == null)
                return NotFound("אומן לא נמצא");

            var wasActive = artist.Status == ArtistStatus.Active;
            artist.Status = status;
            await _context.SaveChangesAsync();

            if (!wasActive && status == ArtistStatus.Active && artist.UserId.HasValue)
            {
                await _notificationService.NotifyArtistApprovedAsync(artist.UserId.Value, artist.Id, artist.Name);
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה בעדכון סטטוס: {ex.Message}");
        }
    }
}

public class ArtistWithCountDto : ArtistBasicDto
{
    public int SongCount { get; set; }
}

public class ArtistSongItemDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public int ViewCount { get; set; }
}

public class ArtistEventItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public string TicketUrl { get; set; } = string.Empty;
    public DateTime EventDate { get; set; }
    public string? Location { get; set; }
}
