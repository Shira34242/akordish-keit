namespace AkordishKeit.Models.Enum
{
    /// <summary>
    /// סטטוס פרופיל בעל מקצוע/מורה
    /// </summary>
    public enum ProfileStatus
    {
        /// <summary>
        /// ממתין לאישור מנהל
        /// </summary>
        Pending = 0,

        /// <summary>
        /// פעיל ומוצג באתר
        /// </summary>
        Active = 1,

        /// <summary>
        /// הושעה על ידי מנהל
        /// </summary>
        Suspended = 2
    }
}
