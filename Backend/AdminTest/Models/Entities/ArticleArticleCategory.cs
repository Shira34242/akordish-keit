namespace AkordishKeit.Models.Entities;

public class ArticleArticleCategory
{
    public int ArticleId { get; set; }
    public int CategoryId { get; set; }

    // Navigation Properties
    public virtual Article Article { get; set; }
    public virtual ArticleCategoryEntity Category { get; set; }
}
