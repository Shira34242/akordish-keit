namespace AkordishKeit.Models.Entities
{
    /// <summary>
    /// פס תוכן דינמי בדף חדשות המוזיקה
    /// מאפשר למנהל לקבוע אילו קטגוריות מוצגות ובאיזה סדר
    /// </summary>
    public class NewsPageSection
    {
        public int Id { get; set; }

        /// <summary>
        /// כותרת הפס (לדוגמה: "פופולאריים", "קליפים", "תוכן")
        /// </summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>
        /// סוג הפס: 0 = לפי קטגוריה, 1 = לפי סוג תוכן
        /// </summary>
        public int SectionType { get; set; }

        /// <summary>
        /// מזהה קטגוריה (בשימוש כאשר SectionType = 0)
        /// </summary>
        public int? CategoryId { get; set; }

        /// <summary>
        /// סוג תוכן (בשימוש כאשר SectionType = 1): 0 = חדשות, 1 = בלוג
        /// </summary>
        public int? ContentTypeId { get; set; }

        /// <summary>
        /// סדר הצגה בדף (ממוין בסדר עולה)
        /// </summary>
        public int DisplayOrder { get; set; }

        /// <summary>
        /// האם הפס פעיל ומוצג בדף
        /// </summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// מספר כתבות להצגה בפס
        /// </summary>
        public int ArticleCount { get; set; } = 10;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
