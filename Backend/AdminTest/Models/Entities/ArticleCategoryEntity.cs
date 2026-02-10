namespace AkordishKeit.Models.Entities;

public class ArticleCategoryEntity
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string DisplayName { get; set; }

    // Navigation Properties
    public virtual ICollection<ArticleArticleCategory> ArticleCategories { get; set; }
}
