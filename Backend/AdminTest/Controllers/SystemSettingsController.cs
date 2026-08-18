using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class SystemSettingsController : ControllerBase
{
    private const string TickerConfigKey = "hero_news_ticker_config";
    private static readonly string[] PublicBannerImageKeys =
    {
        "banner_home_hero_image",
        "banner_home_chords_image",
        "banner_home_index_image",
        "banner_home_podcasts_image",
        "banner_chords_hero_image",
        "banner_podcasts_hero_image",
        "banner_music_index_hero_image"
    };
    private static readonly string[] PublicBannerSettingKeys = PublicBannerImageKeys
        .SelectMany(key => new[] { key, $"{key}_display_mode", $"{key}_desktop_zoom", $"{key}_mobile_zoom", $"{key}_position" })
        .ToArray();
    private static readonly HashSet<string> RetiredAccessGateKeys = new(StringComparer.Ordinal)
    {
        "site_access_gate_enabled",
        "site_access_gate_password_hash",
        "site_access_gate_password_version"
    };
    private const string TickerConfigDescription = "הגדרות פס חדשות הירו בדף הבית";

    private readonly ISystemSettingsService _settingsService;

    public SystemSettingsController(ISystemSettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    [HttpGet("public/{key}")]
    [AllowAnonymous]
    public async Task<ActionResult<object>> GetPublic(string key)
    {
        if (key != TickerConfigKey)
            return NotFound();

        var value = await _settingsService.GetValueAsync(key);
        return Ok(new { key, value });
    }

    [HttpGet("public/banner-images")]
    [AllowAnonymous]
    public async Task<ActionResult<Dictionary<string, string>>> GetPublicBannerImages()
    {
        // Banner changes should be visible immediately to every visitor and every server instance.
        // GetAllAsync reads the shared database directly instead of this instance's five-minute memory cache.
        var values = (await _settingsService.GetAllAsync())
            .Where(setting => PublicBannerSettingKeys.Contains(setting.Key) && !string.IsNullOrWhiteSpace(setting.Value))
            .ToDictionary(setting => setting.Key, setting => setting.Value);
        return Ok(values);
    }

    [HttpGet]
    public async Task<ActionResult<List<SystemSettingDto>>> GetAll()
    {
        var settings = await _settingsService.GetAllAsync();
        return Ok(settings.Where(s => !RetiredAccessGateKeys.Contains(s.Key)).ToList());
    }

    [HttpPut("{key}")]
    public async Task<ActionResult<SystemSettingDto>> Update(string key, [FromBody] UpdateSystemSettingDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (RetiredAccessGateKeys.Contains(key))
            return BadRequest(new { message = "הגדרה זו אינה פעילה עוד" });

        var description = key == TickerConfigKey ? TickerConfigDescription : "";
        var updated = await _settingsService.UpsertAsync(key, dto.Value, description);

        return Ok(updated);
    }

}
