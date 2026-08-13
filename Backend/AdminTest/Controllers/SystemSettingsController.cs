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
    private const string SiteGateEnabledKey = "site_access_gate_enabled";
    private const string SiteGatePasswordHashKey = "site_access_gate_password_hash";
    private const string SiteGatePasswordVersionKey = "site_access_gate_password_version";
    private const string SiteGateCookieName = "site-access-gate";
    private const string SiteGateEnabledDescription = "דרישת סיסמה בכניסה לאתר";
    private const string SiteGatePasswordHashDescription = "סיסמת כניסה לאתר - שמורה מוצפנת";
    private const string SiteGatePasswordVersionDescription = "גרסת סיסמת כניסה לאתר";
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
        var values = new Dictionary<string, string>();
        foreach (var key in PublicBannerImageKeys)
        {
            var value = await _settingsService.GetValueAsync(key);
            if (!string.IsNullOrWhiteSpace(value)) values[key] = value;
        }
        return Ok(values);
    }

    [HttpGet("access-gate")]
    [AllowAnonymous]
    public async Task<ActionResult<SiteAccessGateStatusDto>> GetAccessGate()
    {
        return Ok(await BuildAccessGateStatusAsync());
    }

    [HttpPost("access-gate/verify")]
    [AllowAnonymous]
    public async Task<ActionResult<SiteAccessGateStatusDto>> VerifyAccessGate([FromBody] VerifySiteAccessGateDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var status = await BuildAccessGateStatusAsync();
        if (!status.Enabled)
            return Ok(status);

        var passwordHash = await _settingsService.GetValueAsync(SiteGatePasswordHashKey);
        if (string.IsNullOrWhiteSpace(passwordHash) || !BCrypt.Net.BCrypt.Verify(dto.Password, passwordHash))
            return Unauthorized(new { message = "סיסמה שגויה" });

        IssueAccessGateCookie(status.AccessVersion);
        status.HasAccess = true;
        return Ok(status);
    }

    [HttpPut("access-gate")]
    public async Task<ActionResult<SiteAccessGateStatusDto>> UpdateAccessGate([FromBody] UpdateSiteAccessGateDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var currentHash = await _settingsService.GetValueAsync(SiteGatePasswordHashKey);
        var hasNewPassword = !string.IsNullOrWhiteSpace(dto.Password);

        if (dto.Enabled && string.IsNullOrWhiteSpace(currentHash) && !hasNewPassword)
            return BadRequest(new { message = "כדי להפעיל דרישת סיסמה צריך להגדיר סיסמה" });

        await _settingsService.UpsertAsync(
            SiteGateEnabledKey,
            dto.Enabled ? "true" : "false",
            SiteGateEnabledDescription);

        if (hasNewPassword)
        {
            await _settingsService.UpsertAsync(
                SiteGatePasswordHashKey,
                BCrypt.Net.BCrypt.HashPassword(dto.Password),
                SiteGatePasswordHashDescription);

            await _settingsService.UpsertAsync(
                SiteGatePasswordVersionKey,
                DateTime.UtcNow.Ticks.ToString(),
                SiteGatePasswordVersionDescription);
        }
        else
        {
            await EnsureAccessGateVersionAsync();
        }

        return Ok(await BuildAccessGateStatusAsync());
    }

    [HttpGet]
    public async Task<ActionResult<List<SystemSettingDto>>> GetAll()
    {
        await EnsureAccessGateDefaultsAsync();
        var settings = await _settingsService.GetAllAsync();
        return Ok(settings.Where(s => s.Key != SiteGatePasswordHashKey).ToList());
    }

    [HttpPut("{key}")]
    public async Task<ActionResult<SystemSettingDto>> Update(string key, [FromBody] UpdateSystemSettingDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        if (key == SiteGatePasswordHashKey || key == SiteGatePasswordVersionKey)
            return BadRequest(new { message = "הגדרה זו מתעדכנת רק דרך הגדרות סיסמת הכניסה לאתר" });

        var description = key == TickerConfigKey ? TickerConfigDescription : "";
        var updated = await _settingsService.UpsertAsync(key, dto.Value, description);

        return Ok(updated);
    }

    private async Task<SiteAccessGateStatusDto> BuildAccessGateStatusAsync()
    {
        var enabled = await _settingsService.GetBoolAsync(SiteGateEnabledKey);
        var passwordHash = await _settingsService.GetValueAsync(SiteGatePasswordHashKey);
        var version = await _settingsService.GetValueAsync(SiteGatePasswordVersionKey);

        return new SiteAccessGateStatusDto
        {
            Enabled = enabled,
            PasswordConfigured = !string.IsNullOrWhiteSpace(passwordHash),
            AccessVersion = version ?? string.Empty,
            HasAccess = HasValidAccessGateCookie(version)
        };
    }

    private bool HasValidAccessGateCookie(string? version)
    {
        return !string.IsNullOrWhiteSpace(version)
            && Request.Cookies.TryGetValue(SiteGateCookieName, out var cookieValue)
            && cookieValue == version;
    }

    private void IssueAccessGateCookie(string version)
    {
        Response.Cookies.Append(SiteGateCookieName, version, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.None,
            Expires = DateTimeOffset.UtcNow.AddDays(30)
        });
    }

    private async Task EnsureAccessGateDefaultsAsync()
    {
        if (await _settingsService.GetValueAsync(SiteGateEnabledKey) == null)
        {
            await _settingsService.UpsertAsync(SiteGateEnabledKey, "false", SiteGateEnabledDescription);
        }

        await EnsureAccessGateVersionAsync();
    }

    private async Task EnsureAccessGateVersionAsync()
    {
        if (await _settingsService.GetValueAsync(SiteGatePasswordVersionKey) == null)
        {
            await _settingsService.UpsertAsync(
                SiteGatePasswordVersionKey,
                DateTime.UtcNow.Ticks.ToString(),
                SiteGatePasswordVersionDescription);
        }
    }
}
