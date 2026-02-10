using System;

namespace AkordishKeit.Models.Entities
{
    /// <summary>
    /// תמונות בגלריה של בעל מקצוע (כולל מורים)
    /// </summary>
    public class MusicServiceProviderGalleryImage
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
        /// קישור לתמונה
        /// </summary>
        public string ImageUrl { get; set; } = string.Empty;

        /// <summary>
        /// כיתוב לתמונה (אופציונלי)
        /// </summary>
        public string? Caption { get; set; }

        /// <summary>
        /// סדר הצגה
        /// </summary>
        public int Order { get; set; }

        /// <summary>
        /// תאריך העלאה
        /// </summary>
        public DateTime CreatedAt { get; set; }

        // ════════════════════════════════════
        //          Navigation Properties
        // ════════════════════════════════════

        /// <summary>
        /// בעל המקצוע
        /// </summary>
        public virtual MusicServiceProvider ServiceProvider { get; set; } = null!;
    }
}
