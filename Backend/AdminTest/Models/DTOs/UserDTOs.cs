namespace AkordishKeit.Models.DTOs;

public class MyProfileDto
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public DateTime? BirthDate { get; set; }
    public string? ProfileImageUrl { get; set; }
    public int ContentTag { get; set; }
    public int UploadCount { get; set; }
}

public class UpdateMyProfileDto
{
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public DateTime? BirthDate { get; set; }
}

/// <summary>
/// תוצאת חיפוש משתמשים עם פרופיל ציבורי (לתיוג מעלה תוכן)
/// </summary>
public class UserWithProfileDto
{
    public int UserId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    /// <summary>"artist" | "serviceProvider"</summary>
    public string ProfileType { get; set; } = string.Empty;
    public int ProfileId { get; set; }
    public string ProfileUrl { get; set; } = string.Empty;
}

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
    public int ContentTag { get; set; }
    public int UploadCount { get; set; }
}
