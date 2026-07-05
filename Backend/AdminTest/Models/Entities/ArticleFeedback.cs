namespace AkordishKeit.Models.Entities;

/// <summary>
/// הצבעת כן/לא של משתמש על כתבה (חד-פעמית לכל משתמש/IP)
/// </summary>
public class ArticleFeedback
{
    public int Id { get; set; }

    public int ArticleId { get; set; }

    /// <summary>מזהה משתמש — null אם אנונימי</summary>
    public int? UserId { get; set; }

    /// <summary>IP לזיהוי אנונימי</summary>
    public string? IpAddress { get; set; }

    public string? GuestId { get; set; }

    /// <summary>true = כן, false = לא</summary>
    public bool IsPositive { get; set; }

    public DateTime CreatedAt { get; set; }

    // Navigation
    public virtual Article Article { get; set; } = null!;
    public virtual User? User { get; set; }
}
