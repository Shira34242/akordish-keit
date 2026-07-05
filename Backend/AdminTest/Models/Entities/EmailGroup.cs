namespace AkordishKeit.Models.Entities;

public class EmailGroup
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public int CreatedByUserId { get; set; }

    public virtual User? CreatedByUser { get; set; }
    public virtual ICollection<EmailGroupMember> Members { get; set; } = new List<EmailGroupMember>();
}
