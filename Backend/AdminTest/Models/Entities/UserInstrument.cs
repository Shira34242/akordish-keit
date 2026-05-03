namespace AkordishKeit.Models.Entities;

/// <summary>
/// קשר Many-to-Many בין משתמש לכלי נגינה.
/// משתמש יכול לבחור כמה כלים שהוא מנגן עליהם.
/// </summary>
public class UserInstrument
{
    public int Id { get; set; }

    /// <summary>מזהה המשתמש</summary>
    public int UserId { get; set; }

    /// <summary>מזהה כלי הנגינה (טבלת Instruments הקיימת)</summary>
    public int InstrumentId { get; set; }

    /// <summary>האם זה הכלי העיקרי של המשתמש (בד"כ הראשון שנבחר)</summary>
    public bool IsPrimary { get; set; }

    // Navigation
    public virtual User User { get; set; } = null!;
    public virtual Instrument Instrument { get; set; } = null!;
}
