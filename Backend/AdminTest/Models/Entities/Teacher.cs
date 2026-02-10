using System.Collections.Generic;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities
{
    /// <summary>
    /// מורה - הרחבה ל-ServiceProvider
    /// מכיל רק שדות ייחודיים למורים!
    /// קשר 1:1 עם ServiceProvider (Id זהה)
    /// </summary>
    public class Teacher
    {
        // ════════════════════════════════════
        //          מזהה (זהה ל-ServiceProvider.Id)
        // ════════════════════════════════════

        /// <summary>
        /// מזהה ייחודי - זהה ל-ServiceProvider.Id
        /// </summary>
        public int Id { get; set; }

        // ════════════════════════════════════
        //       שדות ייחודיים למורים בלבד!
        // ════════════════════════════════════

        /// <summary>
        /// מחירון - טקסט חופשי או JSON
        /// דוגמה: "שיעור פרטי - 150 ש״ח, שיעור אונליין - 120 ש״ח"
        /// או JSON: {"private": 150, "online": 120}
        /// </summary>
        public string? PriceList { get; set; }

        /// <summary>
        /// שפות הוראה - Flags Enum
        /// ניתן לבחור מספר שפות
        /// דוגמה: TeachingLanguage.Hebrew | TeachingLanguage.English
        /// </summary>
        public TeachingLanguage? Languages { get; set; }

        /// <summary>
        /// קהל יעד - Flags Enum
        /// ניתן לבחור מספר קהלי יעד
        /// דוגמה: TargetAudience.Children | TargetAudience.Teenagers
        /// </summary>
        public TargetAudience? TargetAudience { get; set; }

        /// <summary>
        /// זמינות - טקסט חופשי
        /// דוגמה: "ימים א'-ה' בערב, שישי בבוקר"
        /// </summary>
        public string? Availability { get; set; }

        /// <summary>
        /// השכלה / תעודות
        /// דוגמה: "תואר ראשון במוזיקה מהאקדמיה למוזיקה"
        /// </summary>
        public string? Education { get; set; }

        /// <summary>
        /// סוגי שיעורים - JSON array
        /// דוגמה: ["פרטי", "קבוצתי", "אונליין"]
        /// </summary>
        public string? LessonTypes { get; set; }

        /// <summary>
        /// התמחויות מיוחדות
        /// דוגמה: "התמחות בילדים עם צרכים מיוחדים"
        /// </summary>
        public string? Specializations { get; set; }

        // ════════════════════════════════════
        //          Navigation Properties
        // ════════════════════════════════════

        /// <summary>
        /// חזרה ל-ServiceProvider (קשר 1:1)
        /// </summary>
        public virtual MusicServiceProvider ServiceProvider { get; set; } = null!;

        /// <summary>
        /// כלי נגינה שהמורה מלמד (Many-to-Many)
        /// מורה יכול ללמד כמה כלי נגינה!
        /// </summary>
        public virtual ICollection<TeacherInstrument> Instruments { get; set; } = new List<TeacherInstrument>();
    }
}
