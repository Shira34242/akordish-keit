using System;
using System.Collections.Generic;

namespace AkordishKeit.Models.Entities
{
    /// <summary>
    /// קטגוריות בעלי מקצוע - טבלת מאסטר
    /// המנהל יכול להוסיף קטגוריות חדשות דרך הממשק
    /// דוגמאות: אולפן הקלטות, מפיק מוזיקלי, נגן לאירועים, מעבד, קליפים וכו'
    /// </summary>
    public class MusicServiceProviderCategory
    {
        /// <summary>
        /// מזהה ייחודי
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// שם הקטגוריה (עברית)
        /// דוגמה: "אולפן הקלטות"
        /// </summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// תיאור הקטגוריה
        /// </summary>
        public string? Description { get; set; }

        /// <summary>
        /// קישור לאייקון (אופציונלי)
        /// </summary>
        public string? IconUrl { get; set; }

        /// <summary>
        /// האם הקטגוריה פעילה
        /// </summary>
        public bool IsActive { get; set; }

        /// <summary>
        /// תאריך יצירה
        /// </summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>
        /// תאריך עדכון אחרון
        /// </summary>
        public DateTime? UpdatedAt { get; set; }

        // ════════════════════════════════════
        //          Navigation Properties
        // ════════════════════════════════════

        /// <summary>
        /// בעלי מקצוע בקטגוריה זו (Many-to-Many)
        /// </summary>
        public virtual ICollection<MusicServiceProviderCategoryMapping> ServiceProviders { get; set; } = new List<MusicServiceProviderCategoryMapping>();
    }
}
