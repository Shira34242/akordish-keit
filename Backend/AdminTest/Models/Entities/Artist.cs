using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities;

public class Artist
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? EnglishName { get; set; }

    // ביוגרפיה
    public string? ShortBio { get; set; }           // תיאור קצר (1-3 שורות)
    public string? Biography { get; set; }           // ביוגרפיה ארוכה

    // תמונות
    public string? ImageUrl { get; set; }            // תמונת פרופיל
    public string? BannerImageUrl { get; set; }      // תמונת באנר (אם BannerMediaType = "image")
    public string? BannerGifUrl { get; set; }        // GIF/וידאו לבאנר (אם BannerMediaType = "gif"/"video")

    /// <summary>
    /// סוג מדיית הבאנר: "image" / "gif" / "video" (בחירה אחת בלבד)
    /// </summary>
    public string? BannerMediaType { get; set; }

    /// <summary>
    /// עוצמת טשטוש לבאנר (0-20)
    /// </summary>
    public int BannerBlur { get; set; } = 0;

    public string? WebsiteUrl { get; set; }
    public bool IsVerified { get; set; }

    // 🆕 Subscription & Tier
    /// <summary>
    /// רמת הפרופיל - חינמי או בתשלום
    /// </summary>
    public ProfileTier Tier { get; set; } = ProfileTier.Free;

    /// <summary>
    /// קישור למנוי שמממן את הפרופיל (null = פרופיל חינמי)
    /// </summary>
    public int? SubscriptionId { get; set; }

    /// <summary>
    /// האם זה הפרופיל הראשי במנוי (הכלול במחיר הבסיס)
    /// false = פרופיל נוסף (add-on בתשלום נוסף של 30₪/חודש)
    /// </summary>
    public bool IsPrimaryProfile { get; set; } = false;

    // Legacy fields - לתאימות לאחור
    public bool IsPremium { get; set; }              // חשבון משלם (deprecated - use Tier)
    public DateTime? LastBoostDate { get; set; }     // תאריך בוסט אחרון
    public int DisplayOrder { get; set; }            // סדר תצוגה

    // סטטוס
    public ArtistStatus Status { get; set; }         // Pending/Active/Hidden

    // קישורים
    public int? UserId { get; set; }
    public int? PersonId { get; set; }

    // באנר הופעה (תמונה + קישור לכרטיסים)
    public string? PerformanceImageUrl { get; set; }  // legacy — לא בשימוש בזרימה החדשה
    public string? PerformanceTicketUrl { get; set; } // legacy — לא בשימוש בזרימה החדשה
    public bool PerformanceIsActive { get; set; } = false; // האם להציג את באנר ההופעה בדף האמן

    /// <summary>
    /// קישור לאירוע (Event) שיוצג כבאנר ההופעה בדף האמן.
    /// האירוע עצמו מוצג גם בדף ההופעות הראשי כהופעה רגילה.
    /// </summary>
    public int? PerformanceEventId { get; set; }

    // תאריכים
    public DateTime CreatedAt { get; set; }
    public DateTime? BumpedAt { get; set; }
    public int BumpCount { get; set; }
    public bool IsDeleted { get; set; }

    // Navigation Properties

    public virtual User? User { get; set; }
    public virtual Person? Person { get; set; }
    public virtual Subscription? Subscription { get; set; }  // 🆕 המנוי שמממן את הפרופיל
    public virtual Event? PerformanceEvent { get; set; }     // אירוע מקושר לבאנר ההופעה
    public virtual ICollection<SongArtist> SongArtists { get; set; } = new List<SongArtist>();
    public virtual ICollection<ArtistSocialLink> SocialLinks { get; set; } = new List<ArtistSocialLink>();
    public virtual ICollection<ArtistGalleryImage> GalleryImages { get; set; } = new List<ArtistGalleryImage>();
    public virtual ICollection<ArtistVideo> Videos { get; set; } = new List<ArtistVideo>();
    public virtual ICollection<ArtistHit> Hits { get; set; } = new List<ArtistHit>();
    public virtual ICollection<ArtistAlbum> Albums { get; set; } = new List<ArtistAlbum>();
    public virtual ICollection<ArticleArtist> ArticleArtists { get; set; } = new List<ArticleArtist>();
    public virtual ICollection<EventArtist> EventArtists { get; set; } = new List<EventArtist>();
}
