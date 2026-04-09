using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;

namespace AkordishKeit.Services;

public class SystemSettingsService : ISystemSettingsService
{
    private readonly AkordishKeitDbContext _context;
    private readonly IMemoryCache _cache;

    private const string CacheKeyPrefix = "sys_";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

    public SystemSettingsService(AkordishKeitDbContext context, IMemoryCache cache)
    {
        _context = context;
        _cache = cache;
    }

    public async Task<bool> GetBoolAsync(string key, bool defaultValue = false)
    {
        var value = await GetRawValueAsync(key);
        if (value == null) return defaultValue;
        return value.Equals("true", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<SystemSettingDto?> UpdateAsync(string key, string value)
    {
        var setting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);
        if (setting == null) return null;

        setting.Value = value;
        setting.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        // פינוי קאש
        _cache.Remove(CacheKeyPrefix + key);

        return MapToDto(setting);
    }

    public async Task<List<SystemSettingDto>> GetAllAsync()
    {
        var settings = await _context.SystemSettings
            .OrderBy(s => s.Key)
            .ToListAsync();

        return settings.Select(MapToDto).ToList();
    }

    // ════════════════════════════════════
    //   פנימי
    // ════════════════════════════════════

    private async Task<string?> GetRawValueAsync(string key)
    {
        var cacheKey = CacheKeyPrefix + key;

        if (_cache.TryGetValue(cacheKey, out string? cached))
            return cached;

        var setting = await _context.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);
        var value = setting?.Value;

        _cache.Set(cacheKey, value, CacheDuration);
        return value;
    }

    private static SystemSettingDto MapToDto(Models.Entities.SystemSetting s) => new()
    {
        Id          = s.Id,
        Key         = s.Key,
        Value       = s.Value,
        Description = s.Description,
        UpdatedAt   = s.UpdatedAt
    };
}
