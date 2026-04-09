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
        int? contentTag,
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

        if (contentTag.HasValue)
        {
            query = query.Where(u => (int)u.ContentTag == contentTag.Value);
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


    public async Task<List<UserWithProfileDto>> SearchUsersWithProfilesAsync(string? query, int limit = 20)
    {
        var results = new List<UserWithProfileDto>();
        var q = query?.Trim().ToLower() ?? "";

        // --- אמנים פעילים עם UserId ---
        var artists = await _context.Artists
            .Where(a => !a.IsDeleted
                && a.UserId != null
                && a.Status == ArtistStatus.Active
                && (string.IsNullOrEmpty(q) || a.Name.ToLower().Contains(q)))
            .OrderBy(a => a.Name)
            .Take(limit)
            .Select(a => new UserWithProfileDto
            {
                UserId = a.UserId!.Value,
                DisplayName = a.Name,
                ImageUrl = a.ImageUrl,
                ProfileType = "artist",
                ProfileId = a.Id,
                ProfileUrl = $"/artist/{a.Id}"
            })
            .ToListAsync();

        results.AddRange(artists);

        // --- בעלי מקצוע / מורים פעילים עם UserId ---
        var providers = await _context.ServiceProviders
            .Where(p => !p.IsDeleted
                && p.UserId != null
                && p.Status == ProfileStatus.Active
                && (string.IsNullOrEmpty(q) || p.DisplayName.ToLower().Contains(q)))
            .OrderBy(p => p.DisplayName)
            .Take(limit)
            .Select(p => new UserWithProfileDto
            {
                UserId = p.UserId!.Value,
                DisplayName = p.DisplayName,
                ImageUrl = p.ProfileImageUrl,
                ProfileType = "serviceProvider",
                ProfileId = p.Id,
                ProfileUrl = p.IsTeacher ? $"/teacher/{p.Id}" : $"/provider/{p.Id}"
            })
            .ToListAsync();

        results.AddRange(providers);

        return results
            .OrderBy(r => r.DisplayName)
            .Take(limit)
            .ToList();
    }

    public async Task<UserWithProfileDto?> GetUploaderProfileByUserIdAsync(int userId)
    {
        // בדוק קודם אם יש פרופיל אמן פעיל
        var artist = await _context.Artists
            .Where(a => !a.IsDeleted && a.UserId == userId && a.Status == ArtistStatus.Active)
            .Select(a => new UserWithProfileDto
            {
                UserId = userId,
                DisplayName = a.Name,
                ImageUrl = a.ImageUrl,
                ProfileType = "artist",
                ProfileId = a.Id,
                ProfileUrl = $"/artist/{a.Id}"
            })
            .FirstOrDefaultAsync();

        if (artist != null) return artist;

        // אחרת בדוק אם יש פרופיל בעל מקצוע / מורה פעיל
        var provider = await _context.ServiceProviders
            .Where(p => !p.IsDeleted && p.UserId == userId && p.Status == ProfileStatus.Active)
            .OrderByDescending(p => p.IsPrimaryProfile)
            .Select(p => new UserWithProfileDto
            {
                UserId = userId,
                DisplayName = p.DisplayName,
                ImageUrl = p.ProfileImageUrl,
                ProfileType = "serviceProvider",
                ProfileId = p.Id,
                ProfileUrl = p.IsTeacher ? $"/teacher/{p.Id}" : $"/provider/{p.Id}"
            })
            .FirstOrDefaultAsync();

        return provider;
    }

    public async Task<MyProfileDto?> GetMyProfileAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return null;
        return new MyProfileDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Phone = user.Phone,
            Address = user.Address,
            BirthDate = user.BirthDate,
            ProfileImageUrl = user.ProfileImageUrl
        };
    }

    public async Task<MyProfileDto?> UpdateMyProfileAsync(int userId, UpdateMyProfileDto dto)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return null;

        user.Phone = dto.Phone;
        user.Address = dto.Address;
        user.BirthDate = dto.BirthDate;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return new MyProfileDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Phone = user.Phone,
            Address = user.Address,
            BirthDate = user.BirthDate,
            ProfileImageUrl = user.ProfileImageUrl
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
            LastLoginAt = entity.LastLoginAt,
            ContentTag = (int)entity.ContentTag,
            UploadCount = entity.UploadCount
        };
    }
}
