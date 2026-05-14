namespace AkordishKeit.Models.Entities
{
    /// <summary>
    /// הגדרת קטגוריות לתצוגה בדפי התוכן הציבוריים
    /// </summary>
    public class NewsPageSection
    {
        public int Id { get; set; }

        /// <summary>
        /// שם ההגדרה בניהול
        /// </summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>
        /// ערך ישן שנשמר לתאימות לאחור
        /// </summary>
        public int SectionType { get; set; }

        /// <summary>
        /// מזהה קטגוריה ישן לתאימות לאחור
        /// </summary>
        public int? CategoryId { get; set; }

        /// <summary>
        /// הדף שבו ההגדרה פעילה: 0 = חדשות מוזיקה, 1 = כתבות
        /// </summary>
        public int? ContentTypeId { get; set; }

        /// <summary>
        /// מזהי קטגוריות לבחירה מרובה, מופרדים בפסיקים
        /// </summary>
        /// <summary>
        /// סדר הצגה בדף (ממוין בסדר עולה)
        /// </summary>
        public int DisplayOrder { get; set; }

        /// <summary>
        /// האם הפס פעיל ומוצג בדף
        /// </summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// ערך ישן שנשמר לתאימות לאחור
        /// </summary>
        public int ArticleCount { get; set; } = 10;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public virtual ICollection<NewsPageSectionCategory> Categories { get; set; } = new List<NewsPageSectionCategory>();
    }
}
