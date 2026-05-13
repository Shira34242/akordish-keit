using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services
{
    public interface IPodcastService
    {
        Task<PagedResult<PodcastDto>> GetPodcastsAsync(int pageNumber, int pageSize, string? search, bool? isActive);
        Task<IEnumerable<PodcastDto>> GetPublicPodcastsAsync();
        Task<PodcastDetailDto?> GetPodcastBySlugAsync(string slug, bool includeInactive = false);
        Task<PodcastDto?> GetPodcastByIdAsync(int id);
        Task<PodcastDto> CreatePodcastAsync(CreatePodcastDto dto);
        Task<PodcastDto?> UpdatePodcastAsync(int id, UpdatePodcastDto dto);
        Task<bool> DeletePodcastAsync(int id);
        Task<PagedResult<PodcastEpisodeDto>> GetEpisodesAsync(int pageNumber, int pageSize, int? podcastId, string? search, bool? isActive);
        Task<PagedResult<PodcastEpisodeDto>> GetPublicEpisodesAsync(int pageNumber, int pageSize, int? podcastId, string? search);
        Task<IEnumerable<PodcastEpisodeDto>> GetLatestEpisodesAsync(int limit);
        Task<IEnumerable<PodcastEpisodeDto>> GetPopularEpisodesAsync(int limit, int? podcastId = null);
        Task<PodcastEpisodeDetailDto?> GetEpisodeBySlugAsync(string podcastSlug, string episodeSlug, bool includeInactive = false);
        Task<PodcastEpisodeDto?> GetEpisodeByIdAsync(int id);
        Task<PodcastEpisodeDto> CreateEpisodeAsync(CreatePodcastEpisodeDto dto);
        Task<PodcastEpisodeDto?> UpdateEpisodeAsync(int id, UpdatePodcastEpisodeDto dto);
        Task<bool> DeleteEpisodeAsync(int id);
    }
}
