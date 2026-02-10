namespace AkordishKeit.Models.DTOs;

public class UserListDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? ProfileImageUrl { get; set; }
    public string? Phone { get; set; }
    public int Role { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public int Level { get; set; }
    public int Points { get; set; }
    public bool IsActive { get; set; }
    public bool EmailConfirmed { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}
