namespace AkordishKeit.Models.DTOs
{
    /// <summary>
    /// פס תוכן אחד בדף חדשות המוזיקה, כולל הכתבות שלו
    /// </summary>
    public class NewsPageSectionDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;

        /// <summary>
        /// סוג הפס: 0 = לפי קטגוריה, 1 = לפי סוג תוכן
        /// </summary>
        public int SectionType { get; set; }

        public int? CategoryId { get; set; }
        public int? ContentTypeId { get; set; }
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; }
        public int ArticleCount { get; set; }

        /// <summary>
        /// הכתבות שייכות לפס זה
        /// </summary>
        public List<ArticleDto> Articles { get; set; } = new();
    }

    public class CreateNewsPageSectionDto
    {
        public string Title { get; set; } = string.Empty;
        public int SectionType { get; set; }
        public int? CategoryId { get; set; }
        public int? ContentTypeId { get; set; }
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; } = true;
        public int ArticleCount { get; set; } = 10;
    }

    public class UpdateNewsPageSectionDto
    {
        public string Title { get; set; } = string.Empty;
        public int SectionType { get; set; }
        public int? CategoryId { get; set; }
        public int? ContentTypeId { get; set; }
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; }
        public int ArticleCount { get; set; }
    }
}
