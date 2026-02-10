namespace AkordishKeit.Models.Entities
{
    /// <summary>
    /// תוכן מרכזי להצגה בניווט הראשי של דף חדשות המוזיקה
    /// מאפשר למנהל לבחור 4 כתבות שיוצגו בראש הדף
    /// </summary>
    public class FeaturedContent
    {
        /// <summary>
        /// מזהה ייחודי
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// מזהה הכתבה המקושרת
        /// </summary>
        public int ArticleId { get; set; }

        /// <summary>
        /// סדר התצוגה (1-4)
        /// </summary>
        public int DisplayOrder { get; set; }

        /// <summary>
        /// האם פעיל
        /// </summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// תאריך יצירה
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// תאריך עדכון
        /// </summary>
        public DateTime? UpdatedAt { get; set; }

        /// <summary>
        /// נוצר על ידי
        /// </summary>
        public string? CreatedBy { get; set; }

        /// <summary>
        /// עודכן על ידי
        /// </summary>
        public string? UpdatedBy { get; set; }

        // Navigation Properties
        /// <summary>
        /// הכתבה המקושרת
        /// </summary>
        public virtual Article Article { get; set; } = null!;
    }
}
