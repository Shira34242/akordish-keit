namespace AkordishKeit.Models.Entities;

public class ArticleGalleryImage
{
    public int Id { get; set; }
    public int ArticleId { get; set; }
    public string ImageUrl { get; set; }
    public string? Caption { get; set; }
    public int DisplayOrder { get; set; }

    // Navigation Properties
    public virtual Article Article { get; set; }
}
