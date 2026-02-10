using AkordishKeit.Data;
using AkordishKeit.Extensions;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services
{
    public class FeaturedContentService : IFeaturedContentService
    {
        private readonly AkordishKeitDbContext _context;

        public FeaturedContentService(AkordishKeitDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<FeaturedContentDto>> GetActiveFeaturedContentAsync()
        {
            var featuredContents = await _context.FeaturedContents
                .Include(fc => fc.Article)
                    .ThenInclude(a => a.ArticleCategories)
                        .ThenInclude(ac => ac.Category)
                .Include(fc => fc.Article)
                    .ThenInclude(a => a.ArticleTags)
                        .ThenInclude(at => at.Tag)
                .Where(fc => fc.IsActive)
                .OrderBy(fc => fc.DisplayOrder)
                .ToListAsync();

            return featuredContents.Select(MapToDto);
        }

        public async Task<IEnumerable<FeaturedContentDto>> GetAllFeaturedContentAsync()
        {
            var featuredContents = await _context.FeaturedContents
                .Include(fc => fc.Article)
                    .ThenInclude(a => a.ArticleCategories)
                        .ThenInclude(ac => ac.Category)
                .Include(fc => fc.Article)
                    .ThenInclude(a => a.ArticleTags)
                        .ThenInclude(at => at.Tag)
                .OrderBy(fc => fc.DisplayOrder)
                .ToListAsync();

            return featuredContents.Select(MapToDto);
        }

        public async Task<FeaturedContentDto?> GetFeaturedContentByIdAsync(int id)
        {
            var featuredContent = await _context.FeaturedContents
                .Include(fc => fc.Article)
                    .ThenInclude(a => a.ArticleCategories)
                        .ThenInclude(ac => ac.Category)
                .Include(fc => fc.Article)
                    .ThenInclude(a => a.ArticleTags)
                        .ThenInclude(at => at.Tag)
                .FirstOrDefaultAsync(fc => fc.Id == id);

            return featuredContent == null ? null : MapToDto(featuredContent);
        }

        public async Task<FeaturedContentDto> CreateFeaturedContentAsync(CreateFeaturedContentDto dto)
        {
            // Check if article is already featured
            if (await IsArticleAlreadyFeaturedAsync(dto.ArticleId))
            {
                throw new InvalidOperationException("הכתבה כבר נמצאת בתוכן המרכזי");
            }

            // Check if display order is already taken
            var existingWithOrder = await _context.FeaturedContents
                .FirstOrDefaultAsync(fc => fc.DisplayOrder == dto.DisplayOrder && fc.IsActive);

            if (existingWithOrder != null)
            {
                throw new InvalidOperationException($"המיקום {dto.DisplayOrder} כבר תפוס. אנא בחר מיקום אחר.");
            }

            var featuredContent = new FeaturedContent
            {
                ArticleId = dto.ArticleId,
                DisplayOrder = dto.DisplayOrder,
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow
            };

            _context.FeaturedContents.Add(featuredContent);
            await _context.SaveChangesAsync();

            // Reload with article data
            await _context.Entry(featuredContent)
                .Reference(fc => fc.Article)
                .LoadAsync();

            await _context.Entry(featuredContent.Article)
                .Collection(a => a.ArticleCategories)
                .Query()
                .Include(ac => ac.Category)
                .LoadAsync();

            await _context.Entry(featuredContent.Article)
                .Collection(a => a.ArticleTags)
                .LoadAsync();

            return MapToDto(featuredContent);
        }

        public async Task<FeaturedContentDto?> UpdateFeaturedContentAsync(int id, UpdateFeaturedContentDto dto)
        {
            var featuredContent = await _context.FeaturedContents.FindAsync(id);
            if (featuredContent == null)
                return null;

            // Check if article is already featured (excluding current)
            if (await IsArticleAlreadyFeaturedAsync(dto.ArticleId, id))
            {
                throw new InvalidOperationException("הכתבה כבר נמצאת בתוכן המרכזי");
            }

            // Check if display order is already taken (excluding current)
            if (dto.DisplayOrder != featuredContent.DisplayOrder)
            {
                var existingWithOrder = await _context.FeaturedContents
                    .FirstOrDefaultAsync(fc => fc.DisplayOrder == dto.DisplayOrder && fc.IsActive && fc.Id != id);

                if (existingWithOrder != null)
                {
                    throw new InvalidOperationException($"המיקום {dto.DisplayOrder} כבר תפוס. אנא בחר מיקום אחר.");
                }
            }

            featuredContent.ArticleId = dto.ArticleId;
            featuredContent.DisplayOrder = dto.DisplayOrder;
            featuredContent.IsActive = dto.IsActive;
            featuredContent.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Reload with article data
            await _context.Entry(featuredContent)
                .Reference(fc => fc.Article)
                .LoadAsync();

            await _context.Entry(featuredContent.Article)
                .Collection(a => a.ArticleCategories)
                .Query()
                .Include(ac => ac.Category)
                .LoadAsync();

            await _context.Entry(featuredContent.Article)
                .Collection(a => a.ArticleTags)
                .LoadAsync();

            return MapToDto(featuredContent);
        }

        public async Task<IEnumerable<FeaturedContentDto>> UpdateFeaturedContentBulkAsync(UpdateFeaturedContentBulkDto dto)
        {
            // Delete all existing featured content
            var existing = await _context.FeaturedContents.ToListAsync();
            _context.FeaturedContents.RemoveRange(existing);

            // Create new featured content
            var newFeaturedContents = dto.Items.Select(item => new FeaturedContent
            {
                ArticleId = item.ArticleId,
                DisplayOrder = item.DisplayOrder,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            }).ToList();

            _context.FeaturedContents.AddRange(newFeaturedContents);
            await _context.SaveChangesAsync();

            // Return the new featured content
            return await GetActiveFeaturedContentAsync();
        }

        public async Task<bool> DeleteFeaturedContentAsync(int id)
        {
            var featuredContent = await _context.FeaturedContents.FindAsync(id);
            if (featuredContent == null)
                return false;

            _context.FeaturedContents.Remove(featuredContent);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> IsArticleAlreadyFeaturedAsync(int articleId, int? excludeId = null)
        {
            var query = _context.FeaturedContents.Where(fc => fc.ArticleId == articleId);

            if (excludeId.HasValue)
            {
                query = query.Where(fc => fc.Id != excludeId.Value);
            }

            return await query.AnyAsync();
        }

        // Helper method
        private FeaturedContentDto MapToDto(FeaturedContent featuredContent)
        {
            return new FeaturedContentDto
            {
                Id = featuredContent.Id,
                ArticleId = featuredContent.ArticleId,
                DisplayOrder = featuredContent.DisplayOrder,
                IsActive = featuredContent.IsActive,
                CreatedAt = featuredContent.CreatedAt,
                UpdatedAt = featuredContent.UpdatedAt,
                CreatedBy = featuredContent.CreatedBy,
                UpdatedBy = featuredContent.UpdatedBy,
                Article = MapArticleToDto(featuredContent.Article)
            };
        }

        private ArticleDto MapArticleToDto(Article article)
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
                }).ToList() ?? new List<ArticleGalleryImageDto>()
            };
        }
    }
}
