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
                .Where(s => s.IsActive)
                .OrderBy(s => s.DisplayOrder)
                .ToListAsync();

            var result = new List<NewsPageSectionDto>();

            foreach (var section in sections)
            {
                var articles = await LoadArticlesForSectionAsync(section);
                result.Add(MapToDto(section, articles));
            }

            return result;
        }

        public async Task<List<NewsPageSectionDto>> GetAllSectionsAsync()
        {
            var sections = await _context.NewsPageSections
                .OrderBy(s => s.DisplayOrder)
                .ToListAsync();

            return sections.Select(s => MapToDto(s, new List<ArticleDto>())).ToList();
        }

        public async Task<NewsPageSectionDto?> GetSectionByIdAsync(int id)
        {
            var section = await _context.NewsPageSections.FindAsync(id);
            if (section == null) return null;

            var articles = await LoadArticlesForSectionAsync(section);
            return MapToDto(section, articles);
        }

        public async Task<NewsPageSectionDto> CreateSectionAsync(CreateNewsPageSectionDto dto)
        {
            var section = new NewsPageSection
            {
                Title = dto.Title,
                SectionType = dto.SectionType,
                CategoryId = dto.CategoryId,
                ContentTypeId = dto.ContentTypeId,
                DisplayOrder = dto.DisplayOrder,
                IsActive = dto.IsActive,
                ArticleCount = dto.ArticleCount,
                CreatedAt = DateTime.UtcNow
            };

            _context.NewsPageSections.Add(section);
            await _context.SaveChangesAsync();

            return MapToDto(section, new List<ArticleDto>());
        }

        public async Task<NewsPageSectionDto?> UpdateSectionAsync(int id, UpdateNewsPageSectionDto dto)
        {
            var section = await _context.NewsPageSections.FindAsync(id);
            if (section == null) return null;

            section.Title = dto.Title;
            section.SectionType = dto.SectionType;
            section.CategoryId = dto.CategoryId;
            section.ContentTypeId = dto.ContentTypeId;
            section.DisplayOrder = dto.DisplayOrder;
            section.IsActive = dto.IsActive;
            section.ArticleCount = dto.ArticleCount;
            section.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return MapToDto(section, new List<ArticleDto>());
        }

        public async Task<bool> DeleteSectionAsync(int id)
        {
            var section = await _context.NewsPageSections.FindAsync(id);
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
                .Where(a => a.Status == (int)ArticleStatus.Published && !a.IsDeleted)
                .AsQueryable();

            // SectionType 0: filter by category
            if (section.SectionType == 0 && !section.CategoryId.HasValue)
            {
                return new List<ArticleDto>();
            }

            if (section.SectionType == 0 && section.CategoryId.HasValue)
            {
                query = query.Where(a => a.ArticleCategories.Any(ac => ac.CategoryId == section.CategoryId.Value));
            }
            // SectionType 1: filter by site section (חדשות / תוכן) — derived from the categories' Section field.
            else if (section.SectionType == 1 && section.ContentTypeId.HasValue)
            {
                var categorySection = (Models.Enum.ArticleCategorySection)section.ContentTypeId.Value;
                query = query.Where(a => a.ArticleCategories.Any(ac => ac.Category.Section == categorySection));
            }

            var articles = await query
                .OrderByDescending(a => a.PublishDate)
                .Take(section.ArticleCount)
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
                DisplayOrder = section.DisplayOrder,
                IsActive = section.IsActive,
                ArticleCount = section.ArticleCount,
                Articles = articles
            };
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
