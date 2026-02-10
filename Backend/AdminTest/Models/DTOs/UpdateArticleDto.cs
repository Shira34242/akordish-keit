using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs;

public class UpdateArticleDto
{
    [Required]
    [StringLength(250)]
    public string Title { get; set; }

    [StringLength(500)]
    public string? Subtitle { get; set; }

    [Required]
    public string Content { get; set; }

    [StringLength(500)]
    public string? FeaturedImageUrl { get; set; }

    [StringLength(100)]
    public string? AuthorName { get; set; }

    [Required]
    [MinLength(1)]
    public List<int> CategoryIds { get; set; }

    [Required]
    public int ContentType { get; set; }

    [Required]
    [StringLength(300)]
    public string Slug { get; set; }

    [StringLength(500)]
    public string? CanonicalUrl { get; set; }

    [StringLength(500)]
    public string? VideoEmbedUrl { get; set; }

    [StringLength(500)]
    public string? AudioEmbedUrl { get; set; }

    [StringLength(200)]
    public string? ImageCredit { get; set; }

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
    /// אם מסופק, מחליף את הרשימה הקיימת
    /// </summary>
    public List<int>? ArtistIds { get; set; }
}
