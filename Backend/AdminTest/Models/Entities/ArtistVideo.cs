namespace AkordishKeit.Models.Entities;

/// <summary>
/// וידאו מוטמע של האומן (YouTube/Vimeo, משלם בלבד)
/// </summary>
public class ArtistVideo
{
    public int Id { get; set; }
    public int ArtistId { get; set; }
    public string VideoUrl { get; set; }            // YouTube/Vimeo embed URL
    public string? Title { get; set; }
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation Properties
    public virtual Artist Artist { get; set; }
}
