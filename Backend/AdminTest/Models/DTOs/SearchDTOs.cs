namespace AkordishKeit.Models.DTOs;

public class SearchItemDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string? ImageUrl { get; set; }
    public string Type { get; set; } = string.Empty; // song, artist, article, teacher, professional, playlist
}

public class SearchResultsDto
{
    public List<SearchItemDto> Songs { get; set; } = new();
    public List<SearchItemDto> Artists { get; set; } = new();
    public List<SearchItemDto> Articles { get; set; } = new();
    public List<SearchItemDto> Teachers { get; set; } = new();
    public List<SearchItemDto> Professionals { get; set; } = new();
    public List<SearchItemDto> Playlists { get; set; } = new();

    public int TotalCount =>
        Songs.Count + Artists.Count + Articles.Count +
        Teachers.Count + Professionals.Count + Playlists.Count;
}
