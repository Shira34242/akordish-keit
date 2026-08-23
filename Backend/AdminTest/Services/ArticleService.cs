using AkordishKeit.Data;
using AkordishKeit.Extensions;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Ganss.Xss;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;

namespace AkordishKeit.Services;

public class ArticleService : IArticleService
{
    private const string NewsCleanupAutoEnabledKey = "article_news_cleanup_auto_enabled";
    private const string NewsCleanupRetentionDaysKey = "article_news_cleanup_retention_days";
    private const string NewsCleanupLastRunAtKey = "article_news_cleanup_last_run_at";
    private const string HomeCategoryIdKey = "home_category_banner_category_id";
    private const int DefaultNewsCleanupRetentionDays = 365;
    private const int MinNewsCleanupRetentionDays = 30;
    private const int MaxNewsCleanupRetentionDays = 3650;

    private readonly AkordishKeitDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly ISystemSettingsService _systemSettings;
    private readonly IYouTubeService _youTubeService;
    private readonly IDisplayRankingService _rankingService;

    public ArticleService(
        AkordishKeitDbContext context,
        INotificationService notificationService,
        ISystemSettingsService systemSettings,
        IYouTubeService youTubeService,
        IDisplayRankingService rankingService)
    {
        _context = context;
        _notificationService = notificationService;
        _systemSettings = systemSettings;
        _youTubeService = youTubeService;
        _rankingService = rankingService;
    }

    private async Task<string?> StoreYouTubeThumbnailIfNeededAsync(string? imageUrl)
    {
        if (!IsYouTubeThumbnailUrl(imageUrl))
            return imageUrl;

        return await _youTubeService.StoreYouTubeThumbnailAsync(imageUrl!) ?? imageUrl;
    }

    private static bool IsYouTubeThumbnailUrl(string? url)
    {
        return Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && (uri.Host.Equals("img.youtube.com", StringComparison.OrdinalIgnoreCase)
                || uri.Host.Equals("i.ytimg.com", StringComparison.OrdinalIgnoreCase));
    }

    private static string SanitizeArticleContent(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return string.Empty;
        }

        var sanitizer = new HtmlSanitizer();
        sanitizer.AllowedTags.Clear();
        foreach (var tag in new[]
        {
            "p", "br", "strong", "b", "em", "i", "u", "a", "h2", "h3", "span",
            "ul", "ol", "li",
            "figure", "figcaption", "img", "iframe", "div"
        })
        {
            sanitizer.AllowedTags.Add(tag);
        }

        sanitizer.AllowedAttributes.Clear();
        foreach (var attribute in new[]
        {
            "href", "src", "alt", "title", "target", "rel", "class",
            "width", "height", "frameborder", "allow", "allowfullscreen", "style", "data-align",
            "data-indent", "data-mention-type", "data-mention-id", "data-youtube-video",
            "loading", "decoding"
        })
        {
            sanitizer.AllowedAttributes.Add(attribute);
        }

        sanitizer.AllowedSchemes.Clear();
        sanitizer.AllowedSchemes.Add("http");
        sanitizer.AllowedSchemes.Add("https");
        sanitizer.AllowedSchemes.Add("mailto");
        sanitizer.AllowedSchemes.Add("tel");
        sanitizer.AllowedCssProperties.Clear();
        foreach (var property in new[] { "width", "max-width", "margin-left", "margin-right", "text-align" })
        {
            sanitizer.AllowedCssProperties.Add(property);
        }

