using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Services;

public interface IDisplayRankingService
{
    IQueryable<Article> ApplyArticleOrdering(IQueryable<Article> query, string? sortBy, ContentPromotionPlacement placement);
    IQueryable<Song> ApplySongOrdering(IQueryable<Song> query, string? sortBy, ContentPromotionPlacement placement);
    IQueryable<Artist> ApplyArtistOrdering(IQueryable<Artist> query, string? sortBy, ContentPromotionPlacement placement);
    IQueryable<MusicServiceProvider> ApplyServiceProviderOrdering(IQueryable<MusicServiceProvider> query, string? sortBy, ContentPromotionPlacement placement);
    IQueryable<Teacher> ApplyTeacherOrdering(IQueryable<Teacher> query, string? sortBy, ContentPromotionPlacement placement);
    IQueryable<Podcast> ApplyPodcastOrdering(IQueryable<Podcast> query, string? sortBy, ContentPromotionPlacement placement);
    IQueryable<PodcastEpisode> ApplyPodcastEpisodeOrdering(IQueryable<PodcastEpisode> query, string? sortBy, ContentPromotionPlacement placement);
}
