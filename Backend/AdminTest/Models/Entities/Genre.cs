using AkordishKeit.Models.Entities;

namespace AkordishKeit.Models.Entities;

public class Genre
{
    public int Id { get; set; }
    public string Name { get; set; }

    // Navigation Properties
    public virtual ICollection<SongGenre> SongGenres { get; set; }
}