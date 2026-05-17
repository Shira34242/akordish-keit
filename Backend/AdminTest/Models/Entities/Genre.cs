using AkordishKeit.Models.Entities;

namespace AkordishKeit.Models.Entities;

public class Genre
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    // Navigation Properties
    public virtual ICollection<SongGenre> SongGenres { get; set; } = new List<SongGenre>();
}
