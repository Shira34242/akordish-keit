using AkordishKeit.Models.Entities;

namespace AkordishKeit.Models.Entities;

public class SongChord
{
    public int Id { get; set; }
    public int SongId { get; set; }
    public string DisplayChordName { get; set; } = string.Empty;
    public string NormalizedChordName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }

    public virtual Song Song { get; set; } = null!;
}
