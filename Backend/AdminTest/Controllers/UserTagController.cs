using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/users")]
public class UserTagController : ControllerBase
{
    private readonly IUserTagService _userTagService;

    public UserTagController(IUserTagService userTagService)
    {
        _userTagService = userTagService;
    }

    // GET: api/users/me/tag
    [HttpGet("me/tag")]
    [Authorize]
    public async Task<ActionResult<UserTagDto>> GetMyTag()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var tag = await _userTagService.GetUserTagAsync(userId.Value);
        if (tag == null) return NotFound();

        return Ok(tag);
    }

    // GET: api/users/{id}/tag  (Admin only)
    [HttpGet("{id}/tag")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<UserTagDto>> GetUserTag(int id)
    {
        var tag = await _userTagService.GetUserTagAsync(id);
        if (tag == null) return NotFound();

        return Ok(tag);
    }

    // POST: api/users/{id}/tag/recalculate  (Admin — force recalculate)
    [HttpPost("{id}/tag/recalculate")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<UserTagDto>> RecalculateTag(int id)
    {
        await _userTagService.RecalculateTagAsync(id);
        var tag = await _userTagService.GetUserTagAsync(id);
        return Ok(tag);
    }

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                 ?? User.FindFirst("id")?.Value
                 ?? User.FindFirst("sub")?.Value;

        return int.TryParse(claim, out var id) ? id : null;
    }
}
