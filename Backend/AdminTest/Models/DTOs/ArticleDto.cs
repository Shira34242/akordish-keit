namespace AkordishKeit.Models.DTOs;

public class ArticleDto
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
    public List<int> CategoryIds { get; set; } = new();
    public List<string> CategoryNames { get; set; } = new();
    public int ContentType { get; set; }
    public string ContentTypeName { get; set; }
    public string Slug { get; set; }
    public string? CanonicalUrl { get; set; }
    public string? VideoEmbedUrl { get; set; }
    public string? AudioEmbedUrl { get; set; }
    public string? ImageCredit { get; set; }
    public string? ShortDescription { get; set; }
    public bool IsFeatured { get; set; }
    public int DisplayOrder { get; set; }
    public int Status { get; set; }
    public string StatusName { get; set; }
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
    public List<string> Tags { get; set; } = new();
    public List<ArticleGalleryImageDto> GalleryImages { get; set; } = new();

    /// <summary>
    /// אומנים מתוייגים בכתבה
    /// </summary>
    public List<ArticleArtistDto> TaggedArtists { get; set; } = new();
}

/// <summary>
/// אומן מתוייג בכתבה
/// </summary>
public class ArticleArtistDto
{
    public int ArtistId { get; set; }
    public string ArtistName { get; set; } = string.Empty;
    public string? ArtistImageUrl { get; set; }
}

public class ArticleGalleryImageDto
{
    public int Id { get; set; }
    public string ImageUrl { get; set; }
    public string? Caption { get; set; }
    public int DisplayOrder { get; set; }
}

public class ArticleStatsDto
{
    public int TotalArticles { get; set; }
    public int PublishedArticles { get; set; }
    public int DraftArticles { get; set; }
    public int ScheduledArticles { get; set; }
    public int TotalViews { get; set; }
    public int TotalLikes { get; set; }
    public int FeaturedArticles { get; set; }
    public int NewsCount { get; set; }
    public int BlogCount { get; set; }
}
