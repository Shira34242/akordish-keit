namespace AkordishKeit.Models.DTOs;

public class ArticleBannerDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? FeaturedImageUrl { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string? ShortDescription { get; set; }
    public int ContentType { get; set; }
    public bool IsFeatured { get; set; }
    public int DisplayOrder { get; set; }
    public DateTime PublishDate { get; set; }
}

public class HomeNewsBannersDto
{
    public List<ArticleBannerDto> Featured { get; set; } = new();
    public List<ArticleBannerDto> Regular { get; set; } = new();
}
