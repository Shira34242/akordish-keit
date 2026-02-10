namespace AkordishKeit.Models.Entities;

public class ArticleTag
{
    public int Id { get; set; }
    public int ArticleId { get; set; }
    public int TagId { get; set; }

    // Navigation Properties
    public virtual Article Article { get; set; }
    public virtual Tag Tag { get; set; }
}
