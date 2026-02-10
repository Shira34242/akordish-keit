namespace AkordishKeit.Models.Entities;

/// <summary>
/// טבלת Junction - קשר Many-to-Many בין שיר לאמנים
/// שיר יכול להיות עם עד 5 אמנים
/// </summary>
public class SongArtist
{
    public int Id { get; set; }
    public int SongId { get; set; }
    public int ArtistId { get; set; }
    public int Order { get; set; } // סדר האמן ברשימה (1, 2, 3...)

    // Navigation Properties
    public virtual Song Song { get; set; }
    public virtual Artist Artist { get; set; }
}