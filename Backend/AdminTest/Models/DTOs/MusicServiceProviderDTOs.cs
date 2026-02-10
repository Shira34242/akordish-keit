using System.ComponentModel.DataAnnotations;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.DTOs;

// ═══════════════════════════════════════════════════════════
//                    Read DTOs (for responses)
// ═══════════════════════════════════════════════════════════

public class MusicServiceProviderDto
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string? UserName { get; set; }
    public string? UserEmail { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public string? ShortBio { get; set; }
    public string? FullDescription { get; set; }
    public bool IsTeacher { get; set; }
    public int? CityId { get; set; }
    public string? CityName { get; set; }
    public string? Location { get; set; }
    public int? YearsOfExperience { get; set; }
    public string? WorkingHours { get; set; }
    public string? WhatsAppNumber { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? WebsiteUrl { get; set; }
    public string? VideoUrl { get; set; }
    public bool IsFeatured { get; set; }
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Collections
    public List<ServiceProviderCategoryDto> Categories { get; set; } = new();
    public List<GalleryImageDto> GalleryImages { get; set; } = new();
}

public class TeacherDto : MusicServiceProviderDto
{
    public string? PriceList { get; set; }
    public TeachingLanguage? Languages { get; set; }
    public TargetAudience? TargetAudience { get; set; }
    public string? Availability { get; set; }
    public string? Education { get; set; }
    public string? LessonTypes { get; set; }
    public string? Specializations { get; set; }
    public List<TeacherInstrumentDto> Instruments { get; set; } = new();
}

public class ServiceProviderCategoryDto
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string? SubCategory { get; set; }
}

public class GalleryImageDto
{
    public int Id { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public string? Caption { get; set; }
    public int Order { get; set; }
}

public class TeacherInstrumentDto
{
    public int Id { get; set; }
    public int InstrumentId { get; set; }
    public string InstrumentName { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
}

// ═══════════════════════════════════════════════════════════
//                    Create DTOs
// ═══════════════════════════════════════════════════════════

public class CreateMusicServiceProviderDto
{
    public int? UserId { get; set; }

    [Required]
    [StringLength(200)]
    public string DisplayName { get; set; } = string.Empty;

    [StringLength(500)]
    public string? ProfileImageUrl { get; set; }

    [StringLength(500)]
    public string? ShortBio { get; set; }

    public string? FullDescription { get; set; }

    public bool IsTeacher { get; set; }

    public int? CityId { get; set; }

    [StringLength(200)]
    public string? Location { get; set; }

    [Range(0, 100)]
    public int? YearsOfExperience { get; set; }

    [StringLength(500)]
    public string? WorkingHours { get; set; }

    [StringLength(20)]
    public string? WhatsAppNumber { get; set; }

    [StringLength(20)]
    public string? PhoneNumber { get; set; }

    [StringLength(200)]
    [EmailAddress]
    public string? Email { get; set; }

    [StringLength(500)]
    [Url]
    public string? WebsiteUrl { get; set; }

    [StringLength(500)]
    public string? VideoUrl { get; set; }

    public bool IsFeatured { get; set; }

    [Required]
    public int Status { get; set; }

    // Collections
    public List<CreateServiceProviderCategoryDto>? Categories { get; set; }
    public List<CreateGalleryImageDto>? GalleryImages { get; set; }
}

public class CreateTeacherDto : CreateMusicServiceProviderDto
{
    [StringLength(1000)]
    public string? PriceList { get; set; }

    public TeachingLanguage? Languages { get; set; }

    public TargetAudience? TargetAudience { get; set; }

    [StringLength(1000)]
    public string? Availability { get; set; }

    [StringLength(1000)]
    public string? Education { get; set; }

    [StringLength(500)]
    public string? LessonTypes { get; set; }

    [StringLength(1000)]
    public string? Specializations { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "חובה לבחור לפחות כלי אחד")]
    public List<CreateTeacherInstrumentDto> Instruments { get; set; } = new();
}

public class CreateServiceProviderCategoryDto
{
    [Required]
    public int CategoryId { get; set; }

    [StringLength(200)]
    public string? SubCategory { get; set; }
}

public class CreateGalleryImageDto
{
    [Required]
    [StringLength(500)]
    public string ImageUrl { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Caption { get; set; }

    [Required]
    public int Order { get; set; }
}

public class CreateTeacherInstrumentDto
{
    [Required]
    public int InstrumentId { get; set; }

    public bool IsPrimary { get; set; }
}

// ═══════════════════════════════════════════════════════════
//                    Update DTOs
// ═══════════════════════════════════════════════════════════

public class UpdateMusicServiceProviderDto
{
    [Required]
    [StringLength(200)]
    public string DisplayName { get; set; } = string.Empty;

    [StringLength(500)]
    public string? ProfileImageUrl { get; set; }

    [StringLength(500)]
    public string? ShortBio { get; set; }

    public string? FullDescription { get; set; }

    public int? CityId { get; set; }

    [StringLength(200)]
    public string? Location { get; set; }

    [Range(0, 100)]
    public int? YearsOfExperience { get; set; }

    [StringLength(500)]
    public string? WorkingHours { get; set; }

    [StringLength(20)]
    public string? WhatsAppNumber { get; set; }

    [StringLength(20)]
    public string? PhoneNumber { get; set; }

    [StringLength(200)]
    [EmailAddress]
    public string? Email { get; set; }

    [StringLength(500)]
    [Url]
    public string? WebsiteUrl { get; set; }

    [StringLength(500)]
    public string? VideoUrl { get; set; }

    public bool IsFeatured { get; set; }

    [Required]
    public int Status { get; set; }

    // Collections
    public List<CreateServiceProviderCategoryDto>? Categories { get; set; }
    public List<CreateGalleryImageDto>? GalleryImages { get; set; }
}

public class UpdateTeacherDto : UpdateMusicServiceProviderDto
{
    [StringLength(1000)]
    public string? PriceList { get; set; }

    public TeachingLanguage? Languages { get; set; }

    public TargetAudience? TargetAudience { get; set; }

    [StringLength(1000)]
    public string? Availability { get; set; }

    [StringLength(1000)]
    public string? Education { get; set; }

    [StringLength(500)]
    public string? LessonTypes { get; set; }

    [StringLength(1000)]
    public string? Specializations { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "חובה לבחור לפחות כלי אחד")]
    public List<CreateTeacherInstrumentDto> Instruments { get; set; } = new();
}

// ═══════════════════════════════════════════════════════════
//                    List/Filter DTOs
// ═══════════════════════════════════════════════════════════

public class MusicServiceProviderListDto
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? UserName { get; set; }
    public string? ProfileImageUrl { get; set; }
    public int? CityId { get; set; }
    public string? CityName { get; set; }
    public string? Location { get; set; }
    public int? YearsOfExperience { get; set; }
    public bool IsTeacher { get; set; }
    public bool IsFeatured { get; set; }
    public int Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int CategoriesCount { get; set; }
    public string? CategoryName { get; set; } // Primary category name for professionals
}

public class TeacherListDto : MusicServiceProviderListDto
{
    public int InstrumentsCount { get; set; }
    public string? PrimaryInstrument { get; set; }
    public List<int> InstrumentIds { get; set; } = new();
    public TeachingLanguage? Languages { get; set; }
    public TargetAudience? TargetAudience { get; set; }
}
