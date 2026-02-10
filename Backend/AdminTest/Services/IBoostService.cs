using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Services;

/// <summary>
/// ממשק לניהול בוסטים (קידומים חד-פעמיים)
/// </summary>
public interface IBoostService
{
    /// <summary>
    /// רכישת בוסט לפרופיל
    /// </summary>
    Task<BoostDto> PurchaseBoostAsync(int serviceProviderId, BoostType type, decimal price, string? externalPaymentId);

    /// <summary>
    /// קבלת בוסט פעיל לפי סוג
    /// </summary>
    Task<BoostDto?> GetActiveBoostByTypeAsync(BoostType type);

    /// <summary>
    /// קבלת כל הבוסטים של פרופיל
    /// </summary>
    Task<List<BoostDto>> GetProfileBoostsAsync(int serviceProviderId);

    /// <summary>
    /// השבתת בוסט (כאשר בוסט חדש נרכש)
    /// </summary>
    Task DeactivateBoostAsync(int boostId);

    /// <summary>
    /// ניקוי בוסטים ישנים שאינם פעילים (תחזוקה)
    /// </summary>
    Task CleanupOldBoostsAsync(int daysOld = 30);
}
