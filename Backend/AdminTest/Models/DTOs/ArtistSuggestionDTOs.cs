namespace AkordishKeit.Models.DTOs;

public class ArtistSuggestionRequestDto
{
    public string? ContentType { get; set; }
    public string? Title { get; set; }
    public string? Subtitle { get; set; }
    public string? Description { get; set; }
    public string? Content { get; set; }
    public string? ArtistName { get; set; }
    public List<int> SelectedArtistIds { get; set; } = new();
}

public class ArtistSuggestionDto
{
    public int ArtistId { get; set; }
    public string ArtistName { get; set; } = string.Empty;
    public string? ArtistImageUrl { get; set; }
    public int Score { get; set; }
    public List<string> MatchedFields { get; set; } = new();
}
