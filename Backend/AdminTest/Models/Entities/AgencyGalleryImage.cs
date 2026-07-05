namespace AkordishKeit.Models.Entities;

public class AgencyGalleryImage
{
    public int Id { get; set; }
    public int AgencyId { get; set; }
    public string MediaType { get; set; } = "image";
    public string? ImageUrl { get; set; }
    public string? VideoUrl { get; set; }
    public string? Title { get; set; }
    public string? Caption { get; set; }
    public int DisplayOrder { get; set; }
    public DateTime CreatedAt { get; set; }

    public virtual Agency Agency { get; set; } = null!;
}
