using AkordishKeit.Models.Entities;

namespace AkordishKeit.Models.Entities;

public class Tag
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool ShowInChordQuickSearch { get; set; }
    public int ChordQuickSearchOrder { get; set; }

    // Navigation Properties
    public virtual ICollection<SongTag> SongTags { get; set; } = new List<SongTag>();
    public virtual ICollection<ArticleTag> ArticleTags { get; set; } = new List<ArticleTag>();
}
