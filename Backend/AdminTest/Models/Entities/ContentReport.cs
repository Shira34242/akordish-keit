using System;

namespace AkordishKeit.Models.Entities;

/// <summary>
/// דיווחים על תוכן - טעויות, תוכן לא ראוי וכו'
/// </summary>
public class ContentReport
{
    public int Id { get; set; }

    /// <summary>
    /// מזהה המשתמש שדיווח (null = אורח)
    /// </summary>
    public int? UserId { get; set; }

    /// <summary>
    /// סוג התוכן שדווח עליו: "Song", "Article", "BlogPost", "General"
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// מזהה התוכן שדווח עליו (0 = הודעה כללית)
    /// </summary>
    public int ContentId { get; set; }

    /// <summary>
    /// סוג הדיווח: "ContentError", "InappropriateContent", "Other"
    /// </summary>
    public string ReportType { get; set; } = string.Empty;

    /// <summary>
    /// תיאור הבעיה (טקסט חופשי)
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// תאריך ושעת הדיווח
    /// </summary>
    public DateTime ReportedAt { get; set; }

    /// <summary>
    /// סטטוס הטיפול: "Pending", "Resolved", "Dismissed"
    /// </summary>
    public string Status { get; set; } = "Pending";

    /// <summary>
    /// תאריך ושעת הטיפול
    /// </summary>
    public DateTime? ResolvedAt { get; set; }

    /// <summary>
    /// מזהה המנהל שטיפל בדיווח
    /// </summary>
    public int? ResolvedByUserId { get; set; }

    /// <summary>
    /// הערות מנהל
    /// </summary>
    public string? AdminNotes { get; set; }

    // Navigation Properties
    public virtual User? User { get; set; }
    public virtual User? ResolvedByUser { get; set; }
}
