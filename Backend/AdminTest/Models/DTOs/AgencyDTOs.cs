using System.ComponentModel.DataAnnotations;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.DTOs;

public class AgencyListDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? BannerImageUrl { get; set; }
    public string? ShortDescription { get; set; }
    public string? BrandPrimaryColor { get; set; }
    public string? BrandSecondaryColor { get; set; }
    public string? BrandTextColor { get; set; }
    public bool IsActive { get; set; }
    public bool ShowInIndexBanner { get; set; }
    public int DisplayOrder { get; set; }
    public int ProfilesCount { get; set; }
    public int ContentsCount { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class AgencyContentBannerDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? BannerImageUrl { get; set; }
    public string? ShortDescription { get; set; }
    public string? BrandPrimaryColor { get; set; }
    public string? BrandSecondaryColor { get; set; }
    public string? BrandTextColor { get; set; }
}

public class AgencyDto : AgencyListDto
{
    public string? FullDescription { get; set; }
    public string? PhoneNumber { get; set; }
    public string? WhatsAppNumber { get; set; }
    public string? Email { get; set; }
    public string? WebsiteUrl { get; set; }
    public List<AgencyProfileDto> Profiles { get; set; } = new();
    public List<AgencyContentDto> Contents { get; set; } = new();
    public List<AgencyGalleryImageDto> GalleryImages { get; set; } = new();
    public List<AgencySocialLinkDto> SocialLinks { get; set; } = new();
}

public class AgencyPublicDto : AgencyDto
{
    public List<AgencyProfileCardDto> Artists { get; set; } = new();
    public List<AgencyProfileCardDto> ServiceProviders { get; set; } = new();
    public List<AgencyProfileCardDto> Teachers { get; set; } = new();
    public List<ArticleDto> DirectArticles { get; set; } = new();
    public List<SongDto> DirectSongs { get; set; } = new();
    public List<PodcastDto> DirectPodcasts { get; set; } = new();
    public List<ArticleDto> MemberArticles { get; set; } = new();
    public List<SongDto> MemberSongs { get; set; } = new();
}

public class AgencyProfileDto
{
    public int Id { get; set; }
    public int AgencyId { get; set; }
    public string ProfileType { get; set; } = string.Empty;
    public int ProfileId { get; set; }
    public AgencyContactMode ContactMode { get; set; }
    public bool ShowBadge { get; set; }
    public bool IsFeaturedByAgency { get; set; }
    public int DisplayOrder { get; set; }
    public string? ProfileName { get; set; }
    public string? ProfileImageUrl { get; set; }
    public bool IsTeacher { get; set; }
    public string? ProfileUrl { get; set; }
}

public class AgencyContentDto
{
    public int Id { get; set; }
    public int AgencyId { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public int ContentId { get; set; }
    public bool IsFeatured { get; set; }
    public int DisplayOrder { get; set; }
    public string? Title { get; set; }
}

public class AgencyProfileCardDto
{
    public int Id { get; set; }
    public string ProfileType { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string? Subtitle { get; set; }
    public string ProfileUrl { get; set; } = string.Empty;
    public bool IsTeacher { get; set; }
    public AgencyContactMode ContactMode { get; set; }
}

public class AgencyBadgeDto
{
    public int AgencyId { get; set; }
    public string AgencyName { get; set; } = string.Empty;
    public string AgencySlug { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string? BrandPrimaryColor { get; set; }
    public string? BrandSecondaryColor { get; set; }
    public string? BrandTextColor { get; set; }
    public AgencyContactMode ContactMode { get; set; }
    public bool ShowBadge { get; set; }
    public string? PhoneNumber { get; set; }
    public string? WhatsAppNumber { get; set; }
    public string? Email { get; set; }
    public string? WebsiteUrl { get; set; }
}

public class CreateAgencyDto
{
    [Required, StringLength(200)]
    public string Name { get; set; } = string.Empty;
    [StringLength(220)]
    public string? Slug { get; set; }
    [StringLength(500)]
    public string? LogoUrl { get; set; }
    [StringLength(500)]
    public string? BannerImageUrl { get; set; }
    [StringLength(500)]
    public string? ShortDescription { get; set; }
    public string? FullDescription { get; set; }
    [StringLength(20)]
    public string? PhoneNumber { get; set; }
    [StringLength(20)]
    public string? WhatsAppNumber { get; set; }
    [StringLength(200), EmailAddress]
    public string? Email { get; set; }
    [StringLength(500)]
    public string? WebsiteUrl { get; set; }
    [StringLength(20)]
    public string? BrandPrimaryColor { get; set; }
    [StringLength(20)]
    public string? BrandSecondaryColor { get; set; }
    [StringLength(20)]
    public string? BrandTextColor { get; set; }
    public bool IsActive { get; set; } = true;
    public bool ShowInIndexBanner { get; set; }
    public int DisplayOrder { get; set; }
}

public class UpdateAgencyDto : CreateAgencyDto
{
}

public class UpsertAgencyProfileDto
{
    [Required]
    public string ProfileType { get; set; } = string.Empty;
    [Required]
    public int ProfileId { get; set; }
    public AgencyContactMode ContactMode { get; set; } = AgencyContactMode.Direct;
    public bool ShowBadge { get; set; } = true;
    public bool IsFeaturedByAgency { get; set; }
    public int DisplayOrder { get; set; }
}

public class UpsertAgencyContentDto
{
    [Required]
    public string ContentType { get; set; } = string.Empty;
    [Required]
    public int ContentId { get; set; }
    public bool IsFeatured { get; set; }
    public int DisplayOrder { get; set; }
}

public class AgencyGalleryImageDto
{
    public int Id { get; set; }
    public int AgencyId { get; set; }
    public string MediaType { get; set; } = "image";
    public string? ImageUrl { get; set; }
    public string? VideoUrl { get; set; }
    public string? Title { get; set; }
    public string? Caption { get; set; }
    public int DisplayOrder { get; set; }
}

public class AgencySocialLinkDto
{
    public int Id { get; set; }
    public int AgencyId { get; set; }
    public SocialPlatform Platform { get; set; }
    public string Url { get; set; } = string.Empty;
}
