using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.Enum;

public enum ArticleCategorySection
{
    [Display(Name = "חדשות מוזיקה")]
    News = 0,

    [Display(Name = "תוכן מקצועי")]
    Content = 1
}
