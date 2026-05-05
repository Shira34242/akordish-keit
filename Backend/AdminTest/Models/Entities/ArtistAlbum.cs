namespace AkordishKeit.Models.Entities;

public class ArtistAlbum
{
    public int Id { get; set; }
    public int ArtistId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string CoverImageUrl { get; set; } = string.Empty;
    public int? ReleaseYear { get; set; }
    public string ExternalUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }

    public virtual Artist Artist { get; set; } = null!;
}
