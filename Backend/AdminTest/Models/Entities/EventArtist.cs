namespace AkordishKeit.Models.Entities;

/// <summary>
/// קישור בין הופעה לאומן (Many-to-Many)
/// </summary>
public class EventArtist
{
    public int Id { get; set; }
    public int EventId { get; set; }
    public int ArtistId { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation Properties
    public virtual Event Event { get; set; }
    public virtual Artist Artist { get; set; }
}
