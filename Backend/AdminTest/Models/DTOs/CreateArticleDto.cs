using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs;

public class CreateArticleDto
{
    [Required]
    [StringLength(250)]
    public string Title { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Subtitle { get; set; }

    [Required]
    public string Content { get; set; } = string.Empty;

    [StringLength(500)]
    public string? FeaturedImageUrl { get; set; }

    [StringLength(100)]
    public string? AuthorName { get; set; }

    [Required]
    public List<int> CategoryIds { get; set; } = new();

    [Required]
    public int ContentType { get; set; }

    [Required]
    [StringLength(300)]
    public string Slug { get; set; } = string.Empty;

    [StringLength(500)]
    public string? CanonicalUrl { get; set; }

    [StringLength(500)]
    public string? VideoEmbedUrl { get; set; }

    [StringLength(500)]
    public string? AudioEmbedUrl { get; set; }

    [StringLength(2000)]
    public string? ImageCredit { get; set; }

    [StringLength(500)]
    public string? FeaturedImageCredit { get; set; }

    [StringLength(1000)]
    public string? ShortDescription { get; set; }

    public bool IsFeatured { get; set; }

    public int DisplayOrder { get; set; }

    [Required]
    public int Status { get; set; }

    public DateTime? ScheduledDate { get; set; }

    public bool IsPremium { get; set; }

    [StringLength(250)]
    public string? MetaTitle { get; set; }

    [StringLength(500)]
    public string? MetaDescription { get; set; }

    [StringLength(500)]
    public string? OpenGraphImageUrl { get; set; }

    public int? ReadTimeMinutes { get; set; }

    public List<int>? TagIds { get; set; }

    public List<CreateArticleGalleryImageDto>? GalleryImages { get; set; }

    /// <summary>
    /// רשימת IDs של אומנים לתיוג (מהמערכת)
    /// </summary>
    public List<int>? ArtistIds { get; set; }

    /// <summary>UserId של מי שהעלה את התוכן (פרופיל ציבורי)</summary>
    public int? UploaderUserId { get; set; }

    /// <summary>סוג הפרופיל: "artist" | "serviceProvider"</summary>
    [StringLength(30)]
    public string? UploaderProfileType { get; set; }

    public int? UploaderProfileId { get; set; }
}

public class CreateArticleGalleryImageDto
{
    [Required]
    [StringLength(500)]
    public string ImageUrl { get; set; } = string.Empty;

    [StringLength(500)]
    public string? Caption { get; set; }

    [Required]
    public int DisplayOrder { get; set; }
}
