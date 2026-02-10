using AkordishKeit.Models.Entities;

namespace AkordishKeit.Models.Entities;

public class SongRating
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int SongId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation Properties
    public virtual User User { get; set; }
    public virtual Song Song { get; set; }
}