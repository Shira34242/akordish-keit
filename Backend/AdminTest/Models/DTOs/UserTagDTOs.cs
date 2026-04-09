namespace AkordishKeit.Models.DTOs;

/// <summary>
/// מידע על תג תרומת התוכן של המשתמש
/// </summary>
public class UserTagDto
{
    public int UserId { get; set; }

    /// <summary>שם ה-enum: None / Beginner / Contributor / LeadingContributor</summary>
    public string Tag { get; set; } = string.Empty;

    /// <summary>שם התג בעברית</summary>
    public string TagHebrew { get; set; } = string.Empty;

    /// <summary>כמות תכנים שהועלו בתקופה הנוכחית</summary>
    public int UploadCount { get; set; }

    /// <summary>כמות ההעלאות הנדרשת לתג הבא (null = כבר בדרגה הגבוהה)</summary>
    public int? NextTagThreshold { get; set; }

    /// <summary>תאריך ההעלאה האחרונה</summary>
    public DateTime? LastUploadDate { get; set; }

    /// <summary>תאריך האיפוס (LastUploadDate + 4 חודשים). null אם אין העלאות</summary>
    public DateTime? ResetDate { get; set; }

    /// <summary>מגבלת הרשימות לתג הנוכחי (רלוונטי כשמנויים מופעלים)</summary>
    public int PlaylistLimit { get; set; }
}
