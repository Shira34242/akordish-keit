using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class ContentPromotionService : IContentPromotionService
{
    private readonly AkordishKeitDbContext _context;

    public ContentPromotionService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public async Task<List<ContentPromotionDto>> GetPromotionsAsync(
        ContentPromotionTargetType? targetType,
        int? targetId,
        ContentPromotionPlacement? placement)
    {
        var query = _context.ContentPromotions.AsNoTracking().AsQueryable();

        if (targetType.HasValue)
            query = query.Where(p => p.TargetType == targetType.Value);

        if (targetId.HasValue)
            query = query.Where(p => p.TargetId == targetId.Value);

        if (placement.HasValue)
            query = query.Where(p => p.Placement == placement.Value);

        var promotions = await query
            .OrderByDescending(p => p.IsActive)
            .ThenBy(p => p.TargetType)
            .ThenBy(p => p.TargetId)
            .ThenBy(p => p.Placement)
            .ThenByDescending(p => p.StartsAt ?? p.UpdatedAt ?? p.CreatedAt)
            .ToListAsync();

        return promotions.Select(MapToDto).ToList();
    }

    public async Task<List<ContentPromotionDto>> GetActivePromotionsAsync(
        ContentPromotionTargetType targetType,
        ContentPromotionPlacement? placement)
    {
        var now = DateTime.UtcNow;
        var query = _context.ContentPromotions.AsNoTracking()
            .Where(p => p.TargetType == targetType
                && p.IsActive
                && (!p.StartsAt.HasValue || p.StartsAt.Value <= now)
                && (!p.EndsAt.HasValue || p.EndsAt.Value >= now));

        if (placement.HasValue)
        {
            query = query.Where(p => p.Placement == placement.Value || p.Placement == ContentPromotionPlacement.General);
        }

        var promotions = await query
            .OrderByDescending(p => p.StartsAt ?? p.UpdatedAt ?? p.CreatedAt)
            .ThenBy(p => p.EndsAt ?? DateTime.MaxValue)
            .ThenBy(p => p.TargetId)
            .ToListAsync();

        return promotions.Select(MapToDto).ToList();
    }

    public async Task<ContentPromotionDto> UpsertPromotionAsync(UpsertContentPromotionDto dto, string? userName)
    {
        ValidateSchedule(dto.StartsAt, dto.EndsAt);
        await EnsureTargetExistsAsync(dto.TargetType, dto.TargetId);

        var now = DateTime.UtcNow;
        var promotion = await _context.ContentPromotions
            .FirstOrDefaultAsync(p =>
                p.TargetType == dto.TargetType &&
                p.TargetId == dto.TargetId &&
                p.Placement == dto.Placement);

        if (promotion == null)
        {
            promotion = new ContentPromotion
            {
                TargetType = dto.TargetType,
                TargetId = dto.TargetId,
                Placement = dto.Placement,
                CreatedAt = now,
                CreatedBy = userName
            };
            _context.ContentPromotions.Add(promotion);
        }

        promotion.Priority = dto.Priority;
        promotion.StartsAt = dto.StartsAt;
        promotion.EndsAt = dto.EndsAt;
        promotion.IsActive = dto.IsActive;
        promotion.ShowOnHome = dto.ShowOnHome || dto.Placement == ContentPromotionPlacement.Home;
        promotion.Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();
        promotion.UpdatedAt = now;
        promotion.UpdatedBy = userName;

        await _context.SaveChangesAsync();
        return MapToDto(promotion);
    }

    public async Task<List<ContentPromotionDto>> BulkUpsertPromotionAsync(BulkUpsertContentPromotionDto dto, string? userName)
    {
        var ids = dto.TargetIds
            .Where(id => id > 0)
            .Distinct()
            .ToList();
        if (ids.Count == 0)
            throw new InvalidOperationException("נדרש לבחור לפחות פריט אחד לקידום");

        ValidateSchedule(dto.StartsAt, dto.EndsAt);
        await EnsureTargetsExistAsync(dto.TargetType, ids);

        var now = DateTime.UtcNow;
        var existingPromotions = await _context.ContentPromotions
            .Where(p =>
                p.TargetType == dto.TargetType &&
                p.Placement == dto.Placement &&
                ids.Contains(p.TargetId))
            .ToListAsync();

        var promotionsByTargetId = existingPromotions.ToDictionary(p => p.TargetId);
        var promotions = new List<ContentPromotion>(ids.Count);

        foreach (var id in ids)
        {
            if (!promotionsByTargetId.TryGetValue(id, out var promotion))
            {
                promotion = new ContentPromotion
                {
                    TargetType = dto.TargetType,
                    TargetId = id,
                    Placement = dto.Placement,
                    CreatedAt = now,
                    CreatedBy = userName
                };
                _context.ContentPromotions.Add(promotion);
            }

            promotion.Priority = dto.Priority;
            promotion.StartsAt = dto.StartsAt;
            promotion.EndsAt = dto.EndsAt;
            promotion.IsActive = dto.IsActive;
            promotion.ShowOnHome = dto.ShowOnHome || dto.Placement == ContentPromotionPlacement.Home;
            promotion.Note = string.IsNullOrWhiteSpace(dto.Note) ? null : dto.Note.Trim();
            promotion.UpdatedAt = now;
            promotion.UpdatedBy = userName;
            promotions.Add(promotion);
        }

        await _context.SaveChangesAsync();
        return promotions.Select(MapToDto).ToList();
    }

    public async Task<bool> DeactivatePromotionAsync(
        ContentPromotionTargetType targetType,
        int targetId,
        ContentPromotionPlacement placement,
        string? userName)
    {
        var promotion = await _context.ContentPromotions.FirstOrDefaultAsync(p =>
            p.TargetType == targetType &&
            p.TargetId == targetId &&
            p.Placement == placement);

        if (promotion == null)
            return false;

        promotion.IsActive = false;
        promotion.UpdatedAt = DateTime.UtcNow;
        promotion.UpdatedBy = userName;
        await _context.SaveChangesAsync();
        return true;
    }

    private async Task EnsureTargetExistsAsync(ContentPromotionTargetType targetType, int targetId)
    {
        var exists = targetType switch
        {
            ContentPromotionTargetType.Article => await _context.Articles.AnyAsync(a => a.Id == targetId && !a.IsDeleted),
            ContentPromotionTargetType.Artist => await _context.Artists.AnyAsync(a => a.Id == targetId && !a.IsDeleted),
            ContentPromotionTargetType.ServiceProvider => await _context.ServiceProviders.AnyAsync(p => p.Id == targetId && !p.IsDeleted && !p.IsTeacher),
            ContentPromotionTargetType.Teacher => await _context.ServiceProviders.AnyAsync(p => p.Id == targetId && !p.IsDeleted && p.IsTeacher),
            ContentPromotionTargetType.Song => await _context.Songs.AnyAsync(s => s.Id == targetId && !s.IsDeleted),
            ContentPromotionTargetType.Podcast => await _context.Podcasts.AnyAsync(p => p.Id == targetId && !p.IsDeleted),
            ContentPromotionTargetType.PodcastEpisode => await _context.PodcastEpisodes.AnyAsync(e => e.Id == targetId && !e.IsDeleted && !e.Podcast.IsDeleted),
            _ => false
        };

        if (!exists)
            throw new InvalidOperationException("הפריט שנבחר לקידום לא נמצא או לא פעיל");
    }

    private async Task EnsureTargetsExistAsync(ContentPromotionTargetType targetType, List<int> targetIds)
    {
        var existingIds = targetType switch
        {
            ContentPromotionTargetType.Article => await _context.Articles
                .Where(a => targetIds.Contains(a.Id) && !a.IsDeleted)
                .Select(a => a.Id)
                .ToListAsync(),
            ContentPromotionTargetType.Artist => await _context.Artists
                .Where(a => targetIds.Contains(a.Id) && !a.IsDeleted)
                .Select(a => a.Id)
                .ToListAsync(),
            ContentPromotionTargetType.ServiceProvider => await _context.ServiceProviders
                .Where(p => targetIds.Contains(p.Id) && !p.IsDeleted && !p.IsTeacher)
                .Select(p => p.Id)
                .ToListAsync(),
            ContentPromotionTargetType.Teacher => await _context.ServiceProviders
                .Where(p => targetIds.Contains(p.Id) && !p.IsDeleted && p.IsTeacher)
                .Select(p => p.Id)
                .ToListAsync(),
            ContentPromotionTargetType.Song => await _context.Songs
                .Where(s => targetIds.Contains(s.Id) && !s.IsDeleted)
                .Select(s => s.Id)
                .ToListAsync(),
            ContentPromotionTargetType.Podcast => await _context.Podcasts
                .Where(p => targetIds.Contains(p.Id) && !p.IsDeleted)
                .Select(p => p.Id)
                .ToListAsync(),
            ContentPromotionTargetType.PodcastEpisode => await _context.PodcastEpisodes
                .Where(e => targetIds.Contains(e.Id) && !e.IsDeleted && !e.Podcast.IsDeleted)
                .Select(e => e.Id)
                .ToListAsync(),
            _ => new List<int>()
        };

        if (existingIds.Count != targetIds.Count)
            throw new InvalidOperationException("אחד או יותר מהפריטים שנבחרו לקידום לא נמצאו או לא פעילים");
    }

    private static void ValidateSchedule(DateTime? startsAt, DateTime? endsAt)
    {
        if (startsAt.HasValue && endsAt.HasValue && endsAt.Value <= startsAt.Value)
            throw new InvalidOperationException("תאריך הסיום חייב להיות אחרי תאריך ההתחלה");
    }

    private static bool IsActiveAt(ContentPromotion promotion, DateTime now)
    {
        return promotion.IsActive &&
            (!promotion.StartsAt.HasValue || promotion.StartsAt.Value <= now) &&
            (!promotion.EndsAt.HasValue || promotion.EndsAt.Value >= now);
    }

    private static ContentPromotionDto MapToDto(ContentPromotion promotion)
    {
        var now = DateTime.UtcNow;
        return new ContentPromotionDto
        {
            Id = promotion.Id,
            TargetType = promotion.TargetType,
            TargetId = promotion.TargetId,
            Placement = promotion.Placement,
            Priority = promotion.Priority,
            StartsAt = promotion.StartsAt,
            EndsAt = promotion.EndsAt,
            IsActive = promotion.IsActive,
            ShowOnHome = promotion.ShowOnHome,
            Note = promotion.Note,
            CreatedAt = promotion.CreatedAt,
            UpdatedAt = promotion.UpdatedAt,
            IsCurrentlyActive = IsActiveAt(promotion, now)
        };
    }
}
