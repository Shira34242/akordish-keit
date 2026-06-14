namespace AkordishKeit.Models.Enum;

/// <summary>
/// סטטוס אומן
/// </summary>
public enum ArtistStatus
{
    /// <summary>
    /// ממתין לאישור
    /// </summary>
    Pending = 0,

    /// <summary>
    /// פעיל
    /// </summary>
    Active = 1,

    /// <summary>
    /// מוסתר/מושעה
    /// </summary>
    Hidden = 2,

    /// <summary>
    /// טיוטה שעדיין לא הושלמה
    /// </summary>
    Draft = 3
}
