using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Services;

/// <summary>
/// ממשק לניהול מנויים
/// </summary>
public interface ISubscriptionService
{
    /// <summary>
    /// יצירת מנוי חדש למשתמש
    /// </summary>
    Task<SubscriptionDto> CreateSubscriptionAsync(CreateSubscriptionDto dto);

    /// <summary>
    /// קבלת מידע על מנוי לפי ID
    /// </summary>
    Task<SubscriptionDto?> GetSubscriptionByIdAsync(int subscriptionId);

    /// <summary>
    /// קבלת מנוי פעיל של משתמש
    /// </summary>
    Task<SubscriptionDto?> GetUserActiveSubscriptionAsync(int userId);

    /// <summary>
    /// עדכון סטטוס מנוי
    /// </summary>
    Task<SubscriptionDto> UpdateSubscriptionStatusAsync(int subscriptionId, UpdateSubscriptionStatusDto dto);

    /// <summary>
    /// שדרוג תוכנית מנוי
    /// </summary>
    Task<SubscriptionDto> UpgradeSubscriptionAsync(int subscriptionId, UpgradeSubscriptionDto dto);

    /// <summary>
    /// ביטול מנוי
    /// </summary>
    Task<SubscriptionDto> CancelSubscriptionAsync(int subscriptionId, CancelSubscriptionDto dto);

    /// <summary>
    /// חידוש מנוי מבוטל
    /// </summary>
    Task<SubscriptionDto> RenewSubscriptionAsync(int subscriptionId);

    /// <summary>
    /// בדיקה האם משתמש יכול לגשת לפיצ'ר מסוים
    /// </summary>
    Task<FeatureAccessDto> CheckFeatureAccessAsync(int userId, string featureName);

    /// <summary>
    /// בדיקה האם משתמש פרימיום
    /// </summary>
    Task<bool> IsPremiumUserAsync(int userId);

    /// <summary>
    /// עדכון סטטוסים של מנויים שפג תוקפם (מריץ באופן תקופתי)
    /// </summary>
    Task UpdateExpiredSubscriptionsAsync();

    /// <summary>
    /// קישור פרופיל למנוי
    /// </summary>
    Task LinkProfileToSubscriptionAsync(int subscriptionId, int? artistId, int? serviceProviderId, bool isPrimary = false);

    /// <summary>
    /// ניתוק פרופיל ממנוי והורדה ל-Free tier
    /// </summary>
    Task UnlinkProfileFromSubscriptionAsync(int? artistId, int? serviceProviderId);

    /// <summary>
    /// חישוב מחיר כולל לפי מספר פרופילים
    /// </summary>
    decimal CalculateTotalPrice(SubscriptionPlan plan, int totalProfiles, string billingCycle);
}
