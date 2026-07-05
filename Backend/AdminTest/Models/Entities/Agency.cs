using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities;

public class Agency
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? BannerImageUrl { get; set; }
    public int BannerBlur { get; set; } = 0;
    public string? ShortDescription { get; set; }
    public string? FullDescription { get; set; }
    public string? PhoneNumber { get; set; }
    public string? WhatsAppNumber { get; set; }
    public string? Email { get; set; }
    public string? WebsiteUrl { get; set; }
    public string? BrandPrimaryColor { get; set; }
    public string? BrandSecondaryColor { get; set; }
    public string? BrandTextColor { get; set; }
    public bool IsActive { get; set; } = true;
    public bool ShowInIndexBanner { get; set; }
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }

    public virtual ICollection<AgencyProfile> Profiles { get; set; } = new List<AgencyProfile>();
    public virtual ICollection<AgencyContent> Contents { get; set; } = new List<AgencyContent>();
    public virtual ICollection<AgencyGalleryImage> GalleryImages { get; set; } = new List<AgencyGalleryImage>();
    public virtual ICollection<AgencySocialLink> SocialLinks { get; set; } = new List<AgencySocialLink>();
}

public class AgencyProfile
{
    public int Id { get; set; }
    public int AgencyId { get; set; }
    public string ProfileType { get; set; } = string.Empty; // "artist" | "serviceProvider"
    public int ProfileId { get; set; }
    public AgencyContactMode ContactMode { get; set; } = AgencyContactMode.Direct;
    public bool ShowBadge { get; set; } = true;
    public bool IsFeaturedByAgency { get; set; }
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; }

    public virtual Agency Agency { get; set; } = null!;
}

public class AgencyContent
{
    public int Id { get; set; }
    public int AgencyId { get; set; }
    public string ContentType { get; set; } = string.Empty; // "article" | "song" | "podcast"
    public int ContentId { get; set; }
    public bool IsFeatured { get; set; }
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; }

    public virtual Agency Agency { get; set; } = null!;
}
