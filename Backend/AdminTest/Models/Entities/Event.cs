namespace AkordishKeit.Models.Entities
{
    /// <summary>
    /// הופעה/אירוע מוזיקלי
    /// </summary>
    public class Event
    {
        /// <summary>
        /// מזהה ייחודי
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// שם ההופעה
        /// </summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// תיאור ההופעה
        /// </summary>
        public string? Description { get; set; }

        /// <summary>
        /// תמונת ההופעה
        /// </summary>
        public string ImageUrl { get; set; } = string.Empty;

        /// <summary>
        /// לינק לרכישת כרטיסים
        /// </summary>
        public string TicketUrl { get; set; } = string.Empty;

        /// <summary>
        /// תאריך ההופעה
        /// </summary>
        public DateTime EventDate { get; set; }

        /// <summary>
        /// מיקום ההופעה
        /// </summary>
        public string? Location { get; set; }

        /// <summary>
        /// שם האמן/להקה
        /// </summary>
        public string? ArtistName { get; set; }

        /// <summary>
        /// מחיר כרטיס (אופציונלי להצגה)
        /// </summary>
        public decimal? Price { get; set; }

        /// <summary>
        /// סדר תצוגה
        /// </summary>
        public int DisplayOrder { get; set; } = 0;

        /// <summary>
        /// האם להציג בדף הראשי
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

        /// <summary>
        /// מחיקה רכה
        /// </summary>
        public bool IsDeleted { get; set; } = false;

        // Navigation Properties
        public virtual ICollection<EventArtist> EventArtists { get; set; }
    }
}
