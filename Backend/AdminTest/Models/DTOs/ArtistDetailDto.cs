using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.DTOs;

/// <summary>
/// פרטי אומן מלאים לצגה בדף האומן
/// </summary>
public class ArtistDetailDto
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string? EnglishName { get; set; }
    public string? ShortBio { get; set; }
    public string? Biography { get; set; }
    public string? ImageUrl { get; set; }
    public string? BannerImageUrl { get; set; }
    public string? BannerGifUrl { get; set; }
    public string? WebsiteUrl { get; set; }
    public bool IsVerified { get; set; }
    public bool IsPremium { get; set; }
    public ArtistStatus Status { get; set; }
    public int? UserId { get; set; }

    // מדיה
    public List<ArtistGalleryImageDto> GalleryImages { get; set; } = new();
    public List<ArtistVideoDto> Videos { get; set; } = new();
    public List<SocialLinkDto> SocialLinks { get; set; } = new();

    // סטטיסטיקות
    public int SongCount { get; set; }
    public int ArticleCount { get; set; }
    public int UpcomingEventCount { get; set; }

    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// אומן לרשימות (מקוצר)
/// </summary>
public class ArtistListDto
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string? ShortBio { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsVerified { get; set; }
    public bool IsPremium { get; set; }
    public int SongCount { get; set; }
    public ArtistStatus Status { get; set; }  // נדרש עבור Admin
    public DateTime CreatedAt { get; set; }    // נדרש עבור Admin
}

/// <summary>
/// תמונה בגלריה
/// </summary>
public class ArtistGalleryImageDto
{
    public int Id { get; set; }
    public string ImageUrl { get; set; }
    public string? Caption { get; set; }
    public int DisplayOrder { get; set; }
}

/// <summary>
/// וידאו מוטמע
/// </summary>
public class ArtistVideoDto
{
    public int Id { get; set; }
    public string VideoUrl { get; set; }
    public string? Title { get; set; }
    public int DisplayOrder { get; set; }
}

/// <summary>
/// קישור לרשת חברתית
/// </summary>
public class SocialLinkDto
{
    public int? Id { get; set; }  // null עבור קישורים חדשים
    public SocialPlatform Platform { get; set; }
    public string Url { get; set; }
}
