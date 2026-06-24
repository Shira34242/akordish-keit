namespace AkordishKeit.Models.DTOs;

public class SearchItemDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string? ImageUrl { get; set; }
    public string? Slug { get; set; }
    public string? ParentSlug { get; set; }
    public string Type { get; set; } = string.Empty; // song, artist, article, teacher, professional, playlist, podcast, podcastEpisode, event, agency
}

public class SearchResultsDto
{
    public List<SearchItemDto> Songs { get; set; } = new();
    public List<SearchItemDto> Artists { get; set; } = new();
    public List<SearchItemDto> Articles { get; set; } = new();
    public List<SearchItemDto> Teachers { get; set; } = new();
    public List<SearchItemDto> Professionals { get; set; } = new();
    public List<SearchItemDto> Playlists { get; set; } = new();
    public List<SearchItemDto> Podcasts { get; set; } = new();
    public List<SearchItemDto> PodcastEpisodes { get; set; } = new();
    public List<SearchItemDto> Events { get; set; } = new();
    public List<SearchItemDto> Agencies { get; set; } = new();

    public int TotalCount =>
        Songs.Count + Artists.Count + Articles.Count +
        Teachers.Count + Professionals.Count + Playlists.Count +
        Podcasts.Count + PodcastEpisodes.Count + Events.Count + Agencies.Count;
}
