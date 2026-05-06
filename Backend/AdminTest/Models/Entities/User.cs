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

    public string? Phone { get; set; }
    public string? Address { get; set; }
    public DateTime? BirthDate { get; set; }

    /// <summary>מזהה עיר (FK לטבלת Cities — עתידית; כיום שמורה רק כמספר לתאימות עם CitiesController הקיים)</summary>
    public int? CityId { get; set; }

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
    public bool MarketingConsent { get; set; }
    public DateTime? MarketingConsentAt { get; set; }
    public DateTime? MarketingConsentRevokedAt { get; set; }
    public string? MarketingConsentSource { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public bool IsDeleted { get; set; }

    // ════════════════════════════════════
    //          העדxxxxxxxxxxx/ ════════════════════════════════════

    public int? PreferredInstrumentId { get; set; }

    /// <summary>שם כלי שלא קיים ברשימה (טקסט חופשי כשהמשתמש בחר "אחר")</summary>
    public string? OtherInstrumentName { get; set; }

    /// <summary>רמת ניגון כללית (לכל כליו של המשתמש)</summary>
    public InstrumentLevel? InstrumentLevel { get; set; }

    // ════════════════════════════════════
    //          תזכורות השלמת פרופיל
    // ════════════════════════════════════

    /// <summary>מתי הוצגה תזכורת אחרונה להשלמת פרופיל (רך — לא חוסם)</summary>
    public DateTime? LastProfileReminderAt { get; set; }

    /// <summary>כמה פעמים המשתמש דחה תזכורת. אחרי 3 — לא נציג שוב</summary>
    public int ProfileReminderDismissCount { get; set; } = 0;

    /// <summary>ספירת ביקורים (login) — משמש לקביעת מתי להציג תזכורת</summary>
    public int VisitCount { get; set; } = 0;

    // ════════════════════════════════════
    //          תג תרומת תוכן
    // ════════════════════════════════════

    /// <summary>תג נוכחי לפי כמות תכנים שהועלו</summary>
    public UserContentTag ContentTag { get; set; } = UserContentTag.None;

    /// <summary>כמות תכנים שנספרו בתקופה הנוכחית (שירים + כתבות)</summary>
    public int UploadCount { get; set; } = 0;

    /// <summary>תאריך ההעלאה האחרונה — לחישוב איפוס כל 4 חודשים</summary>
    public DateTime? LastUploadDate { get; set; }

    // ════════════════════════════════════
    //          Navigation Properties
    // ════════════════════════════════════

    public virtual Instrument? PreferredInstrument { get; set; }

    /// <summary>כלי הנגינה שהמשתמש מנגן עליהם (Many-to-Many דרך UserInstruments)</summary>
    public virtual ICollection<UserInstrument> Instruments { get; set; } = new List<UserInstrument>();

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
