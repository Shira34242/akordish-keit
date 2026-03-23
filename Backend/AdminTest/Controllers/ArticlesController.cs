using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ArticlesController : ControllerBase
{
    private readonly IArticleService _articleService;
    private readonly IYouTubeService _youTubeService;

    public ArticlesController(IArticleService articleService, IYouTubeService youTubeService)
    {
        _articleService = articleService;
        _youTubeService = youTubeService;
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
        [FromQuery] int pageSize = 10)
    {
        var result = await _articleService.GetArticlesAsync(
            search, categoryId, contentType, status, isFeatured, isPremium, authorName, pageNumber, pageSize);

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
    public async Task<ActionResult<ArticleDto>> GetArticleBySlug(string slug)
    {
        var article = await _articleService.GetArticleBySlugAsync(slug);

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
        var articles = await _articleService.GetFeaturedArticlesAsync(contentType, limit);

        return Ok(articles);
    }

    // GET: api/Articles/stats
    [HttpGet("stats")]
    public async Task<ActionResult<ArticleStatsDto>> GetArticleStats()
    {
        var stats = await _articleService.GetArticleStatsAsync();

        return Ok(stats);
    }

    // POST: api/Articles
    [HttpPost]
    public async Task<ActionResult<ArticleDto>> CreateArticle([FromBody] CreateArticleDto dto)
    {
        try
        {
            var article = await _articleService.CreateArticleAsync(dto);

            return CreatedAtAction(nameof(GetArticle), new { id = article.Id }, article);
        }
        catch (InvalidOperationException ex)
        {
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

            if (dto.CategoryIds == null || dto.CategoryIds.Count == 0)
                dto.CategoryIds = new List<int> { 1 };

            var article = await _articleService.CreateArticleAsync(dto);
            return CreatedAtAction(nameof(GetArticle), new { id = article.Id }, article);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // PUT: api/Articles/5
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateArticle(int id, [FromBody] UpdateArticleDto dto)
    {
        try
        {
            var article = await _articleService.UpdateArticleAsync(id, dto);

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

    // POST: api/Articles/5/duplicate
    [HttpPost("{id}/duplicate")]
    public async Task<ActionResult<ArticleDto>> DuplicateArticle(int id)
    {
        try
        {
            var duplicate = await _articleService.DuplicateArticleAsync(id);
            return Ok(duplicate);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // DELETE: api/Articles/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteArticle(int id)
    {
        var result = await _articleService.DeleteArticleAsync(id);

        if (!result)
        {
            return NotFound(new { message = "Article not found" });
        }

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
            var userAgent = Request.Headers["User-Agent"].ToString();

            // Get Referrer
            var referrer = Request.Headers["Referer"].ToString();

            var viewCount = await _articleService.IncrementViewCountAsync(id, userId, ipAddress, userAgent, referrer);

            return Ok(new { viewCount });
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
        var result = await _articleService.GetFeedbackAsync(id, userId, ip);
        return Ok(result);
    }

    // POST: api/Articles/5/feedback
    [HttpPost("{id}/feedback")]
    public async Task<ActionResult<ArticleFeedbackResultDto>> SubmitFeedback(int id, [FromBody] SubmitFeedbackDto dto)
    {
        int? userId = GetCurrentUserId();
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        try
        {
            var result = await _articleService.SubmitFeedbackAsync(id, dto.IsPositive, userId, ip);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException)
        {
            // כבר הצביע — מחזירים את המצב הנוכחי בלי שגיאה
            var current = await _articleService.GetFeedbackAsync(id, userId, ip);
            return Ok(current);
        }
    }

    // GET: api/Articles/top-content (Admin)
    [HttpGet("top-content")]
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
