namespace AkordishKeit.Models.Entities;

/// <summary>
/// תמונה בגלריית האומן (עד 10 תמונות, משלם בלבד)
/// </summary>
public class ArtistGalleryImage
{
    public int Id { get; set; }
    public int ArtistId { get; set; }
    public string ImageUrl { get; set; }
    public string? Caption { get; set; }           // כיתוב לתמונה
    public int DisplayOrder { get; set; }           // סדר תצוגה
    public DateTime CreatedAt { get; set; }

    // Navigation Properties
    public virtual Artist Artist { get; set; }
}
