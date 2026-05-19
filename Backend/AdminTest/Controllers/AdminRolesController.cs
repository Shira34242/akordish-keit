using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[Route("api/admin/roles")]
[ApiController]
[Authorize(Policy = "roles.manage")]
public class AdminRolesController : ControllerBase
{
    private readonly IAdminRoleService _service;

    public AdminRolesController(IAdminRoleService service)
    {
        _service = service;
    }

    [HttpGet("permissions")]
    public ActionResult<List<AdminPermissionDto>> GetPermissions()
    {
        return Ok(_service.GetAvailablePermissions());
    }

    [HttpGet]
    public async Task<ActionResult<List<AdminRoleDto>>> GetRoles([FromQuery] bool includeInactive = true)
    {
        return Ok(await _service.GetRolesAsync(includeInactive));
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AdminRoleDto>> GetRole(int id)
    {
        var role = await _service.GetRoleAsync(id);
        return role == null ? NotFound() : Ok(role);
    }

    [HttpPost]
    public async Task<ActionResult<AdminRoleDto>> CreateRole([FromBody] SaveAdminRoleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "שם תפקיד הוא שדה חובה" });

        var role = await _service.CreateRoleAsync(dto);
        return CreatedAtAction(nameof(GetRole), new { id = role.Id }, role);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AdminRoleDto>> UpdateRole(int id, [FromBody] SaveAdminRoleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "שם תפקיד הוא שדה חובה" });

        var role = await _service.UpdateRoleAsync(id, dto);
        return role == null ? NotFound() : Ok(role);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteRole(int id)
    {
        return await _service.DeleteRoleAsync(id) ? NoContent() : NotFound();
    }
}
