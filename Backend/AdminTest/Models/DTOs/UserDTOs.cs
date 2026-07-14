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
    public int RankingScore { get; set; }
}

public class UpdateMyProfileDto
{
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public DateTime? BirthDate { get; set; }
    public string? ProfileImageUrl { get; set; }
}

public class AdminUpdateUserDto
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public int Role { get; set; }
    public bool IsActive { get; set; }
}

/// <summary>
/// תוצאת חיפוש משתמשים עם פרופיל ציבורי (לתיוג מעלה תוכן)
/// </summary>
public class UserWithProfileDto
{
    public int? UserId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    /// <summary>"artist" | "serviceProvider" | "user"</summary>
    public string ProfileType { get; set; } = string.Empty;
    public int ProfileId { get; set; }
    public string ProfileUrl { get; set; } = string.Empty;
    /// <summary>רלוונטי רק ל-serviceProvider — האם זה מורה</summary>
    public bool IsTeacher { get; set; }
    /// <summary>Active | Pending | Suspended | Hidden</summary>
    public string Status { get; set; } = "None";
    /// <summary>שמות קטגוריות (רק ל-serviceProvider)</summary>
    public List<string> Categories { get; set; } = new();
}

/// <summary>
/// בקשת עזיבת דף — המשתמש מנתק את עצמו מהדף (לא מוחק)
/// </summary>
public class RevokePageDto
{
    /// <summary>"artist" | "serviceProvider"</summary>
    public string ProfileType { get; set; } = string.Empty;
    public int ProfileId { get; set; }
}

public class DeletePageRequestDto
{
    /// <summary>"artist" | "serviceProvider"</summary>
    public string ProfileType { get; set; } = string.Empty;
    public int ProfileId { get; set; }
}

/// <summary>
/// בקשת הצגה / הסתרה של דף ציבורי מהאינדקס בלי מחיקה
/// </summary>
public class SetPageVisibilityDto
{
    /// <summary>"artist" | "serviceProvider"</summary>
    public string ProfileType { get; set; } = string.Empty;
    public int ProfileId { get; set; }
    public bool IsActive { get; set; }
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
    public int? PreferredInstrumentId { get; set; }
    public string? PreferredInstrumentName { get; set; }
    public int ContentTag { get; set; }
    public int UploadCount { get; set; }
    public int RankingScore { get; set; }
    public int ReferralJoinedCount { get; set; }
    public int GoogleReferralJoinedCount { get; set; }
}

public class AdminUserDetailDto : UserListDto
{
    public string? GoogleId { get; set; }
    public string? Address { get; set; }
    public DateTime? BirthDate { get; set; }
    public int? CityId { get; set; }
    public string? OtherInstrumentName { get; set; }
    public int? InstrumentLevel { get; set; }
    public string? InstrumentLevelName { get; set; }
    public bool MarketingConsent { get; set; }
    public DateTime? MarketingConsentAt { get; set; }
    public DateTime? MarketingConsentRevokedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int VisitCount { get; set; }
    public DateTime? LastProfileReminderAt { get; set; }
    public int ProfileReminderDismissCount { get; set; }
    public DateTime? LastUploadDate { get; set; }
    public int ChordBookExportCount { get; set; }
    public List<AdminUserInstrumentDto> Instruments { get; set; } = new();
    public List<AdminUserPageDto> Pages { get; set; } = new();
    public List<AdminUserAgencyDto> Agencies { get; set; } = new();
    public List<AdminUserReferralDto> Referrals { get; set; } = new();
    public AdminUserContentSummaryDto ContentSummary { get; set; } = new();
}

public class AdminUserReferralDto
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Source { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class AdminUserInstrumentDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? EnglishName { get; set; }
    public bool IsPrimary { get; set; }
}

public class AdminUserPageDto
{
    public string ProfileType { get; set; } = string.Empty;
    public int ProfileId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string ProfileUrl { get; set; } = string.Empty;
    public bool IsTeacher { get; set; }
    public string Status { get; set; } = string.Empty;
    public bool IsPrimary { get; set; }
    public List<string> Categories { get; set; } = new();
}

public class AdminUserAgencyDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public string ProfileType { get; set; } = string.Empty;
    public int ProfileId { get; set; }
    public string ContactMode { get; set; } = string.Empty;
    public bool ShowBadge { get; set; }
    public bool IsFeaturedByAgency { get; set; }
}

public class AdminUserContentSummaryDto
{
    public int Songs { get; set; }
    public int Articles { get; set; }
    public int Events { get; set; }
    public int Playlists { get; set; }
    public int Favorites { get; set; }
    public int Ratings { get; set; }
    public int KnownChords { get; set; }
    public int Notifications { get; set; }
}
