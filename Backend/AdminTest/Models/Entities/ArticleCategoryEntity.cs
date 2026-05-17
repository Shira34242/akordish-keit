using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities;

public class ArticleCategoryEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;

    // אזור באתר שבו מופיעות כתבות עם קטגוריה זו: חדשות מוזיקה (0) או תוכן מקצועי (1)
    public ArticleCategorySection Section { get; set; } = ArticleCategorySection.News;

    // Navigation Properties
    public virtual ICollection<ArticleArticleCategory> ArticleCategories { get; set; } = new List<ArticleArticleCategory>();
}
