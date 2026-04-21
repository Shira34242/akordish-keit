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

    [HttpGet]
    public async Task<ActionResult<List<SystemSettingDto>>> GetAll()
    {
        var settings = await _settingsService.GetAllAsync();
        return Ok(settings);
    }

    [HttpPut("{key}")]
    public async Task<ActionResult<SystemSettingDto>> Update(string key, [FromBody] UpdateSystemSettingDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var description = key == TickerConfigKey ? TickerConfigDescription : "";
        var updated = await _settingsService.UpsertAsync(key, dto.Value, description);

        return Ok(updated);
    }
}
