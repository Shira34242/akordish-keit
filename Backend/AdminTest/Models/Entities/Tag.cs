using AkordishKeit.Models.Entities;

namespace AkordishKeit.Models.Entities;

public class Tag
{
    public int Id { get; set; }
    public string Name { get; set; }

    // Navigation Properties
    public virtual ICollection<SongTag> SongTags { get; set; }
}