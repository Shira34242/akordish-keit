namespace AkordishKeit.Models.Entities;

public class Article
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string Content { get; set; } = string.Empty;
    public string? FeaturedImageUrl { get; set; }
    public string? HeroBackgroundImageUrl { get; set; }
    public DateTime PublishDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? BumpedAt { get; set; }
    public int BumpCount { get; set; }
    public string? AuthorName { get; set; }
    public int ContentType { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string? CanonicalUrl { get; set; }
    public string? VideoEmbedUrl { get; set; }
    public string? AudioEmbedUrl { get; set; }
    public string? ImageCredit { get; set; }
    public string? ShortDescription { get; set; }
    public bool IsFeatured { get; set; }
    public int DisplayOrder { get; set; }
    public int Status { get; set; }
    public DateTime? ScheduledDate { get; set; }
    public bool IsPremium { get; set; }
    public string? MetaTitle { get; set; }
    public string? MetaDescription { get; set; }
    public string? OpenGraphImageUrl { get; set; }
    public int ViewCount { get; set; }
    public int LikeCount { get; set; }
    public int? ReadTimeMinutes { get; set; }
    public string? CreatedBy { get; set; }
    public string? UpdatedBy { get; set; }
    public bool IsDeleted { get; set; }

    // תיוג מעלה תוכן — UserId של פרופיל ציבורי + סוג הפרופיל
    public int? UploaderUserId { get; set; }
    public string? UploaderProfileType { get; set; } // "artist" | "serviceProvider"
    public int? UploaderProfileId { get; set; }

    /// <summary>
    /// המשתמש הרגיל שהגיש את הכתבה דרך טופס ההגשה.
    /// נפרד מ-UploaderUserId שמיועד לפרופיל מקצועי ציבורי.
    /// </summary>
    public int? SubmittedByUserId { get; set; }

    // Navigation Properties
    public virtual ICollection<ArticleTag> ArticleTags { get; set; } = new List<ArticleTag>();
    public virtual ICollection<ArticleGalleryImage> GalleryImages { get; set; } = new List<ArticleGalleryImage>();
    public virtual ICollection<ArticleArticleCategory> ArticleCategories { get; set; } = new List<ArticleArticleCategory>();
    public virtual ICollection<ArticleArtist> ArticleArtists { get; set; } = new List<ArticleArtist>();
    public virtual User? UploaderUser { get; set; }
    public virtual User? SubmittedByUser { get; set; }
}
