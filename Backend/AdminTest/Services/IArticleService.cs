using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IArticleService
{
    Task<PagedResult<ArticleDto>> GetArticlesAsync(
        string? search,
        int? category,
        int? contentType,
        int? status,
        bool? isFeatured,
        bool? isPremium,
        string? authorName,
        int pageNumber,
        int pageSize);

    Task<ArticleDto?> GetArticleByIdAsync(int id);

    Task<ArticleDto?> GetArticleBySlugAsync(string slug);

    Task<List<ArticleDto>> GetFeaturedArticlesAsync(int? contentType, int limit);

    Task<ArticleStatsDto> GetArticleStatsAsync();

    Task<ArticleDto> CreateArticleAsync(CreateArticleDto dto, int? callerUserId = null);

    Task<ArticleDto> UpdateArticleAsync(int id, UpdateArticleDto dto);

    Task<bool> DeleteArticleAsync(int id);

    Task<int> IncrementViewCountAsync(int id, int? userId, string? ipAddress, string? userAgent, string? referrer);

    Task<int> IncrementLikeCountAsync(int id);

    Task<bool> SlugExistsAsync(string slug, int? excludeArticleId = null);

    Task<ArticleDto> DuplicateArticleAsync(int id);

    // ─── Feedback ─────────────────────────────────────────────
    Task<ArticleFeedbackResultDto> GetFeedbackAsync(int articleId, int? userId, string? ipAddress);
    Task<ArticleFeedbackResultDto> SubmitFeedbackAsync(int articleId, bool isPositive, int? userId, string? ipAddress);

    // ─── Top Content (Admin) ──────────────────────────────────
    Task<List<ArticleRankDto>> GetTopContentAsync(int limit = 20);

    // ─── My Content ───────────────────────────────────────────
    Task<List<ArticleDto>> GetMyArticlesAsync(int userId);
}
