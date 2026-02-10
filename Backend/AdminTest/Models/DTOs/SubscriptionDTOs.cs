using AkordishKeit.Models.Enum;
using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs;

/// <summary>
/// DTO להחזרת מידע על מנוי
/// </summary>
public class SubscriptionDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public SubscriptionPlan Plan { get; set; }
    public string PlanName { get; set; } = string.Empty;
    public SubscriptionStatus Status { get; set; }
    public string StatusName { get; set; } = string.Empty;
    public bool IsTrial { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public DateTime? RenewalDate { get; set; }
    public DateTime? TrialEndDate { get; set; }
    public bool IsAutoRenew { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancellationReason { get; set; }
    public decimal? Price { get; set; }
    public string Currency { get; set; } = "ILS";
    public string? BillingCycle { get; set; }
    public DateTime CreatedAt { get; set; }

    // Computed fields
    public bool IsActive { get; set; }
    public bool IsPremiumActive { get; set; }
    public int? DaysRemaining { get; set; }
    public int TotalProfilesUsed { get; set; }
}

/// <summary>
/// DTO ליצירת מנוי חדש (בשלב זה ללא תשלום אמיתי)
/// </summary>
public class CreateSubscriptionDto
{
    [Required]
    public int UserId { get; set; }

    [Required]
    public SubscriptionPlan Plan { get; set; }

    /// <summary>
    /// האם זה מנוי ניסיון (2 חודשים חינם)
    /// </summary>
    public bool IsTrial { get; set; } = false;

    /// <summary>
    /// האם מתחדש אוטומטית (כרגע לא משפיע, רק לשמירה)
    /// </summary>
    public bool IsAutoRenew { get; set; } = true;

    /// <summary>
    /// תדירות חיוב (Monthly, Yearly)
    /// </summary>
    public string BillingCycle { get; set; } = "Monthly";
}

/// <summary>
/// DTO לעדכון סטטוס מנוי
/// </summary>
public class UpdateSubscriptionStatusDto
{
    [Required]
    public SubscriptionStatus Status { get; set; }

    /// <summary>
    /// סיבת העדכון (למשל, סיבת ביטול)
    /// </summary>
    public string? Reason { get; set; }
}

/// <summary>
/// DTO לשדרוג תוכנית מנוי
/// </summary>
public class UpgradeSubscriptionDto
{
    [Required]
    public SubscriptionPlan NewPlan { get; set; }

    /// <summary>
    /// תדירות חיוב (Monthly, Yearly)
    /// </summary>
    public string BillingCycle { get; set; } = "Monthly";
}

/// <summary>
/// DTO לביטול מנוי
/// </summary>
public class CancelSubscriptionDto
{
    /// <summary>
    /// סיבת הביטול (אופציונלי)
    /// </summary>
    public string? Reason { get; set; }

    /// <summary>
    /// האם לבטל מיידית או בסוף התקופה ששולמה
    /// </summary>
    public bool CancelImmediately { get; set; } = false;
}

/// <summary>
/// תשובה לשאלה "האם המשתמש יכול לגשת לפיצ'ר?"
/// </summary>
public class FeatureAccessDto
{
    public bool HasAccess { get; set; }
    public string? Reason { get; set; }
    public SubscriptionPlan? RequiredPlan { get; set; }
}

/// <summary>
/// DTO לקישור פרופיל למנוי
/// </summary>
public class LinkProfileDto
{
    public int? ArtistId { get; set; }
    public int? ServiceProviderId { get; set; }
    public bool IsPrimary { get; set; } = false;
}

/// <summary>
/// DTO לניתוק פרופיל ממנוי
/// </summary>
public class UnlinkProfileDto
{
    public int? ArtistId { get; set; }
    public int? ServiceProviderId { get; set; }
}

/// <summary>
/// DTO להחזרת מידע על בוסט
/// </summary>
public class BoostDto
{
    public int Id { get; set; }
    public int ServiceProviderId { get; set; }
    public decimal Price { get; set; }
    public string? ExternalPaymentId { get; set; }
    public BoostType Type { get; set; }
    public string TypeName { get; set; } = string.Empty;
    public DateTime PurchaseDate { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? ExpiryDate { get; set; }
    public bool IsActive { get; set; }
}
