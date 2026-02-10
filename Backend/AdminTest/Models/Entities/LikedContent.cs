using System;

namespace AkordishKeit.Models.Entities;

/// <summary>
/// Entity לשמירת תכנים שהמשתמש אהב (כתבות, פוסטים בבלוג)
/// </summary>
public class LikedContent
{
    public int Id { get; set; }

    /// <summary>
    /// מזהה המשתמש שאהב את התוכן
    /// </summary>
    public int UserId { get; set; }

    /// <summary>
    /// סוג התוכן: "Article" או "BlogPost"
    /// </summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>
    /// מזהה התוכן (Article.Id או BlogPost.Id)
    /// </summary>
    public int ContentId { get; set; }

    /// <summary>
    /// תאריך שבו התוכן נוסף למועדפים
    /// </summary>
    public DateTime LikedAt { get; set; }

    // Navigation properties
    public virtual User User { get; set; } = null!;
}
