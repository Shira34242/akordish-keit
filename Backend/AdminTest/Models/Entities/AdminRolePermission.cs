namespace AkordishKeit.Models.Entities;

public class AdminRolePermission
{
    public int Id { get; set; }
    public int AdminRoleId { get; set; }
    public string PermissionKey { get; set; } = string.Empty;

    public AdminRole AdminRole { get; set; } = null!;
}
