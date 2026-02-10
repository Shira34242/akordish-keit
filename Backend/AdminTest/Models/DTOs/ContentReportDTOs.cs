using System;
using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs;

/// <summary>
/// DTO ליצירת דיווח חדש
/// </summary>
public class CreateReportDto
{
    [Required(ErrorMessage = "סוג התוכן הוא שדה חובה")]
    [RegularExpression("^(Song|Article|BlogPost|General)$", ErrorMessage = "סוג התוכן לא חוקי")]
    public string ContentType { get; set; } = string.Empty;

    [Required(ErrorMessage = "מזהה התוכן הוא שדה חובה")]
    public int ContentId { get; set; }

    [Required(ErrorMessage = "סוג הדיווח הוא שדה חובה")]
    [RegularExpression("^(ContentError|InappropriateContent|Other)$", ErrorMessage = "סוג הדיווח לא חוקי")]
    public string ReportType { get; set; } = string.Empty;

    [Required(ErrorMessage = "תיאור הבעיה הוא שדה חובה")]
    [StringLength(1000, MinimumLength = 10, ErrorMessage = "התיאור חייב להיות בין 10 ל-1000 תווים")]
    public string Description { get; set; } = string.Empty;
}

/// <summary>
/// DTO לתצוגת דיווח (למנהלים)
/// </summary>
public class ReportDto
{
    public int Id { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public int ContentId { get; set; }
    public string ContentTitle { get; set; } = string.Empty;
    public string ContentUrl { get; set; } = string.Empty;
    public string ReportType { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTime ReportedAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ReporterUsername { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? ResolvedByUsername { get; set; }
    public string? AdminNotes { get; set; }
}

/// <summary>
/// DTO לעדכון סטטוס דיווח
/// </summary>
public class UpdateReportStatusDto
{
    [Required(ErrorMessage = "סטטוס הוא שדה חובה")]
    [RegularExpression("^(Resolved|Dismissed)$", ErrorMessage = "סטטוס לא חוקי")]
    public string Status { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "הערות המנהל לא יכולות לעבור 500 תווים")]
    public string? AdminNotes { get; set; }
}
