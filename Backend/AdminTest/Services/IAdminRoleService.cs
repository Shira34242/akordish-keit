using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IAdminRoleService
{
    List<AdminPermissionDto> GetAvailablePermissions();
    Task<List<AdminRoleDto>> GetRolesAsync(bool includeInactive = true);
    Task<AdminRoleDto?> GetRoleAsync(int id);
    Task<AdminRoleDto> CreateRoleAsync(SaveAdminRoleDto dto);
    Task<AdminRoleDto?> UpdateRoleAsync(int id, SaveAdminRoleDto dto);
    Task<bool> DeleteRoleAsync(int id);
}
