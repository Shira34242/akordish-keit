using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs;

public class ImportContentFromUrlRequestDto
{
    [Required(ErrorMessage = "קישור מקור הוא שדה חובה")]
    public string Url { get; set; } = string.Empty;

    [Required(ErrorMessage = "סוג תוכן הוא שדה חובה")]
    public string ContentType { get; set; } = string.Empty;
}

public class ImportedContentDraftDto
{
    public string ContentType { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public string SourceUrl { get; set; } = string.Empty;
    public string? Platform { get; set; }
    public DateTime? PublishedAt { get; set; }
    public string? Location { get; set; }
    public string? ArtistName { get; set; }
}

public class ImportContentFromUrlResponseDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string SourceUrl { get; set; } = string.Empty;
    public ImportedContentDraftDto? Draft { get; set; }
    public List<string> MissingFields { get; set; } = new();
}
