using AkordishKeit.Models.Entities;

namespace AkordishKeit.Models.Entities;

public class MusicalKey
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public bool IsMinor { get; set; }
    public int SemitoneOffset { get; set; }

    // Navigation Properties
    public virtual ICollection<Song> SongsInOriginalKey { get; set; } = new List<Song>();
    public virtual ICollection<Song> SongsInEasyKey { get; set; } = new List<Song>();
}
