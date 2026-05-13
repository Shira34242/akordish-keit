using AkordishKeit.Data;
using AkordishKeit.Extensions;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class ArticleService : IArticleService
{
    private readonly AkordishKeitDbContext _context;
    private readonly INotificationService _notificationService;

    public ArticleService(AkordishKeitDbContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
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
        int? tagId = null)
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
        query = ApplyFilters(query, search, categoryId, contentType, status, isFeatured, isPremium, authorName, tagId);

        // Order by CreatedAt before pagination
        query = query.OrderByDescending(a => a.CreatedAt);

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
            .OrderBy(a => a.DisplayOrder)
            .ThenByDescending(a => a.PublishDate)
            .Take(limit)
            .ToListAsync();

        return articles.Select(MapToDto).ToList();
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

        var article = new Article
        {
            Title = dto.Title,
            Subtitle = dto.Subtitle,
            Content = dto.Content,
            FeaturedImageUrl = dto.FeaturedImageUrl,
            PublishDate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            AuthorName = dto.AuthorName,
            ContentType = (int)dto.ContentType,
            Slug = dto.Slug,
            CanonicalUrl = dto.CanonicalUrl,
            VideoEmbedUrl = dto.VideoEmbedUrl,
            AudioEmbedUrl = dto.AudioEmbedUrl,
            ImageCredit = dto.ImageCredit,
            ShortDescription = dto.ShortDescription,
            IsFeatured = dto.IsFeatured,
            DisplayOrder = dto.DisplayOrder,
            Status = (int)dto.Status,
            ScheduledDate = dto.ScheduledDate,
            IsPremium = dto.IsPremium,
            MetaTitle = dto.MetaTitle,
            MetaDescription = dto.MetaDescription,
            OpenGraphImageUrl = dto.OpenGraphImageUrl,
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

        var wasPublished = article.Status == (int)ArticleStatus.Published;

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

        // Update article properties
        article.Title = dto.Title;
        article.Subtitle = dto.Subtitle;
        article.Content = dto.Content;
        article.FeaturedImageUrl = dto.FeaturedImageUrl;
        article.UpdatedAt = DateTime.UtcNow;
        article.AuthorName = dto.AuthorName;
        article.Slug = dto.Slug;
        article.CanonicalUrl = dto.CanonicalUrl;
        article.VideoEmbedUrl = dto.VideoEmbedUrl;
        article.AudioEmbedUrl = dto.AudioEmbedUrl;
        article.ImageCredit = dto.ImageCredit;
        article.ShortDescription = dto.ShortDescription;
        article.IsFeatured = dto.IsFeatured;
        article.DisplayOrder = dto.DisplayOrder;
        article.Status = (int)dto.Status;
        article.ScheduledDate = dto.ScheduledDate;
        article.IsPremium = dto.IsPremium;
        article.MetaTitle = dto.MetaTitle;
        article.MetaDescription = dto.MetaDescription;
        article.OpenGraphImageUrl = dto.OpenGraphImageUrl;
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

        if (!wasPublished &&
            article.Status == (int)ArticleStatus.Published &&
            article.SubmittedByUserId.HasValue)
        {
            await _notificationService.NotifyArticleApprovedAsync(
                article.SubmittedByUserId.Value,
                article.Id,
                article.Title,
                article.Slug,
                article.ContentType);
        }

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

            if (article.SubmittedByUserId.HasValue)
            {
                await _notificationService.NotifyArticleApprovedAsync(
                    article.SubmittedByUserId.Value,
                    article.Id,
                    article.Title,
                    article.Slug,
                    article.ContentType);
            }
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

    public async Task<int> IncrementViewCountAsync(int id, int? userId, string? ipAddress, string? userAgent, string? referrer)
    {
        var article = await _context.Articles.FindAsync(id);

        if (article == null)
        {
            throw new KeyNotFoundException("Article not found");
        }

        // Check if this is a unique view (within last 24 hours)
        var cutoffTime = DateTime.UtcNow.AddHours(-24);
        bool isUniqueView = false;

        if (userId.HasValue)
        {
            // For logged-in users: check by UserId
            isUniqueView = !await _context.ArticleViews
                .AnyAsync(av => av.ArticleId == id &&
                               av.UserId == userId &&
                               av.ViewedAt >= cutoffTime);
        }
        else if (!string.IsNullOrEmpty(ipAddress))
        {
            // For guest users: check by IP + UserAgent
            isUniqueView = !await _context.ArticleViews
                .AnyAsync(av => av.ArticleId == id &&
                               av.IpAddress == ipAddress &&
                               av.UserAgent == userAgent &&
                               av.ViewedAt >= cutoffTime);
        }
        else
        {
            // No tracking info available, count as unique
            isUniqueView = true;
        }

        // Only increment if this is a unique view
        if (isUniqueView)
        {
            // Record the view
            var articleView = new ArticleView
            {
                ArticleId = id,
                UserId = userId,
                IpAddress = ipAddress,
                UserAgent = userAgent,
                Referrer = referrer,
                ViewedAt = DateTime.UtcNow
            };

            _context.ArticleViews.Add(articleView);

            // Increment the counter
            article.ViewCount++;

            await _context.SaveChangesAsync();
        }

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

    public async Task<ArticleFeedbackResultDto> GetFeedbackAsync(int articleId, int? userId, string? ipAddress)
    {
        var yes = await _context.ArticleFeedbacks.CountAsync(f => f.ArticleId == articleId && f.IsPositive);
        var no = await _context.ArticleFeedbacks.CountAsync(f => f.ArticleId == articleId && !f.IsPositive);
        var total = yes + no;

        ArticleFeedback? userVote = null;
        if (userId.HasValue)
            userVote = await _context.ArticleFeedbacks.FirstOrDefaultAsync(f => f.ArticleId == articleId && f.UserId == userId);
        else if (!string.IsNullOrEmpty(ipAddress))
            userVote = await _context.ArticleFeedbacks.FirstOrDefaultAsync(f => f.ArticleId == articleId && f.UserId == null && f.IpAddress == ipAddress);

        return BuildFeedbackResult(yes, no, total, userVote);
    }

    public async Task<ArticleFeedbackResultDto> SubmitFeedbackAsync(int articleId, bool isPositive, int? userId, string? ipAddress)
    {
        // בדיקה שהכתבה קיימת
        if (!await _context.Articles.AnyAsync(a => a.Id == articleId))
            throw new KeyNotFoundException("Article not found");

        // בדיקה האם כבר הצביע
        ArticleFeedback? existing = null;
        if (userId.HasValue)
            existing = await _context.ArticleFeedbacks
                .FirstOrDefaultAsync(f => f.ArticleId == articleId && f.UserId == userId);
        else if (!string.IsNullOrEmpty(ipAddress))
            existing = await _context.ArticleFeedbacks
                .FirstOrDefaultAsync(f => f.ArticleId == articleId && f.UserId == null && f.IpAddress == ipAddress);

        if (existing != null)
            throw new InvalidOperationException("Already voted");

        _context.ArticleFeedbacks.Add(new ArticleFeedback
        {
            ArticleId = articleId,
            UserId = userId,
            IpAddress = string.IsNullOrEmpty(ipAddress) ? null : ipAddress,
            IsPositive = isPositive,
            CreatedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync();

        return await GetFeedbackAsync(articleId, userId, ipAddress);
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

    private static IQueryable<Article> ApplyFilters(
        IQueryable<Article> query,
        string? search,
        int? categoryId,
        int? contentType,
        int? status,
        bool? isFeatured,
        bool? isPremium,
        string? authorName,
        int? tagId = null)
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
        if (categoryId.HasValue)
        {
            query = query.Where(a => a.ArticleCategories.Any(ac => ac.CategoryId == categoryId.Value));
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

        return query;
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
