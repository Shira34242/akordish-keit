using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IUserService
{
    Task<PagedResult<UserListDto>> GetUsersAsync(
        string? search,
        int? role,
        bool? isActive,
        int? contentTag,
        int pageNumber,
        int pageSize);

    /// <summary>
    /// מחפש משתמשים בעלי פרופיל ציבורי פעיל (אמן / מורה / בעל מקצוע)
    /// </summary>
    Task<List<UserWithProfileDto>> SearchUsersWithProfilesAsync(string? query, int limit = 20);

    /// <summary>
    /// מחזיר את פרופיל המעלה של משתמש לפי ה-UserId שלו (אמן / בעל מקצוע / מורה)
    /// </summary>
    Task<UserWithProfileDto?> GetUploaderProfileByUserIdAsync(int userId);

    Task<MyProfileDto?> GetMyProfileAsync(int userId);
    Task<MyProfileDto?> UpdateMyProfileAsync(int userId, UpdateMyProfileDto dto);
}