        var sanitized = FilterArticleIframes(sanitizer.Sanitize(content));
        return FilterArticleTemplateClasses(sanitized);
    }

    private static string FilterArticleIframes(string html)
    {
        return Regex.Replace(
            html,
            @"<iframe\b(?<attrs>[^>]*)>\s*</iframe>",
            match =>
            {
                var srcMatch = Regex.Match(
                    match.Groups["attrs"].Value,
                    "\\ssrc\\s*=\\s*([\"'])(?<src>.*?)\\1",
                    RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

                return IsAllowedArticleIframeSrc(srcMatch.Groups["src"].Value)
                    ? match.Value
                    : string.Empty;
            },
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    }

    private static bool IsAllowedArticleIframeSrc(string? src)
    {
        if (!Uri.TryCreate(src, UriKind.Absolute, out var uri))
        {
            return false;
        }

        if (uri.Scheme != Uri.UriSchemeHttps)
        {
            return false;
        }

        var host = uri.Host.ToLowerInvariant();
        return (host is "www.youtube.com" or "youtube.com" or "www.youtube-nocookie.com" or "youtube-nocookie.com")
            && uri.AbsolutePath.StartsWith("/embed/", StringComparison.OrdinalIgnoreCase);
    }

    private static string FilterArticleTemplateClasses(string html)
    {
        var allowedClasses = new HashSet<string>(StringComparer.Ordinal)
        {
            "article-media",
            "article-media-link",
            "article-media-align-right",
            "article-media-align-center",
            "article-media-align-left",
            "article-inline-image",
            "article-video-frame",
            "article-video-align-right",
            "article-video-align-center",
            "article-video-align-left",
            "article-action",
            "article-button",
            "article-button-primary",
            "article-button-dark",
            "article-button-soft",
            "article-button-small",
            "article-button-regular",
            "article-button-large",
            "article-action-right",
            "article-action-center",
            "article-action-left",
            "article-text-soft-title",
            "article-text-small-title",
            "article-text-highlight",
            "content-mention"
        };

        for (var size = 30; size <= 100; size += 5)
        {
            allowedClasses.Add($"article-media-size-{size}");
        }

        return Regex.Replace(
            html,
            "\\sclass=\"(?<classes>[^\"]*)\"",
            match =>
            {
                var classes = match.Groups["classes"].Value
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Where(allowedClasses.Contains)
                    .Distinct()
                    .ToList();

                return classes.Count == 0 ? string.Empty : $" class=\"{string.Join(' ', classes)}\"";
            },
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    }

    public async Task<PagedResult<ArticleDto>> GetArticlesAsync(
        string? search,
        int? categoryId,
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
        string? sortBy = null)
    {
        var query = _context.Articles
            .AsNoTracking()
            .Include(a => a.ArticleCategories)
                .ThenInclude(ac => ac.Category)
            .Include(a => a.ArticleTags)
                .ThenInclude(at => at.Tag)
            .Include(a => a.GalleryImages)
            .Include(a => a.ArticleArtists)
                .ThenInclude(aa => aa.Artist)
            .Include(a => a.UploaderUser)
                .ThenInclude(u => u!.ManagedArtist)
            .Include(a => a.UploaderUser)
                .ThenInclude(u => u!.ServiceProviderProfiles)
            .AsSplitQuery()
            .AsQueryable();

        // Apply filters
        query = ApplyFilters(query, search, categoryId, contentType, status, isFeatured, isPremium, authorName,
            tagId, categoryIds, artistId, uploaderSearch, dateFrom, dateTo);

        query = _rankingService.ApplyArticleOrdering(query, sortBy, ContentPromotionPlacement.Index);

        // Get paginated entities
        var pagedEntities = await query.ToPagedResultAsync(pageNumber, pageSize);

        // Map to DTOs
        var dtos = pagedEntities.Items.Select(MapToDto).ToList();

        return new PagedResult<ArticleDto>
        {
            Items = dtos,
            TotalCount = pagedEntities.TotalCount,
            PageNumber = pagedEntities.PageNumber,
            PageSize = pagedEntities.PageSize
        };
    }

    public async Task<ArticleDto?> GetArticleByIdAsync(int id)
    {
        var article = await _context.Articles
            .AsNoTracking()
            .Include(a => a.ArticleCategories)
                .ThenInclude(ac => ac.Category)
            .Include(a => a.ArticleTags)
                .ThenInclude(at => at.Tag)
            .Include(a => a.GalleryImages)
            .Include(a => a.ArticleArtists)
                .ThenInclude(aa => aa.Artist)
            .Include(a => a.UploaderUser)
                .ThenInclude(u => u!.ManagedArtist)
            .Include(a => a.UploaderUser)
                .ThenInclude(u => u!.ServiceProviderProfiles)
            .AsSplitQuery()
            .FirstOrDefaultAsync(a => a.Id == id);

        return article == null ? null : MapToDto(article);
    }

    public async Task<ArticleDto?> GetArticleBySlugAsync(string slug, int? contentType = null)
    {
        var query = _context.Articles
            .AsNoTracking()
            .Include(a => a.ArticleCategories)
                .ThenInclude(ac => ac.Category)
            .Include(a => a.ArticleTags)
                .ThenInclude(at => at.Tag)
            .Include(a => a.GalleryImages)
            .Include(a => a.ArticleArtists)
                .ThenInclude(aa => aa.Artist)
            .Include(a => a.UploaderUser)
                .ThenInclude(u => u!.ManagedArtist)
            .Include(a => a.UploaderUser)
                .ThenInclude(u => u!.ServiceProviderProfiles)
            .AsSplitQuery()
            .Where(a => a.Slug == slug
                && a.Status == (int)ArticleStatus.Published
                && a.PublishDate <= DateTime.UtcNow);

        if (contentType.HasValue)
        {
            var section = (ArticleCategorySection)contentType.Value;
            query = query.Where(a => a.ArticleCategories.Any(ac => ac.Category.Section == section));
        }

        var article = await query.FirstOrDefaultAsync();

        return article == null ? null : MapToDto(article);
    }

    public async Task<List<ArticleDto>> GetFeaturedArticlesAsync(int? contentType, int limit)
    {
        var query = _context.Articles
            .AsNoTracking()
            .Where(a => a.IsFeatured && a.Status == (int)ArticleStatus.Published && a.PublishDate <= DateTime.UtcNow)
            .AsQueryable();

        if (contentType.HasValue)
        {
            var section = (ArticleCategorySection)contentType.Value;
            query = query.Where(a => a.ArticleCategories.Any(ac => ac.Category.Section == section));
        }

        var articles = await query
            .Include(a => a.ArticleCategories)
                .ThenInclude(ac => ac.Category)
            .Include(a => a.ArticleTags)
                .ThenInclude(at => at.Tag)
            .Include(a => a.ArticleArtists)
                .ThenInclude(aa => aa.Artist)
            .Include(a => a.UploaderUser)
                .ThenInclude(u => u!.ManagedArtist)
            .Include(a => a.UploaderUser)
                .ThenInclude(u => u!.ServiceProviderProfiles)
            .AsSplitQuery()
            .OrderByDescending(a => _context.ContentPromotions
                .Where(p => p.TargetType == ContentPromotionTargetType.Article
                    && p.TargetId == a.Id
                    && p.IsActive
                    && (!p.StartsAt.HasValue || p.StartsAt.Value <= DateTime.UtcNow)
                    && (!p.EndsAt.HasValue || p.EndsAt.Value >= DateTime.UtcNow)
                    && (p.Placement == ContentPromotionPlacement.Featured || p.Placement == ContentPromotionPlacement.General))
                .Select(p => (int?)p.Priority)
                .Max() ?? -1)
            .ThenBy(a => a.DisplayOrder)
            .ThenByDescending(a => a.PublishDate)
            .Take(limit)
            .ToListAsync();

        return articles.Select(MapToDto).ToList();
    }

    public async Task<HomeNewsBannersDto> GetHomeNewsBannersAsync(int featuredLimit = 5, int regularLimit = 6)
    {
        var now = DateTime.UtcNow;
        var newsQuery = _context.Articles
            .AsNoTracking()
            .Where(a => !a.IsDeleted
                && a.Status == (int)ArticleStatus.Published
                && a.PublishDate <= now
                && a.ArticleCategories.Any(ac => ac.Category.Section == ArticleCategorySection.News));

        var featured = await newsQuery
            .Where(a => a.IsFeatured)
            .OrderByDescending(a => _context.ContentPromotions
                .Where(p => p.TargetType == ContentPromotionTargetType.Article
                    && p.TargetId == a.Id
                    && p.IsActive
                    && (!p.StartsAt.HasValue || p.StartsAt.Value <= DateTime.UtcNow)
                    && (!p.EndsAt.HasValue || p.EndsAt.Value >= DateTime.UtcNow)
                    && (p.Placement == ContentPromotionPlacement.Home || p.Placement == ContentPromotionPlacement.General || p.ShowOnHome))
                .Select(p => (int?)p.Priority)
                .Max() ?? -1)
            .ThenBy(a => a.DisplayOrder)
            .ThenByDescending(a => a.PublishDate)
            .Take(Math.Clamp(featuredLimit, 1, 10))
            .Select(a => new ArticleBannerDto
            {
                Id = a.Id,
                Title = a.Title,
                FeaturedImageUrl = a.FeaturedImageUrl,
                Slug = a.Slug,
                ShortDescription = a.ShortDescription,
                ContentType = (int)ArticleContentType.News,
                IsFeatured = true,
                DisplayOrder = a.DisplayOrder,
                PublishDate = a.PublishDate
            })
            .ToListAsync();

        var featuredIds = featured.Select(a => a.Id).ToList();
        var regular = await newsQuery
            .Where(a => !featuredIds.Contains(a.Id))
            .OrderByDescending(a => _context.ContentPromotions
                .Where(p => p.TargetType == ContentPromotionTargetType.Article
                    && p.TargetId == a.Id
                    && p.IsActive
                    && (!p.StartsAt.HasValue || p.StartsAt.Value <= DateTime.UtcNow)
                    && (!p.EndsAt.HasValue || p.EndsAt.Value >= DateTime.UtcNow)
                    && (p.Placement == ContentPromotionPlacement.Home || p.Placement == ContentPromotionPlacement.General || p.ShowOnHome))
                .Select(p => (int?)p.Priority)
                .Max() ?? -1)
            .ThenByDescending(a => a.BumpedAt ?? a.CreatedAt)
            .Take(Math.Clamp(regularLimit, 1, 20))
            .Select(a => new ArticleBannerDto
            {
                Id = a.Id,
                Title = a.Title,
                FeaturedImageUrl = a.FeaturedImageUrl,
                Slug = a.Slug,
                ShortDescription = a.ShortDescription,
                ContentType = (int)ArticleContentType.News,
                IsFeatured = a.IsFeatured,
                DisplayOrder = a.DisplayOrder,
                PublishDate = a.PublishDate
            })
            .ToListAsync();

        return new HomeNewsBannersDto
        {
            Featured = featured,
            Regular = regular
        };
    }

    public async Task<List<ArticleBannerDto>> GetHomeContentBannersAsync(int limit = 12)
    {
        return await GetPublishedBannerQuery(ArticleCategorySection.Content)
            .OrderByDescending(a => _context.ContentPromotions
                .Where(p => p.TargetType == ContentPromotionTargetType.Article
                    && p.TargetId == a.Id
                    && p.IsActive
                    && (!p.StartsAt.HasValue || p.StartsAt.Value <= DateTime.UtcNow)
                    && (!p.EndsAt.HasValue || p.EndsAt.Value >= DateTime.UtcNow)
                    && (p.Placement == ContentPromotionPlacement.Home || p.Placement == ContentPromotionPlacement.General || p.ShowOnHome))
                .Select(p => (int?)p.Priority)
                .Max() ?? -1)
            .ThenByDescending(a => a.BumpedAt ?? a.CreatedAt)
            .Take(Math.Clamp(limit, 1, 20))
            .Select(a => new ArticleBannerDto
            {
                Id = a.Id,
                Title = a.Title,
                FeaturedImageUrl = a.FeaturedImageUrl,
                Slug = a.Slug,
                ShortDescription = a.ShortDescription,
                ContentType = (int)ArticleContentType.Blog,
                IsFeatured = a.IsFeatured,
                DisplayOrder = a.DisplayOrder,
                PublishDate = a.PublishDate
            })
            .ToListAsync();
    }

    public async Task<HomeCategoryBannersDto> GetHomeCategoryBannersAsync(int limit = 12)
    {
        var configuredCategory = await _systemSettings.GetValueAsync(HomeCategoryIdKey);
        if (!int.TryParse(configuredCategory, out var categoryId) || categoryId <= 0)
        {
            return new HomeCategoryBannersDto();
        }

        var categoryName = await _context.ArticleCategories
            .Where(category => category.Id == categoryId)
            .Select(category => category.DisplayName)
            .FirstOrDefaultAsync();

        if (string.IsNullOrWhiteSpace(categoryName))
        {
            return new HomeCategoryBannersDto();
        }

        var banners = await _context.Articles
            .AsNoTracking()
            .Where(a => !a.IsDeleted
                && a.Status == (int)ArticleStatus.Published
                && a.PublishDate <= DateTime.UtcNow
                && a.ArticleCategories.Any(ac => ac.CategoryId == categoryId))
            .OrderByDescending(a => _context.ContentPromotions
                .Where(p => p.TargetType == ContentPromotionTargetType.Article
                    && p.TargetId == a.Id
                    && p.IsActive
                    && (!p.StartsAt.HasValue || p.StartsAt.Value <= DateTime.UtcNow)
                    && (!p.EndsAt.HasValue || p.EndsAt.Value >= DateTime.UtcNow)
                    && (p.Placement == ContentPromotionPlacement.Home || p.Placement == ContentPromotionPlacement.General || p.ShowOnHome))
                .Select(p => (int?)p.Priority)
                .Max() ?? -1)
            .ThenByDescending(a => a.BumpedAt ?? a.CreatedAt)
            .Take(Math.Clamp(limit, 1, 20))
            .Select(a => new ArticleBannerDto
            {
                Id = a.Id,
                Title = a.Title,
                FeaturedImageUrl = a.FeaturedImageUrl,
                Slug = a.Slug,
                ShortDescription = a.ShortDescription,
                ContentType = a.ContentType,
                IsFeatured = a.IsFeatured,
                DisplayOrder = a.DisplayOrder,
                PublishDate = a.PublishDate
            })
            .ToListAsync();

        return new HomeCategoryBannersDto
        {
            CategoryName = categoryName,
            Banners = banners
        };
    }

    public async Task<List<ArticleBannerDto>> GetHomeViralBannersAsync(int limit = 10, int offset = 0)
    {
        var now = DateTime.UtcNow;
        var weekAgo = now.AddDays(-7);
        var take = Math.Clamp(limit, 1, 10);
        var skip = Math.Clamp(offset, 0, 200);
        var dailySeed = now.Date.DayOfYear;

        var candidates = await _context.Articles
            .AsNoTracking()
            .Where(a => !a.IsDeleted
                && a.Status == (int)ArticleStatus.Published
                && a.PublishDate <= now
                && a.ArticleCategories.Any(ac =>
                    ac.Category.Section == ArticleCategorySection.News
                    || ac.Category.Section == ArticleCategorySection.Content))
            .GroupJoin(
                _context.ArticleViews.AsNoTracking().Where(av =>
                    av.ViewedAt >= weekAgo
                    && av.ViewedAt <= now),
                a => a.Id,
                av => av.ArticleId,
                (a, views) => new
                {
                    Article = new ArticleBannerDto
                    {
                        Id = a.Id,
                        Title = a.Title,
                        FeaturedImageUrl = a.FeaturedImageUrl,
                        Slug = a.Slug,
                        ShortDescription = a.ShortDescription,
                        ContentType = a.ContentType,
                        IsFeatured = a.IsFeatured,
                        DisplayOrder = a.DisplayOrder,
                        PublishDate = a.PublishDate
                    },
                    WeeklyViews = views.Count(),
                    TotalViews = a.ViewCount
                })
            .ToListAsync();

        var latestArticles = candidates
            .OrderByDescending(a => a.Article.PublishDate)
            .ThenByDescending(a => a.Article.Id)
            .Take(4)
            .ToList();
        var latestArticleIds = latestArticles
            .Select(a => a.Article.Id)
            .ToHashSet();

        var viralArticles = candidates
            .Where(a => !latestArticleIds.Contains(a.Article.Id))
            .Select(a => new
            {
                a.Article,
                Score =
                    (a.Article.IsFeatured ? 1000 : 0)
                    + (a.WeeklyViews * 20)
                    + Math.Min(a.TotalViews, 1000)
                    + (((a.Article.Id * 1103515245L + dailySeed * 12345L) & 0x7fffffff) % 700)
            })
            .OrderByDescending(a => a.Score)
            .ThenByDescending(a => a.Article.PublishDate)
            .ThenByDescending(a => a.Article.Id)
            .Select(a => a.Article);

        return latestArticles
            .Select(a => a.Article)
            .Concat(viralArticles)
            .Skip(skip)
            .Take(take)
            .ToList();
    }

    public async Task<PagedResult<ArticleBannerDto>> GetPublishedArticleBannersAsync(
        int contentType,
        int pageNumber = 1,
        int pageSize = 12,
        IEnumerable<int>? categoryIds = null)
    {
        var section = (ArticleCategorySection)contentType;
        var query = GetPublishedBannerQuery(section);
        var ids = categoryIds?.Distinct().ToList();

        if (ids?.Count > 0)
        {
            query = query.Where(a => a.ArticleCategories.Any(ac => ids.Contains(ac.CategoryId)));
        }

        pageNumber = Math.Max(1, pageNumber);
        pageSize = Math.Clamp(pageSize, 1, 40);
        var totalCount = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.BumpedAt ?? a.CreatedAt)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new ArticleBannerDto
            {
                Id = a.Id,
                Title = a.Title,
                FeaturedImageUrl = a.FeaturedImageUrl,
                Slug = a.Slug,
                ShortDescription = a.ShortDescription,
                ContentType = contentType,
                IsFeatured = a.IsFeatured,
                DisplayOrder = a.DisplayOrder,
                PublishDate = a.PublishDate
            })
            .ToListAsync();

        return new PagedResult<ArticleBannerDto>
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = pageNumber,
            PageSize = pageSize
        };
    }

    private IQueryable<Article> GetPublishedBannerQuery(ArticleCategorySection section)
    {
        var now = DateTime.UtcNow;
        return _context.Articles
            .AsNoTracking()
            .Where(a => !a.IsDeleted
                && a.Status == (int)ArticleStatus.Published
                && a.PublishDate <= now
                && a.ArticleCategories.Any(ac => ac.Category.Section == section));
    }

    public async Task<ArticleStatsDto> GetArticleStatsAsync()
    {
        return new ArticleStatsDto
        {
            TotalArticles = await _context.Articles.CountAsync(),
            PublishedArticles = await _context.Articles.CountAsync(a => a.Status == (int)ArticleStatus.Published),
            DraftArticles = await _context.Articles.CountAsync(a => a.Status == (int)ArticleStatus.Draft),
            ScheduledArticles = await _context.Articles.CountAsync(a => a.Status == (int)ArticleStatus.Scheduled),
            TotalViews = await _context.Articles.SumAsync(a => a.ViewCount),
            TotalLikes = await _context.Articles.SumAsync(a => a.LikeCount),
            FeaturedArticles = await _context.Articles.CountAsync(a => a.IsFeatured),
            NewsCount = await _context.Articles.CountAsync(a => a.ArticleCategories.Any(ac => ac.Category.Section == ArticleCategorySection.News)),
            BlogCount = await _context.Articles.CountAsync(a => a.ArticleCategories.Any(ac => ac.Category.Section == ArticleCategorySection.Content))
        };
    }

    public async Task<ArticleDto> CreateArticleAsync(CreateArticleDto dto, int? callerUserId = null)
    {
        await EnsureValidArticleCategoriesAsync(dto.CategoryIds);

        // Validate slug uniqueness
        if (await SlugExistsAsync(dto.Slug))
        {
            throw new InvalidOperationException("An article with this slug already exists");
        }

        var uploader = await NormalizeUploaderAsync(
            callerUserId,
            dto.UploaderUserId,
            dto.UploaderProfileType,
            dto.UploaderProfileId);
        var featuredImageUrl = await StoreYouTubeThumbnailIfNeededAsync(dto.FeaturedImageUrl);
        var openGraphImageUrl = await StoreYouTubeThumbnailIfNeededAsync(dto.OpenGraphImageUrl);
        var sanitizedContent = SanitizeArticleContent(dto.Content);

        var article = new Article
        {
            Title = dto.Title,
            Subtitle = dto.Subtitle,
            Content = sanitizedContent,
            FeaturedImageUrl = featuredImageUrl,
            PublishDate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            AuthorName = dto.AuthorName,
            ContentType = (int)dto.ContentType,
            Slug = dto.Slug,
            CanonicalUrl = dto.CanonicalUrl,
            VideoEmbedUrl = dto.VideoEmbedUrl,
            AudioEmbedUrl = dto.AudioEmbedUrl,
            ImageCredit = dto.ImageCredit,
            FeaturedImageCredit = dto.FeaturedImageCredit,
            ShortDescription = dto.ShortDescription,
            IsFeatured = dto.IsFeatured,
            DisplayOrder = dto.DisplayOrder,
            Status = (int)dto.Status,
            ScheduledDate = dto.ScheduledDate,
            IsPremium = dto.IsPremium,
            MetaTitle = dto.MetaTitle,
            MetaDescription = dto.MetaDescription,
            OpenGraphImageUrl = openGraphImageUrl,
            ReadTimeMinutes = dto.ReadTimeMinutes,
            UploaderUserId = uploader.UserId,
            UploaderProfileType = uploader.ProfileType,
            UploaderProfileId = uploader.ProfileId,
            SubmittedByUserId = callerUserId,
            ViewCount = 0,
            LikeCount = 0,
            IsDeleted = false
        };

        _context.Articles.Add(article);
        await _context.SaveChangesAsync();

        // Add categories
        if (dto.CategoryIds != null && dto.CategoryIds.Any())
            await AddArticleCategoriesAsync(article.Id, dto.CategoryIds);

        // Auto-compute ContentType from categories' sections.
        article.ContentType = await ComputeContentTypeFromCategoriesAsync(dto.CategoryIds);

        // Add tags
        if (dto.TagIds != null && dto.TagIds.Any())
            AddArticleTags(article.Id, dto.TagIds);

        // Add gallery images
        if (dto.GalleryImages != null && dto.GalleryImages.Any())
            AddGalleryImages(article.Id, dto.GalleryImages);

        // Add artists (תיוג אומנים)
        if (dto.ArtistIds != null && dto.ArtistIds.Any())
            AddArticleArtists(article.Id, dto.ArtistIds);

        await _context.SaveChangesAsync();

        return (await GetArticleByIdAsync(article.Id))!;
    }

    public async Task<ArticleDto> UpdateArticleAsync(int id, UpdateArticleDto dto, int? callerUserId = null)
    {
        await EnsureValidArticleCategoriesAsync(dto.CategoryIds);

        var article = await _context.Articles
            .Include(a => a.ArticleCategories)
            .Include(a => a.ArticleTags)
            .Include(a => a.GalleryImages)
            .Include(a => a.ArticleArtists)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (article == null)
        {
            throw new KeyNotFoundException("Article not found");
        }

        // Validate slug uniqueness (excluding current article)
        if (article.Slug != dto.Slug && await SlugExistsAsync(dto.Slug, id))
        {
            throw new InvalidOperationException("An article with this slug already exists");
        }

        var uploader = await NormalizeUploaderAsync(
            callerUserId,
            dto.UploaderUserId,
            dto.UploaderProfileType,
            dto.UploaderProfileId);
        var featuredImageUrl = await StoreYouTubeThumbnailIfNeededAsync(dto.FeaturedImageUrl);
        var openGraphImageUrl = await StoreYouTubeThumbnailIfNeededAsync(dto.OpenGraphImageUrl);
        var sanitizedContent = SanitizeArticleContent(dto.Content);

        // Update article properties
        article.Title = dto.Title;
        article.Subtitle = dto.Subtitle;
        article.Content = sanitizedContent;
        article.FeaturedImageUrl = featuredImageUrl;
        article.UpdatedAt = DateTime.UtcNow;
        article.AuthorName = dto.AuthorName;
        article.Slug = dto.Slug;
        article.CanonicalUrl = dto.CanonicalUrl;
        article.VideoEmbedUrl = dto.VideoEmbedUrl;
        article.AudioEmbedUrl = dto.AudioEmbedUrl;
        article.ImageCredit = dto.ImageCredit;
        article.FeaturedImageCredit = dto.FeaturedImageCredit;
        article.ShortDescription = dto.ShortDescription;
        article.IsFeatured = dto.IsFeatured;
        article.DisplayOrder = dto.DisplayOrder;
        article.Status = (int)dto.Status;
        article.ScheduledDate = dto.ScheduledDate;
        article.IsPremium = dto.IsPremium;
        article.MetaTitle = dto.MetaTitle;
        article.MetaDescription = dto.MetaDescription;
        article.OpenGraphImageUrl = openGraphImageUrl;
        article.ReadTimeMinutes = dto.ReadTimeMinutes;
        article.UploaderUserId = uploader.UserId;
        article.UploaderProfileType = uploader.ProfileType;
        article.UploaderProfileId = uploader.ProfileId;

        // Update categories
        _context.ArticleArticleCategories.RemoveRange(article.ArticleCategories);
        if (dto.CategoryIds != null && dto.CategoryIds.Any())
            await AddArticleCategoriesAsync(article.Id, dto.CategoryIds);

        // Auto-compute ContentType from the new categories' sections.
        article.ContentType = await ComputeContentTypeFromCategoriesAsync(dto.CategoryIds);

        // Update tags
        _context.ArticleTags.RemoveRange(article.ArticleTags);
        if (dto.TagIds != null && dto.TagIds.Any())
            AddArticleTags(article.Id, dto.TagIds);

        // Update gallery images
        _context.ArticleGalleryImages.RemoveRange(article.GalleryImages);
        if (dto.GalleryImages != null && dto.GalleryImages.Any())
            AddGalleryImages(article.Id, dto.GalleryImages);

        // Update artists (תיוג אומנים)
        if (dto.ArtistIds != null)
        {
            var existingArtists = await _context.ArticleArtists
                .Where(aa => aa.ArticleId == id)
                .ToListAsync();
            _context.ArticleArtists.RemoveRange(existingArtists);

            if (dto.ArtistIds.Any())
                AddArticleArtists(article.Id, dto.ArtistIds);
        }

        await _context.SaveChangesAsync();

        return (await GetArticleByIdAsync(id))!;
    }

    public async Task<ArticleDto> UpdateArticleStatusAsync(int id, int status)
    {
        if (!Enum.IsDefined(typeof(ArticleStatus), status))
        {
            throw new InvalidOperationException("Invalid article status");
        }

        var article = await _context.Articles
            .Include(a => a.ArticleCategories)
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

        if (article == null)
        {
            throw new KeyNotFoundException("Article not found");
        }

        if (status == (int)ArticleStatus.Published && !article.ArticleCategories.Any())
        {
            throw new InvalidOperationException("נא לבחור קטגוריה לפני פרסום הכתבה");
        }

        var wasPublished = article.Status == (int)ArticleStatus.Published;
        article.Status = status;
        article.UpdatedAt = DateTime.UtcNow;

        if (!wasPublished && status == (int)ArticleStatus.Published)
        {
            article.PublishDate = DateTime.UtcNow;
            article.ScheduledDate = null;
        }

        await _context.SaveChangesAsync();
        return (await GetArticleByIdAsync(id))!;
    }

    public async Task<ArticleDto> UpdateArticleCategoriesAsync(int id, UpdateArticleCategoriesDto dto)
    {
        var article = await _context.Articles
            .Include(a => a.ArticleCategories)
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

        if (article == null)
        {
            throw new KeyNotFoundException("Article not found");
        }

        var categoryIds = await BuildCategoryIdsForModeAsync(
            article.ArticleCategories.Select(ac => ac.CategoryId),
            dto.CategoryIds,
            dto.Mode);

        var linksToRemove = article.ArticleCategories
            .Where(ac => !categoryIds.Contains(ac.CategoryId))
            .ToList();
        _context.ArticleArticleCategories.RemoveRange(linksToRemove);

        var existingIds = article.ArticleCategories
            .Select(ac => ac.CategoryId)
            .ToHashSet();
        var categoryIdsToAdd = categoryIds
            .Where(categoryId => !existingIds.Contains(categoryId))
            .ToList();
        if (categoryIdsToAdd.Count > 0)
        {
            await AddArticleCategoriesAsync(article.Id, categoryIdsToAdd);
        }

        article.ContentType = await ComputeContentTypeFromCategoriesAsync(categoryIds);
        article.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return (await GetArticleByIdAsync(id))!;
    }

    public async Task<BulkArticleActionResultDto> BulkUpdateArticleCategoriesAsync(BulkUpdateArticleCategoriesDto dto)
    {
        var articleIds = dto.ArticleIds.Distinct().ToList();
        var changedArticles = new List<ArticleDto>();
        await using var transaction = await _context.Database.BeginTransactionAsync();

        foreach (var articleId in articleIds)
        {
            changedArticles.Add(await UpdateArticleCategoriesAsync(articleId, new UpdateArticleCategoriesDto
            {
                CategoryIds = dto.CategoryIds,
                Mode = dto.Mode
            }));
        }

        await transaction.CommitAsync();

        return new BulkArticleActionResultDto
        {
            RequestedCount = articleIds.Count,
            AffectedCount = changedArticles.Count,
            Articles = changedArticles
        };
    }

    public async Task<BulkArticleActionResultDto> BulkUpdateArticleStatusAsync(BulkUpdateArticleStatusDto dto)
    {
        var articleIds = dto.ArticleIds.Distinct().ToList();
        var changedArticles = new List<ArticleDto>();
        await using var transaction = await _context.Database.BeginTransactionAsync();

        foreach (var articleId in articleIds)
        {
            changedArticles.Add(await UpdateArticleStatusAsync(articleId, dto.Status));
        }

        await transaction.CommitAsync();

        return new BulkArticleActionResultDto
        {
            RequestedCount = articleIds.Count,
            AffectedCount = changedArticles.Count,
            Articles = changedArticles
        };
    }

    public async Task<ArticleDto> UpdateArticleArtistsAsync(int id, UpdateArticleArtistsDto dto)
    {
        var article = await _context.Articles
            .Include(a => a.ArticleArtists)
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

        if (article == null)
        {
            throw new KeyNotFoundException("Article not found");
        }

        var artistIds = await BuildArtistIdsForModeAsync(
            article.ArticleArtists.Select(aa => aa.ArtistId),
            dto.ArtistIds,
            dto.Mode);

        var linksToRemove = article.ArticleArtists
            .Where(aa => !artistIds.Contains(aa.ArtistId))
            .ToList();
        _context.ArticleArtists.RemoveRange(linksToRemove);

        var existingIds = article.ArticleArtists
            .Select(aa => aa.ArtistId)
            .ToHashSet();
        var artistIdsToAdd = artistIds
            .Where(artistId => !existingIds.Contains(artistId))
            .ToList();

        if (artistIdsToAdd.Count > 0)
        {
            AddArticleArtists(article.Id, artistIdsToAdd);
        }

        article.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return (await GetArticleByIdAsync(id))!;
    }

    public async Task<BulkArticleActionResultDto> BulkUpdateArticleArtistsAsync(BulkUpdateArticleArtistsDto dto)
    {
        var articleIds = dto.ArticleIds.Distinct().ToList();
        var changedArticles = new List<ArticleDto>();
        await using var transaction = await _context.Database.BeginTransactionAsync();

        foreach (var articleId in articleIds)
        {
            changedArticles.Add(await UpdateArticleArtistsAsync(articleId, new UpdateArticleArtistsDto
            {
                ArtistIds = dto.ArtistIds,
                Mode = dto.Mode
            }));
        }

        await transaction.CommitAsync();

        return new BulkArticleActionResultDto
        {
            RequestedCount = articleIds.Count,
            AffectedCount = changedArticles.Count,
            Articles = changedArticles
        };
    }

    public async Task<ArticleDto> UpdateArticleUploaderAsync(int id, UpdateArticleUploaderDto dto, int? callerUserId = null)
    {
        var article = await _context.Articles
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

        if (article == null)
        {
            throw new KeyNotFoundException("Article not found");
        }

        var uploader = await NormalizeUploaderAsync(
            callerUserId,
            dto.UploaderUserId,
            dto.UploaderProfileType,
            dto.UploaderProfileId);

        article.UploaderUserId = uploader.UserId;
        article.UploaderProfileType = uploader.ProfileType;
        article.UploaderProfileId = uploader.ProfileId;
        article.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return (await GetArticleByIdAsync(id))!;
    }

    public async Task<BulkArticleActionResultDto> BulkUpdateArticleUploaderAsync(BulkUpdateArticleUploaderDto dto, int? callerUserId = null)
    {
        var articleIds = dto.ArticleIds.Distinct().ToList();
        var changedArticles = new List<ArticleDto>();
        await using var transaction = await _context.Database.BeginTransactionAsync();

        foreach (var articleId in articleIds)
        {
            changedArticles.Add(await UpdateArticleUploaderAsync(articleId, new UpdateArticleUploaderDto
            {
                UploaderUserId = dto.UploaderUserId,
                UploaderProfileType = dto.UploaderProfileType,
                UploaderProfileId = dto.UploaderProfileId
            }, callerUserId));
        }

        await transaction.CommitAsync();

        return new BulkArticleActionResultDto
        {
            RequestedCount = articleIds.Count,
            AffectedCount = changedArticles.Count,
            Articles = changedArticles
        };
    }

    public async Task<BulkArticleActionResultDto> BulkDuplicateArticlesAsync(BulkArticleIdsDto dto)
    {
        var articleIds = dto.ArticleIds.Distinct().ToList();
        var duplicates = new List<ArticleDto>();
        await using var transaction = await _context.Database.BeginTransactionAsync();

        foreach (var articleId in articleIds)
        {
            duplicates.Add(await DuplicateArticleAsync(articleId));
        }

        await transaction.CommitAsync();

        return new BulkArticleActionResultDto
        {
            RequestedCount = articleIds.Count,
            AffectedCount = duplicates.Count,
            Articles = duplicates
        };
    }

    public async Task<BulkArticleActionResultDto> BulkDeleteArticlesAsync(BulkArticleIdsDto dto)
    {
        var articleIds = dto.ArticleIds.Distinct().ToList();
        var affectedCount = 0;
        await using var transaction = await _context.Database.BeginTransactionAsync();

        foreach (var articleId in articleIds)
        {
            if (await DeleteArticleAsync(articleId))
            {
                affectedCount++;
            }
        }

        await transaction.CommitAsync();

        return new BulkArticleActionResultDto
        {
            RequestedCount = articleIds.Count,
            AffectedCount = affectedCount
        };
    }

    public async Task<bool> DeleteArticleAsync(int id)
    {
        var article = await _context.Articles.FindAsync(id);

        if (article == null)
        {
            return false;
        }

        // Soft delete
        article.IsDeleted = true;
        article.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<ArticleNewsCleanupSettingsDto> GetNewsCleanupSettingsAsync()
    {
        var retentionDaysValue = await _systemSettings.GetValueAsync(NewsCleanupRetentionDaysKey);
        var lastRunValue = await _systemSettings.GetValueAsync(NewsCleanupLastRunAtKey);

        return new ArticleNewsCleanupSettingsDto
        {
            AutoDeleteEnabled = await _systemSettings.GetBoolAsync(NewsCleanupAutoEnabledKey),
            RetentionDays = NormalizeNewsCleanupDays(retentionDaysValue),
            LastRunAt = DateTime.TryParse(lastRunValue, out var lastRunAt) ? lastRunAt : null
        };
    }

    public async Task<ArticleNewsCleanupSettingsDto> UpdateNewsCleanupSettingsAsync(UpdateArticleNewsCleanupSettingsDto dto)
    {
        var retentionDays = NormalizeNewsCleanupDays(dto.RetentionDays);

        await _systemSettings.UpsertAsync(
            NewsCleanupAutoEnabledKey,
            dto.AutoDeleteEnabled ? "true" : "false",
            "Automatic cleanup for old music news articles");

        await _systemSettings.UpsertAsync(
            NewsCleanupRetentionDaysKey,
            retentionDays.ToString(),
            "Retention period in days for old music news articles");

        return await GetNewsCleanupSettingsAsync();
    }

    public async Task<ArticleNewsCleanupResultDto> CleanupOldNewsAsync(int olderThanDays, CancellationToken cancellationToken = default)
    {
        var normalizedDays = NormalizeNewsCleanupDays(olderThanDays);
        var cutoffDate = DateTime.UtcNow.AddDays(-normalizedDays);

        var query = _context.Articles
            .Where(a => (a.ContentType == (int)ArticleContentType.News
                    || a.ArticleCategories.Any(ac => ac.Category.Section == ArticleCategorySection.News))
                && a.Status == (int)ArticleStatus.Published
                && a.PublishDate < cutoffDate);

        var matchedCount = await query.CountAsync(cancellationToken);

        var deletedCount = await query.ExecuteUpdateAsync(
            setters => setters
                .SetProperty(a => a.IsDeleted, true)
                .SetProperty(a => a.UpdatedAt, DateTime.UtcNow),
            cancellationToken);

        await _systemSettings.UpsertAsync(
            NewsCleanupLastRunAtKey,
            DateTime.UtcNow.ToString("O"),
            "Last old music news cleanup run time");

        return new ArticleNewsCleanupResultDto
        {
            OlderThanDays = normalizedDays,
            CutoffDate = cutoffDate,
            MatchedCount = matchedCount,
            DeletedCount = deletedCount
        };
    }

    public async Task<ArticleNewsCleanupResultDto?> RunAutomaticNewsCleanupAsync(CancellationToken cancellationToken = default)
    {
        var settings = await GetNewsCleanupSettingsAsync();
        if (!settings.AutoDeleteEnabled)
        {
            return null;
        }

        return await CleanupOldNewsAsync(settings.RetentionDays, cancellationToken);
    }

    public async Task<int> IncrementViewCountAsync(int id, int? userId, string? ipAddress, string? userAgent, string? referrer)
    {
        var article = await _context.Articles.FindAsync(id);

        if (article == null)
        {
            throw new KeyNotFoundException("Article not found");
        }

        // Every real page open is a view. Unique visitors are calculated separately
        // in analytics from UserId, or IP + User-Agent for guests.
        _context.ArticleViews.Add(new ArticleView
        {
            ArticleId = id,
            UserId = userId,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            Referrer = referrer,
            ViewedAt = DateTime.UtcNow
        });

        article.ViewCount++;
        await _context.SaveChangesAsync();

        return article.ViewCount;
    }

    public async Task<int> IncrementLikeCountAsync(int id)
    {
        var article = await _context.Articles.FindAsync(id);

        if (article == null)
        {
            throw new KeyNotFoundException("Article not found");
        }

        article.LikeCount++;
        await _context.SaveChangesAsync();

        return article.LikeCount;
    }

    // ─── Feedback ─────────────────────────────────────────────────────────────

    public async Task<ArticleFeedbackResultDto> GetFeedbackAsync(int articleId, int? userId, string? ipAddress, string? guestId)
    {
        var yes = await _context.ArticleFeedbacks.CountAsync(f => f.ArticleId == articleId && f.IsPositive);
        var no = await _context.ArticleFeedbacks.CountAsync(f => f.ArticleId == articleId && !f.IsPositive);
        var total = yes + no;

        ArticleFeedback? userVote = null;
        if (userId.HasValue)
            userVote = await _context.ArticleFeedbacks.FirstOrDefaultAsync(f => f.ArticleId == articleId && f.UserId == userId);
        else
        {
            var anonymousId = BuildAnonymousFeedbackId(guestId, ipAddress);
            if (!string.IsNullOrEmpty(anonymousId))
                userVote = await _context.ArticleFeedbacks.FirstOrDefaultAsync(f => f.ArticleId == articleId && f.UserId == null && f.IpAddress == anonymousId);
        }

        return BuildFeedbackResult(yes, no, total, userVote);
    }

    public async Task<ArticleFeedbackResultDto> SubmitFeedbackAsync(int articleId, bool isPositive, int? userId, string? ipAddress, string? guestId)
    {
        // בדיקה שהכתבה קיימת
        if (!await _context.Articles.AnyAsync(a => a.Id == articleId))
            throw new KeyNotFoundException("Article not found");

        // בדיקה האם כבר הצביע
        ArticleFeedback? existing = null;
        if (userId.HasValue)
            existing = await _context.ArticleFeedbacks
                .FirstOrDefaultAsync(f => f.ArticleId == articleId && f.UserId == userId);
        else
        {
            var anonymousId = BuildAnonymousFeedbackId(guestId, ipAddress);
            if (!string.IsNullOrEmpty(anonymousId))
                existing = await _context.ArticleFeedbacks
                    .FirstOrDefaultAsync(f => f.ArticleId == articleId && f.UserId == null && f.IpAddress == anonymousId);
        }

        if (existing != null)
            throw new InvalidOperationException("Already voted");

        _context.ArticleFeedbacks.Add(new ArticleFeedback
        {
            ArticleId = articleId,
            UserId = userId,
            IpAddress = userId.HasValue ? (string.IsNullOrEmpty(ipAddress) ? null : ipAddress) : BuildAnonymousFeedbackId(guestId, ipAddress),
            IsPositive = isPositive,
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        return await GetFeedbackAsync(articleId, userId, ipAddress, guestId);
    }

    private static ArticleFeedbackResultDto BuildFeedbackResult(int yes, int no, int total, ArticleFeedback? userVote)
    {
        int yesPct = total > 0 ? (int)Math.Round((double)yes / total * 100) : 50;
        int noPct = total > 0 ? 100 - yesPct : 50;
        return new ArticleFeedbackResultDto
        {
            YesCount = yes,
            NoCount = no,
            TotalCount = total,
            YesPct = yesPct,
            NoPct = noPct,
            HasVoted = userVote != null,
            UserChoice = userVote?.IsPositive
        };
    }

    private static string? BuildAnonymousFeedbackId(string? guestId, string? ipAddress)
    {
        if (!string.IsNullOrWhiteSpace(guestId))
            return $"guest:{guestId.Trim()}";

        return string.IsNullOrWhiteSpace(ipAddress) ? null : ipAddress;
    }

    // ─── My Content ────────────────────────────────────────────────────────────

    public async Task<PagedResult<ArticleDto>> GetMyArticlesAsync(int userId, int pageNumber = 1, int pageSize = 8)
    {
        var artistIds = await _context.Artists
            .Where(a => a.UserId == userId && !a.IsDeleted)
            .Select(a => a.Id)
            .ToListAsync();

        var serviceProviderIds = await _context.ServiceProviders
            .Where(p => p.UserId == userId && !p.IsDeleted)
            .Select(p => p.Id)
            .ToListAsync();

        var query = _context.Articles
            .Where(a =>
                !a.IsDeleted &&
                (a.SubmittedByUserId == userId ||
                 a.UploaderUserId == userId ||
                 (a.UploaderProfileType == "artist" && a.UploaderProfileId.HasValue && artistIds.Contains(a.UploaderProfileId.Value)) ||
                 (a.UploaderProfileType == "serviceProvider" && a.UploaderProfileId.HasValue && serviceProviderIds.Contains(a.UploaderProfileId.Value)) ||
                 a.ArticleArtists.Any(aa => artistIds.Contains(aa.ArtistId))))
            .OrderByDescending(a => a.CreatedAt);

        var totalCount = await query.CountAsync();
        var articles = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Include(a => a.ArticleCategories).ThenInclude(ac => ac.Category)
            .Include(a => a.ArticleTags).ThenInclude(at => at.Tag)
            .Include(a => a.GalleryImages)
            .Include(a => a.ArticleArtists).ThenInclude(aa => aa.Artist)
            .Include(a => a.UploaderUser).ThenInclude(u => u!.ManagedArtist)
            .Include(a => a.UploaderUser).ThenInclude(u => u!.ServiceProviderProfiles)
            .AsSplitQuery()
            .ToListAsync();

        return new PagedResult<ArticleDto>
        {
            Items = articles.Select(MapToDto).ToList(),
            TotalCount = totalCount,
            PageNumber = pageNumber,
            PageSize = pageSize
        };
    }

    public async Task<List<ArticleDto>> GetPublishedArticlesByUploaderProfileAsync(string profileType, int profileId, int limit = 12)
    {
        var now = DateTime.UtcNow;

        var articles = await _context.Articles
            .Include(a => a.ArticleCategories).ThenInclude(ac => ac.Category)
            .Include(a => a.ArticleTags).ThenInclude(at => at.Tag)
            .Include(a => a.GalleryImages)
            .Include(a => a.ArticleArtists).ThenInclude(aa => aa.Artist)
            .Include(a => a.UploaderUser).ThenInclude(u => u!.ManagedArtist)
            .Include(a => a.UploaderUser).ThenInclude(u => u!.ServiceProviderProfiles)
            .AsSplitQuery()
            .Where(a => a.UploaderProfileType == profileType
                && a.UploaderProfileId == profileId
                && a.Status == (int)ArticleStatus.Published
                && a.PublishDate <= now
                && !a.IsDeleted)
            .OrderByDescending(a => a.PublishDate)
            .Take(limit)
            .ToListAsync();

        return articles.Select(MapToDto).ToList();
    }

    // ─── Top Content (Admin) ───────────────────────────────────────────────────

    public async Task<List<ArticleRankDto>> GetTopContentAsync(int limit = 20)
    {
        var articles = await _context.Articles
            .Where(a => !a.IsDeleted && a.Status == (int)AkordishKeit.Models.Enum.ArticleStatus.Published)
            .OrderByDescending(a => a.ViewCount + a.LikeCount * 3)
            .Take(limit)
            .ToListAsync();

        var articleIds = articles.Select(a => a.Id).ToList();

        var feedbackGroups = await _context.ArticleFeedbacks
            .Where(f => articleIds.Contains(f.ArticleId))
            .GroupBy(f => f.ArticleId)
            .Select(g => new
            {
                ArticleId = g.Key,
                Yes = g.Count(f => f.IsPositive),
                No = g.Count(f => !f.IsPositive)
            })
            .ToListAsync();

        return articles.Select(a =>
        {
            var fb = feedbackGroups.FirstOrDefault(g => g.ArticleId == a.Id);
            var yes = fb?.Yes ?? 0;
            var no = fb?.No ?? 0;
            var total = yes + no;
            return new ArticleRankDto
            {
                Id = a.Id,
                Title = a.Title,
                Slug = a.Slug,
                FeaturedImageUrl = a.FeaturedImageUrl,
                ContentType = a.ContentType,
                ViewCount = a.ViewCount,
                LikeCount = a.LikeCount,
                FeedbackYes = yes,
                FeedbackNo = no,
                FeedbackTotal = total,
                YesPct = total > 0 ? (int)Math.Round((double)yes / total * 100) : 0
            };
        }).ToList();
    }

    public async Task<bool> SlugExistsAsync(string slug, int? excludeArticleId = null)
    {
        var query = _context.Articles.Where(a => a.Slug == slug);

        if (excludeArticleId.HasValue)
        {
            query = query.Where(a => a.Id != excludeArticleId.Value);
        }

        return await query.AnyAsync();
    }

    public async Task<ArticleDto> DuplicateArticleAsync(int id)
    {
        var original = await _context.Articles
            .Include(a => a.ArticleCategories)
            .Include(a => a.ArticleTags)
            .Include(a => a.GalleryImages)
            .Include(a => a.ArticleArtists)
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

        if (original == null)
            throw new InvalidOperationException("הכתבה לא נמצאה");

        var baseSlug = original.Slug + "-copy";
        var slug = baseSlug;
        var counter = 1;
        while (await SlugExistsAsync(slug))
            slug = $"{baseSlug}-{counter++}";

        var newArticle = new Article
        {
            Title = original.Title + " - עותק",
            Subtitle = original.Subtitle,
            Content = original.Content,
            FeaturedImageUrl = original.FeaturedImageUrl,
            AuthorName = original.AuthorName,
            ContentType = original.ContentType,
            Slug = slug,
            CanonicalUrl = null,
            VideoEmbedUrl = original.VideoEmbedUrl,
            AudioEmbedUrl = original.AudioEmbedUrl,
            ImageCredit = original.ImageCredit,
            FeaturedImageCredit = original.FeaturedImageCredit,
            ShortDescription = original.ShortDescription,
            IsFeatured = false,
            DisplayOrder = 0,
            Status = (int)ArticleStatus.Draft,
            ScheduledDate = null,
            IsPremium = original.IsPremium,
            MetaTitle = original.MetaTitle,
            MetaDescription = original.MetaDescription,
            OpenGraphImageUrl = original.OpenGraphImageUrl,
            ReadTimeMinutes = original.ReadTimeMinutes,
            PublishDate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UploaderUserId = original.UploaderUserId,
            UploaderProfileType = original.UploaderProfileType,
            UploaderProfileId = original.UploaderProfileId,
            ViewCount = 0,
            LikeCount = 0,
            IsDeleted = false
        };

        _context.Articles.Add(newArticle);
        await _context.SaveChangesAsync();

        var categoryIds = original.ArticleCategories.Select(ac => ac.CategoryId).ToList();
        if (categoryIds.Any()) await AddArticleCategoriesAsync(newArticle.Id, categoryIds);

        var tagIds = original.ArticleTags.Select(at => at.TagId).ToList();
        if (tagIds.Any()) AddArticleTags(newArticle.Id, tagIds);

        var galleryImages = original.GalleryImages.Select(gi => new CreateArticleGalleryImageDto
        {
            ImageUrl = gi.ImageUrl,
            Caption = gi.Caption,
            DisplayOrder = gi.DisplayOrder
        }).ToList();
        if (galleryImages.Any()) AddGalleryImages(newArticle.Id, galleryImages);

        var artistIds = original.ArticleArtists.Select(aa => aa.ArtistId).ToList();
        if (artistIds.Any()) AddArticleArtists(newArticle.Id, artistIds);

        await _context.SaveChangesAsync();

        return (await GetArticleByIdAsync(newArticle.Id))!;
    }

    #region Private Helper Methods

    private static int NormalizeNewsCleanupDays(string? value)
    {
        return int.TryParse(value, out var days)
            ? NormalizeNewsCleanupDays(days)
            : DefaultNewsCleanupRetentionDays;
    }

    private static int NormalizeNewsCleanupDays(int days)
    {
        return Math.Clamp(days, MinNewsCleanupRetentionDays, MaxNewsCleanupRetentionDays);
    }

    // ContentType מחושב מהקטגוריות של הכתבה:
    // אם יש קטגוריה אחת לפחות באזור "חדשות" → News (0). אחרת → Blog (1).
    // נשאר כשדה לצורך URLs (התראות, דיווחים) — הסינון בעמוד הציבורי כבר עבר ל-Section של הקטגוריות.
    private async Task<int> ComputeContentTypeFromCategoriesAsync(IEnumerable<int>? categoryIds)
    {
        if (categoryIds == null) return (int)ArticleContentType.News;
        var ids = categoryIds.ToList();
        if (ids.Count == 0) return (int)ArticleContentType.News;

        var hasNews = await _context.ArticleCategories
            .AnyAsync(c => ids.Contains(c.Id) && c.Section == ArticleCategorySection.News);

        return hasNews ? (int)ArticleContentType.News : (int)ArticleContentType.Blog;
    }

    private async Task EnsureValidArticleCategoriesAsync(IEnumerable<int>? categoryIds)
    {
        var ids = categoryIds?.Distinct().ToList() ?? new List<int>();
        if (ids.Count == 0)
        {
            throw new InvalidOperationException("נא לבחור קטגוריה כדי לקבוע איפה הכתבה תוצג באתר");
        }

        var validCount = await _context.ArticleCategories.CountAsync(c => ids.Contains(c.Id));
        if (validCount != ids.Count)
        {
            throw new InvalidOperationException("נבחרה קטגוריה שלא קיימת במערכת");
        }
    }

    private async Task<List<int>> BuildCategoryIdsForModeAsync(
        IEnumerable<int> currentCategoryIds,
        IEnumerable<int>? requestedCategoryIds,
        string? mode)
    {
        var requestedIds = requestedCategoryIds?.Distinct().ToList() ?? new List<int>();
        if (requestedIds.Count == 0)
        {
            throw new InvalidOperationException("נא לבחור לפחות קטגוריה אחת");
        }

        var normalizedMode = string.IsNullOrWhiteSpace(mode) ? "replace" : mode.Trim().ToLowerInvariant();
        var currentIds = currentCategoryIds.Distinct().ToList();

        var finalIds = normalizedMode switch
        {
            "add" => currentIds.Union(requestedIds).Distinct().ToList(),
            "remove" => currentIds.Except(requestedIds).Distinct().ToList(),
            _ => requestedIds
        };

        await EnsureValidArticleCategoriesAsync(finalIds);
        return finalIds;
    }

    private async Task EnsureValidArticleArtistsAsync(IEnumerable<int>? artistIds)
    {
        var ids = artistIds?.Distinct().ToList() ?? new List<int>();
        if (ids.Count == 0) return;

        var existingIds = await _context.Artists
            .Where(a => !a.IsDeleted && ids.Contains(a.Id))
            .Select(a => a.Id)
            .ToListAsync();

        var missingIds = ids.Except(existingIds).ToList();
        if (missingIds.Count > 0)
        {
            throw new InvalidOperationException("אחד האמנים שנבחרו לא נמצא");
        }
    }

    private async Task<List<int>> BuildArtistIdsForModeAsync(
        IEnumerable<int> currentArtistIds,
        IEnumerable<int>? requestedArtistIds,
        string? mode)
    {
        var requestedIds = requestedArtistIds?.Distinct().ToList() ?? new List<int>();
        if (requestedIds.Count == 0)
        {
            throw new InvalidOperationException("נא לבחור לפחות אמן אחד");
        }

        await EnsureValidArticleArtistsAsync(requestedIds);

        var normalizedMode = string.IsNullOrWhiteSpace(mode) ? "replace" : mode.Trim().ToLowerInvariant();
        var currentIds = currentArtistIds.Distinct().ToList();

        return normalizedMode switch
        {
            "add" => currentIds.Union(requestedIds).Distinct().ToList(),
            "remove" => currentIds.Except(requestedIds).Distinct().ToList(),
            _ => requestedIds
        };
    }

    private static IQueryable<Article> ApplyFilters(
        IQueryable<Article> query,
        string? search,
        int? categoryId,
        int? contentType,
        int? status,
        bool? isFeatured,
        bool? isPremium,
        string? authorName,
        int? tagId = null,
        IEnumerable<int>? categoryIds = null,
        int? artistId = null,
        string? uploaderSearch = null,
        DateTime? dateFrom = null,
        DateTime? dateTo = null)
    {
        // Search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search}%";
            query = query.Where(a =>
                EF.Functions.Like(a.Title, pattern) ||
                (a.Subtitle != null && EF.Functions.Like(a.Subtitle, pattern)) ||
                (a.ShortDescription != null && EF.Functions.Like(a.ShortDescription, pattern)) ||
                EF.Functions.Like(a.Slug, pattern));
        }

        // Category filter
        var selectedCategoryIds = categoryIds?
            .Where(id => id > 0)
            .Distinct()
            .ToList() ?? new List<int>();

        if (categoryId.HasValue && categoryId.Value > 0)
        {
            selectedCategoryIds.Add(categoryId.Value);
            selectedCategoryIds = selectedCategoryIds.Distinct().ToList();
        }

        if (selectedCategoryIds.Count > 0)
        {
            query = query.Where(a => a.ArticleCategories.Any(ac => selectedCategoryIds.Contains(ac.CategoryId)));
        }

        // Section filter is derived from the categories' Section field.
        if (contentType.HasValue)
        {
            var section = (ArticleCategorySection)contentType.Value;
            query = query.Where(a => a.ArticleCategories.Any(ac => ac.Category.Section == section));
        }

        // Status filter
        if (status.HasValue)
        {
            query = query.Where(a => a.Status == status.Value);
        }

        // Featured filter
        if (isFeatured.HasValue)
        {
            query = query.Where(a => a.IsFeatured == isFeatured.Value);
        }

        // Premium filter
        if (isPremium.HasValue)
        {
            query = query.Where(a => a.IsPremium == isPremium.Value);
        }

        // Author filter
        if (!string.IsNullOrWhiteSpace(authorName))
        {
            query = query.Where(a => a.AuthorName != null && EF.Functions.Like(a.AuthorName, $"%{authorName}%"));
        }

        // Tag filter
        if (tagId.HasValue)
        {
            query = query.Where(a => a.ArticleTags.Any(at => at.TagId == tagId.Value));
        }

        if (artistId.HasValue)
        {
            query = query.Where(a => a.ArticleArtists.Any(aa => aa.ArtistId == artistId.Value));
        }

        if (!string.IsNullOrWhiteSpace(uploaderSearch))
        {
            var uploaderPattern = $"%{uploaderSearch.Trim()}%";
            query = query.Where(a =>
                a.UploaderUser != null &&
                (EF.Functions.Like(a.UploaderUser.Username, uploaderPattern) ||
                 EF.Functions.Like(a.UploaderUser.Email, uploaderPattern) ||
                 (a.UploaderUser.ManagedArtist != null && EF.Functions.Like(a.UploaderUser.ManagedArtist.Name, uploaderPattern)) ||
                 a.UploaderUser.ServiceProviderProfiles.Any(profile => EF.Functions.Like(profile.DisplayName, uploaderPattern))));
        }

        if (dateFrom.HasValue)
        {
            query = query.Where(a => a.CreatedAt >= dateFrom.Value.Date);
        }

        if (dateTo.HasValue)
        {
            var exclusiveDateTo = dateTo.Value.Date.AddDays(1);
            query = query.Where(a => a.CreatedAt < exclusiveDateTo);
        }

        return query;
    }

    private static IQueryable<Article> ApplySorting(IQueryable<Article> query, string? sortBy)
    {
        return sortBy switch
        {
            "title" => query.OrderBy(a => a.Title),
            "artist" => query.OrderBy(a => a.ArticleArtists
                .OrderBy(aa => aa.Artist.Name)
                .Select(aa => aa.Artist.Name)
                .FirstOrDefault()).ThenBy(a => a.Title),
            "uploader" => query.OrderBy(a => a.UploaderUser != null ? a.UploaderUser.Username : string.Empty).ThenBy(a => a.Title),
            "publish" => query.OrderByDescending(a => a.PublishDate),
            "date_asc" => query.OrderBy(a => a.CreatedAt),
            "views" => query.OrderByDescending(a => a.ViewCount),
            _ => query.OrderByDescending(a => a.BumpedAt ?? a.CreatedAt)
        };
    }

    private ArticleDto MapToDto(Article article)
    {
        return new ArticleDto
        {
            Id = article.Id,
            Title = article.Title,
            Subtitle = article.Subtitle,
            Content = article.Content,
            FeaturedImageUrl = article.FeaturedImageUrl,
            PublishDate = article.PublishDate,
            CreatedAt = article.CreatedAt,
            UpdatedAt = article.UpdatedAt,
            BumpedAt = article.BumpedAt,
            BumpCount = article.BumpCount,
            AuthorName = article.AuthorName,

            CategoryIds = article.ArticleCategories.Select(ac => ac.CategoryId).ToList(),
            CategoryNames = article.ArticleCategories
                .Where(ac => ac.Category != null)
                .Select(ac => ac.Category.DisplayName)
                .ToList(),
            ContentType = article.ContentType,
            ContentTypeName = ((ArticleContentType)article.ContentType).ToString(),
            Slug = article.Slug,
            CanonicalUrl = article.CanonicalUrl,
            VideoEmbedUrl = article.VideoEmbedUrl,
            AudioEmbedUrl = article.AudioEmbedUrl,
            ImageCredit = article.ImageCredit,
            FeaturedImageCredit = article.FeaturedImageCredit,
            ShortDescription = article.ShortDescription,
            IsFeatured = article.IsFeatured,
            DisplayOrder = article.DisplayOrder,
            Status = article.Status,
            StatusName = ((ArticleStatus)article.Status).ToString(),
            ScheduledDate = article.ScheduledDate,
            IsPremium = article.IsPremium,
            MetaTitle = article.MetaTitle,
            MetaDescription = article.MetaDescription,
            OpenGraphImageUrl = article.OpenGraphImageUrl,
            ViewCount = article.ViewCount,
            LikeCount = article.LikeCount,
            ReadTimeMinutes = article.ReadTimeMinutes,
            CreatedBy = article.CreatedBy,
            UpdatedBy = article.UpdatedBy,
            TagIds = article.ArticleTags.Select(at => at.TagId).ToList(),
            Tags = article.ArticleTags.Select(at => at.Tag.Name).ToList(),
            GalleryImages = article.GalleryImages
                .OrderBy(gi => gi.DisplayOrder)
                .Select(gi => new ArticleGalleryImageDto
                {
                    Id = gi.Id,
                    ImageUrl = gi.ImageUrl,
                    Caption = gi.Caption,
                    DisplayOrder = gi.DisplayOrder
                }).ToList(),
            TaggedArtists = article.ArticleArtists?.Select(aa => new ArticleArtistDto
            {
                ArtistId = aa.ArtistId,
                ArtistName = aa.Artist.Name,
                ArtistImageUrl = aa.Artist.ImageUrl
            }).ToList() ?? new List<ArticleArtistDto>(),
            UploaderProfile = ResolveUploaderProfile(article.UploaderUser, article.UploaderProfileType, article.UploaderProfileId),
            SubmittedByUserId = article.SubmittedByUserId,
            UploaderUserId = article.UploaderUserId,
            UploaderProfileType = article.UploaderProfileType,
            UploaderProfileId = article.UploaderProfileId
        };
    }

    private async Task<(int? UserId, string? ProfileType, int? ProfileId)> NormalizeUploaderAsync(
        int? callerUserId,
        int? requestedUserId,
        string? requestedProfileType,
        int? requestedProfileId)
    {
        if (!callerUserId.HasValue)
        {
            return await NormalizeUploaderWithoutCallerAsync(requestedUserId, requestedProfileType, requestedProfileId);
        }

        var currentUser = await _context.Users.FindAsync(callerUserId.Value);
        if (currentUser == null)
        {
            throw new InvalidOperationException("המשתמש לא נמצא");
        }

        var isAdmin = currentUser.Role == UserRole.Admin || currentUser.Role == UserRole.Manager;
        var profileType = NormalizeProfileType(requestedProfileType);
        int? uploaderUserId = isAdmin ? requestedUserId ?? callerUserId.Value : callerUserId.Value;
        var profileId = requestedProfileId;

        if (isAdmin && profileId.HasValue && profileType != null)
        {
            var profileOwnerUserId = await GetProfileOwnerUserIdAsync(profileType, profileId.Value);
            if (requestedUserId.HasValue && profileOwnerUserId.HasValue && requestedUserId.Value != profileOwnerUserId.Value)
            {
                throw new InvalidOperationException("הפרופיל שנבחר לא שייך למשתמש שנבחר");
            }

            var profileExists = await ProfileExistsAsync(profileType, profileId.Value);
            if (!profileExists)
            {
                throw new InvalidOperationException("הפרופיל שנבחר לא נמצא");
            }

            return (profileOwnerUserId ?? requestedUserId, profileType, profileId);
        }

        if (profileType == null)
        {
            return (uploaderUserId, null, null);
        }

        if (!uploaderUserId.HasValue)
        {
            return (null, null, null);
        }

        profileId ??= await GetDefaultProfileIdForUserAsync(uploaderUserId.Value, profileType);
        if (!profileId.HasValue)
        {
            return (uploaderUserId, null, null);
        }

        var belongsToUser = await ProfileBelongsToUserAsync(uploaderUserId.Value, profileType, profileId.Value);
        if (!belongsToUser)
        {
            throw new InvalidOperationException("הפרופיל שנבחר לא שייך למשתמש המעלה");
        }

        return (uploaderUserId, profileType, profileId);
    }

    private async Task<(int? UserId, string? ProfileType, int? ProfileId)> NormalizeUploaderWithoutCallerAsync(
        int? requestedUserId,
        string? requestedProfileType,
        int? requestedProfileId)
    {
        var profileType = NormalizeProfileType(requestedProfileType);
        if (profileType == null)
        {
            return (requestedUserId, null, null);
        }

        var uploaderUserId = requestedUserId;
        if (!uploaderUserId.HasValue && requestedProfileId.HasValue)
        {
            uploaderUserId = await GetProfileOwnerUserIdAsync(profileType, requestedProfileId.Value);
        }

        if (!uploaderUserId.HasValue)
        {
            if (requestedProfileId.HasValue)
            {
                var profileExists = await ProfileExistsAsync(profileType, requestedProfileId.Value);
                return profileExists
                    ? (null, profileType, requestedProfileId.Value)
                    : (null, null, null);
            }

            return (null, null, null);
        }

        var profileId = requestedProfileId ?? await GetDefaultProfileIdForUserAsync(uploaderUserId.Value, profileType);
        if (!profileId.HasValue)
        {
            return (uploaderUserId, null, null);
        }

        var belongsToUser = await ProfileBelongsToUserAsync(uploaderUserId.Value, profileType, profileId.Value);
        if (!belongsToUser)
        {
            throw new InvalidOperationException("הפרופיל שנבחר לא שייך למשתמש המעלה");
        }

        return (uploaderUserId, profileType, profileId);
    }

    private static string? NormalizeProfileType(string? profileType)
    {
        if (string.IsNullOrWhiteSpace(profileType)) return null;
        return profileType == "artist" || profileType == "serviceProvider" ? profileType : null;
    }

    private async Task<int?> GetProfileOwnerUserIdAsync(string profileType, int profileId)
    {
        if (profileType == "artist")
        {
            return await _context.Artists
                .Where(a => !a.IsDeleted && a.Id == profileId)
                .Select(a => a.UserId)
                .FirstOrDefaultAsync();
        }

        return await _context.ServiceProviders
            .Where(p => !p.IsDeleted && p.Id == profileId)
            .Select(p => p.UserId)
            .FirstOrDefaultAsync();
    }

    private async Task<int?> GetDefaultProfileIdForUserAsync(int userId, string profileType)
    {
        if (profileType == "artist")
        {
            return await _context.Artists
                .Where(a => !a.IsDeleted && a.UserId == userId)
                .OrderByDescending(a => a.Status == ArtistStatus.Active)
                .Select(a => (int?)a.Id)
                .FirstOrDefaultAsync();
        }

        return await _context.ServiceProviders
            .Where(p => !p.IsDeleted && p.UserId == userId)
            .OrderByDescending(p => p.IsPrimaryProfile)
            .ThenByDescending(p => p.Status == ProfileStatus.Active)
            .Select(p => (int?)p.Id)
            .FirstOrDefaultAsync();
    }

    private async Task<bool> ProfileBelongsToUserAsync(int userId, string profileType, int profileId)
    {
        if (profileType == "artist")
        {
            return await _context.Artists
                .AnyAsync(a => !a.IsDeleted && a.Id == profileId && a.UserId == userId);
        }

        return await _context.ServiceProviders
            .AnyAsync(p => !p.IsDeleted && p.Id == profileId && p.UserId == userId);
    }

    private async Task<bool> ProfileExistsAsync(string profileType, int profileId)
    {
        if (profileType == "artist")
        {
            return await _context.Artists
                .AnyAsync(a => !a.IsDeleted && a.Id == profileId);
        }

        return await _context.ServiceProviders
            .AnyAsync(p => !p.IsDeleted && p.Id == profileId);
    }

    private ContentUploaderProfileDto? ResolveUploaderProfile(User? user, string? profileType, int? profileId)
    {
        if (string.IsNullOrEmpty(profileType)) return null;

        if (profileType == "artist" && user?.ManagedArtist != null)
        {
            var artist = user.ManagedArtist;
            if (profileId.HasValue && artist.Id != profileId.Value) return null;

            return new ContentUploaderProfileDto
            {
                Type = "artist",
                ProfileId = artist.Id,
                Name = artist.Name,
                ImageUrl = artist.ImageUrl,
                ProfileUrl = $"/artist/{artist.Id}"
            };
        }

        if (profileType == "serviceProvider" && user != null)
        {
            var provider = user.ServiceProviderProfiles
                .Where(p => !p.IsDeleted)
                .Where(p => !profileId.HasValue || p.Id == profileId.Value)
                .OrderByDescending(p => p.IsPrimaryProfile)
                .FirstOrDefault();

            if (provider != null)
            {
                var route = provider.IsTeacher ? "teacher" : "provider";
                return new ContentUploaderProfileDto
                {
                    Type = "serviceProvider",
                    ProfileId = provider.Id,
                    Name = provider.DisplayName,
                    ImageUrl = provider.ProfileImageUrl,
                    ProfileUrl = $"/{route}/{provider.Id}"
                };
            }
        }

        if (profileId.HasValue)
        {
            if (profileType == "artist")
            {
                var artist = _context.Artists
                    .AsNoTracking()
                    .FirstOrDefault(a => !a.IsDeleted && a.Id == profileId.Value);

                return artist == null
                    ? null
                    : new ContentUploaderProfileDto
                    {
                        Type = "artist",
                        ProfileId = artist.Id,
                        Name = artist.Name,
                        ImageUrl = artist.ImageUrl,
                        ProfileUrl = $"/artist/{artist.Id}"
                    };
            }

            if (profileType == "serviceProvider")
            {
                var provider = _context.ServiceProviders
                    .AsNoTracking()
                    .FirstOrDefault(p => !p.IsDeleted && p.Id == profileId.Value);

                if (provider == null) return null;

                var route = provider.IsTeacher ? "teacher" : "provider";
                return new ContentUploaderProfileDto
                {
                    Type = "serviceProvider",
                    ProfileId = provider.Id,
                    Name = provider.DisplayName,
                    ImageUrl = provider.ProfileImageUrl,
                    ProfileUrl = $"/{route}/{provider.Id}"
                };
            }
        }

        return null;
    }

    private async Task AddArticleCategoriesAsync(int articleId, List<int> categoryIds)
    {
        var validCategoryIds = await _context.ArticleCategories
            .Where(c => categoryIds.Contains(c.Id))
            .Select(c => c.Id)
            .ToListAsync();

        foreach (var categoryId in validCategoryIds.Distinct())
        {
            _context.ArticleArticleCategories.Add(new ArticleArticleCategory
            {
                ArticleId = articleId,
                CategoryId = categoryId
            });
        }
    }

    private void AddArticleTags(int articleId, List<int> tagIds)
    {
        foreach (var tagId in tagIds)
        {
            _context.ArticleTags.Add(new ArticleTag
            {
                ArticleId = articleId,
                TagId = tagId
            });
        }
    }

    private void AddGalleryImages(int articleId, List<CreateArticleGalleryImageDto> galleryImages)
    {
        foreach (var dto in galleryImages)
        {
            _context.ArticleGalleryImages.Add(new ArticleGalleryImage
            {
                ArticleId = articleId,
                ImageUrl = dto.ImageUrl,
                Caption = dto.Caption,
                DisplayOrder = dto.DisplayOrder
            });
        }
    }

    private void AddArticleArtists(int articleId, List<int> artistIds)
    {
        foreach (var artistId in artistIds)
        {
            _context.ArticleArtists.Add(new ArticleArtist
            {
                ArticleId = articleId,
                ArtistId = artistId,
                CreatedAt = DateTime.UtcNow
            });
        }
    }

    #endregion
}
