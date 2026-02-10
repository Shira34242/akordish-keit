namespace AkordishKeit.Models.Entities
{
    /// <summary>
    /// קשר Many-to-Many בין בעל מקצוע לקטגוריות
    /// בעל מקצוע יכול להיות בכמה קטגוריות (למשל: אולפן + מפיק)
    /// </summary>
    public class MusicServiceProviderCategoryMapping
    {
        /// <summary>
        /// מזהה ייחודי
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// מזהה בעל המקצוע
        /// </summary>
        public int ServiceProviderId { get; set; }

        /// <summary>
        /// מזהה הקטגוריה
        /// </summary>
        public int CategoryId { get; set; }

        /// <summary>
        /// תת-קטגוריה אופציונלית
        /// דוגמה: אם הקטגוריה היא "נגן לאירועים", תת-קטגוריה יכולה להיות "גיטרה"
        /// </summary>
        public string? SubCategory { get; set; }

        // ════════════════════════════════════
        //          Navigation Properties
        // ════════════════════════════════════

        /// <summary>
        /// בעל המקצוע
        /// </summary>
        public virtual MusicServiceProvider ServiceProvider { get; set; } = null!;

        /// <summary>
        /// הקטגוריה
        /// </summary>
        public virtual MusicServiceProviderCategory Category { get; set; } = null!;
    }
}
