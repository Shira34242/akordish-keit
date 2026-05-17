using AkordishKeit.Models.Entities;

namespace AkordishKeit.Models.Entities;

public class Person
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? EnglishName { get; set; }
    public string? Biography { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsDeleted { get; set; }

    // Navigation Properties
    public virtual ICollection<Song> ComposedSongs { get; set; } = new List<Song>();
    public virtual ICollection<Song> WrittenSongs { get; set; } = new List<Song>();
    public virtual ICollection<Song> ArrangedSongs { get; set; } = new List<Song>();
    public virtual ICollection<Artist> Artists { get; set; } = new List<Artist>();
}
