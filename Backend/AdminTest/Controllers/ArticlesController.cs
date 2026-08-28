using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;
using AkordishKeit.Services;
using AkordishKeit.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ArticlesController : ControllerBase
{
    private readonly AkordishKeitDbContext _context;
    private readonly IArticleService _articleService;
    private readonly IYouTubeService _youTubeService;
    private readonly IUserTagService _userTagService;
    private readonly INotificationService _notificationService;
    private readonly IMemoryCache _cache;
    private readonly ContentExposureCacheVersion _exposureCacheVersion;
    private readonly ILogger<ArticlesController> _logger;

    public ArticlesController(
        AkordishKeitDbContext context,
        IArticleService articleService,
        IYouTubeService youTubeService,
        IUserTagService userTagService,
        INotificationService notificationService,
        IMemoryCache cache,
        ContentExposureCacheVersion exposureCacheVersion,
        ILogger<ArticlesController> logger)
    {
        _context = context;
        _articleService = articleService;
        _youTubeService = youTubeService;
        _userTagService = userTagService;
        _notificationService = notificationService;
        _cache = cache;
        _exposureCacheVersion = exposureCacheVersion;
        _logger = logger;
    }

    // GET: api/Articles
    [HttpGet]
    public async Task<ActionResult<PagedResult<ArticleDto>>> GetArticles(
        [FromQuery] string? search = null,
        [FromQuery] int? categoryId = null,
        [FromQuery] int? contentType = null,
        [FromQuery] int? status = null,
        [FromQuery] bool? isFeatured = null,
        [FromQuery] bool? isPremium = null,
        [FromQuery] string? authorName = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] int? tagId = null,
        [FromQuery] List<int>? categoryIds = null,
        [FromQuery] int? artistId = null,
        [FromQuery] string? uploaderSearch = null,
        [FromQuery] DateTime? dateFrom = null,
        [FromQuery] DateTime? dateTo = null,
        [FromQuery] string? sortBy = null)
    {
        var result = await _articleService.GetArticlesAsync(
            search, categoryId, contentType, status, isFeatured, isPremium, authorName, pageNumber, pageSize,
            tagId, categoryIds, artistId, uploaderSearch, dateFrom, dateTo, sortBy);

        return Ok(result);
    }

    // GET: api/Articles/5
    [HttpGet("{id}")]
    public async Task<ActionResult<ArticleDto>> GetArticle(int id)
    {
        var article = await _articleService.GetArticleByIdAsync(id);

        if (article == null)
        {
            return NotFound(new { message = "Article not found" });
        }

        return Ok(article);
    }

    // GET: api/Articles/slug/my-article-slug
    [HttpGet("slug/{slug}")]
    public async Task<ActionResult<ArticleDto>> GetArticleBySlug(string slug, [FromQuery] int? contentType = null)
    {
        var article = await _articleService.GetArticleBySlugAsync(slug, contentType);

        if (article == null)
        {
            return NotFound(new { message = "Article not found" });
        }

        return Ok(article);
    }

    // GET: api/Articles/featured
    [HttpGet("featured")]
    public async Task<ActionResult<IEnumerable<ArticleDto>>> GetFeaturedArticles(
        [FromQuery] int? contentType = null,
        [FromQuery] int limit = 5)
    {
        var cacheKey = $"featured_articles_{GetPublicArticleCacheVersion()}_{contentType}_{limit}";
        if (!_cache.TryGetValue(cacheKey, out List<ArticleDto>? articles))
        {
            articles = await _articleService.GetFeaturedArticlesAsync(contentType, limit);
            _cache.Set(cacheKey, articles, TimeSpan.FromMinutes(5));
        }
        return HttpCacheRevalidation.Revalidate<IEnumerable<ArticleDto>>(this, articles!);
    }

    // GET: api/Articles/home-news-banners
    [HttpGet("home-news-banners")]
    public async Task<ActionResult<HomeNewsBannersDto>> GetHomeNewsBanners()
    {
        var cacheKey = $"home_news_banners_v3_{_exposureCacheVersion.ArticleVersion}";
        var banners = await _cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            return await _articleService.GetHomeNewsBannersAsync();
        });

        return HttpCacheRevalidation.Revalidate(this, banners!);
    }

    // GET: api/Articles/home-content-banners
    [HttpGet("home-content-banners")]
    public async Task<ActionResult<List<ArticleBannerDto>>> GetHomeContentBanners([FromQuery] int limit = 12)
    {
        var normalizedLimit = Math.Clamp(limit, 1, 20);
        var cacheKey = $"home_content_banners_v3_{_exposureCacheVersion.ArticleVersion}_{normalizedLimit}";
        var banners = await _cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            return await _articleService.GetHomeContentBannersAsync(normalizedLimit);
        });

        return HttpCacheRevalidation.Revalidate(this, banners!);
    }

    // GET: api/Articles/home-category-banners
    [HttpGet("home-category-banners")]
    public async Task<ActionResult<HomeCategoryBannersDto>> GetHomeCategoryBanners([FromQuery] int limit = 12)
    {
        var normalizedLimit = Math.Clamp(limit, 1, 20);
        var banners = await _articleService.GetHomeCategoryBannersAsync(normalizedLimit);
        return HttpCacheRevalidation.Revalidate(this, banners);
    }

    // GET: api/Articles/home-viral-banners
    [HttpGet("home-viral-banners")]
    public async Task<ActionResult<List<ArticleBannerDto>>> GetHomeViralBanners(
        [FromQuery] int limit = 10,
        [FromQuery] int offset = 0)
    {
        var normalizedLimit = Math.Clamp(limit, 1, 10);
        var normalizedOffset = Math.Clamp(offset, 0, 200);
        var cacheKey = $"home_viral_banners_v5_{_exposureCacheVersion.ArticleVersion}_{normalizedLimit}_{normalizedOffset}";
        var banners = await _cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            return await _articleService.GetHomeViralBannersAsync(normalizedLimit, normalizedOffset);
        });

        return HttpCacheRevalidation.Revalidate(this, banners!);
    }

    // GET: api/Articles/public-banners
    [HttpGet("public-banners")]
    public async Task<ActionResult<PagedResult<ArticleBannerDto>>> GetPublishedArticleBanners(
        [FromQuery] int contentType,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 12,
        [FromQuery] List<int>? categoryIds = null)
    {
        if (!Enum.IsDefined(typeof(ArticleContentType), contentType))
        {
            return BadRequest(new { message = "Invalid content type" });
        }

        var categoryKey = categoryIds?.Count > 0
            ? string.Join("-", categoryIds.OrderBy(id => id))
            : "all";
        var cacheKey = $"public_article_banners_v1_{GetPublicArticleCacheVersion()}_{contentType}_{pageNumber}_{pageSize}_{categoryKey}";
        var result = await _cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2);
            return await _articleService.GetPublishedArticleBannersAsync(contentType, pageNumber, pageSize, categoryIds);
        });

        return HttpCacheRevalidation.Revalidate(this, result!);
    }

    // GET: api/Articles/stats
    [HttpGet("stats")]
    public async Task<ActionResult<ArticleStatsDto>> GetArticleStats()
    {
        const string cacheKey = "article_stats";
        if (!_cache.TryGetValue(cacheKey, out ArticleStatsDto? stats))
        {
            stats = await _articleService.GetArticleStatsAsync();
            _cache.Set(cacheKey, stats, TimeSpan.FromMinutes(10));
        }
        return Ok(stats);
    }

    // GET: api/Articles/my
    [HttpGet("my")]
    [Authorize]
    public async Task<ActionResult<PagedResult<ArticleDto>>> GetMyArticles([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 8)
    {
        var userId = GetCurrentUserId();
        if (userId == null) return Unauthorized();
        var result = await _articleService.GetMyArticlesAsync(userId.Value, pageNumber, pageSize);
        return Ok(result);
    }

    // POST: api/Articles
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ArticleDto>> CreateArticle([FromBody] CreateArticleDto dto)
    {
        try
        {
            var article = await _articleService.CreateArticleAsync(dto, GetCurrentUserId());
            InvalidatePublicArticleCaches();
            _logger.LogInformation("Article created (admin): ArticleId={ArticleId} Title={Title}",
                article.Id, article.Title);
            return CreatedAtAction(nameof(GetArticle), new { id = article.Id }, article);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Article creation failed: {Error}", ex.Message);
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST: api/Articles/draft - autosave from the admin editor
    [HttpPost("draft")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ArticleDto>> CreateArticleDraft([FromBody] CreateArticleDto dto)
    {
        try
        {
            // The editor may display Published as its default choice, but leaving
            // without an explicit submit must never publish the article.
            dto.Status = (int)ArticleStatus.Draft;
            dto.ScheduledDate = null;

            var article = await _articleService.CreateArticleAsync(dto, GetCurrentUserId());
            InvalidatePublicArticleCaches();
            _logger.LogInformation("Article draft autosaved (admin): ArticleId={ArticleId} Title={Title}",
                article.Id, article.Title);
            return CreatedAtAction(nameof(GetArticle), new { id = article.Id }, article);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Article draft autosave failed: {Error}", ex.Message);
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST: api/Articles/submit - הגשת כתבה על-ידי משתמש רשום (ממתינה לאישור מנהל)
    [HttpPost("submit")]
    [Authorize]
    public async Task<ActionResult<ArticleDto>> SubmitArticle([FromBody] CreateArticleDto dto)
    {
        try
        {
            dto.Status = (int)ArticleStatus.Draft;
            dto.IsFeatured = false;
            dto.IsPremium = false;
            dto.DisplayOrder = 0;

            if (string.IsNullOrWhiteSpace(dto.Slug))
                dto.Slug = $"article-{DateTime.UtcNow.Ticks}";

            var userId = GetCurrentUserId();
            var article = await _articleService.CreateArticleAsync(dto, userId);

            // עדכון תג תרומת תוכן לאחר הגשת כתבה מוצלחת
            if (userId.HasValue)
            {
                await _userTagService.RecalculateTagAsync(userId.Value);
                await _notificationService.NotifyArticleSubmittedAsync(userId.Value, article.Id, article.Title);
            }

            _logger.LogInformation("Article submitted by user: ArticleId={ArticleId} Title={Title} UserId={UserId}",
                article.Id, article.Title, userId);
            return CreatedAtAction(nameof(GetArticle), new { id = article.Id }, article);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Article submit failed: UserId={UserId} Error={Error}", GetCurrentUserId(), ex.Message);
            return BadRequest(new { message = ex.Message });
        }
    }

    // PUT: api/Articles/5
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateArticle(int id, [FromBody] UpdateArticleDto dto)
    {
        try
        {
            var article = await _articleService.UpdateArticleAsync(id, dto, GetCurrentUserId());
            InvalidatePublicArticleCaches();

            if (dto.Status == (int)ArticleStatus.Published)
            {
                var submittedByUserId = await _context.Articles
                    .Where(a => a.Id == id)
                    .Select(a => a.SubmittedByUserId)
                    .FirstOrDefaultAsync();
                if (submittedByUserId.HasValue)
                {
                    await _userTagService.RecalculateTagAsync(submittedByUserId.Value);
                }
                _logger.LogInformation("Article published: ArticleId={ArticleId} Title={Title}",
                    id, article.Title);
            }
            else
            {
                _logger.LogInformation("Article updated: ArticleId={ArticleId} Title={Title} Status={Status}",
                    id, article.Title, dto.Status);
            }

            return Ok(article);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // PATCH: api/Articles/5/status
    [HttpPatch("{id}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ArticleDto>> UpdateArticleStatus(int id, [FromBody] UpdateArticleStatusDto dto)
    {
        try
        {
            var article = await _articleService.UpdateArticleStatusAsync(id, dto.Status);
            InvalidatePublicArticleCaches();

            if (dto.Status == (int)ArticleStatus.Published)
            {
                var submittedByUserId = await _context.Articles
                    .Where(a => a.Id == id)
                    .Select(a => a.SubmittedByUserId)
                    .FirstOrDefaultAsync();

                if (submittedByUserId.HasValue)
                {
                    await _userTagService.RecalculateTagAsync(submittedByUserId.Value);
                }
            }

            _logger.LogInformation("Article status changed: ArticleId={ArticleId} Title={Title} NewStatus={Status}",
                id, article.Title, (ArticleStatus)dto.Status);
            return Ok(article);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // PATCH: api/Articles/5/categories
    [HttpPatch("{id}/categories")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ArticleDto>> UpdateArticleCategories(int id, [FromBody] UpdateArticleCategoriesDto dto)
    {
        try
        {
            var article = await _articleService.UpdateArticleCategoriesAsync(id, dto);
            InvalidatePublicArticleCaches();
            return Ok(article);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST: api/Articles/bulk/categories
    [HttpPost("bulk/categories")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<BulkArticleActionResultDto>> BulkUpdateArticleCategories([FromBody] BulkUpdateArticleCategoriesDto dto)
    {
        try
        {
            var result = await _articleService.BulkUpdateArticleCategoriesAsync(dto);
            InvalidatePublicArticleCaches();
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // PATCH: api/Articles/bulk/status
    [HttpPatch("bulk/status")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<BulkArticleActionResultDto>> BulkUpdateArticleStatus([FromBody] BulkUpdateArticleStatusDto dto)
    {
        try
        {
            var result = await _articleService.BulkUpdateArticleStatusAsync(dto);
            InvalidatePublicArticleCaches();
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // PATCH: api/Articles/5/artists
    [HttpPatch("{id}/artists")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ArticleDto>> UpdateArticleArtists(int id, [FromBody] UpdateArticleArtistsDto dto)
    {
        try
        {
            var article = await _articleService.UpdateArticleArtistsAsync(id, dto);
            InvalidatePublicArticleCaches();
            return Ok(article);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST: api/Articles/bulk/artists
    [HttpPost("bulk/artists")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<BulkArticleActionResultDto>> BulkUpdateArticleArtists([FromBody] BulkUpdateArticleArtistsDto dto)
    {
        try
        {
            var result = await _articleService.BulkUpdateArticleArtistsAsync(dto);
            InvalidatePublicArticleCaches();
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // PATCH: api/Articles/5/uploader
    [HttpPatch("{id}/uploader")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ArticleDto>> UpdateArticleUploader(int id, [FromBody] UpdateArticleUploaderDto dto)
    {
        try
        {
            var article = await _articleService.UpdateArticleUploaderAsync(id, dto, GetCurrentUserId());
            InvalidatePublicArticleCaches();
            return Ok(article);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST: api/Articles/bulk/uploader
    [HttpPost("bulk/uploader")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<BulkArticleActionResultDto>> BulkUpdateArticleUploader([FromBody] BulkUpdateArticleUploaderDto dto)
    {
        try
        {
            var result = await _articleService.BulkUpdateArticleUploaderAsync(dto, GetCurrentUserId());
            InvalidatePublicArticleCaches();
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST: api/Articles/5/duplicate
    [HttpPost("{id}/duplicate")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ArticleDto>> DuplicateArticle(int id)
    {
        try
        {
            var duplicate = await _articleService.DuplicateArticleAsync(id);
            _logger.LogInformation("Article duplicated: OriginalId={OriginalId} NewId={NewId}",
                id, duplicate.Id);
            return Ok(duplicate);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // POST: api/Articles/bulk/duplicate
    [HttpPost("bulk/duplicate")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<BulkArticleActionResultDto>> BulkDuplicateArticles([FromBody] BulkArticleIdsDto dto)
    {
        try
        {
            var result = await _articleService.BulkDuplicateArticlesAsync(dto);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST: api/Articles/bulk-delete
    [HttpPost("bulk-delete")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<BulkArticleActionResultDto>> BulkDeleteArticles([FromBody] BulkArticleIdsDto dto)
    {
        var result = await _articleService.BulkDeleteArticlesAsync(dto);
        InvalidatePublicArticleCaches();
        return Ok(result);
    }

    // GET: api/Articles/news-cleanup/settings
    [HttpGet("news-cleanup/settings")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ArticleNewsCleanupSettingsDto>> GetNewsCleanupSettings()
    {
        var settings = await _articleService.GetNewsCleanupSettingsAsync();
        return Ok(settings);
    }

    // PUT: api/Articles/news-cleanup/settings
    [HttpPut("news-cleanup/settings")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ArticleNewsCleanupSettingsDto>> UpdateNewsCleanupSettings([FromBody] UpdateArticleNewsCleanupSettingsDto dto)
    {
        var settings = await _articleService.UpdateNewsCleanupSettingsAsync(dto);
        _logger.LogInformation(
            "News cleanup settings updated: AutoDeleteEnabled={AutoDeleteEnabled} RetentionDays={RetentionDays}",
            settings.AutoDeleteEnabled,
            settings.RetentionDays);
        return Ok(settings);
    }

    // POST: api/Articles/news-cleanup/run
    [HttpPost("news-cleanup/run")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ArticleNewsCleanupResultDto>> CleanupOldNews([FromBody] CleanupOldNewsDto dto)
    {
        var result = await _articleService.CleanupOldNewsAsync(dto.OlderThanDays);
        InvalidatePublicArticleCaches();
        _logger.LogInformation(
            "Old news cleanup executed manually: OlderThanDays={OlderThanDays} DeletedCount={DeletedCount}",
            result.OlderThanDays,
            result.DeletedCount);
        return Ok(result);
    }

    // DELETE: api/Articles/5
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteArticle(int id)
    {
        var result = await _articleService.DeleteArticleAsync(id);

        if (!result)
        {
            return NotFound(new { message = "Article not found" });
        }

        _logger.LogInformation("Article deleted: ArticleId={ArticleId}", id);
        InvalidatePublicArticleCaches();
        return NoContent();
    }

    // POST: api/Articles/5/increment-view
    [HttpPost("{id}/increment-view")]
    public async Task<IActionResult> IncrementViewCount(int id)
    {
        try
        {
            // Get user info if authenticated
            int? userId = null;
            if (User.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out var parsedUserId))
                {
                    userId = parsedUserId;
                }
            }

            // Get IP address
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

            // Get User Agent
            var userAgent = AnalyticsIdentity.GetVisitorKey(Request);

            // Get Referrer
            var referrer = Request.Headers["Referer"].ToString();

            await _articleService.IncrementViewCountAsync(id, userId, ipAddress, userAgent, referrer);

            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // POST: api/Articles/5/increment-like
    [HttpPost("{id}/increment-like")]
    public async Task<IActionResult> IncrementLikeCount(int id)
    {
        try
        {
            var likeCount = await _articleService.IncrementLikeCountAsync(id);

            return Ok(new { likeCount });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // GET: api/Articles/5/feedback
    [HttpGet("{id}/feedback")]
    public async Task<ActionResult<ArticleFeedbackResultDto>> GetFeedback(int id)
    {
        int? userId = GetCurrentUserId();
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var guestId = GetGuestId();
        var result = await _articleService.GetFeedbackAsync(id, userId, ip, guestId);
        return Ok(result);
    }

    // POST: api/Articles/5/feedback
    [HttpPost("{id}/feedback")]
    public async Task<ActionResult<ArticleFeedbackResultDto>> SubmitFeedback(int id, [FromBody] SubmitFeedbackDto dto)
    {
        int? userId = GetCurrentUserId();
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var guestId = GetGuestId();
        try
        {
            var result = await _articleService.SubmitFeedbackAsync(id, dto.IsPositive, userId, ip, guestId);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException)
        {
            // כבר הצביע — מחזירים את המצב הנוכחי בלי שגיאה
            var current = await _articleService.GetFeedbackAsync(id, userId, ip, guestId);
            return Ok(current);
        }
    }

    // GET: api/Articles/top-content (Admin)
    [HttpGet("top-content")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<List<ArticleRankDto>>> GetTopContent([FromQuery] int limit = 20)
    {
        var result = await _articleService.GetTopContentAsync(limit);
        return Ok(result);
    }

    // ─── Helper ──────────────────────────────────────────────────────────────────

    private int? GetCurrentUserId()
    {
        if (User.Identity?.IsAuthenticated != true) return null;
        var claim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return claim != null && int.TryParse(claim.Value, out var id) ? id : null;
    }

    private string? GetGuestId()
    {
        var guestId = Request.Headers["X-Akordish-Guest-Id"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(guestId)) return null;

        guestId = guestId.Trim();
        return guestId.Length <= 58 ? guestId : guestId[..58];
    }

    private void InvalidatePublicArticleCaches()
    {
        _exposureCacheVersion.InvalidateArticles();
        _cache.Set("public_article_cache_version", Guid.NewGuid().ToString("N"));
    }

    private string GetPublicArticleCacheVersion()
    {
        return _cache.GetOrCreate("public_article_cache_version", entry =>
        {
            entry.Priority = CacheItemPriority.NeverRemove;
            return Guid.NewGuid().ToString("N");
        })!;
    }

    // GET: api/Articles/youtube-metadata?url=...
    [HttpGet("youtube-metadata")]
    public async Task<ActionResult<YouTubeMetadataDto>> GetYouTubeMetadata([FromQuery] string url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return BadRequest(new { message = "URL is required" });
        }

        var metadata = await _youTubeService.GetVideoMetadataAsync(url);
        return Ok(metadata);
    }
}
