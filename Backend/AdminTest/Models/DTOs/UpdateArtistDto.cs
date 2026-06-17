using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.DTOs;

/// <summary>
/// DTO לעדכון פרטי אומן בסיסיים
/// </summary>
public class UpdateArtistDto
{
    public string? Name { get; set; }                // נדרש ליצירה, אופציונלי לעדכון
    public string? EnglishName { get; set; }
    public string? ShortBio { get; set; }
    public string? Biography { get; set; }
    public string? ImageUrl { get; set; }
    public string? BannerImageUrl { get; set; }
    public string? BannerGifUrl { get; set; }        // רק למשלם
    /// <summary>"image" | "gif" | "video" — בחירה אחת לבאנר</summary>
    public string? BannerMediaType { get; set; }
    /// <summary>עוצמת טשטוש (0-20)</summary>
    public int? BannerBlur { get; set; }
    public string? WebsiteUrl { get; set; }
    public ArtistStatus? Status { get; set; }        // ניהול סטטוס (Admin)
    public bool? IsPremium { get; set; }             // חשבון משלם (Admin)
    public bool? IsFeatured { get; set; }            // מוצג כאמן מומלץ בדף הבית (Admin)

    // באנר הופעה — legacy
    public string? PerformanceImageUrl { get; set; }
    public string? PerformanceTicketUrl { get; set; }
    public bool? PerformanceIsActive { get; set; }

    /// <summary>
    /// פרטי האירוע לבאנר ההופעה. אם null = ניקוי הקישור.
    /// אם EventId קיים – מתעדכן אירוע קיים. אם לא – נוצר חדש.
    /// בכל מקרה האירוע יוצג גם בדף ההופעות הראשי כהופעה רגילה.
    /// </summary>
    public PerformanceEventInputDto? PerformanceEvent { get; set; }

    public List<SocialLinkDto>? SocialLinks { get; set; }
    public List<AddGalleryImageDto>? GalleryImages { get; set; }
    public List<AddVideoDto>? Videos { get; set; }
    public List<AddArtistHitDto>? Hits { get; set; }
    public List<AddArtistAlbumDto>? Albums { get; set; }
}

/// <summary>
/// קלט יצירה/עדכון של אירוע מקושר לבאנר אמן.
/// המערכת תיצור אירוע מלא ותקשר אותו לאמן.
/// </summary>
public class PerformanceEventInputDto
{
    /// <summary>אם מסופק – יעדכן אירוע קיים. אם לא – יצור חדש.</summary>
    public int? EventId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    /// <summary>תמונה ראשית לדף ההופעות (פוסטר ריבועי)</summary>
    public string ImageUrl { get; set; } = string.Empty;
    /// <summary>תמונת באנר רחבה (4:1 בערך) לתצוגה בדף האמן</summary>
    public string? BannerImageUrl { get; set; }
    public string TicketUrl { get; set; } = string.Empty;
    public DateTime EventDate { get; set; }
    public string? Location { get; set; }
    public decimal? Price { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// DTO להוספת תמונה לגלריה
/// </summary>
public class AddGalleryImageDto
{
    public string ImageUrl { get; set; } = string.Empty;
    public string? Caption { get; set; }
    public int DisplayOrder { get; set; }
}

/// <summary>
/// DTO להוספת וידאו
/// </summary>
public class AddVideoDto
{
    public string VideoUrl { get; set; } = string.Empty;
    public string? Title { get; set; }
    public int DisplayOrder { get; set; }
}

/// <summary>
/// DTO להוספת להיט גדול בדף אמן
/// </summary>
public class AddArtistHitDto
{
    public string Title { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string YouTubeUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// DTO להוספת אלבום בדף אמן
/// </summary>
public class AddArtistAlbumDto
{
    public string Title { get; set; } = string.Empty;
    public string CoverImageUrl { get; set; } = string.Empty;
    public int? ReleaseYear { get; set; }
    public string ExternalUrl { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// DTO לעדכון רשתות חברתיות
/// </summary>
public class UpdateSocialLinksDto
{
    public List<SocialLinkDto> SocialLinks { get; set; } = new();
}

/// <summary>
/// תגובה לבוסט
/// </summary>
public class BoostArtistResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTime? BoostEndDate { get; set; }
}

/// <summary>
/// תגובה לשדרוג
/// </summary>
public class UpgradeToPremiumResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? PaymentUrl { get; set; }
}
