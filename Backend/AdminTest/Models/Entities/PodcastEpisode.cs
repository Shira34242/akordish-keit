namespace AkordishKeit.Models.Entities
{
    public class PodcastEpisode
    {
        public int Id { get; set; }
        public int PodcastId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Slug { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int EpisodeNumber { get; set; }
        public string SourceUrl { get; set; } = string.Empty;
        public string EmbedUrl { get; set; } = string.Empty;
        public string? ThumbnailUrl { get; set; }
        public string Platform { get; set; } = "YouTube";
        public int ViewCount { get; set; }
        public DateTime PublishedAt { get; set; } = DateTime.UtcNow;
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public bool IsDeleted { get; set; }

        public virtual Podcast Podcast { get; set; } = null!;
    }
}
