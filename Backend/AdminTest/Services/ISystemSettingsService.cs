using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface ISystemSettingsService
{
    Task<bool> GetBoolAsync(string key, bool defaultValue = false);

    Task<string?> GetValueAsync(string key);

    Task<SystemSettingDto?> UpdateAsync(string key, string value);

    Task<SystemSettingDto> UpsertAsync(string key, string value, string description = "");

    Task<List<SystemSettingDto>> GetAllAsync();
}
