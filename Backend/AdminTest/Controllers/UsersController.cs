using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class UsersController : ControllerBase
{
    private readonly IUserService _service;

    public UsersController(IUserService service)
    {
        _service = service;
    }

    // GET: api/Users
    [HttpGet]
    public async Task<ActionResult<PagedResult<UserListDto>>> GetUsers(
        [FromQuery] string? search = null,
        [FromQuery] int? role = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10)
    {
        var result = await _service.GetUsersAsync(
            search, role, isActive, pageNumber, pageSize);

        return Ok(result);
    }

}
