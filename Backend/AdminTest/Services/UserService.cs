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
                ProfileUrl = p.IsTeacher ? $"/teacher/{p.Id}" : $"/provider/{p.Id}",
                IsTeacher = p.IsTeacher,
                Status = p.Status.ToString()
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
        // בדוק קודם אם יש פרופיל אמן (כולל ממתין — לא רק פעיל)
        var artistEntity = await _context.Artists
            .Where(a => !a.IsDeleted && a.UserId == userId)
            .OrderByDescending(a => a.Status == ArtistStatus.Active)
            .FirstOrDefaultAsync();

        if (artistEntity != null)
        {
            return new UserWithProfileDto
            {
                UserId = userId,
                DisplayName = artistEntity.Name,
                ImageUrl = artistEntity.ImageUrl,
                ProfileType = "artist",
                ProfileId = artistEntity.Id,
                ProfileUrl = $"/artist/{artistEntity.Id}",
                IsTeacher = false,
                Status = artistEntity.Status.ToString(),
                Categories = new List<string>()
            };
        }

        // אחרת בדוק אם יש פרופיל בעל מקצוע / מורה (כולל ממתין)
        var providerEntity = await _context.ServiceProviders
            .Include(p => p.Categories)
            .ThenInclude(c => c.Category)
            .Where(p => !p.IsDeleted && p.UserId == userId)
            .OrderByDescending(p => p.IsPrimaryProfile)
            .ThenByDescending(p => p.Status == ProfileStatus.Active)
            .FirstOrDefaultAsync();

        if (providerEntity == null) return null;

        return new UserWithProfileDto
        {
            UserId = userId,
            DisplayName = providerEntity.DisplayName,
            ImageUrl = providerEntity.ProfileImageUrl,
            ProfileType = "serviceProvider",
            ProfileId = providerEntity.Id,
            ProfileUrl = providerEntity.IsTeacher ? $"/teacher/{providerEntity.Id}" : $"/provider/{providerEntity.Id}",
            IsTeacher = providerEntity.IsTeacher,
            Status = providerEntity.Status.ToString(),
            Categories = providerEntity.Categories
                .Select(c => c.Category.Name)
                .ToList()
        };
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
            ProfileImageUrl = user.ProfileImageUrl,
            ContentTag = (int)user.ContentTag,
            UploadCount = user.UploadCount
        };
    }

    public async Task<MyProfileDto?> UpdateMyProfileAsync(int userId, UpdateMyProfileDto dto)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return null;

        user.Phone = dto.Phone;
        user.Address = dto.Address;
        user.BirthDate = dto.BirthDate;
        if (dto.ProfileImageUrl != null)
            user.ProfileImageUrl = dto.ProfileImageUrl;
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
            ProfileImageUrl = user.ProfileImageUrl,
            ContentTag = (int)user.ContentTag,
            UploadCount = user.UploadCount
        };
    }

    public async Task<List<UserWithProfileDto>> GetMyAllPagesAsync(int userId)
    {
        var results = new List<UserWithProfileDto>();

        // --- אמן ---
        var artist = await _context.Artists
            .Where(a => !a.IsDeleted && a.UserId == userId)
            .FirstOrDefaultAsync();

        if (artist != null)
        {
            results.Add(new UserWithProfileDto
            {
                UserId = userId,
                DisplayName = artist.Name,
                ImageUrl = artist.ImageUrl,
                ProfileType = "artist",
                ProfileId = artist.Id,
                ProfileUrl = $"/artist/{artist.Id}",
                IsTeacher = false,
                Status = artist.Status.ToString(),
                Categories = new List<string>()
            });
        }

        // --- כל ה-ServiceProviders ---
        var providers = await _context.ServiceProviders
            .Include(p => p.Categories)
            .ThenInclude(c => c.Category)
            .Where(p => !p.IsDeleted && p.UserId == userId)
            .OrderByDescending(p => p.IsPrimaryProfile)
            .ToListAsync();

        foreach (var p in providers)
        {
            results.Add(new UserWithProfileDto
            {
                UserId = userId,
                DisplayName = p.DisplayName,
                ImageUrl = p.ProfileImageUrl,
                ProfileType = "serviceProvider",
                ProfileId = p.Id,
                ProfileUrl = p.IsTeacher ? $"/teacher/{p.Id}" : $"/provider/{p.Id}",
                IsTeacher = p.IsTeacher,
                Status = p.Status.ToString(),
                Categories = p.Categories.Select(c => c.Category.Name).ToList()
            });
        }

        return results;
    }

    public async Task<bool> RevokePageAsync(int userId, RevokePageDto dto)
    {
        if (dto.ProfileType == "artist")
        {
            var artist = await _context.Artists
                .FirstOrDefaultAsync(a => a.Id == dto.ProfileId && a.UserId == userId && !a.IsDeleted);
            if (artist == null) return false;
            artist.UserId = null;
        }
        else if (dto.ProfileType == "serviceProvider")
        {
            var provider = await _context.ServiceProviders
                .FirstOrDefaultAsync(p => p.Id == dto.ProfileId && p.UserId == userId && !p.IsDeleted);
            if (provider == null) return false;
            provider.UserId = null;
        }
        else
        {
            return false;
        }

        await _context.SaveChangesAsync();
        return true;
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
