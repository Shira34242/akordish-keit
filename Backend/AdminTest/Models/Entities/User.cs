using System;
using System.Collections.Generic;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities;

/// <summary>
/// משתמש במערכת - זהות והתחברות
/// </summary>
public class User
{
    // ════════════════════════════════════
    //          זהות בסיסית
    // ════════════════════════════════════

    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? GoogleId { get; set; }
    public string? PasswordHash { get; set; }
    public string? Phone { get; set; }  // טלפון אישי (חדש!)

    // ════════════════════════════════════
    //          פרופיל אישי
    // ════════════════════════════════════

    public string? ProfileImageUrl { get; set; }
    public UserRole Role { get; set; }  // הרשאות (enum)
    public int Level { get; set; }
    public int Points { get; set; }

    // ════════════════════════════════════
    //          סטטוס וניהול
    // ════════════════════════════════════

    public bool IsActive { get; set; }
    public bool EmailConfirmed { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public bool IsDeleted { get; set; }

    // ════════════════════════════════════
    //          העדxxxxxxxxxxx/ ════════════════════════════════════

    public int? PreferredInstrumentId { get; set; }

    // ════════════════════════════════════
    //          Navigation Properties
    // ════════════════════════════════════

    public virtual Instrument? PreferredInstrument { get; set; }

    /// <summary>
    /// פרופילי בעל מקצוע/מורה (1:Many)
    /// משתמש יכול להיות בעל מספר פרופילים מקצועיים
    /// </summary>
    public virtual ICollection<MusicServiceProvider> ServiceProviderProfiles { get; set; } = new List<MusicServiceProvider>();

    /// <summary>
    /// מנויים (היסטוריה כוללת)
    /// </summary>
    public virtual ICollection<Subscription> Subscriptions { get; set; } = new List<Subscription>();

    // קשרים קיימים
    public virtual ICollection<Song> UploadedSongs { get; set; } = new List<Song>();
    public virtual ICollection<Favorite> Favorites { get; set; } = new List<Favorite>();
    public virtual ICollection<SongRating> Ratings { get; set; } = new List<SongRating>();
    public virtual Artist? ManagedArtist { get; set; }

    // ════════════════════════════════════
    //          Helper Methods
    // ════════════════════════════════════

    /// <summary>
    /// בדיקה האם למשתמש יש מנוי Premium פעיל
    /// </summary>
    public bool IsPremium()
    {
        var activeSubscription = Subscriptions?
            .FirstOrDefault(s => s.IsCurrentlyActive());
        return activeSubscription?.IsPremium() ?? false;
    }

    /// <summary>
    /// בדיקה האם למשתמש יש פרופיל מקצועי (Artist או ServiceProvider)
    /// </summary>
    public bool IsProfessional()
    {
        return ManagedArtist != null || ServiceProviderProfiles.Any();
    }
}
