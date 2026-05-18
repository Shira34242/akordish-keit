namespace AkordishKeit.Models.DTOs;

public class AdminPermissionDto
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
}

public class AdminRoleDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
    public bool IsSystem { get; set; }
    public int UsersCount { get; set; }
    public List<string> Permissions { get; set; } = new();
}

public class SaveAdminRoleDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public List<string> Permissions { get; set; } = new();
}
