using System;
using System.Collections.Generic;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities
{
    /// <summary>
    /// בעל מקצוע - הבסיס לכל נותני השירות
    /// כולל: אולפנים, מפיקים, נגנים, מעבדים, קליפים, חנויות, מורים וכו'
    /// </summary>
    public class MusicServiceProvider
    {
        // ════════════════════════════════════
        //          מזהה וקשרים
        // ════════════════════════════════════

        /// <summary>
        /// מזהה ייחודי
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// קשר למשתמש בעל הפרופיל (אופציונלי - null = פרופיל "צף" שטרם חובר למשתמש)
        /// </summary>
        public int? UserId { get; set; }

        // ════════════════════════════════════
        //          מידע בסיסי
        // ════════════════════════════════════

        /// <summary>
        /// שם מוצג באתר
        /// </summary>
        public string DisplayName { get; set; } = string.Empty;

        /// <summary>
        /// תמונת פרופיל
        /// </summary>
        public string? ProfileImageUrl { get; set; }

        /// <summary>
        /// תיאור קצר (2-4 שורות)
        /// </summary>
        public string? ShortBio { get; set; }

        /// <summary>
        /// תיאור מורחב - About Me
        /// </summary>
        public string? FullDescription { get; set; }

        // ════════════════════════════════════
        //          סוג נותן השירות
        // ════════════════════════════════════

        /// <summary>
        /// האם זה גם מורה (אז תהיה הרחבת Teacher)
        /// </summary>
        public bool IsTeacher { get; set; }

        // ════════════════════════════════════
        //          מידע מקצועי
        // ════════════════════════════════════

        /// <summary>
        /// מזהה העיר (מתייחס לרשימת הערים ב-CitiesController)
        /// </summary>
        public int? CityId { get; set; }

        /// <summary>
        /// אזור פעילות / כתובת מלאה
        /// </summary>
        public string? Location { get; set; }

        /// <summary>
        /// שנות ניסיון
        /// </summary>
        public int? YearsOfExperience { get; set; }

        /// <summary>
        /// שעות פעילות (טקסט חופשי)
        /// דוגמה: "א'-ה' 10:00-19:00, ו' 9:00-13:00"
        /// </summary>
        public string? WorkingHours { get; set; }

        // ════════════════════════════════════
        //          יצירת קשר
        // ════════════════════════════════════

        /// <summary>
        /// מספר וואטסאפ ליצירת קשר
        /// </summary>
        public string? WhatsAppNumber { get; set; }

        /// <summary>
        /// מספר טלפון ליצירת קשר
        /// </summary>
        public string? PhoneNumber { get; set; }

        /// <summary>
        /// אימייל ליצירת קשר
        /// </summary>
        public string? Email { get; set; }

        /// <summary>
        /// אתר אינטרנט
        /// </summary>
        public string? WebsiteUrl { get; set; }

        // ════════════════════════════════════
        //          מדיה
        // ════════════════════════════════════

        /// <summary>
        /// קישור לסרטון YouTube או Vimeo (embed)
        /// </summary>
        public string? VideoUrl { get; set; }

        // ════════════════════════════════════
        //          ניהול ומערכת
        // ════════════════════════════════════

        /// <summary>
        /// האם מוצג בבאנר "מומלצים"
        /// </summary>
        public bool IsFeatured { get; set; }

        /// <summary>
        /// סטטוס הפרופיל (ממתין לאישור / פעיל / הושעה)
        /// </summary>
        public ProfileStatus Status { get; set; }

        // 🆕 Subscription & Tier
        /// <summary>
        /// רמת הפרופיל - חינמי או בתשלום
        /// </summary>
        public ProfileTier Tier { get; set; } = ProfileTier.Free;

        /// <summary>
        /// קישור למנוי שמממן את הפרופיל (null = פרופיל חינמי)
        /// </summary>
        public int? SubscriptionId { get; set; }

        /// <summary>
        /// האם זה הפרופיל הראשי במנוי (הכלול במחיר הבסיס)
        /// false = פרופיל נוסף (add-on בתשלום נוסף)
        /// </summary>
        public bool IsPrimaryProfile { get; set; } = false;

        /// <summary>
        /// תאריך יצירת הפרופיל
        /// </summary>
        public DateTime CreatedAt { get; set; }

        /// <summary>
        /// תאריך עדכון אחרון
        /// </summary>
        public DateTime? UpdatedAt { get; set; }

        /// <summary>
        /// מחיקה רכה
        /// </summary>
        public bool IsDeleted { get; set; }

        // ════════════════════════════════════
        //          Navigation Properties
        // ════════════════════════════════════

        /// <summary>
        /// המשתמש בעל הפרופיל (null אם הפרופיל טרם חובר למשתמש)
        /// </summary>
        public virtual User? User { get; set; }

        /// <summary>
        /// המנוי שמממן את הפרופיל (null = פרופיל חינמי)
        /// </summary>
        public virtual Subscription? Subscription { get; set; }  // 🆕

        /// <summary>
        /// קטגוריות בעל המקצוע (Many-to-Many)
        /// בעל מקצוע יכול להיות בכמה קטגוריות (למשל: אולפן + מפיק)
        /// </summary>
        public virtual ICollection<MusicServiceProviderCategoryMapping> Categories { get; set; } = new List<MusicServiceProviderCategoryMapping>();

        /// <summary>
        /// גלריית תמונות
        /// </summary>
        public virtual ICollection<MusicServiceProviderGalleryImage> GalleryImages { get; set; } = new List<MusicServiceProviderGalleryImage>();

        /// <summary>
        /// הרחבה למורה (1:0..1) - קיימת רק אם IsTeacher = true
        /// </summary>
        public virtual Teacher? TeacherProfile { get; set; }

        /// <summary>
        /// רשימת בוסטים (קידומים חד-פעמיים) שנרכשו לפרופיל זה
        /// </summary>
        public virtual ICollection<Boost> Boosts { get; set; } = new List<Boost>();
    }
}
