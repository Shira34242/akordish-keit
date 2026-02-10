namespace AkordishKeit.Models.Entities
{
    /// <summary>
    /// קשר Many-to-Many בין מורה לכלי נגינה
    /// מורה יכול ללמד כמה כלי נגינה
    /// </summary>
    public class TeacherInstrument
    {
        /// <summary>
        /// מזהה ייחודי
        /// </summary>
        public int Id { get; set; }

        /// <summary>
        /// מזהה המורה
        /// </summary>
        public int TeacherId { get; set; }

        /// <summary>
        /// מזהה כלי הנגינה (קשר לטבלה קיימת Instruments)
        /// </summary>
        public int InstrumentId { get; set; }

        /// <summary>
        /// האם זה הכלי העיקרי שהמורה מלמד
        /// </summary>
        public bool IsPrimary { get; set; }

        // ════════════════════════════════════
        //          Navigation Properties
        // ════════════════════════════════════

        /// <summary>
        /// המורה
        /// </summary>
        public virtual Teacher Teacher { get; set; } = null!;

        /// <summary>
        /// כלי הנגינה (טבלה קיימת!)
        /// </summary>
        public virtual Instrument Instrument { get; set; } = null!;
    }
}
