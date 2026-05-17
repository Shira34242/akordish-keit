using AkordishKeit.Models.Entities;

namespace AkordishKeit.Models.Entities;

public class SongGenre
{
    public int SongId { get; set; }
    public int GenreId { get; set; }

    // Navigation Properties
    public virtual Song Song { get; set; } = null!;
    public virtual Genre Genre { get; set; } = null!;
}
