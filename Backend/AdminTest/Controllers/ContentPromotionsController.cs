using System.Security.Claims;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[Route("api/admin/[controller]")]
[ApiController]
[Authorize(Roles = "Admin")]
public class ContentPromotionsController : ControllerBase
{
    private readonly IContentPromotionService _promotionService;

    public ContentPromotionsController(IContentPromotionService promotionService)
    {
        _promotionService = promotionService;
    }

    [HttpGet]
    public async Task<ActionResult<List<ContentPromotionDto>>> GetPromotions(
        [FromQuery] ContentPromotionTargetType? targetType,
        [FromQuery] int? targetId,
        [FromQuery] ContentPromotionPlacement? placement)
    {
        return await _promotionService.GetPromotionsAsync(targetType, targetId, placement);
    }

    [HttpPost]
    public async Task<ActionResult<ContentPromotionDto>> UpsertPromotion([FromBody] UpsertContentPromotionDto dto)
    {
        try
        {
            return await _promotionService.UpsertPromotionAsync(dto, GetAdminName());
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("bulk")]
    public async Task<ActionResult<List<ContentPromotionDto>>> BulkUpsertPromotion([FromBody] BulkUpsertContentPromotionDto dto)
    {
        try
        {
            return await _promotionService.BulkUpsertPromotionAsync(dto, GetAdminName());
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{targetType}/{targetId:int}/{placement}")]
    public async Task<IActionResult> DeactivatePromotion(
        ContentPromotionTargetType targetType,
        int targetId,
        ContentPromotionPlacement placement)
    {
        var changed = await _promotionService.DeactivatePromotionAsync(targetType, targetId, placement, GetAdminName());
        return changed ? NoContent() : NotFound();
    }

    private string? GetAdminName()
    {
        return User.FindFirstValue(ClaimTypes.Name) ??
            User.FindFirstValue(ClaimTypes.Email) ??
            User.FindFirstValue(ClaimTypes.NameIdentifier);
    }
}
