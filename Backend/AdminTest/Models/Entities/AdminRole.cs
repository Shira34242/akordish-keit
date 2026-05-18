namespace AkordishKeit.Models.Entities;

public class AdminRole
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsSystem { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }

    public ICollection<AdminRolePermission> Permissions { get; set; } = new List<AdminRolePermission>();
    public ICollection<User> Users { get; set; } = new List<User>();
}
