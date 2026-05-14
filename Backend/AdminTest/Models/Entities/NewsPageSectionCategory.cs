namespace AkordishKeit.Models.Entities
{
    public class NewsPageSectionCategory
    {
        public int NewsPageSectionId { get; set; }
        public int CategoryId { get; set; }

        public virtual NewsPageSection NewsPageSection { get; set; } = null!;
        public virtual ArticleCategoryEntity Category { get; set; } = null!;
    }
}
