using System;
using System.Collections.Generic;

namespace AkordishKeit.Models.Entities;

/// <summary>
/// רשימת השמעה של משתמש
/// </summary>
public class Playlist
{
    public int Id { get; set; }

    /// <summary>
    /// מזהה המשתמש שיצר את הרשימה
    /// </summary>
    public int UserId { get; set; }

    /// <summary>
    /// שם הרשימה (חובה)
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// תיאור הרשימה (אופציונלי)
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// תמונת נושא לרשימה (אופציונלי)
    /// </summary>
    public string? ImageUrl { get; set; }

    /// <summary>
    /// האם הרשימה ציבורית (לעתיד)
    /// </summary>
    public bool IsPublic { get; set; } = false;

    /// <summary>
    /// האם הרשימה אומצה מהמאגר הקהילתי
    /// </summary>
    public bool IsAdopted { get; set; } = false;

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // ════════════════════════════════════
    //      Navigation Properties
    // ════════════════════════════════════

    /// <summary>
    /// המשתמש שיצר את הרשימה
    /// </summary>
    public virtual User User { get; set; } = null!;

    /// <summary>
    /// השירים שברשימה
    /// </summary>
    public virtual ICollection<PlaylistSong> PlaylistSongs { get; set; } = new List<PlaylistSong>();
}
