using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities;

public class Artist
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string? EnglishName { get; set; }

    // ביוגרפיה
    public string? ShortBio { get; set; }           // תיאור קצר (1-3 שורות)
    public string? Biography { get; set; }           // ביוגרפיה ארוכה

    // תמונות
    public string? ImageUrl { get; set; }            // תמונת פרופיל
    public string? BannerImageUrl { get; set; }      // תמונת באנר רגילה (לכולם)
    public string? BannerGifUrl { get; set; }        // GIF/וידאו לבאנר (משלם בלבד)

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

    // תאריכים
    public DateTime CreatedAt { get; set; }
    public bool IsDeleted { get; set; }

    // Navigation Properties

    public virtual User? User { get; set; }
    public virtual Person? Person { get; set; }
    public virtual Subscription? Subscription { get; set; }  // 🆕 המנוי שמממן את הפרופיל
    public virtual ICollection<SongArtist> SongArtists { get; set; }
    public virtual ICollection<ArtistSocialLink> SocialLinks { get; set; }
    public virtual ICollection<ArtistGalleryImage> GalleryImages { get; set; }
    public virtual ICollection<ArtistVideo> Videos { get; set; }
    public virtual ICollection<ArticleArtist> ArticleArtists { get; set; }
    public virtual ICollection<EventArtist> EventArtists { get; set; }
}