namespace AkordishKeit.Models.Entities;

public class NotificationGroup
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public bool SendToAll { get; set; }
    public int? Role { get; set; }
    public bool? IsActive { get; set; }
    public int? ContentTag { get; set; }
    public int? PreferredInstrumentId { get; set; }
    public DateTime? JoinedFrom { get; set; }
    public DateTime? JoinedTo { get; set; }
    public string? AddressContains { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }
    public int CreatedByUserId { get; set; }

    public virtual User? CreatedByUser { get; set; }
}
