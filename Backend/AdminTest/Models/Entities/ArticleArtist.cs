namespace AkordishKeit.Models.Entities;

/// <summary>
/// קישור בין כתבה לאומן (Many-to-Many)
/// </summary>
public class ArticleArtist
{
    public int Id { get; set; }
    public int ArticleId { get; set; }
    public int ArtistId { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation Properties
    public virtual Article Article { get; set; }
    public virtual Artist Artist { get; set; }
}
