using System;
using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs;

/// <summary>
/// DTO לתצוגת תוכן אהוב
/// </summary>
public class LikedContentDto
{
    public int Id { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public int ContentId { get; set; }
    public DateTime LikedAt { get; set; }

    // פרטי התוכן
    public string? Title { get; set; }
    public string? Subtitle { get; set; }
    public string? ImageUrl { get; set; }
    public string? Slug { get; set; }
}

/// <summary>
/// DTO להוספת תוכן למועדפים
/// </summary>
public class AddLikedContentDto
{
    [Required(ErrorMessage = "סוג התוכן הוא שדה חובה")]
    [RegularExpression("^(Article|BlogPost)$", ErrorMessage = "סוג התוכן חייב להיות Article או BlogPost")]
    public string ContentType { get; set; } = string.Empty;

    [Required(ErrorMessage = "מזהה התוכן הוא שדה חובה")]
    public int ContentId { get; set; }
}
