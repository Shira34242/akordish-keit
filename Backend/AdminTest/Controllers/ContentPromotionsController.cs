using System.Security.Claims;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace AkordishKeit.Controllers;

[Route("api/admin/[controller]")]
[ApiController]
[Authorize(Roles = "Admin")]
public class ContentPromotionsController : ControllerBase
{
    private readonly IContentPromotionService _promotionService;
    private readonly IMemoryCache _cache;

    public ContentPromotionsController(IContentPromotionService promotionService, IMemoryCache cache)
    {
        _promotionService = promotionService;
        _cache = cache;
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
            var promotion = await _promotionService.UpsertPromotionAsync(dto, GetAdminName());
            InvalidatePodcastPromotionCaches(dto.TargetType);
            return promotion;
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
            var promotions = await _promotionService.BulkUpsertPromotionAsync(dto, GetAdminName());
            InvalidatePodcastPromotionCaches(dto.TargetType);
            return promotions;
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
        if (changed)
            InvalidatePodcastPromotionCaches(targetType);
        return changed ? NoContent() : NotFound();
    }

    private void InvalidatePodcastPromotionCaches(ContentPromotionTargetType targetType)
    {
        if (targetType is not (ContentPromotionTargetType.Podcast or ContentPromotionTargetType.PodcastEpisode))
            return;

        for (var limit = 1; limit <= 12; limit++)
            _cache.Remove($"home_podcast_cards_v2_{limit}");

        _cache.Remove("home_popular_episode_banners_v2");
    }

    private string? GetAdminName()
    {
        return User.FindFirstValue(ClaimTypes.Name) ??
            User.FindFirstValue(ClaimTypes.Email) ??
            User.FindFirstValue(ClaimTypes.NameIdentifier);
    }
}
