namespace AkordishKeit.Models.Entities;

public class PodcastEpisodeArtist
{
    public int Id { get; set; }
    public int PodcastEpisodeId { get; set; }
    public int ArtistId { get; set; }
    public DateTime CreatedAt { get; set; }

    public virtual PodcastEpisode PodcastEpisode { get; set; } = null!;
    public virtual Artist Artist { get; set; } = null!;
}
