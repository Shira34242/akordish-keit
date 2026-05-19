using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class AdminRoleService : IAdminRoleService
{
    private static readonly List<AdminPermissionDto> Permissions = new()
    {
        new() { Key = "admin.access", Label = "כניסה לאזור הניהול", Group = "כללי" },
        new() { Key = "users.manage", Label = "ניהול משתמשים", Group = "משתמשים" },
        new() { Key = "content.manage", Label = "ניהול תוכן כללי", Group = "תוכן" },
        new() { Key = "content.songs", Label = "ניהול אקורדים", Group = "תוכן" },
        new() { Key = "content.articles", Label = "ניהול כתבות", Group = "תוכן" },
        new() { Key = "content.events", Label = "ניהול הופעות", Group = "תוכן" },
        new() { Key = "content.podcasts", Label = "ניהול פודקאסטים", Group = "תוכן" },
        new() { Key = "analytics.view", Label = "צפייה באנליטיקס", Group = "מערכת" },
        new() { Key = "advertising.manage", Label = "ניהול פרסום", Group = "פרסום" },
        new() { Key = "notifications.manage", Label = "ניהול התראות ודיוורים", Group = "התראות" },
        new() { Key = "reports.manage", Label = "ניהול דיווחים", Group = "התראות" },
        new() { Key = "system.manage", Label = "ניהול הגדרות מערכת", Group = "מערכת" },
        new() { Key = "roles.manage", Label = "ניהול תפקידים והרשאות", Group = "מערכת" }
    };

    public static List<string> AllPermissionKeys => Permissions.Select(p => p.Key).ToList();

    private readonly AkordishKeitDbContext _context;

    public AdminRoleService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public List<AdminPermissionDto> GetAvailablePermissions() => Permissions;

    public async Task<List<AdminRoleDto>> GetRolesAsync(bool includeInactive = true)
    {
        IQueryable<AdminRole> query = _context.AdminRoles
            .Include(r => r.Permissions)
            .Where(r => !r.IsDeleted);

        if (!includeInactive)
            query = query.Where(r => r.IsActive);

        var roles = await query.OrderBy(r => r.Name).ToListAsync();

        var roleIds = roles.Select(r => r.Id).ToList();
        var userCounts = await _context.Users
            .Where(u => u.AdminRoleId.HasValue && roleIds.Contains(u.AdminRoleId!.Value) && !u.IsDeleted)
            .GroupBy(u => u.AdminRoleId!.Value)
            .Select(g => new { RoleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Count);

        return roles.Select(r => MapToDto(r, userCounts.GetValueOrDefault(r.Id, 0))).ToList();
    }

    public async Task<AdminRoleDto?> GetRoleAsync(int id)
    {
        var role = await _context.AdminRoles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);

        if (role == null) return null;

        var usersCount = await _context.Users.CountAsync(u => u.AdminRoleId == id && !u.IsDeleted);
        return MapToDto(role, usersCount);
    }

    public async Task<AdminRoleDto> CreateRoleAsync(SaveAdminRoleDto dto)
    {
        var role = new AdminRole
        {
            Name = dto.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            IsActive = dto.IsActive,
            CreatedAt = DateTime.UtcNow,
            Permissions = NormalizePermissions(dto.Permissions)
                .Select(key => new AdminRolePermission { PermissionKey = key })
                .ToList()
        };

        _context.AdminRoles.Add(role);
        await _context.SaveChangesAsync();

        return (await GetRoleAsync(role.Id))!;
    }

    public async Task<AdminRoleDto?> UpdateRoleAsync(int id, SaveAdminRoleDto dto)
    {
        var role = await _context.AdminRoles
            .Include(r => r.Permissions)
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);

        if (role == null || role.IsSystem) return null;

        role.Name = dto.Name.Trim();
        role.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
        role.IsActive = dto.IsActive;
        role.UpdatedAt = DateTime.UtcNow;

        _context.AdminRolePermissions.RemoveRange(role.Permissions);
        role.Permissions = NormalizePermissions(dto.Permissions)
            .Select(key => new AdminRolePermission { AdminRoleId = role.Id, PermissionKey = key })
            .ToList();

        await _context.SaveChangesAsync();
        return await GetRoleAsync(role.Id);
    }

    public async Task<bool> DeleteRoleAsync(int id)
    {
        var role = await _context.AdminRoles
            .Include(r => r.Users)
            .FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);

        if (role == null || role.IsSystem) return false;

        foreach (var user in role.Users)
        {
            user.AdminRoleId = null;
            user.Role = Models.Enum.UserRole.Regular;
            user.UpdatedAt = DateTime.UtcNow;
        }

        role.IsDeleted = true;
        role.IsActive = false;
        role.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    private static List<string> NormalizePermissions(IEnumerable<string> permissions)
    {
        var allowed = Permissions.Select(p => p.Key).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return permissions
            .Where(permission => allowed.Contains(permission))
            .Select(permission => permission.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static AdminRoleDto MapToDto(AdminRole role, int usersCount = 0)
    {
        return new AdminRoleDto
        {
            Id = role.Id,
            Name = role.Name,
            Description = role.Description,
            IsActive = role.IsActive,
            IsSystem = role.IsSystem,
            UsersCount = usersCount,
            Permissions = role.Permissions.Select(p => p.PermissionKey).OrderBy(p => p).ToList()
        };
    }
}
