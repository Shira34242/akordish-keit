using AkordishKeit.Models.Enum;

namespace AkordishKeit.Models.Entities;

/// <summary>
/// מנוי של משתמש מקצועי (מורה/אמן/בעל מקצוע)
/// </summary>
public class Subscription
{
    public int Id { get; set; }

    /// <summary>
    /// קישור למשתמש
    /// </summary>
    public int UserId { get; set; }

    /// <summary>
    /// תוכנית המנוי (Free, Regular, Premium)
    /// </summary>
    public SubscriptionPlan Plan { get; set; }

    /// <summary>
    /// סטטוס המנוי (Active, Cancelled, Expired, וכו')
    /// </summary>
    public SubscriptionStatus Status { get; set; }

    /// <summary>
    /// האם זה מנוי ניסיון (2 חודשים חינם)
    /// </summary>
    public bool IsTrial { get; set; }

    /// <summary>
    /// תאריך התחלת המנוי
    /// </summary>
    public DateTime StartDate { get; set; }

    /// <summary>
    /// תאריך סיום המנוי (עבור Trial או מנוי ששולם)
    /// </summary>
    public DateTime? EndDate { get; set; }

    /// <summary>
    /// תאריך החידוש הבא (עבור מנויים אוטומטיים)
    /// </summary>
    public DateTime? RenewalDate { get; set; }

    /// <summary>
    /// תאריך סיום תקופת הניסיון (עבור Trial)
    /// </summary>
    public DateTime? TrialEndDate { get; set; }

    /// <summary>
    /// האם מנוי מתחדש אוטומטית
    /// </summary>
    public bool IsAutoRenew { get; set; }

    /// <summary>
    /// תאריך ביטול המנוי (אם בוטל)
    /// </summary>
    public DateTime? CancelledAt { get; set; }

    /// <summary>
    /// סיבת הביטול
    /// </summary>
    public string? CancellationReason { get; set; }

    /// <summary>
    /// מזהה תשלום חיצוני (מספק הסליקה) - לעתיד
    /// </summary>
    public string? ExternalPaymentId { get; set; }

    /// <summary>
    /// מחיר ששולם (לתיעוד)
    /// </summary>
    public decimal? Price { get; set; }

    /// <summary>
    /// מטבע (ILS ברירת מחדל)
    /// </summary>
    public string Currency { get; set; } = "ILS";

    /// <summary>
    /// תדירות חיוב (Monthly, Yearly)
    /// </summary>
    public string? BillingCycle { get; set; }

    /// <summary>
    /// מספר פרופילים נוספים (Add-ons) שנרכשו מעבר לפרופיל הראשי הכלול במנוי
    /// כל פרופיל נוסף עולה 30₪/חודש
    /// </summary>
    public int NumberOfAdditionalProfiles { get; set; } = 0;

    /// <summary>
    /// תאריך יצירה
    /// </summary>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// תאריך עדכון אחרון
    /// </summary>
    public DateTime? UpdatedAt { get; set; }

    // Navigation Properties
    public virtual User User { get; set; } = null!;

    /// <summary>
    /// פרופילי בעלי מקצוע שהמנוי מכסה
    /// </summary>
    public virtual ICollection<MusicServiceProvider> CoveredServiceProviders { get; set; } = new List<MusicServiceProvider>();

    /// <summary>
    /// פרופילי אמנים שהמנוי מכסה
    /// </summary>
    public virtual ICollection<Artist> CoveredArtists { get; set; } = new List<Artist>();

    /// <summary>
    /// בדיקה האם המנוי פעיל כרגע
    /// </summary>
    public bool IsCurrentlyActive()
    {
        // מנוי פעיל או בניסיון
        if (Status != SubscriptionStatus.Active && Status != SubscriptionStatus.Trial)
            return false;

        // בדיקת תאריך תפוגה
        if (EndDate.HasValue && EndDate.Value < DateTime.UtcNow)
            return false;

        // בדיקת תקופת ניסיון
        if (IsTrial && TrialEndDate.HasValue && TrialEndDate.Value < DateTime.UtcNow)
            return false;

        return true;
    }

    /// <summary>
    /// בדיקה האם המנוי Premium (Regular או Premium plan)
    /// </summary>
    public bool IsPremium()
    {
        return IsCurrentlyActive() && (Plan == SubscriptionPlan.Regular || Plan == SubscriptionPlan.Premium);
    }

    /// <summary>
    /// כמה ימים נשארו למנוי
    /// </summary>
    public int? DaysRemaining()
    {
        if (!IsCurrentlyActive())
            return null;

        var expirationDate = IsTrial ? TrialEndDate : EndDate;
        if (!expirationDate.HasValue)
            return null;

        var days = (expirationDate.Value.Date - DateTime.UtcNow.Date).Days;
        return days > 0 ? days : 0;
    }

    /// <summary>
    /// חישוב מחיר כולל של המנוי (בסיס + תוספים)
    /// Regular = 49₪, Premium = 99₪, כל פרופיל נוסף = 30₪
    /// </summary>
    public decimal CalculateTotalPrice()
    {
        decimal basePrice = Plan switch
        {
            SubscriptionPlan.Free => 0m,
            SubscriptionPlan.Regular => 49m,
            SubscriptionPlan.Premium => 99m,
            _ => 0m
        };

        // כל פרופיל נוסף עולה 30₪
        decimal additionalProfilesPrice = NumberOfAdditionalProfiles * 30m;

        return basePrice + additionalProfilesPrice;
    }

    /// <summary>
    /// חישוב מספר הפרופילים הנוספים בפועל (לא ראשיים)
    /// מחשב מהפרופילים המקושרים למנוי
    /// </summary>
    public int GetActualAdditionalProfilesCount()
    {
        int additionalServiceProviders = CoveredServiceProviders?.Count(sp => !sp.IsPrimaryProfile) ?? 0;
        int additionalArtists = CoveredArtists?.Count(a => !a.IsPrimaryProfile) ?? 0;
        return additionalServiceProviders + additionalArtists;
    }

    /// <summary>
    /// בדיקה האם מספר הפרופילים הנוספים תואם למציאות
    /// </summary>
    public bool IsAdditionalProfilesCountValid()
    {
        return NumberOfAdditionalProfiles == GetActualAdditionalProfilesCount();
    }
}
