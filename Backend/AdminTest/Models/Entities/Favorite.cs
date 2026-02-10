using AkordishKeit.Models.Entities;

namespace AkordishKeit.Models.Entities;

public class Favorite
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int SongId { get; set; }
    public DateTime CreatedAt { get; set; }

    // Navigation Properties
    public virtual User User { get; set; }
    public virtual Song Song { get; set; }
}