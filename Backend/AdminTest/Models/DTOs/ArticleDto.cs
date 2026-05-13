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
    public List<int> TagIds { get; set; } = new();
    public List<string> Tags { get; set; } = new();
    public List<ArticleGalleryImageDto> GalleryImages { get; set; } = new();

    /// <summary>
    /// אומנים מתוייגים בכתבה
    /// </summary>
    public List<ArticleArtistDto> TaggedArtists { get; set; } = new();

    /// <summary>
    /// פרופיל ציבורי שהעלה את התוכן (אמן / מורה / בעל מקצוע)
    /// </summary>
    public ContentUploaderProfileDto? UploaderProfile { get; set; }

    /// <summary>שדות גולמיים — לשימוש בטופס עריכה</summary>
    public int? UploaderUserId { get; set; }
    public string? UploaderProfileType { get; set; }
    public int? UploaderProfileId { get; set; }
}

/// <summary>
/// פרופיל ציבורי שהעלה תוכן (אמן / מורה / בעל מקצוע)
/// </summary>
public class ContentUploaderProfileDto
{
    /// <summary>"artist" | "serviceProvider"</summary>
    public string Type { get; set; } = string.Empty;
    public int ProfileId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    /// <summary>נתיב לדף הפרופיל, לדוגמה: /artist/5 או /teacher/12</summary>
    public string ProfileUrl { get; set; } = string.Empty;
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

/// <summary>תגובת פידבק לכתבה (yes/no)</summary>
public class ArticleFeedbackResultDto
{
    public int YesCount { get; set; }
    public int NoCount { get; set; }
    public int TotalCount { get; set; }
    public int YesPct { get; set; }
    public int NoPct { get; set; }
    /// <summary>האם המשתמש הנוכחי כבר הצביע</summary>
    public bool HasVoted { get; set; }
    /// <summary>true=כן, false=לא, null=לא הצביע</summary>
    public bool? UserChoice { get; set; }
}

/// <summary>שליחת פידבק</summary>
public class SubmitFeedbackDto
{
    public bool IsPositive { get; set; }
}

public class UpdateArticleStatusDto
{
    public int Status { get; set; }
}

public class UpdateArticleCategoriesDto
{
    public List<int> CategoryIds { get; set; } = new();
    public string Mode { get; set; } = "replace";
}

public class BulkArticleIdsDto
{
    public List<int> ArticleIds { get; set; } = new();
}

public class BulkUpdateArticleCategoriesDto : UpdateArticleCategoriesDto
{
    public List<int> ArticleIds { get; set; } = new();
}

public class BulkUpdateArticleStatusDto : BulkArticleIdsDto
{
    public int Status { get; set; }
}

public class BulkArticleActionResultDto
{
    public int RequestedCount { get; set; }
    public int AffectedCount { get; set; }
    public List<ArticleDto> Articles { get; set; } = new();
}

/// <summary>כתבה בדירוג תוכן (לאדמין)</summary>
public class ArticleRankDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Slug { get; set; }
    public string? FeaturedImageUrl { get; set; }
    public int ContentType { get; set; }
    public int ViewCount { get; set; }
    public int LikeCount { get; set; }
    public int FeedbackYes { get; set; }
    public int FeedbackNo { get; set; }
    public int FeedbackTotal { get; set; }
    public int YesPct { get; set; }
}
