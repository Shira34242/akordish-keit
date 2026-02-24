namespace AkordishKeit.Models.Entities;

/// <summary>
/// טבלת Junction - קשר Many-to-Many בין שיר לאמנים
/// שיר יכול להיות עם עד 5 אמנים
/// </summary>
public class SongArtist
{
    public int Id { get; set; }
    public int SongId { get; set; }
    public int? ArtistId { get; set; } // nullable - לתמיכה באמנים זמניים
    public int Order { get; set; } // סדר האמן ברשימה (1, 2, 3...)

    // שדות לאמנים זמניים (שטרם אושרו)
    public string? TempArtistName { get; set; } // שם אמן זמני
    public bool IsTemporary { get; set; } // האם זה אמן זמני

    // Navigation Properties
    public virtual Song Song { get; set; }
    public virtual Artist? Artist { get; set; } // nullable כי אמן זמני לא קשור לטבלת Artists
}