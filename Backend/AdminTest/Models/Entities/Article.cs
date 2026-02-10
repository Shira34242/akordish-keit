namespace AkordishKeit.Models.Entities;

public class Article
{
    public int Id { get; set; }
    public string Title { get; set; }
    public string? Subtitle { get; set; }
    public string Content { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public DateTime PublishDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? AuthorName { get; set; }
    public int ContentType { get; set; }
    public string Slug { get; set; }
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

    // Navigation Properties
    public virtual ICollection<ArticleTag> ArticleTags { get; set; }
    public virtual ICollection<ArticleGalleryImage> GalleryImages { get; set; }
    public virtual ICollection<ArticleArticleCategory> ArticleCategories { get; set; }
    public virtual ICollection<ArticleArtist> ArticleArtists { get; set; }
}
