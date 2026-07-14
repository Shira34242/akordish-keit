using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services
{
    public class NewsPageSectionService : INewsPageSectionService
    {
        private readonly AkordishKeitDbContext _context;

        public NewsPageSectionService(AkordishKeitDbContext context)
        {
            _context = context;
        }

        public async Task<List<NewsPageSectionDto>> GetActiveSectionsWithArticlesAsync()
        {
            var sections = await _context.NewsPageSections
                .Include(s => s.Categories)
                .Where(s => s.IsActive)
                .OrderBy(s => s.DisplayOrder)
                .ToListAsync();

            var result = new List<NewsPageSectionDto>();

            foreach (var section in sections)
            {
                result.Add(MapToDto(section, new List<ArticleDto>()));
            }

            return result;
        }

        public async Task<List<NewsPageSectionDto>> GetAllSectionsAsync()
        {
            var sections = await _context.NewsPageSections
                .Include(s => s.Categories)
                .OrderBy(s => s.DisplayOrder)
                .ToListAsync();

            return sections.Select(s => MapToDto(s, new List<ArticleDto>())).ToList();
        }

        public async Task<NewsPageSectionDto?> GetSectionByIdAsync(int id)
        {
            var section = await _context.NewsPageSections
                .Include(s => s.Categories)
                .FirstOrDefaultAsync(s => s.Id == id);
            if (section == null) return null;

            var articles = await LoadArticlesForSectionAsync(section);
            return MapToDto(section, articles);
        }

        public async Task<NewsPageSectionDto> CreateSectionAsync(CreateNewsPageSectionDto dto)
        {
            var categoryIds = await NormalizeCategoryIdsAsync(dto.CategoryIds, dto.CategoryId, dto.ContentTypeId);
            var section = new NewsPageSection
            {
                Title = ResolvePageTitle(dto.Title, dto.ContentTypeId),
                SectionType = 0,
                CategoryId = GetPrimaryCategoryId(categoryIds),
                ContentTypeId = dto.ContentTypeId,
                DisplayOrder = dto.DisplayOrder,
                IsActive = dto.IsActive && categoryIds.Count > 0,
                ArticleCount = 0,
                CreatedAt = DateTime.UtcNow,
                Categories = categoryIds
                    .Select(categoryId => new NewsPageSectionCategory { CategoryId = categoryId })
                    .ToList()
            };

            _context.NewsPageSections.Add(section);
            await _context.SaveChangesAsync();

            return MapToDto(section, new List<ArticleDto>());
        }

        public async Task<NewsPageSectionDto?> UpdateSectionAsync(int id, UpdateNewsPageSectionDto dto)
        {
            var section = await _context.NewsPageSections
                .Include(s => s.Categories)
                .FirstOrDefaultAsync(s => s.Id == id);
            if (section == null) return null;

            var categoryIds = await NormalizeCategoryIdsAsync(dto.CategoryIds, dto.CategoryId, dto.ContentTypeId);

            section.Title = ResolvePageTitle(dto.Title, dto.ContentTypeId);
            section.SectionType = 0;
            section.CategoryId = GetPrimaryCategoryId(categoryIds);
            section.ContentTypeId = dto.ContentTypeId;
            section.DisplayOrder = dto.DisplayOrder;
            section.IsActive = dto.IsActive && categoryIds.Count > 0;
            section.ArticleCount = 0;
            section.UpdatedAt = DateTime.UtcNow;
            SyncSectionCategories(section, categoryIds);

            await _context.SaveChangesAsync();

            return MapToDto(section, new List<ArticleDto>());
        }

        public async Task<bool> DeleteSectionAsync(int id)
        {
            var section = await _context.NewsPageSections
                .Include(s => s.Categories)
                .FirstOrDefaultAsync(s => s.Id == id);
            if (section == null) return false;

            _context.NewsPageSections.Remove(section);
            await _context.SaveChangesAsync();
            return true;
        }

        // --- Private helpers ---

        private async Task<List<ArticleDto>> LoadArticlesForSectionAsync(NewsPageSection section)
        {
            var query = _context.Articles
                .Include(a => a.ArticleCategories)
                    .ThenInclude(ac => ac.Category)
                .Include(a => a.ArticleTags)
                    .ThenInclude(at => at.Tag)
                .Include(a => a.GalleryImages)
                .Include(a => a.ArticleArtists)
                    .ThenInclude(aa => aa.Artist)
                .Where(a => a.Status == (int)ArticleStatus.Published
                    && a.PublishDate <= DateTime.UtcNow
                    && !a.IsDeleted)
                .AsQueryable();

            var categoryIds = GetCategoryIds(section);

            if (categoryIds.Count == 0)
            {
                return new List<ArticleDto>();
            }

            query = query.Where(a => a.ArticleCategories.Any(ac => categoryIds.Contains(ac.CategoryId)));

            var articles = await query
                .OrderByDescending(a => a.PublishDate)
                .ToListAsync();

            return articles.Select(MapArticleToDto).ToList();
        }

        private static NewsPageSectionDto MapToDto(NewsPageSection section, List<ArticleDto> articles)
        {
            return new NewsPageSectionDto
            {
                Id = section.Id,
                Title = section.Title,
                SectionType = section.SectionType,
                CategoryId = section.CategoryId,
                ContentTypeId = section.ContentTypeId,
                CategoryIds = GetCategoryIds(section),
                DisplayOrder = section.DisplayOrder,
                IsActive = section.IsActive,
                ArticleCount = 0,
                Articles = articles
            };
        }

        private async Task<List<int>> NormalizeCategoryIdsAsync(
            IEnumerable<int>? categoryIds,
            int? fallbackCategoryId,
            int? contentTypeId)
        {
            var ids = categoryIds?
                .Where(id => id > 0)
                .Distinct()
                .ToList() ?? new List<int>();

            if (ids.Count == 0 && fallbackCategoryId.HasValue && fallbackCategoryId.Value > 0)
            {
                ids.Add(fallbackCategoryId.Value);
            }

            if (ids.Count == 0)
            {
                return ids;
            }

            var validCategories = await _context.ArticleCategories
                .Where(category => ids.Contains(category.Id))
                .Select(category => new { category.Id, category.Section })
                .ToListAsync();

            if (contentTypeId.HasValue)
            {
                validCategories = validCategories
                    .Where(category => (int)category.Section == contentTypeId.Value)
                    .ToList();
            }

            var validIds = validCategories.Select(category => category.Id).ToHashSet();
            return ids.Where(validIds.Contains).ToList();
        }

        private static int? GetPrimaryCategoryId(List<int> categoryIds)
        {
            return categoryIds.Count > 0 ? categoryIds[0] : null;
        }

        private static string ResolvePageTitle(string? title, int? contentTypeId)
        {
            if (!string.IsNullOrWhiteSpace(title))
            {
                return title.Trim();
            }

            return contentTypeId == 1 ? "כתבות" : "חדשות המוזיקה";
        }

        private static List<int> GetCategoryIds(NewsPageSection section)
        {
            var ids = section.Categories?
                .Select(category => category.CategoryId)
                .Where(id => id > 0)
                .Distinct()
                .ToList() ?? new List<int>();

            if (ids.Count == 0 && section.CategoryId.HasValue && section.CategoryId.Value > 0)
            {
                ids.Add(section.CategoryId.Value);
            }

            return ids;
        }

        private static void SyncSectionCategories(NewsPageSection section, List<int> categoryIds)
        {
            var wantedIds = categoryIds.Where(id => id > 0).Distinct().ToHashSet();

            var linksToRemove = section.Categories
                .Where(link => !wantedIds.Contains(link.CategoryId))
                .ToList();

            foreach (var link in linksToRemove)
            {
                section.Categories.Remove(link);
            }

            var existingIds = section.Categories.Select(link => link.CategoryId).ToHashSet();
            foreach (var categoryId in wantedIds.Where(id => !existingIds.Contains(id)))
            {
                section.Categories.Add(new NewsPageSectionCategory
                {
                    NewsPageSectionId = section.Id,
                    CategoryId = categoryId
                });
            }
        }

        private static ArticleDto MapArticleToDto(Article article)
        {
            return new ArticleDto
            {
                Id = article.Id,
                Title = article.Title,
                Subtitle = article.Subtitle,
                Content = article.Content,
                ShortDescription = article.ShortDescription,
                FeaturedImageUrl = article.FeaturedImageUrl,
                ImageCredit = article.ImageCredit,
                FeaturedImageCredit = article.FeaturedImageCredit,
                VideoEmbedUrl = article.VideoEmbedUrl,
                AudioEmbedUrl = article.AudioEmbedUrl,
                CategoryIds = article.ArticleCategories?.Select(ac => ac.CategoryId).ToList() ?? new List<int>(),
                CategoryNames = article.ArticleCategories?
                    .Select(ac => ac.Category.DisplayName)
                    .ToList() ?? new List<string>(),
                ContentType = article.ContentType,
                ContentTypeName = article.ContentType.ToString(),
                Slug = article.Slug,
                Status = article.Status,
                StatusName = article.Status.ToString(),
                PublishDate = article.PublishDate,
                ScheduledDate = article.ScheduledDate,
                IsFeatured = article.IsFeatured,
                DisplayOrder = article.DisplayOrder,
                IsPremium = article.IsPremium,
                CanonicalUrl = article.CanonicalUrl,
                MetaTitle = article.MetaTitle,
                MetaDescription = article.MetaDescription,
                OpenGraphImageUrl = article.OpenGraphImageUrl,
                AuthorName = article.AuthorName,
                CreatedAt = article.CreatedAt,
                UpdatedAt = article.UpdatedAt,
                CreatedBy = article.CreatedBy,
                UpdatedBy = article.UpdatedBy,
                ViewCount = article.ViewCount,
                LikeCount = article.LikeCount,
                ReadTimeMinutes = article.ReadTimeMinutes,
                Tags = article.ArticleTags?.Select(at => at.Tag.Name).ToList() ?? new List<string>(),
                GalleryImages = article.GalleryImages?.Select(gi => new ArticleGalleryImageDto
                {
                    Id = gi.Id,
                    ImageUrl = gi.ImageUrl,
                    Caption = gi.Caption,
                    DisplayOrder = gi.DisplayOrder
                }).ToList() ?? new List<ArticleGalleryImageDto>(),
                TaggedArtists = article.ArticleArtists?.Select(aa => new ArticleArtistDto
                {
                    ArtistId = aa.ArtistId,
                    ArtistName = aa.Artist?.Name ?? string.Empty,
                    ArtistImageUrl = aa.Artist?.ImageUrl
                }).ToList() ?? new List<ArticleArtistDto>()
            };
        }
    }
}
