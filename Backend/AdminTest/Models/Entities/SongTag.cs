using AkordishKeit.Models.Entities;

namespace AkordishKeit.Models.Entities;

public class SongTag
{
    public int SongId { get; set; }
    public int TagId { get; set; }

    // Navigation Properties
    public virtual Song Song { get; set; }
    public virtual Tag Tag { get; set; }
}