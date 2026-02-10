using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IUserService
{
    Task<PagedResult<UserListDto>> GetUsersAsync(
        string? search,
        int? role,
        bool? isActive,
        int pageNumber,
        int pageSize);

}
