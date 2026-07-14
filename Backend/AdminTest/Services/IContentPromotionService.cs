using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Services;

public interface IContentPromotionService
{
    Task<List<ContentPromotionDto>> GetPromotionsAsync(ContentPromotionTargetType? targetType, int? targetId, ContentPromotionPlacement? placement);
    Task<List<ContentPromotionDto>> GetActivePromotionsAsync(ContentPromotionTargetType targetType, ContentPromotionPlacement? placement);
    Task<ContentPromotionDto> UpsertPromotionAsync(UpsertContentPromotionDto dto, string? userName);
    Task<List<ContentPromotionDto>> BulkUpsertPromotionAsync(BulkUpsertContentPromotionDto dto, string? userName);
    Task<bool> DeactivatePromotionAsync(ContentPromotionTargetType targetType, int targetId, ContentPromotionPlacement placement, string? userName);
}
