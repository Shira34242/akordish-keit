using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs
{
    /// <summary>
    /// DTO ליצירת הופעה חדשה
    /// </summary>
    public class CreateEventDto
    {
        [Required(ErrorMessage = "שם ההופעה הוא שדה חובה")]
        [StringLength(200, ErrorMessage = "שם ההופעה חייב להיות עד 200 תווים")]
        public string Name { get; set; } = string.Empty;

        [StringLength(1000, ErrorMessage = "התיאור חייב להיות עד 1000 תווים")]
        public string? Description { get; set; }

        [Required(ErrorMessage = "תמונת ההופעה היא שדה חובה")]
        [StringLength(500, ErrorMessage = "URL התמונה חייב להיות עד 500 תווים")]
        public string ImageUrl { get; set; } = string.Empty;

        [Required(ErrorMessage = "לינק לרכישת כרטיסים הוא שדה חובה")]
        [StringLength(500, ErrorMessage = "URL הכרטיסים חייב להיות עד 500 תווים")]
        public string TicketUrl { get; set; } = string.Empty;

        [Required(ErrorMessage = "תאריך ההופעה הוא שדה חובה")]
        public DateTime EventDate { get; set; }

        [StringLength(200, ErrorMessage = "המיקום חייב להיות עד 200 תווים")]
        public string? Location { get; set; }

        /// <summary>
        /// שם אומן חופשי (טקסט) - למקרה שהאומן לא קיים במערכת
        /// </summary>
        [StringLength(100, ErrorMessage = "שם האמן חייב להיות עד 100 תווים")]
        public string? ArtistName { get; set; }

        /// <summary>
        /// רשימת IDs של אומנים לתיוג (מהמערכת)
        /// </summary>
        public List<int> ArtistIds { get; set; } = new();

        public decimal? Price { get; set; }

        public int DisplayOrder { get; set; } = 0;

        public bool IsActive { get; set; } = true;
    }

    /// <summary>
    /// DTO לעדכון הופעה
    /// </summary>
    public class UpdateEventDto
    {
        [Required(ErrorMessage = "שם ההופעה הוא שדה חובה")]
        [StringLength(200, ErrorMessage = "שם ההופעה חייב להיות עד 200 תווים")]
        public string Name { get; set; } = string.Empty;

        [StringLength(1000, ErrorMessage = "התיאור חייב להיות עד 1000 תווים")]
        public string? Description { get; set; }

        [Required(ErrorMessage = "תמונת ההופעה היא שדה חובה")]
        [StringLength(500, ErrorMessage = "URL התמונה חייב להיות עד 500 תווים")]
        public string ImageUrl { get; set; } = string.Empty;

        [Required(ErrorMessage = "לינק לרכישת כרטיסים הוא שדה חובה")]
        [StringLength(500, ErrorMessage = "URL הכרטיסים חייב להיות עד 500 תווים")]
        public string TicketUrl { get; set; } = string.Empty;

        [Required(ErrorMessage = "תאריך ההופעה הוא שדה חובה")]
        public DateTime EventDate { get; set; }

        [StringLength(200, ErrorMessage = "המיקום חייב להיות עד 200 תווים")]
        public string? Location { get; set; }

        /// <summary>
        /// שם אומן חופשי (טקסט) - למקרה שהאומן לא קיים במערכת
        /// </summary>
        [StringLength(100, ErrorMessage = "שם האמן חייב להיות עד 100 תווים")]
        public string? ArtistName { get; set; }

        /// <summary>
        /// רשימת IDs של אומנים לתיוג (מהמערכת)
        /// אם מסופק, מחליף את הרשימה הקיימת
        /// </summary>
        public List<int>? ArtistIds { get; set; }

        public decimal? Price { get; set; }

        public int DisplayOrder { get; set; } = 0;

        public bool IsActive { get; set; } = true;
    }

    /// <summary>
    /// DTO להחזרת הופעה
    /// </summary>
    public class EventDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string ImageUrl { get; set; } = string.Empty;
        public string TicketUrl { get; set; } = string.Empty;
        public DateTime EventDate { get; set; }
        public string? Location { get; set; }

        /// <summary>
        /// שם אומן חופשי (טקסט) - למקרה שהאומן לא קיים במערכת
        /// </summary>
        public string? ArtistName { get; set; }

        /// <summary>
        /// אומנים מתוייגים מהמערכת
        /// </summary>
        public List<EventArtistDto> TaggedArtists { get; set; } = new();

        public decimal? Price { get; set; }
        public int DisplayOrder { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? CreatedBy { get; set; }
        public string? UpdatedBy { get; set; }

        // Calculated fields for UI
        public int DaysUntilEvent { get; set; }
        public bool IsToday { get; set; }
        public bool IsPast { get; set; }
        public string EventStatus { get; set; } = string.Empty; // "היום" / "עבר" / "עוד X ימים"
    }

    /// <summary>
    /// DTO להחזרת הופעות קרובות (לדף הראשי)
    /// </summary>
    public class UpcomingEventDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string ImageUrl { get; set; } = string.Empty;
        public string TicketUrl { get; set; } = string.Empty;
        public DateTime EventDate { get; set; }
        public string? Location { get; set; }

        /// <summary>
        /// שם אומן חופשי (טקסט)
        /// </summary>
        public string? ArtistName { get; set; }

        /// <summary>
        /// שמות אומנים מתוייגים
        /// </summary>
        public List<string> TaggedArtistNames { get; set; } = new();

        public int DaysUntilEvent { get; set; }
        public string EventStatus { get; set; } = string.Empty;
    }

    /// <summary>
    /// אומן מתוייג בהופעה
    /// </summary>
    public class EventArtistDto
    {
        public int ArtistId { get; set; }
        public string ArtistName { get; set; } = string.Empty;
        public string? ArtistImageUrl { get; set; }
    }
}
