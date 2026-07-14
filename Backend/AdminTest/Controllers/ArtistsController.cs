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
    private const int MaxManagedPagesPerUser = 5;
    private readonly AkordishKeitDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly ISongService _songService;
    private readonly IArticleService _articleService;
    private readonly IExternalImageStorageService _externalImageStorage;
    private readonly IDisplayRankingService _rankingService;
    private readonly ILogger<ArtistsController> _logger;

    public ArtistsController(
        AkordishKeitDbContext context,
        INotificationService notificationService,
        ISongService songService,
        IArticleService articleService,
        IExternalImageStorageService externalImageStorage,
        IDisplayRankingService rankingService,
        ILogger<ArtistsController> logger)
    {
        _context = context;
        _notificationService = notificationService;
        _songService = songService;
        _articleService = articleService;
        _externalImageStorage = externalImageStorage;
        _rankingService = rankingService;
        _logger = logger;
    }

    [HttpGet("{id}/podcast-episodes")]
    public async Task<ActionResult<List<PodcastEpisodeDto>>> GetArtistPodcastEpisodes(int id, [FromQuery] int limit = 12)
    {
        try
        {
            limit = Math.Clamp(limit, 1, 48);
            var mentionTypePattern = MentionTypePattern("artist");
            var mentionIdPattern = MentionIdPattern(id);
            var artistHrefExactPattern = ArtistHrefExactPattern(id);
            var artistHrefSlugPattern = ArtistHrefSlugPattern(id);

            var episodes = await _context.PodcastEpisodes
                .AsNoTracking()
                .Where(e => !e.IsDeleted
                    && e.IsActive
                    && !e.Podcast.IsDeleted
                    && e.Podcast.IsActive
                    && (e.PodcastEpisodeArtists.Any(pa => pa.ArtistId == id)
                        || (EF.Functions.Like(e.Description, mentionTypePattern)
                            && EF.Functions.Like(e.Description, mentionIdPattern))
                        || EF.Functions.Like(e.Description, artistHrefExactPattern)
                        || EF.Functions.Like(e.Description, artistHrefSlugPattern)))
                .OrderByDescending(e => e.PublishedAt)
                .ThenByDescending(e => e.Id)
                .Take(limit)
                .Select(e => new PodcastEpisodeDto
                {
                    Id = e.Id,
                    PodcastId = e.PodcastId,
                    PodcastName = e.Podcast.Name,
                    PodcastSlug = e.Podcast.Slug,
                    Title = e.Title,
                    Slug = e.Slug,
                    Description = e.Description,
                    EpisodeNumber = e.EpisodeNumber,
                    SourceUrl = e.SourceUrl,
                    EmbedUrl = e.EmbedUrl,
                    ThumbnailUrl = e.ThumbnailUrl,
                    Platform = e.Platform,
                    ViewCount = e.ViewCount,
                    PublishedAt = e.PublishedAt,
                    DisplayOrder = e.DisplayOrder,
                    IsActive = e.IsActive,
                    CreatedAt = e.CreatedAt,
                    UpdatedAt = e.UpdatedAt,
                    TaggedArtists = e.PodcastEpisodeArtists
                        .Select(tag => new PodcastEpisodeArtistDto
                        {
                            ArtistId = tag.ArtistId,
                            ArtistName = tag.Artist.Name,
                            ArtistImageUrl = tag.Artist.ImageUrl
                        })
                        .ToList()
                })
                .ToListAsync();

            return Ok(episodes);
        }
        catch (Exception)
        {
            return StatusCode(500, "שגיאה בטעינת פרקי פודקאסט");
        }
    }

    // ========================================

    [HttpGet]
    public async Task<ActionResult<PagedResult<ArtistListDto>>> GetArtists(
        [FromQuery] bool? isPremium = null,
        [FromQuery] ArtistStatus? status = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string sortBy = "smart",
        [FromQuery] string? search = null,
        [FromQuery] bool includeDrafts = false)
    {
        try
        {
            var allowDrafts = includeDrafts && User.IsInRole("Admin");
            var query = _context.Artists
                .Where(a => !a.IsDeleted && (allowDrafts || a.Status != ArtistStatus.Draft));

            if (status.HasValue)
                query = query.Where(a => a.Status == status.Value);

            if (isPremium.HasValue)
                query = query.Where(a => a.IsPremium == isPremium.Value);

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(a => a.Name.Contains(search));

            var totalCount = await query.CountAsync();

            query = _rankingService.ApplyArtistOrdering(query, sortBy, ContentPromotionPlacement.Index);

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
                    IsFeatured = a.IsFeatured,
                    SongCount = a.SongArtists.Count(sa => !sa.Song.IsDeleted && sa.Song.IsApproved),
                    Status = a.Status,
                    CreatedAt = a.CreatedAt,
                    BumpedAt = a.BumpedAt,
                    BumpCount = a.BumpCount
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
        catch (Exception)
        {
            return StatusCode(500, "שגיאה בטעינת אומנים");
        }
    }

    [HttpGet("featured")]
    public async Task<ActionResult<List<ArtistListDto>>> GetFeaturedArtists([FromQuery] int count = 10)
    {
        try
        {
            var now = DateTime.UtcNow;
            var artists = await _context.Artists
                .Where(a => !a.IsDeleted && a.Status == ArtistStatus.Active)
                .Where(a => a.IsFeatured || a.IsPremium || a.LastBoostDate.HasValue || _context.ContentPromotions.Any(p =>
                    p.TargetType == ContentPromotionTargetType.Artist
                    && p.TargetId == a.Id
                    && p.IsActive
                    && (!p.StartsAt.HasValue || p.StartsAt.Value <= now)
                    && (!p.EndsAt.HasValue || p.EndsAt.Value >= now)
                    && (p.Placement == ContentPromotionPlacement.Home || p.Placement == ContentPromotionPlacement.Featured || p.Placement == ContentPromotionPlacement.General || p.ShowOnHome)))
                .OrderByDescending(a => _context.ContentPromotions
                    .Where(p => p.TargetType == ContentPromotionTargetType.Artist
                        && p.TargetId == a.Id
                        && p.IsActive
                        && (!p.StartsAt.HasValue || p.StartsAt.Value <= now)
                        && (!p.EndsAt.HasValue || p.EndsAt.Value >= now)
                        && (p.Placement == ContentPromotionPlacement.Home || p.Placement == ContentPromotionPlacement.Featured || p.Placement == ContentPromotionPlacement.General || p.ShowOnHome))
                    .Select(p => (int?)p.Priority)
                    .Max() ?? -1)
                .ThenByDescending(a => a.IsFeatured)
                .ThenByDescending(a => a.IsPremium)
                .ThenByDescending(a => a.LastBoostDate)
                .ThenBy(a => a.DisplayOrder)
                .ThenBy(a => a.Name)
                .Take(count)
                .Select(a => new ArtistListDto
                {
                    Id = a.Id,
                    Name = a.Name,
                    ShortBio = a.ShortBio,
                    ImageUrl = a.ImageUrl,
                    IsVerified = a.IsVerified,
                    IsPremium = a.IsPremium,
                    IsFeatured = a.IsFeatured,
                    SongCount = a.SongArtists.Count(sa => !sa.Song.IsDeleted && sa.Song.IsApproved),
                    Status = a.Status,
                    CreatedAt = a.CreatedAt,
                    BumpedAt = a.BumpedAt,
                    BumpCount = a.BumpCount
                })
                .ToListAsync();

            return Ok(artists);
        }
        catch (Exception)
        {
            return StatusCode(500, "שגיאה בטעינת אומנים מומלצים");
        }
    }

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
        catch (Exception)
        {
            return StatusCode(500, "אירעה שגיאה בטעינת האמנים המובילים");
        }
    }

    // ========================================

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

            if (artist.Status == ArtistStatus.Draft && !User.IsInRole("Admin"))
                return NotFound("אומן לא נמצא");

            var now = DateTime.UtcNow;
            var mentionTypePattern = MentionTypePattern("artist");
            var mentionIdPattern = MentionIdPattern(id);
            var artistHrefExactPattern = ArtistHrefExactPattern(id);
            var artistHrefSlugPattern = ArtistHrefSlugPattern(id);

            var songCount = await _context.Songs
                .Where(s => !s.IsDeleted
                    && s.IsApproved
                    && (s.SongArtists.Any(sa => sa.ArtistId == id)
                        || (s.UploaderProfileType == "artist" && s.UploaderProfileId == id)
                        || (EF.Functions.Like(s.LyricsWithChords, mentionTypePattern)
                            && EF.Functions.Like(s.LyricsWithChords, mentionIdPattern))
                        || EF.Functions.Like(s.LyricsWithChords, artistHrefExactPattern)
                        || EF.Functions.Like(s.LyricsWithChords, artistHrefSlugPattern)))
                .CountAsync();

            var articleCount = await _context.Articles
                .Where(a => !a.IsDeleted
                    && a.Status == (int)ArticleStatus.Published
                    && a.PublishDate <= now
                    && (a.ArticleArtists.Any(aa => aa.ArtistId == id)
                        || (a.UploaderProfileType == "artist" && a.UploaderProfileId == id)
                        || (EF.Functions.Like(a.Content, mentionTypePattern)
                            && EF.Functions.Like(a.Content, mentionIdPattern))
                        || EF.Functions.Like(a.Content, artistHrefExactPattern)
                        || EF.Functions.Like(a.Content, artistHrefSlugPattern)))
                .CountAsync();

            var today = now.Date;

            var upcomingEventCount = await _context.Events
                .Where(e => e.EventDate.Date >= today
                    && !e.IsDeleted
                    && e.IsActive
                    && (e.EventArtists.Any(ea => ea.ArtistId == id)
                        || (EF.Functions.Like(e.Description, mentionTypePattern)
                            && EF.Functions.Like(e.Description, mentionIdPattern))
                        || EF.Functions.Like(e.Description, artistHrefExactPattern)
                        || EF.Functions.Like(e.Description, artistHrefSlugPattern)))
                .CountAsync();

            var podcastEpisodeCount = await _context.PodcastEpisodes
                .Where(e => !e.IsDeleted
                    && e.IsActive
                    && !e.Podcast.IsDeleted
                    && e.Podcast.IsActive
                    && (e.PodcastEpisodeArtists.Any(pa => pa.ArtistId == id)
                        || (EF.Functions.Like(e.Description, mentionTypePattern)
                            && EF.Functions.Like(e.Description, mentionIdPattern))
                        || EF.Functions.Like(e.Description, artistHrefExactPattern)
                        || EF.Functions.Like(e.Description, artistHrefSlugPattern)))
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
                IsFeatured = artist.IsFeatured,
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
                PodcastEpisodeCount = podcastEpisodeCount,
                CreatedAt = artist.CreatedAt
            };

            return Ok(result);
        }
        catch (Exception)
        {
            return StatusCode(500, "שגיאה בטעינת פרטי אומן");
        }
    }

    [HttpGet("{id}/songs")]
    public async Task<ActionResult<PagedResult<ArtistSongItemDto>>> GetArtistSongs(
        int id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        try
        {
            var mentionTypePattern = MentionTypePattern("artist");
            var mentionIdPattern = MentionIdPattern(id);
            var artistHrefExactPattern = ArtistHrefExactPattern(id);
            var artistHrefSlugPattern = ArtistHrefSlugPattern(id);
            var query = _context.Songs
                .AsNoTracking()
                .Where(s => !s.IsDeleted
                    && s.IsApproved
                    && (s.SongArtists.Any(sa => sa.ArtistId == id)
                        || (s.UploaderProfileType == "artist" && s.UploaderProfileId == id)
                        || (EF.Functions.Like(s.LyricsWithChords, mentionTypePattern)
                            && EF.Functions.Like(s.LyricsWithChords, mentionIdPattern))
                        || EF.Functions.Like(s.LyricsWithChords, artistHrefExactPattern)
                        || EF.Functions.Like(s.LyricsWithChords, artistHrefSlugPattern)));

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
        catch (Exception)
        {
            return StatusCode(500, "שגיאה בטעינת שירים");
        }
    }

    [HttpGet("{id}/articles")]
    public async Task<ActionResult<PagedResult<ArticleDto>>> GetArtistArticles(
        int id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        try
        {
            var now = DateTime.UtcNow;
            var mentionTypePattern = MentionTypePattern("artist");
            var mentionIdPattern = MentionIdPattern(id);
            var artistHrefExactPattern = ArtistHrefExactPattern(id);
            var artistHrefSlugPattern = ArtistHrefSlugPattern(id);
            var query = _context.Articles
                .AsNoTracking()
                .Include(a => a.ArticleCategories)
                    .ThenInclude(ac => ac.Category)
                .Where(a => (a.ArticleArtists.Any(aa => aa.ArtistId == id)
                        || (a.UploaderProfileType == "artist" && a.UploaderProfileId == id)
                        || (EF.Functions.Like(a.Content, mentionTypePattern)
                            && EF.Functions.Like(a.Content, mentionIdPattern))
                        || EF.Functions.Like(a.Content, artistHrefExactPattern)
                        || EF.Functions.Like(a.Content, artistHrefSlugPattern))
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
        catch (Exception)
        {
            return StatusCode(500, "שגיאה בטעינת כתבות");
        }
    }

    private static string MentionTypePattern(string profileType)
    {
        return $@"%data-mention-type=""{profileType}""%";
    }

    private static string MentionIdPattern(int profileId)
    {
        return $@"%data-mention-id=""{profileId}""%";
    }

    private static string ArtistHrefExactPattern(int artistId)
    {
        return $@"%/artist/{artistId}""%";
    }

    private static string ArtistHrefSlugPattern(int artistId)
    {
        return $@"%/artist/{artistId}/%";
    }

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
            var today = DateTime.UtcNow.Date;
            var mentionTypePattern = MentionTypePattern("artist");
            var mentionIdPattern = MentionIdPattern(id);
            var artistHrefExactPattern = ArtistHrefExactPattern(id);
            var artistHrefSlugPattern = ArtistHrefSlugPattern(id);

            var events = await _context.Events
                .AsNoTracking()
                .Where(e => e.EventDate.Date >= today
                    && !e.IsDeleted
                    && e.IsActive
                    && (e.EventArtists.Any(ea => ea.ArtistId == id)
                        || (EF.Functions.Like(e.Description, mentionTypePattern)
                            && EF.Functions.Like(e.Description, mentionIdPattern))
                        || EF.Functions.Like(e.Description, artistHrefExactPattern)
                        || EF.Functions.Like(e.Description, artistHrefSlugPattern)))
                .OrderBy(e => e.EventDate)
                .Select(e => new ArtistEventItemDto
                {
                    Id = e.Id,
                    Name = e.Name,
                    ImageUrl = e.ImageUrl,
                    TicketUrl = e.TicketUrl,
                    EventDate = e.EventDate,
                    Location = e.Location,
                    ArtistName = e.ArtistName,
                    TaggedArtistNames = e.EventArtists
                        .Select(eventArtist => eventArtist.Artist.Name)
                        .ToList(),
                    DaysUntilEvent = (e.EventDate.Date - today).Days,
                    EventStatus = e.EventDate.Date == today
                        ? "היום"
                        : $"עוד {(e.EventDate.Date - today).Days} ימים"
                })
                .ToListAsync();

            return Ok(events);
        }
        catch (Exception)
        {
            return StatusCode(500, "שגיאה בטעינת הופעות");
        }
    }

    // ========================================

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
            var previousStatus = artist.Status;
            var wasActive = previousStatus == ArtistStatus.Active;

            var richMediaError = ValidateArtistRichMedia(dto, isAdmin && dto.Status == ArtistStatus.Draft);
            if (richMediaError != null)
                return BadRequest(new { message = richMediaError });

            if (!string.IsNullOrWhiteSpace(dto.Name))
                artist.Name = dto.Name.Trim();

            if (!string.IsNullOrWhiteSpace(dto.EnglishName))
                artist.EnglishName = dto.EnglishName;

            artist.ShortBio = dto.ShortBio;
            artist.Biography = dto.Biography;
            artist.ImageUrl = await _externalImageStorage.StoreExternalImageIfNeededAsync(
                dto.ImageUrl,
                "uploads/artists",
                $"artist-{id}");
            artist.BannerImageUrl = await _externalImageStorage.StoreExternalImageIfNeededAsync(
                dto.BannerImageUrl,
                "uploads/artists",
                $"artist-banner-{id}");
            artist.BannerGifUrl = dto.BannerGifUrl;
            artist.BannerMediaType = NormalizeBannerMediaType(dto.BannerMediaType);
            if (dto.BannerBlur.HasValue)
                artist.BannerBlur = Math.Clamp(dto.BannerBlur.Value, 0, 20);
            artist.WebsiteUrl = dto.WebsiteUrl;

            artist.PerformanceImageUrl = await _externalImageStorage.StoreExternalImageIfNeededAsync(
                dto.PerformanceImageUrl,
                "uploads/artists",
                $"artist-performance-{id}");
            artist.PerformanceTicketUrl = dto.PerformanceTicketUrl;
            if (dto.PerformanceIsActive.HasValue)
                artist.PerformanceIsActive = dto.PerformanceIsActive.Value;

            if (dto.PerformanceIsActive == true)
                await SyncPerformanceEventAsync(artist, dto.PerformanceEvent);
            else if (dto.PerformanceIsActive == false)
                await SyncPerformanceEventAsync(artist, null);

            if (isAdmin)
            {
                if (dto.Status.HasValue)
                    artist.Status = dto.Status.Value;

                if (dto.IsPremium.HasValue)
                    artist.IsPremium = dto.IsPremium.Value;

                if (dto.IsFeatured.HasValue)
                    artist.IsFeatured = dto.IsFeatured.Value;
            }

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

            if (dto.GalleryImages != null)
            {
                var existingImages = await _context.ArtistGalleryImages
                    .Where(gi => gi.ArtistId == id)
                    .ToListAsync();
                _context.ArtistGalleryImages.RemoveRange(existingImages);

                foreach (var img in dto.GalleryImages)
                {
                    var imageUrl = await _externalImageStorage.StoreExternalImageIfNeededAsync(
                        img.ImageUrl,
                        "uploads/artists/gallery",
                        $"artist-gallery-{id}");

                    _context.ArtistGalleryImages.Add(new ArtistGalleryImage
                    {
                        ArtistId = id,
                        ImageUrl = imageUrl ?? img.ImageUrl,
                        Caption = img.Caption,
                        DisplayOrder = img.DisplayOrder
                    });
                }
            }

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

            var preserveIncompleteDraftItems = isAdmin && artist.Status == ArtistStatus.Draft;
            await SyncArtistHitsAsync(id, dto.Hits, preserveIncompleteDraftItems);
            await SyncArtistAlbumsAsync(id, dto.Albums, preserveIncompleteDraftItems);

            await _context.SaveChangesAsync();

            if (isAdmin && !wasActive && artist.Status == ArtistStatus.Active && artist.UserId.HasValue)
            {
                await _notificationService.NotifyArtistApprovedAsync(artist.UserId.Value, artist.Id, artist.Name);
            }
            else if (isAdmin && previousStatus != ArtistStatus.Hidden && artist.Status == ArtistStatus.Hidden && artist.UserId.HasValue)
            {
                await _notificationService.NotifyArtistRejectedAsync(artist.UserId.Value, artist.Id, artist.Name);
            }

            return NoContent();
        }
        catch (Exception)
        {
            return StatusCode(500, "שגיאה בעדכון אומן");
        }
    }

    // ========================================

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
        catch (Exception)
        {
            return StatusCode(500, "שגיאה בהוספת תמונה");
        }
    }

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
        catch (Exception)
        {
            return StatusCode(500, "שגיאה במחיקת תמונה");
        }
    }

    // ========================================

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
        catch (Exception)
        {
            return StatusCode(500, "שגיאה בהוספת וידאו");
        }
    }

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
        catch (Exception)
        {
            return StatusCode(500, "שגיאה במחיקת וידאו");
        }
    }

    // ========================================

    [HttpPost("{id}/boost")]
    [Authorize]
    public async Task<ActionResult<BoostArtistResponse>> BoostArtist(int id)
    {
        try
        {
            var artist = await _context.Artists.FindAsync(id);
            if (artist == null)
                return NotFound("אומן לא נמצא");


            artist.LastBoostDate = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new BoostArtistResponse
            {
                Success = true,
                Message = "האומן קודם בהצלחה!",
                BoostEndDate = DateTime.UtcNow.AddMonths(1)
            });
        }
        catch (Exception)
        {
            return StatusCode(500, "שגיאה בקידום אומן");
        }
    }

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


            return Ok(new UpgradeToPremiumResponse
            {
                Success = true,
                Message = "נא להמתין להפניה לעמוד התשלום",
                PaymentUrl = "/payment/premium-artist"
            });
        }
        catch (Exception)
        {
            return StatusCode(500, "שגיאה בשדרוג חשבון");
        }
    }

    // ========================================

    [HttpPost("create-profile")]
    [Authorize]
    public async Task<ActionResult<ArtistDetailDto>> CreateArtistProfile([FromBody] UpdateArtistDto dto)
    {
        try
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                return Unauthorized("משתמש לא מזוהה");

            var isDraft = dto.Status == ArtistStatus.Draft;
            if (string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("שם האומן הוא שדה חובה");
            var artistName = dto.Name.Trim();

            var existingArtist = await _context.Artists
                .FirstOrDefaultAsync(a => a.UserId == userId && a.Name == artistName && !a.IsDeleted);

            if (existingArtist != null)
                return BadRequest("כבר יצרת אומן בשם זה");

            var managedPagesCount = await CountManagedPagesAsync(userId);
            if (managedPagesCount >= MaxManagedPagesPerUser)
                return BadRequest($"אפשר לנהל עד {MaxManagedPagesPerUser} דפים בלבד");

            var activeSubscription = await _context.Subscriptions
                .Where(s => s.UserId == userId)
                .Where(s => s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trial)
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            bool isPrimaryProfile = managedPagesCount == 0;

            bool isPremium = activeSubscription?.Plan == SubscriptionPlan.Premium;

            var richMediaError = ValidateArtistRichMedia(dto, isDraft);
            if (richMediaError != null)
                return BadRequest(new { message = richMediaError });

            var artist = new Artist
            {
                UserId = userId,
                Name = artistName,
                EnglishName = dto.EnglishName,
                ShortBio = dto.ShortBio,
                Biography = dto.Biography,
                ImageUrl = dto.ImageUrl,
                WebsiteUrl = dto.WebsiteUrl,
                IsPrimaryProfile = isPrimaryProfile,
                IsPremium = isPremium,
                IsFeatured = false,
                Status = isDraft ? ArtistStatus.Draft : ArtistStatus.Pending,
                IsVerified = false,
                DisplayOrder = 999,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

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
                !isDraft && artist.PerformanceIsActive ? dto.PerformanceEvent : null);
            await _context.SaveChangesAsync();

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

            await SyncArtistHitsAsync(artist.Id, dto.Hits, isDraft);
            await SyncArtistAlbumsAsync(artist.Id, dto.Albums, isDraft);

            await _context.SaveChangesAsync();

            if (!isDraft)
            {
                await _notificationService.NotifyArtistSubmittedAsync(userId, artist.Id, artistName);
            }

            _logger.LogInformation("Artist profile created: ArtistId={ArtistId} Name={Name} UserId={UserId} Status={Status} IsPremium={IsPremium}",
                artist.Id, artist.Name, userId, artist.Status, artist.IsPremium);

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
                    IsFeatured = a.IsFeatured,
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
                    CreatedAt = a.CreatedAt,
                    BumpedAt = a.BumpedAt,
                    BumpCount = a.BumpCount
                })
                .FirstOrDefaultAsync();

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating artist profile");
            return StatusCode(500, "שגיאה ביצירת פרופיל אומן");
        }
    }

    // ========================================
    // Admin
    // ========================================

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ArtistDetailDto>> CreateArtist([FromBody] UpdateArtistDto dto)
    {
        try
        {
            var isDraft = dto.Status == ArtistStatus.Draft;
            if (!isDraft && string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest("שם האומן הוא שדה חובה");

            var artistName = dto.Name?.Trim() ?? string.Empty;
            var existingArtist = string.IsNullOrWhiteSpace(artistName)
                ? null
                : await _context.Artists
                    .FirstOrDefaultAsync(a => a.Name == artistName && !a.IsDeleted);

            if (existingArtist != null)
                return BadRequest("אומן בשם זה כבר קיים במערכת");

            var richMediaError = ValidateArtistRichMedia(dto, isDraft);
            if (richMediaError != null)
                return BadRequest(new { message = richMediaError });

            await using var transaction = await _context.Database.BeginTransactionAsync();

            var imageUrl = await _externalImageStorage.StoreExternalImageIfNeededAsync(
                dto.ImageUrl,
                "uploads/artists",
                "artist-new");
            var bannerImageUrl = await _externalImageStorage.StoreExternalImageIfNeededAsync(
                dto.BannerImageUrl,
                "uploads/artists",
                "artist-banner-new");
            var bannerGifUrl = await _externalImageStorage.StoreExternalImageIfNeededAsync(
                dto.BannerGifUrl,
                "uploads/artists",
                "artist-banner-new");

            var artist = new Artist
            {
                Name = artistName,
                EnglishName = dto.EnglishName,
                ShortBio = dto.ShortBio,
                Biography = dto.Biography,
                ImageUrl = imageUrl,
                BannerImageUrl = bannerImageUrl,
                BannerGifUrl = bannerGifUrl,
                BannerMediaType = NormalizeBannerMediaType(dto.BannerMediaType),
                BannerBlur = dto.BannerBlur.HasValue ? Math.Clamp(dto.BannerBlur.Value, 0, 20) : 0,
                WebsiteUrl = dto.WebsiteUrl,
                Status = dto.Status ?? ArtistStatus.Pending,
                IsPremium = dto.IsPremium ?? false,
                IsFeatured = dto.IsFeatured ?? false,
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

            await SyncPerformanceEventAsync(
                artist,
                artist.PerformanceIsActive ? dto.PerformanceEvent : null);
            await _context.SaveChangesAsync();

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

            if (dto.GalleryImages != null && dto.GalleryImages.Any())
            {
                foreach (var img in dto.GalleryImages)
                {
                    var galleryImageUrl = await _externalImageStorage.StoreExternalImageIfNeededAsync(
                        img.ImageUrl,
                        "uploads/artists/gallery",
                        $"artist-gallery-{artist.Id}");

                    _context.ArtistGalleryImages.Add(new ArtistGalleryImage
                    {
                        ArtistId = artist.Id,
                        ImageUrl = galleryImageUrl ?? string.Empty,
                        Caption = img.Caption,
                        DisplayOrder = img.DisplayOrder
                    });
                }
            }

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

            await SyncArtistHitsAsync(artist.Id, dto.Hits, isDraft);
            await SyncArtistAlbumsAsync(artist.Id, dto.Albums, isDraft);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

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
                    IsFeatured = a.IsFeatured,
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
                    ArticleCount = 0,
                    UpcomingEventCount = 0,
                    CreatedAt = a.CreatedAt,
                    BumpedAt = a.BumpedAt,
                    BumpCount = a.BumpCount
                })
                .FirstOrDefaultAsync();

            _logger.LogInformation("Artist created by admin: ArtistId={ArtistId} Name={Name} Status={Status}",
                artist.Id, artist.Name, artist.Status);
            return CreatedAtAction(nameof(GetArtistById), new { id = artist.Id }, result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating artist (admin): Name={Name}", dto.Name);
            return StatusCode(500, "שגיאה ביצירת אומן");
        }
    }

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

            _logger.LogInformation("Artist deleted: ArtistId={ArtistId} Name={Name}",
                artist.Id, artist.Name);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting artist: ArtistId={Id}", id);
            return StatusCode(500, "שגיאה במחיקת אומן");
        }
    }

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
                IsFeatured = false,
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
                    IsFeatured = a.IsFeatured,
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
                    CreatedAt = a.CreatedAt,
                    BumpedAt = a.BumpedAt,
                    BumpCount = a.BumpCount
                })
                .FirstOrDefaultAsync();

            _logger.LogInformation("Artist duplicated: OriginalId={OriginalId} NewId={NewId}",
                id, result?.Id);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error duplicating artist: ArtistId={Id}", id);
            return StatusCode(500, "שגיאה בשכפול אומן");
        }
    }

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

    private static string? ValidateArtistRichMedia(UpdateArtistDto dto, bool allowIncomplete = false)
    {
        if (allowIncomplete)
            return null;

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

    private async Task SyncArtistHitsAsync(
        int artistId,
        List<AddArtistHitDto>? hits,
        bool preserveIncomplete = false)
    {
        if (hits == null) return;

        var existingHits = await _context.ArtistHits
            .Where(hit => hit.ArtistId == artistId)
            .ToListAsync();
        _context.ArtistHits.RemoveRange(existingHits);

        foreach (var hit in hits.Where(h =>
            preserveIncomplete
                ? !string.IsNullOrWhiteSpace(h.Title) ||
                  !string.IsNullOrWhiteSpace(h.ImageUrl) ||
                  !string.IsNullOrWhiteSpace(h.YouTubeUrl)
                : !string.IsNullOrWhiteSpace(h.YouTubeUrl)))
        {
            var imageUrl = await _externalImageStorage.StoreExternalImageIfNeededAsync(
                hit.ImageUrl,
                "uploads/artists/hits",
                $"artist-hit-{artistId}");

            _context.ArtistHits.Add(new ArtistHit
            {
                ArtistId = artistId,
                Title = string.IsNullOrWhiteSpace(hit.Title) ? "להיט גדול" : hit.Title.Trim(),
                ImageUrl = imageUrl,
                YouTubeUrl = hit.YouTubeUrl?.Trim() ?? string.Empty,
                DisplayOrder = hit.DisplayOrder,
                IsActive = hit.IsActive,
                CreatedAt = DateTime.UtcNow
            });
        }
    }

    private async Task SyncArtistAlbumsAsync(
        int artistId,
        List<AddArtistAlbumDto>? albums,
        bool preserveIncomplete = false)
    {
        if (albums == null) return;

        var existingAlbums = await _context.ArtistAlbums
            .Where(album => album.ArtistId == artistId)
            .ToListAsync();
        _context.ArtistAlbums.RemoveRange(existingAlbums);

        foreach (var album in albums.Where(a =>
            preserveIncomplete
                ? !string.IsNullOrWhiteSpace(a.Title) ||
                  !string.IsNullOrWhiteSpace(a.CoverImageUrl) ||
                  !string.IsNullOrWhiteSpace(a.ExternalUrl) ||
                  a.ReleaseYear.HasValue
                : !string.IsNullOrWhiteSpace(a.CoverImageUrl)))
        {
            var coverImageUrl = await _externalImageStorage.StoreExternalImageIfNeededAsync(
                album.CoverImageUrl,
                "uploads/artists/albums",
                $"artist-album-{artistId}");

            _context.ArtistAlbums.Add(new ArtistAlbum
            {
                ArtistId = artistId,
                Title = string.IsNullOrWhiteSpace(album.Title) ? "אלבום" : album.Title.Trim(),
                CoverImageUrl = coverImageUrl ?? album.CoverImageUrl?.Trim() ?? string.Empty,
                ReleaseYear = album.ReleaseYear,
                ExternalUrl = string.IsNullOrWhiteSpace(album.ExternalUrl) ? string.Empty : album.ExternalUrl.Trim(),
                DisplayOrder = album.DisplayOrder,
                IsActive = album.IsActive,
                CreatedAt = DateTime.UtcNow
            });
        }
    }

    private async Task SyncPerformanceEventAsync(Artist artist, PerformanceEventInputDto? input)
    {
        if (input == null)
        {
            artist.PerformanceEventId = null;
            artist.PerformanceIsActive = false;
            artist.PerformanceImageUrl = null;
            artist.PerformanceTicketUrl = null;
            return;
        }

        var imageUrl = await _externalImageStorage.StoreExternalImageIfNeededAsync(
            FirstText(input.ImageUrl, input.BannerImageUrl, artist.PerformanceImageUrl),
            "uploads/events",
            $"artist-performance-event-{artist.Id}") ?? string.Empty;
        var bannerImageUrl = await _externalImageStorage.StoreExternalImageIfNeededAsync(
            FirstText(input.BannerImageUrl, input.ImageUrl, artist.PerformanceImageUrl),
            "uploads/events",
            $"artist-performance-banner-{artist.Id}");
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
            await _context.SaveChangesAsync();
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

    [HttpPut("{id}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateArtistStatus(int id, [FromBody] ArtistStatus status)
    {
        try
        {
            var artist = await _context.Artists.FindAsync(id);
            if (artist == null)
                return NotFound("אומן לא נמצא");

            var previousStatus = artist.Status;
            artist.Status = status;
            await _context.SaveChangesAsync();

            if (previousStatus != ArtistStatus.Active && status == ArtistStatus.Active && artist.UserId.HasValue)
            {
                await _notificationService.NotifyArtistApprovedAsync(artist.UserId.Value, artist.Id, artist.Name);
            }
            else if (previousStatus != ArtistStatus.Hidden && status == ArtistStatus.Hidden && artist.UserId.HasValue)
            {
                await _notificationService.NotifyArtistRejectedAsync(artist.UserId.Value, artist.Id, artist.Name);
            }

            _logger.LogInformation("Artist status updated: ArtistId={ArtistId} Name={Name} NewStatus={Status}",
                artist.Id, artist.Name, status);
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating artist status: ArtistId={Id} Status={Status}", id, status);
            return StatusCode(500, "שגיאה בעדכון סטטוס");
        }
    }

    // POST: api/Artists/5/link-user/10
    [HttpPost("{id}/link-user/{userId}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> LinkToUser(int id, int userId)
    {
        try
        {
            var artist = await _context.Artists
                .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

            if (artist == null)
                return NotFound(new { message = "האמן לא נמצא" });

            if (false && artist.UserId.HasValue)
                return BadRequest(new { message = "האמן כבר מקושר למשתמש" });

            var userExists = await _context.Users
                .AnyAsync(u => u.Id == userId && !u.IsDeleted);

            if (!userExists)
                return BadRequest(new { message = "המשתמש לא נמצא" });

            var managedPagesCount = await CountManagedPagesAsync(userId, id);
            if (managedPagesCount >= MaxManagedPagesPerUser)
                return BadRequest(new { message = $"אפשר לנהל עד {MaxManagedPagesPerUser} דפים בלבד" });

            artist.UserId = userId;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Artist linked to user: ArtistId={ArtistId} UserId={UserId}", id, userId);
            return Ok(new { message = "האמן קושר למשתמש בהצלחה" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error linking artist to user: ArtistId={ArtistId} UserId={UserId}", id, userId);
            return StatusCode(500, new { message = "שגיאה בשיוך האמן למשתמש" });
        }
    }

    private async Task<int> CountManagedPagesAsync(int userId, int? excludedArtistId = null)
    {
        var artistsCount = await _context.Artists
            .CountAsync(a => a.UserId == userId
                && !a.IsDeleted
                && (!excludedArtistId.HasValue || a.Id != excludedArtistId.Value));

        var providersCount = await _context.ServiceProviders
            .CountAsync(sp => sp.UserId == userId && !sp.IsDeleted);

        return artistsCount + providersCount;
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
    public string? ArtistName { get; set; }
    public List<string> TaggedArtistNames { get; set; } = new();
    public int DaysUntilEvent { get; set; }
    public string EventStatus { get; set; } = string.Empty;
}
