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
        int? tagId = null,
        IEnumerable<int>? categoryIds = null,
        int? artistId = null,
        string? uploaderSearch = null,
        DateTime? dateFrom = null,
        DateTime? dateTo = null,
        string? sortBy = null);

    Task<ArticleDto?> GetArticleByIdAsync(int id);

    Task<ArticleDto?> GetArticleBySlugAsync(string slug, int? contentType = null);

    Task<List<ArticleDto>> GetFeaturedArticlesAsync(int? contentType, int limit);

    Task<HomeNewsBannersDto> GetHomeNewsBannersAsync(int featuredLimit = 5, int regularLimit = 6);

    Task<List<ArticleBannerDto>> GetHomeContentBannersAsync(int limit = 12);

    Task<HomeCategoryBannersDto> GetHomeCategoryBannersAsync(int limit = 12);

    Task<List<ArticleBannerDto>> GetHomeViralBannersAsync(int limit = 10, int offset = 0);
    Task<PagedResult<ArticleBannerDto>> GetPublishedArticleBannersAsync(
        int contentType,
        int pageNumber = 1,
        int pageSize = 12,
        IEnumerable<int>? categoryIds = null);

    Task<ArticleStatsDto> GetArticleStatsAsync();

    Task<ArticleDto> CreateArticleAsync(CreateArticleDto dto, int? callerUserId = null);

    Task<ArticleDto> UpdateArticleAsync(int id, UpdateArticleDto dto, int? callerUserId = null);

    Task<ArticleDto> UpdateArticleStatusAsync(int id, int status);

    Task<ArticleDto> UpdateArticleCategoriesAsync(int id, UpdateArticleCategoriesDto dto);

    Task<BulkArticleActionResultDto> BulkUpdateArticleCategoriesAsync(BulkUpdateArticleCategoriesDto dto);

    Task<BulkArticleActionResultDto> BulkUpdateArticleStatusAsync(BulkUpdateArticleStatusDto dto);

    Task<ArticleDto> UpdateArticleArtistsAsync(int id, UpdateArticleArtistsDto dto);

    Task<BulkArticleActionResultDto> BulkUpdateArticleArtistsAsync(BulkUpdateArticleArtistsDto dto);

    Task<ArticleDto> UpdateArticleUploaderAsync(int id, UpdateArticleUploaderDto dto, int? callerUserId = null);

    Task<BulkArticleActionResultDto> BulkUpdateArticleUploaderAsync(BulkUpdateArticleUploaderDto dto, int? callerUserId = null);

    Task<BulkArticleActionResultDto> BulkDuplicateArticlesAsync(BulkArticleIdsDto dto);

    Task<BulkArticleActionResultDto> BulkDeleteArticlesAsync(BulkArticleIdsDto dto);

    Task<bool> DeleteArticleAsync(int id);

    Task<ArticleNewsCleanupSettingsDto> GetNewsCleanupSettingsAsync();

    Task<ArticleNewsCleanupSettingsDto> UpdateNewsCleanupSettingsAsync(UpdateArticleNewsCleanupSettingsDto dto);

    Task<ArticleNewsCleanupResultDto> CleanupOldNewsAsync(int olderThanDays, CancellationToken cancellationToken = default);

    Task<ArticleNewsCleanupResultDto?> RunAutomaticNewsCleanupAsync(CancellationToken cancellationToken = default);

    Task<int> IncrementViewCountAsync(int id, int? userId, string? ipAddress, string? userAgent, string? referrer);

    Task<int> IncrementLikeCountAsync(int id);

    Task<bool> SlugExistsAsync(string slug, int? excludeArticleId = null);

    Task<ArticleDto> DuplicateArticleAsync(int id);

    // ─── Feedback ─────────────────────────────────────────────
    Task<ArticleFeedbackResultDto> GetFeedbackAsync(int articleId, int? userId, string? ipAddress, string? guestId);
    Task<ArticleFeedbackResultDto> SubmitFeedbackAsync(int articleId, bool isPositive, int? userId, string? ipAddress, string? guestId);

    // ─── Top Content (Admin) ──────────────────────────────────
    Task<List<ArticleRankDto>> GetTopContentAsync(int limit = 20);

    // ─── My Content ───────────────────────────────────────────
    Task<PagedResult<ArticleDto>> GetMyArticlesAsync(int userId, int pageNumber = 1, int pageSize = 8);

    Task<List<ArticleDto>> GetPublishedArticlesByUploaderProfileAsync(string profileType, int profileId, int limit = 12);
}
