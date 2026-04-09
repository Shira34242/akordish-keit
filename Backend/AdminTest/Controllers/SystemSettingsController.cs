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
    private readonly ISystemSettingsService _settingsService;

    public SystemSettingsController(ISystemSettingsService settingsService)
    {
        _settingsService = settingsService;
    }

    // GET: api/SystemSettings
    [HttpGet]
    public async Task<ActionResult<List<SystemSettingDto>>> GetAll()
    {
        var settings = await _settingsService.GetAllAsync();
        return Ok(settings);
    }

    // PUT: api/SystemSettings/{key}
    [HttpPut("{key}")]
    public async Task<ActionResult<SystemSettingDto>> Update(string key, [FromBody] UpdateSystemSettingDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var updated = await _settingsService.UpdateAsync(key, dto.Value);

        if (updated == null)
            return NotFound(new { message = $"הגדרה '{key}' לא נמצאה" });

        return Ok(updated);
    }
}
