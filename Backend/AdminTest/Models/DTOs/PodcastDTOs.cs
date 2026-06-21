using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs
{
    public class PodcastDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? ImageUrl { get; set; }
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public int EpisodeCount { get; set; }
        public PodcastEpisodeDto? LatestEpisode { get; set; }
        public AgencyContentBannerDto? AgencyBanner { get; set; }
    }

    public class PodcastDetailDto : PodcastDto
    {
        public List<PodcastEpisodeDto> Episodes { get; set; } = new();
    }

    public class PodcastHomeCardDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? ImageUrl { get; set; }
    }

    public class PodcastEpisodeBannerDto
    {
        public int Id { get; set; }
        public string PodcastName { get; set; } = string.Empty;
        public string PodcastSlug { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? ThumbnailUrl { get; set; }
    }

    public class PodcastEpisodeDto
    {
        public int Id { get; set; }
        public int PodcastId { get; set; }
        public string PodcastName { get; set; } = string.Empty;
        public string PodcastSlug { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int EpisodeNumber { get; set; }
        public string SourceUrl { get; set; } = string.Empty;
        public string EmbedUrl { get; set; } = string.Empty;
        public string? ThumbnailUrl { get; set; }
        public string Platform { get; set; } = string.Empty;
        public int ViewCount { get; set; }
        public DateTime PublishedAt { get; set; }
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public List<PodcastEpisodeArtistDto> TaggedArtists { get; set; } = new();
    }

    public class PodcastEpisodeArtistDto
    {
        public int ArtistId { get; set; }
        public string ArtistName { get; set; } = string.Empty;
        public string? ArtistImageUrl { get; set; }
    }

    public class PodcastEpisodeDetailDto : PodcastEpisodeDto
    {
        public PodcastEpisodeDto? PreviousEpisode { get; set; }
        public PodcastEpisodeDto? NextEpisode { get; set; }
        public List<PodcastEpisodeDto> SeriesEpisodes { get; set; } = new();
    }

    public class CreatePodcastDto
    {
        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [StringLength(220)]
        public string? Slug { get; set; }

        [StringLength(1000)]
        public string? Description { get; set; }

        [StringLength(1000)]
        public string? ImageUrl { get; set; }

        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class UpdatePodcastDto : CreatePodcastDto
    {
    }

    public class SubmitPodcastDto
    {
        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [StringLength(1000)]
        public string SourceUrl { get; set; } = string.Empty;
    }

    public class CreatePodcastEpisodeDto
    {
        [Required]
        public int PodcastId { get; set; }

        [Required]
        [StringLength(250)]
        public string Title { get; set; } = string.Empty;

        [StringLength(260)]
        public string? Slug { get; set; }

        [StringLength(1000)]
        public string? Description { get; set; }

        public int EpisodeNumber { get; set; }

        [Required]
        [StringLength(1000)]
        public string SourceUrl { get; set; } = string.Empty;

        [StringLength(1000)]
        public string? EmbedUrl { get; set; }

        [StringLength(1000)]
        public string? ThumbnailUrl { get; set; }

        [StringLength(80)]
        public string? Platform { get; set; }

        public DateTime? PublishedAt { get; set; }
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; } = true;
        public List<int>? ArtistIds { get; set; }
    }

    public class UpdatePodcastEpisodeDto : CreatePodcastEpisodeDto
    {
    }

    public class SubmitPodcastEpisodeDto
    {
        [Required]
        public int PodcastId { get; set; }

        [Required]
        [StringLength(250)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [StringLength(1000)]
        public string SourceUrl { get; set; } = string.Empty;
    }
}
