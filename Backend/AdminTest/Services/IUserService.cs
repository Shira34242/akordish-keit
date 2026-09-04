using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IUserService
{
    Task<PagedResult<UserListDto>> GetUsersAsync(
        string? search,
        int? role,
        bool? isActive,
        int? contentTag,
        int? preferredInstrumentId,
        int pageNumber,
        int pageSize,
        string? sortBy = null,
        DateTime? createdAfter = null);

    /// <summary>
    /// מחפש משתמשים בעלי פרופיל ציבורי פעיל (אמן / מורה / בעל מקצוע)
    /// </summary>
    Task<List<UserWithProfileDto>> SearchUsersWithProfilesAsync(string? query, int limit = 20, string? profileKind = null, bool includeAgencies = false);

    /// <summary>
    /// מחזיר את פרופיל המעלה של משתמש לפי ה-UserId שלו (אמן / בעל מקצוע / מורה)
    /// </summary>
    Task<UserWithProfileDto?> GetUploaderProfileByUserIdAsync(int userId);

    Task<MyProfileDto?> GetMyProfileAsync(int userId);
    Task<AdminUserDetailDto?> GetAdminUserDetailAsync(int userId);
    Task<MyProfileDto?> UpdateMyProfileAsync(int userId, UpdateMyProfileDto dto);
    Task<UserListDto?> AdminUpdateUserAsync(int userId, AdminUpdateUserDto dto);
    Task<bool> AdminDeleteUserAsync(int userId);

    /// <summary>
    /// מחזיר את כל הדפים של המשתמש (אמן + כל בעלי המקצוע)
    /// </summary>
    Task<List<UserWithProfileDto>> GetMyAllPagesAsync(int userId);

    /// <summary>
    /// מנתק את המשתמש מהדף (UserId = null) — הדף עצמו נשאר ועובר לניהול המערכת
    /// </summary>
    Task<bool> RevokePageAsync(int userId, RevokePageDto dto);

    /// <summary>
    /// שולח למנהלים בקשה למחיקת דף, בלי למחוק את הדף בפועל
    /// </summary>
    Task<bool> RequestPageDeletionAsync(int userId, DeletePageRequestDto dto);

    /// <summary>
    /// שולח למנהלים בקשה למחיקת חשבון משתמש. החשבון לא נמחק אוטומטית.
    /// </summary>
    Task<bool> RequestAccountDeletionAsync(int userId);

    /// <summary>
    /// מציג או מסתיר דף ציבורי מהאינדקס בלי למחוק אותו
    /// </summary>
    Task<UserWithProfileDto?> SetPageVisibilityAsync(int userId, SetPageVisibilityDto dto);
}
