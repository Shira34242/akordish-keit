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
    public string? WebsiteUrl { get; set; }
    public ArtistStatus? Status { get; set; }        // ניהול סטטוס (Admin)
    public bool? IsPremium { get; set; }             // חשבון משלם (Admin)
    public List<SocialLinkDto>? SocialLinks { get; set; }
    public List<AddGalleryImageDto>? GalleryImages { get; set; }
    public List<AddVideoDto>? Videos { get; set; }
}

/// <summary>
/// DTO להוספת תמונה לגלריה
/// </summary>
public class AddGalleryImageDto
{
    public string ImageUrl { get; set; }
    public string? Caption { get; set; }
    public int DisplayOrder { get; set; }
}

/// <summary>
/// DTO להוספת וידאו
/// </summary>
public class AddVideoDto
{
    public string VideoUrl { get; set; }
    public string? Title { get; set; }
    public int DisplayOrder { get; set; }
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
    public string Message { get; set; }
    public DateTime? BoostEndDate { get; set; }
}

/// <summary>
/// תגובה לשדרוג
/// </summary>
public class UpgradeToPremiumResponse
{
    public bool Success { get; set; }
    public string Message { get; set; }
    public string? PaymentUrl { get; set; }
}
