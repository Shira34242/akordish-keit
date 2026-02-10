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

    public ArticleService(AkordishKeitDbContext context)
    {
        _context = context;
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
        int pageSize)
    {
        var query = _context.Articles
            .Include(a => a.ArticleCategories)
                .ThenInclude(ac => ac.Category)
            .Include(a => a.ArticleTags)
                .ThenInclude(at => at.Tag)
            .Include(a => a.GalleryImages)
            .Include(a => a.ArticleArtists)
                .ThenInclude(aa => aa.Artist)
            .AsQueryable();

        // Apply filters
        query = ApplyFilters(query, search, categoryId, contentType, status, isFeatured, isPremium, authorName);

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
            .Include(a => a.ArticleCategories)
                .ThenInclude(ac => ac.Category)
            .Include(a => a.ArticleTags)
                .ThenInclude(at => at.Tag)
            .Include(a => a.GalleryImages)
            .Include(a => a.ArticleArtists)
                .ThenInclude(aa => aa.Artist)
            .FirstOrDefaultAsync(a => a.Id == id);

        return article == null ? null : MapToDto(article);
    }

    public async Task<ArticleDto?> GetArticleBySlugAsync(string slug)
    {
        var article = await _context.Articles
            .Include(a => a.ArticleCategories)
                .ThenInclude(ac => ac.Category)
            .Include(a => a.ArticleTags)
                .ThenInclude(at => at.Tag)
            .Include(a => a.GalleryImages)
            .Include(a => a.ArticleArtists)
                .ThenInclude(aa => aa.Artist)
            .FirstOrDefaultAsync(a => a.Slug == slug);

        return article == null ? null : MapToDto(article);
    }

    public async Task<List<ArticleDto>> GetFeaturedArticlesAsync(int? contentType, int limit)
    {
        var query = _context.Articles
            .Where(a => a.IsFeatured && a.Status == (int)ArticleStatus.Published && a.PublishDate <= DateTime.UtcNow)
            .AsQueryable();

        if (contentType.HasValue)
        {
            query = query.Where(a => a.ContentType == contentType.Value);
        }

        var articles = await query
            .Include(a => a.ArticleCategories)
                .ThenInclude(ac => ac.Category)
            .Include(a => a.ArticleTags)
                .ThenInclude(at => at.Tag)
            .Include(a => a.ArticleArtists)
                .ThenInclude(aa => aa.Artist)
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
            NewsCount = await _context.Articles.CountAsync(a => a.ContentType == (int)ArticleContentType.News),
            BlogCount = await _context.Articles.CountAsync(a => a.ContentType == (int)ArticleContentType.Blog)
        };
    }

    public async Task<ArticleDto> CreateArticleAsync(CreateArticleDto dto)
    {
        // Validate slug uniqueness
        if (await SlugExistsAsync(dto.Slug))
        {
            throw new InvalidOperationException("An article with this slug already exists");
        }

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
            ViewCount = 0,
            LikeCount = 0,
            IsDeleted = false
        };

        _context.Articles.Add(article);
        await _context.SaveChangesAsync();

        // Add categories
        if (dto.CategoryIds != null && dto.CategoryIds.Any())
        {
            await AddArticleCategoriesAsync(article.Id, dto.CategoryIds);
        }

        // Add tags
        if (dto.TagIds != null && dto.TagIds.Any())
        {
            await AddArticleTagsAsync(article.Id, dto.TagIds);
        }

        // Add gallery images
        if (dto.GalleryImages != null && dto.GalleryImages.Any())
        {
            await AddGalleryImagesAsync(article.Id, dto.GalleryImages);
        }

        // Add artists (תיוג אומנים)
        if (dto.ArtistIds != null && dto.ArtistIds.Any())
        {
            await AddArticleArtistsAsync(article.Id, dto.ArtistIds);
        }

        return (await GetArticleByIdAsync(article.Id))!;
    }

    public async Task<ArticleDto> UpdateArticleAsync(int id, UpdateArticleDto dto)
    {
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

        // Update article properties
        article.Title = dto.Title;
        article.Subtitle = dto.Subtitle;
        article.Content = dto.Content;
        article.FeaturedImageUrl = dto.FeaturedImageUrl;
        article.UpdatedAt = DateTime.UtcNow;
        article.AuthorName = dto.AuthorName;
        article.ContentType = (int)dto.ContentType;
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

        // Update categories
        _context.ArticleArticleCategories.RemoveRange(article.ArticleCategories);
        if (dto.CategoryIds != null && dto.CategoryIds.Any())
        {
            await AddArticleCategoriesAsync(article.Id, dto.CategoryIds);
        }

        // Update tags
        _context.ArticleTags.RemoveRange(article.ArticleTags);
        if (dto.TagIds != null && dto.TagIds.Any())
        {
            await AddArticleTagsAsync(article.Id, dto.TagIds);
        }

        // Update gallery images
        _context.ArticleGalleryImages.RemoveRange(article.GalleryImages);
        if (dto.GalleryImages != null && dto.GalleryImages.Any())
        {
            await AddGalleryImagesAsync(article.Id, dto.GalleryImages);
        }

        // Update artists (תיוג אומנים)
        if (dto.ArtistIds != null)
        {
            var existingArtists = await _context.ArticleArtists
                .Where(aa => aa.ArticleId == id)
                .ToListAsync();
            _context.ArticleArtists.RemoveRange(existingArtists);

            if (dto.ArtistIds.Any())
            {
                await AddArticleArtistsAsync(article.Id, dto.ArtistIds);
            }
        }

        await _context.SaveChangesAsync();

        return (await GetArticleByIdAsync(id))!;
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

    public async Task<bool> SlugExistsAsync(string slug, int? excludeArticleId = null)
    {
        var query = _context.Articles.Where(a => a.Slug == slug);

        if (excludeArticleId.HasValue)
        {
            query = query.Where(a => a.Id != excludeArticleId.Value);
        }

        return await query.AnyAsync();
    }

    #region Private Helper Methods

    private static IQueryable<Article> ApplyFilters(
        IQueryable<Article> query,
        string? search,
        int? categoryId,
        int? contentType,
        int? status,
        bool? isFeatured,
        bool? isPremium,
        string? authorName)
    {
        // Search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.ToLower();
            query = query.Where(a =>
                a.Title.ToLower().Contains(searchLower) ||
                (a.Subtitle != null && a.Subtitle.ToLower().Contains(searchLower)) ||
                (a.ShortDescription != null && a.ShortDescription.ToLower().Contains(searchLower)) ||
                a.Slug.ToLower().Contains(searchLower));
        }

        // Category filter
        if (categoryId.HasValue)
        {
            query = query.Where(a => a.ArticleCategories.Any(ac => ac.CategoryId == categoryId.Value));
        }

        // ContentType filter
        if (contentType.HasValue)
        {
            query = query.Where(a => a.ContentType == contentType.Value);
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
            query = query.Where(a => a.AuthorName != null && a.AuthorName.ToLower().Contains(authorName.ToLower()));
        }

        return query;
    }

    private static ArticleDto MapToDto(Article article)
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
            }).ToList() ?? new List<ArticleArtistDto>()
        };
    }

    private async Task AddArticleCategoriesAsync(int articleId, List<int> categoryIds)
    {
        foreach (var categoryId in categoryIds)
        {
            var articleCategory = new ArticleArticleCategory
            {
                ArticleId = articleId,
                CategoryId = categoryId
            };
            _context.ArticleArticleCategories.Add(articleCategory);
        }
        await _context.SaveChangesAsync();
    }

    private async Task AddArticleTagsAsync(int articleId, List<int> tagIds)
    {
        foreach (var tagId in tagIds)
        {
            var articleTag = new ArticleTag
            {
                ArticleId = articleId,
                TagId = tagId
            };
            _context.ArticleTags.Add(articleTag);
        }
        await _context.SaveChangesAsync();
    }

    private async Task AddGalleryImagesAsync(int articleId, List<CreateArticleGalleryImageDto> galleryImages)
    {
        foreach (var galleryImageDto in galleryImages)
        {
            var galleryImage = new ArticleGalleryImage
            {
                ArticleId = articleId,
                ImageUrl = galleryImageDto.ImageUrl,
                Caption = galleryImageDto.Caption,
                DisplayOrder = galleryImageDto.DisplayOrder
            };
            _context.ArticleGalleryImages.Add(galleryImage);
        }
        await _context.SaveChangesAsync();
    }

    private async Task AddArticleArtistsAsync(int articleId, List<int> artistIds)
    {
        foreach (var artistId in artistIds)
        {
            var articleArtist = new ArticleArtist
            {
                ArticleId = articleId,
                ArtistId = artistId,
                CreatedAt = DateTime.UtcNow
            };
            _context.ArticleArtists.Add(articleArtist);
        }
        await _context.SaveChangesAsync();
    }

    #endregion
}
