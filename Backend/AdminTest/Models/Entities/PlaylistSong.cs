using System;

namespace AkordishKeit.Models.Entities;

/// <summary>
/// קשר בין רשימת השמעה לשירים (Many-to-Many)
/// </summary>
public class PlaylistSong
{
    public int Id { get; set; }

    /// <summary>
    /// מזהה רשימת ההשמעה
    /// </summary>
    public int PlaylistId { get; set; }

    /// <summary>
    /// מזהה השיר
    /// </summary>
    public int SongId { get; set; }

    /// <summary>
    /// סדר השיר ברשימה (1, 2, 3...)
    /// </summary>
    public int Order { get; set; }

    /// <summary>
    /// מתי נוסף השיר לרשימה
    /// </summary>
    public DateTime AddedAt { get; set; }

    // ════════════════════════════════════
    //      Navigation Properties
    // ════════════════════════════════════

    /// <summary>
    /// רשימת ההשמעה
    /// </summary>
    public virtual Playlist Playlist { get; set; } = null!;

    /// <summary>
    /// השיר
    /// </summary>
    public virtual Song Song { get; set; } = null!;
}
