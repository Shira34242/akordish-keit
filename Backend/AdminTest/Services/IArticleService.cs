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
        int pageSize,
        int? tagId = null);

    Task<ArticleDto?> GetArticleByIdAsync(int id);

    Task<ArticleDto?> GetArticleBySlugAsync(string slug, int? contentType = null);

    Task<List<ArticleDto>> GetFeaturedArticlesAsync(int? contentType, int limit);

    Task<ArticleStatsDto> GetArticleStatsAsync();

    Task<ArticleDto> CreateArticleAsync(CreateArticleDto dto, int? callerUserId = null);

    Task<ArticleDto> UpdateArticleAsync(int id, UpdateArticleDto dto, int? callerUserId = null);

    Task<ArticleDto> UpdateArticleStatusAsync(int id, int status);

    Task<ArticleDto> UpdateArticleCategoriesAsync(int id, UpdateArticleCategoriesDto dto);

    Task<BulkArticleActionResultDto> BulkUpdateArticleCategoriesAsync(BulkUpdateArticleCategoriesDto dto);

    Task<BulkArticleActionResultDto> BulkUpdateArticleStatusAsync(BulkUpdateArticleStatusDto dto);

    Task<BulkArticleActionResultDto> BulkDuplicateArticlesAsync(BulkArticleIdsDto dto);

    Task<BulkArticleActionResultDto> BulkDeleteArticlesAsync(BulkArticleIdsDto dto);

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
    Task<PagedResult<ArticleDto>> GetMyArticlesAsync(int userId, int pageNumber = 1, int pageSize = 8);

    Task<List<ArticleDto>> GetPublishedArticlesByUploaderProfileAsync(string profileType, int profileId, int limit = 12);
}
