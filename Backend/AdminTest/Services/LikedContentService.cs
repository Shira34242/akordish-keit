using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class LikedContentService : ILikedContentService
{
    private readonly AkordishKeitDbContext _context;

    public LikedContentService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public async Task<List<LikedContentDto>> GetUserLikedContentAsync(int userId)
    {
        var likedContents = await _context.LikedContents
            .Where(lc => lc.UserId == userId)
            .OrderByDescending(lc => lc.LikedAt)
            .ToListAsync();

        var result = new List<LikedContentDto>();

        foreach (var lc in likedContents)
        {
            var dto = new LikedContentDto
            {
                Id = lc.Id,
                ContentType = lc.ContentType,
                ContentId = lc.ContentId,
                LikedAt = lc.LikedAt
            };

            // טעינת פרטי הכתבה/בלוג
            var article = await _context.Articles
                .FirstOrDefaultAsync(a => a.Id == lc.ContentId);

            if (article != null)
            {
                dto.Title = article.Title;
                dto.Subtitle = article.Subtitle;
                dto.ImageUrl = article.FeaturedImageUrl;
                dto.Slug = article.Slug;
            }

            result.Add(dto);
        }

        return result;
    }

    public async Task<LikedContentDto?> AddLikedContentAsync(AddLikedContentDto dto, int userId)
    {
        // בדיקה שהתוכן לא כבר במועדפים
        var exists = await _context.LikedContents
            .AnyAsync(lc => lc.UserId == userId &&
                           lc.ContentType == dto.ContentType &&
                           lc.ContentId == dto.ContentId);

        if (exists)
            return null; // כבר קיים

        var likedContent = new LikedContent
        {
            UserId = userId,
            ContentType = dto.ContentType,
            ContentId = dto.ContentId,
            LikedAt = DateTime.UtcNow
        };

        _context.LikedContents.Add(likedContent);
        await _context.SaveChangesAsync();

        return new LikedContentDto
        {
            Id = likedContent.Id,
            ContentType = likedContent.ContentType,
            ContentId = likedContent.ContentId,
            LikedAt = likedContent.LikedAt
        };
    }

    public async Task<bool> RemoveLikedContentAsync(string contentType, int contentId, int userId)
    {
        var likedContent = await _context.LikedContents
            .FirstOrDefaultAsync(lc => lc.UserId == userId &&
                                      lc.ContentType == contentType &&
                                      lc.ContentId == contentId);

        if (likedContent == null)
            return false;

        _context.LikedContents.Remove(likedContent);
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> IsContentLikedAsync(string contentType, int contentId, int userId)
    {
        return await _context.LikedContents
            .AnyAsync(lc => lc.UserId == userId &&
                           lc.ContentType == contentType &&
                           lc.ContentId == contentId);
    }
}
