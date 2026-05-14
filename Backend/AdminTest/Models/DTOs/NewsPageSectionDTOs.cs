namespace AkordishKeit.Models.DTOs
{
    /// <summary>
    /// הגדרת קטגוריות לדף תוכן ציבורי
    /// </summary>
    public class NewsPageSectionDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;

        /// <summary>
        /// ערך ישן שנשמר לתאימות לאחור
        /// </summary>
        public int SectionType { get; set; }

        public int? CategoryId { get; set; }
        public int? ContentTypeId { get; set; }
        public List<int> CategoryIds { get; set; } = new();
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
        public string? Title { get; set; }
        public int SectionType { get; set; }
        public int? CategoryId { get; set; }
        public int? ContentTypeId { get; set; }
        public List<int> CategoryIds { get; set; } = new();
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; } = true;
        public int ArticleCount { get; set; } = 10;
    }

    public class UpdateNewsPageSectionDto
    {
        public string? Title { get; set; }
        public int SectionType { get; set; }
        public int? CategoryId { get; set; }
        public int? ContentTypeId { get; set; }
        public List<int> CategoryIds { get; set; } = new();
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; }
        public int ArticleCount { get; set; }
    }
}
