using AkordishKeit.Data;
using AkordishKeit.Extensions;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class UserService : IUserService
{
    private readonly AkordishKeitDbContext _context;

    public UserService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<UserListDto>> GetUsersAsync(
        string? search,
        int? role,
        bool? isActive,
        int pageNumber,
        int pageSize)
    {
        var query = _context.Users
            .Where(u => !u.IsDeleted)
            .AsQueryable();

        // Apply filters
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(u =>
                u.Username.Contains(search) ||
                u.Email.Contains(search) ||
                (u.Phone != null && u.Phone.Contains(search)));
        }

        if (role.HasValue)
        {
            query = query.Where(u => u.Role == (UserRole)role.Value);
        }

        if (isActive.HasValue)
        {
            query = query.Where(u => u.IsActive == isActive.Value);
        }

        // Order by CreatedAt
        query = query.OrderByDescending(u => u.CreatedAt);

        // Get paginated entities
        var pagedEntities = await query.ToPagedResultAsync(pageNumber, pageSize);

        // Map to DTOs
        var dtos = pagedEntities.Items.Select(MapToListDto).ToList();

        return new PagedResult<UserListDto>
        {
            Items = dtos,
            TotalCount = pagedEntities.TotalCount,
            PageNumber = pagedEntities.PageNumber,
            PageSize = pagedEntities.PageSize
        };
    }


    // ═══════════════════════════════════════════════════════════
    //                    Mapping Methods
    // ═══════════════════════════════════════════════════════════

    private static UserListDto MapToListDto(User entity)
    {
        return new UserListDto
        {
            Id = entity.Id,
            Username = entity.Username,
            Email = entity.Email,
            ProfileImageUrl = entity.ProfileImageUrl,
            Phone = entity.Phone,
            Role = (int)entity.Role,
            RoleName = entity.Role.ToString(),
            Level = entity.Level,
            Points = entity.Points,
            IsActive = entity.IsActive,
            EmailConfirmed = entity.EmailConfirmed,
            CreatedAt = entity.CreatedAt,
            LastLoginAt = entity.LastLoginAt
        };
    }
}
