using AkordishKeit.Data;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class DisplayRankingService : IDisplayRankingService
{
    private readonly AkordishKeitDbContext _context;

    public DisplayRankingService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public IQueryable<Article> ApplyArticleOrdering(IQueryable<Article> query, string? sortBy, ContentPromotionPlacement placement)
    {
        var now = DateTime.UtcNow;
        var bumpCutoff = now.AddHours(-24);
        return sortBy?.Trim().ToLowerInvariant() switch
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
            _ => query
                .OrderByDescending(a => _context.ContentPromotions.Any(p =>
                    p.TargetType == ContentPromotionTargetType.Article
                    && p.TargetId == a.Id
                    && p.IsActive
                    && (!p.StartsAt.HasValue || p.StartsAt.Value <= now)
                    && (!p.EndsAt.HasValue || p.EndsAt.Value >= now)))
                .ThenByDescending(a => _context.ContentPromotions
                    .Where(p => p.TargetType == ContentPromotionTargetType.Article
                        && p.TargetId == a.Id
                        && p.IsActive
                        && (!p.StartsAt.HasValue || p.StartsAt.Value <= now)
                        && (!p.EndsAt.HasValue || p.EndsAt.Value >= now))
                    .Select(p => (DateTime?)(p.StartsAt ?? p.UpdatedAt ?? p.CreatedAt))
                    .Max())
                .ThenByDescending(a => a.BumpedAt.HasValue && a.BumpedAt.Value >= bumpCutoff)
                .ThenByDescending(a => a.BumpedAt)
                .ThenByDescending(a => a.IsFeatured)
                .ThenByDescending(a => a.UploaderUser != null ? a.UploaderUser.RankingScore : 0)
                .ThenByDescending(a => a.CreatedAt)
                .ThenByDescending(a => a.PublishDate)
        };
    }

    public IQueryable<Song> ApplySongOrdering(IQueryable<Song> query, string? sortBy, ContentPromotionPlacement placement)
    {
        var now = DateTime.UtcNow;
        var bumpCutoff = now.AddHours(-24);
        var normalizedSort = sortBy?.Trim().ToLowerInvariant();

        if (normalizedSort == "recent")
        {
            return query
                .OrderByDescending(s => s.UpdatedAt ?? s.CreatedAt)
                .ThenByDescending(s => s.Id);
        }

        var weekAgo = now.AddDays(-7);
        var ordered = query
            .OrderByDescending(s => _context.ContentPromotions.Any(p =>
                p.TargetType == ContentPromotionTargetType.Song
                && p.TargetId == s.Id
                && p.IsActive
                && (!p.StartsAt.HasValue || p.StartsAt.Value <= now)
                && (!p.EndsAt.HasValue || p.EndsAt.Value >= now)))
            .ThenByDescending(s => _context.ContentPromotions
                .Where(p => p.TargetType == ContentPromotionTargetType.Song
                    && p.TargetId == s.Id
                    && p.IsActive
                    && (!p.StartsAt.HasValue || p.StartsAt.Value <= now)
                    && (!p.EndsAt.HasValue || p.EndsAt.Value >= now))
                .Select(p => (DateTime?)(p.StartsAt ?? p.UpdatedAt ?? p.CreatedAt))
                .Max())
            .ThenByDescending(s => s.BumpedAt.HasValue && s.BumpedAt.Value >= bumpCutoff)
            .ThenByDescending(s => s.BumpedAt);

        return normalizedSort switch
        {
            "home_popular" => ordered
                .ThenByDescending(s => _context.SongViews.Count(view =>
                    view.SongId == s.Id
                    && view.ViewedAt >= weekAgo
                    && view.ViewedAt <= now))
                .ThenByDescending(s => s.ViewCount)
                .ThenByDescending(s => s.UpdatedAt ?? s.CreatedAt),
            "date" => ordered.ThenByDescending(s => _context.ContentSubmissions
                    .Where(cs => cs.SongId == s.Id && !cs.IsDeleted && cs.Status == SubmissionStatus.Approved)
                    .Select(cs => (DateTime?)(cs.ReviewedAt ?? cs.SubmittedAt))
                    .Max() ?? s.CreatedAt)
                .ThenByDescending(s => s.CreatedAt),
            "views" or "popularity" => ordered.ThenByDescending(s => s.ViewCount),
            "name" => ordered.ThenBy(s => s.Title),
            "artist" => ordered.ThenBy(s => s.SongArtists
                .OrderBy(sa => sa.Order)
                .Select(sa => sa.Artist != null ? sa.Artist.Name : sa.TempArtistName)
                .FirstOrDefault()).ThenBy(s => s.Title),
            "uploader" => ordered.ThenBy(s => s.UploaderUser != null ? s.UploaderUser.Username : string.Empty).ThenBy(s => s.Title),
            "date_asc" => ordered.ThenBy(s => _context.ContentSubmissions
                    .Where(cs => cs.SongId == s.Id && !cs.IsDeleted && cs.Status == SubmissionStatus.Approved)
                    .Select(cs => (DateTime?)(cs.ReviewedAt ?? cs.SubmittedAt))
                    .Max() ?? s.CreatedAt)
                .ThenBy(s => s.CreatedAt),
            _ => ordered
                .ThenByDescending(s => s.UploaderUser != null ? s.UploaderUser.RankingScore : 0)
                .ThenByDescending(s => s.ViewCount)
                .ThenBy(s => s.Title)
        };
    }

    public IQueryable<Artist> ApplyArtistOrdering(IQueryable<Artist> query, string? sortBy, ContentPromotionPlacement placement)
    {
        var now = DateTime.UtcNow;
        var bumpCutoff = now.AddHours(-24);
        return sortBy?.Trim().ToLowerInvariant() switch
        {
            "songcount" => query
                .OrderByDescending(a => a.SongArtists.Count(sa => !sa.Song.IsDeleted && sa.Song.IsApproved))
                .ThenBy(a => a.Name),
            "created_desc" => query.OrderByDescending(a => a.CreatedAt).ThenBy(a => a.Name),
            "created" => query.OrderByDescending(a => a.BumpedAt ?? a.CreatedAt).ThenBy(a => a.Name),
            "created_asc" => query.OrderBy(a => a.CreatedAt).ThenBy(a => a.Name),
            "name" or "name_asc" => query.OrderBy(a => a.Name).ThenByDescending(a => a.CreatedAt),
            "name_desc" => query.OrderByDescending(a => a.Name).ThenByDescending(a => a.CreatedAt),
            _ => query
                .OrderByDescending(a => _context.ContentPromotions.Any(p =>
                    p.TargetType == ContentPromotionTargetType.Artist
                    && p.TargetId == a.Id
                    && p.IsActive
                    && (!p.StartsAt.HasValue || p.StartsAt.Value <= now)
                    && (!p.EndsAt.HasValue || p.EndsAt.Value >= now)))
                .ThenByDescending(a => _context.ContentPromotions
                    .Where(p => p.TargetType == ContentPromotionTargetType.Artist
                        && p.TargetId == a.Id
                        && p.IsActive
                        && (!p.StartsAt.HasValue || p.StartsAt.Value <= now)
                        && (!p.EndsAt.HasValue || p.EndsAt.Value >= now))
                    .Select(p => (DateTime?)(p.StartsAt ?? p.UpdatedAt ?? p.CreatedAt))
                    .Max())
                .ThenByDescending(a => a.BumpedAt.HasValue && a.BumpedAt.Value >= bumpCutoff)
                .ThenByDescending(a => a.BumpedAt)
                .ThenByDescending(a => a.IsFeatured)
                .ThenByDescending(a => a.IsPremium || a.Tier == ProfileTier.Subscribed)
                .ThenByDescending(a => a.User != null ? a.User.RankingScore : 0)
                .ThenBy(a => a.CreatedAt)
                .ThenBy(a => a.Name)
        };
    }

    public IQueryable<MusicServiceProvider> ApplyServiceProviderOrdering(
        IQueryable<MusicServiceProvider> query,
        string? sortBy,
        ContentPromotionPlacement placement)
    {
        var now = DateTime.UtcNow;
        var bumpCutoff = now.AddHours(-24);
        return sortBy?.Trim().ToLowerInvariant() switch
        {
            "created_desc" => query.OrderByDescending(sp => sp.CreatedAt).ThenBy(sp => sp.DisplayName),
            "created_asc" => query.OrderBy(sp => sp.CreatedAt).ThenBy(sp => sp.DisplayName),
            "name_asc" => query.OrderBy(sp => sp.DisplayName).ThenByDescending(sp => sp.CreatedAt),
            "name_desc" => query.OrderByDescending(sp => sp.DisplayName).ThenByDescending(sp => sp.CreatedAt),
            _ => query
                .OrderByDescending(sp => _context.ContentPromotions.Any(p =>
                    p.TargetType == ContentPromotionTargetType.ServiceProvider
                    && p.TargetId == sp.Id
                    && p.IsActive
                    && (!p.StartsAt.HasValue || p.StartsAt.Value <= now)
                    && (!p.EndsAt.HasValue || p.EndsAt.Value >= now)))
                .ThenByDescending(sp => _context.ContentPromotions
                    .Where(p => p.TargetType == ContentPromotionTargetType.ServiceProvider
                        && p.TargetId == sp.Id
                        && p.IsActive
                        && (!p.StartsAt.HasValue || p.StartsAt.Value <= now)
                        && (!p.EndsAt.HasValue || p.EndsAt.Value >= now))
                    .Select(p => (DateTime?)(p.StartsAt ?? p.UpdatedAt ?? p.CreatedAt))
                    .Max())
                .ThenByDescending(sp => sp.BumpedAt.HasValue && sp.BumpedAt.Value >= bumpCutoff)
                .ThenByDescending(sp => sp.BumpedAt)
                .ThenByDescending(sp => sp.IsFeatured)
                .ThenByDescending(sp => sp.User != null ? sp.User.RankingScore : 0)
                .ThenBy(sp => sp.CreatedAt)
                .ThenBy(sp => sp.DisplayName)
        };
    }

    public IQueryable<Teacher> ApplyTeacherOrdering(IQueryable<Teacher> query, string? sortBy, ContentPromotionPlacement placement)
    {
        var now = DateTime.UtcNow;
        var bumpCutoff = now.AddHours(-24);
        return sortBy?.Trim().ToLowerInvariant() switch
        {
            "created_desc" => query.OrderByDescending(t => t.ServiceProvider.CreatedAt).ThenBy(t => t.ServiceProvider.DisplayName),
            "created_asc" => query.OrderBy(t => t.ServiceProvider.CreatedAt).ThenBy(t => t.ServiceProvider.DisplayName),
            "name_asc" => query.OrderBy(t => t.ServiceProvider.DisplayName).ThenByDescending(t => t.ServiceProvider.CreatedAt),
            "name_desc" => query.OrderByDescending(t => t.ServiceProvider.DisplayName).ThenByDescending(t => t.ServiceProvider.CreatedAt),
            _ => query
                .OrderByDescending(t => _context.ContentPromotions.Any(p =>
                    p.TargetType == ContentPromotionTargetType.Teacher
                    && p.TargetId == t.Id
                    && p.IsActive
                    && (!p.StartsAt.HasValue || p.StartsAt.Value <= now)
                    && (!p.EndsAt.HasValue || p.EndsAt.Value >= now)))
                .ThenByDescending(t => _context.ContentPromotions
                    .Where(p => p.TargetType == ContentPromotionTargetType.Teacher
                        && p.TargetId == t.Id
                        && p.IsActive
                        && (!p.StartsAt.HasValue || p.StartsAt.Value <= now)
                        && (!p.EndsAt.HasValue || p.EndsAt.Value >= now))
                    .Select(p => (DateTime?)(p.StartsAt ?? p.UpdatedAt ?? p.CreatedAt))
                    .Max())
                .ThenByDescending(t => t.ServiceProvider.BumpedAt.HasValue && t.ServiceProvider.BumpedAt.Value >= bumpCutoff)
                .ThenByDescending(t => t.ServiceProvider.BumpedAt)
                .ThenByDescending(t => t.ServiceProvider.IsFeatured)
                .ThenByDescending(t => t.ServiceProvider.User != null ? t.ServiceProvider.User.RankingScore : 0)
                .ThenBy(t => t.ServiceProvider.CreatedAt)
                .ThenBy(t => t.ServiceProvider.DisplayName)
        };
    }

    public IQueryable<Podcast> ApplyPodcastOrdering(IQueryable<Podcast> query, string? sortBy, ContentPromotionPlacement placement)
    {
        var now = DateTime.UtcNow;
        return sortBy?.Trim().ToLowerInvariant() switch
        {
            "date" => query.OrderByDescending(p => p.CreatedAt),
            "date_asc" => query.OrderBy(p => p.CreatedAt),
            "name" => query.OrderBy(p => p.Name),
            _ => query
                .OrderByDescending(p => _context.ContentPromotions.Any(cp =>
                    cp.TargetType == ContentPromotionTargetType.Podcast
                    && cp.TargetId == p.Id
                    && cp.IsActive
                    && (!cp.StartsAt.HasValue || cp.StartsAt.Value <= now)
                    && (!cp.EndsAt.HasValue || cp.EndsAt.Value >= now)))
                .ThenByDescending(p => _context.ContentPromotions
                    .Where(cp => cp.TargetType == ContentPromotionTargetType.Podcast
                        && cp.TargetId == p.Id
                        && cp.IsActive
                        && (!cp.StartsAt.HasValue || cp.StartsAt.Value <= now)
                        && (!cp.EndsAt.HasValue || cp.EndsAt.Value >= now))
                    .Select(cp => (DateTime?)(cp.StartsAt ?? cp.UpdatedAt ?? cp.CreatedAt))
                    .Max())
                .ThenBy(p => p.Name)
        };
    }

    public IQueryable<PodcastEpisode> ApplyPodcastEpisodeOrdering(IQueryable<PodcastEpisode> query, string? sortBy, ContentPromotionPlacement placement)
    {
        var now = DateTime.UtcNow;
        return sortBy?.Trim().ToLowerInvariant() switch
        {
            "title" => query.OrderBy(e => e.Title),
            "podcast" => query.OrderBy(e => e.Podcast.Name).ThenByDescending(e => e.PublishedAt),
            "views" => query.OrderByDescending(e => e.ViewCount),
            "date_asc" => query.OrderBy(e => e.PublishedAt),
            _ => query
                .OrderByDescending(e => _context.ContentPromotions.Any(cp =>
                    cp.TargetType == ContentPromotionTargetType.PodcastEpisode
                    && cp.TargetId == e.Id
                    && cp.IsActive
                    && (!cp.StartsAt.HasValue || cp.StartsAt.Value <= now)
                    && (!cp.EndsAt.HasValue || cp.EndsAt.Value >= now)))
                .ThenByDescending(e => _context.ContentPromotions
                    .Where(cp => cp.TargetType == ContentPromotionTargetType.PodcastEpisode
                        && cp.TargetId == e.Id
                        && cp.IsActive
                        && (!cp.StartsAt.HasValue || cp.StartsAt.Value <= now)
                        && (!cp.EndsAt.HasValue || cp.EndsAt.Value >= now))
                    .Select(cp => (DateTime?)(cp.StartsAt ?? cp.UpdatedAt ?? cp.CreatedAt))
                    .Max())
                .ThenByDescending(e => e.PublishedAt)
                .ThenByDescending(e => e.Id)
        };
    }
}
