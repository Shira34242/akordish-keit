using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.DTOs;

/// <summary>
/// פרטי אומן מלאים לצגה בדף האומן
/// </summary>
public class ArtistDetailDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? EnglishName { get; set; }
    public string? ShortBio { get; set; }
    public string? Biography { get; set; }
    public string? ImageUrl { get; set; }
    public string? BannerImageUrl { get; set; }
    public string? BannerGifUrl { get; set; }
    /// <summary>"image" | "gif" | "video" — איזה מהשדות לעיל פעיל</summary>
    public string? BannerMediaType { get; set; }
    /// <summary>עוצמת טשטוש (0-20)</summary>
    public int BannerBlur { get; set; }
    public string? WebsiteUrl { get; set; }
    public bool IsVerified { get; set; }
    public bool IsPremium { get; set; }
    public bool IsFeatured { get; set; }
    public ArtistStatus Status { get; set; }
    public int? UserId { get; set; }

    // באנר הופעה (legacy + חדש)
    public string? PerformanceImageUrl { get; set; }
    public string? PerformanceTicketUrl { get; set; }
    public bool PerformanceIsActive { get; set; }

    /// <summary>אירוע מקושר לבאנר ההופעה (אם קיים)</summary>
    public int? PerformanceEventId { get; set; }
    public PerformanceEventDetailsDto? PerformanceEvent { get; set; }

    // מדיה
    public List<ArtistGalleryImageDto> GalleryImages { get; set; } = new();
    public List<ArtistVideoDto> Videos { get; set; } = new();
    public List<ArtistHitDto> Hits { get; set; } = new();
    public List<ArtistAlbumDto> Albums { get; set; } = new();
    public List<SocialLinkDto> SocialLinks { get; set; } = new();

    // סטטיסטיקות
    public int SongCount { get; set; }
    public int ArticleCount { get; set; }
    public int UpcomingEventCount { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? BumpedAt { get; set; }
    public int BumpCount { get; set; }
}

/// <summary>
/// אומן לרשימות (מקוצר)
/// </summary>
public class ArtistListDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ShortBio { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsVerified { get; set; }
    public bool IsPremium { get; set; }
    public bool IsFeatured { get; set; }
    public int SongCount { get; set; }
    public ArtistStatus Status { get; set; }  // נדרש עבור Admin
    public DateTime CreatedAt { get; set; }    // נדרש עבור Admin
    public DateTime? BumpedAt { get; set; }
    public int BumpCount { get; set; }
}

/// <summary>
/// תמונה בגלריה
/// </summary>
public class ArtistGalleryImageDto
{
    public int Id { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public string? Caption { get; set; }
    public int DisplayOrder { get; set; }
}

/// <summary>
/// וידאו מוטמע
/// </summary>
public class ArtistVideoDto
{
    public int Id { get; set; }
    public string VideoUrl { get; set; } = string.Empty;
    public string? Title { get; set; }
    public int DisplayOrder { get; set; }
}

/// <summary>
/// להיט גדול בדף אמן
/// </summary>
public class ArtistHitDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string YouTubeUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
}

/// <summary>
/// אלבום בדף אמן עם קישור חיצוני
/// </summary>
public class ArtistAlbumDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string CoverImageUrl { get; set; } = string.Empty;
    public int? ReleaseYear { get; set; }
    public string ExternalUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; }
}

/// <summary>
/// קישור לרשת חברתית
/// </summary>
public class SocialLinkDto
{
    public int? Id { get; set; }  // null עבור קישורים חדשים
    public SocialPlatform Platform { get; set; }
    public string Url { get; set; } = string.Empty;
}

/// <summary>
/// פרטי אירוע (Event) המקושר לבאנר ההופעה של אמן
/// </summary>
public class PerformanceEventDetailsDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public string? BannerImageUrl { get; set; }
    public string TicketUrl { get; set; } = string.Empty;
    public DateTime EventDate { get; set; }
    public string? Location { get; set; }
    public decimal? Price { get; set; }
    public bool IsActive { get; set; }
}
