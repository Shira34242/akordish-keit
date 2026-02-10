using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

/// <summary>
/// שירות לניהול מנויים
/// </summary>
public class SubscriptionService : ISubscriptionService
{
    private readonly AkordishKeitDbContext _context;

    public SubscriptionService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// יצירת מנוי חדש למשתמש
    /// </summary>
    public async Task<SubscriptionDto> CreateSubscriptionAsync(CreateSubscriptionDto dto)
    {
        // בדיקה שהמשתמש קיים
        var user = await _context.Users.FindAsync(dto.UserId);
        if (user == null)
        {
            throw new ArgumentException("משתמש לא נמצא");
        }

        // בדיקה שאין למשתמש מנוי פעיל
        var existingSubscription = await _context.Subscriptions
            .Where(s => s.UserId == dto.UserId &&
                       (s.Status == SubscriptionStatus.Active ||
                        s.Status == SubscriptionStatus.Trial))
            .FirstOrDefaultAsync();

        if (existingSubscription != null)
        {
            throw new InvalidOperationException("למשתמש כבר יש מנוי פעיל");
        }

        // יצירת מנוי חדש
        var subscription = new Subscription
        {
            UserId = dto.UserId,
            Plan = dto.Plan,
            Status = dto.IsTrial ? SubscriptionStatus.Trial : SubscriptionStatus.PendingPayment,
            IsTrial = dto.IsTrial,
            IsAutoRenew = dto.IsAutoRenew,
            BillingCycle = dto.BillingCycle,
            StartDate = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        // אם זה מנוי ניסיון - 3 חודשים חינם (לפי האיפיון)
        if (dto.IsTrial)
        {
            subscription.TrialEndDate = DateTime.UtcNow.AddMonths(3);
            subscription.EndDate = subscription.TrialEndDate;
            subscription.Price = 0; // חינמי
            subscription.Currency = "ILS";
        }
        else
        {
            // קביעת מחיר לפי תוכנית
            subscription.Price = GetPlanPrice(dto.Plan, dto.BillingCycle);
            subscription.Currency = "ILS";

            // קביעת תאריך חידוש
            if (dto.BillingCycle == "Monthly")
            {
                subscription.RenewalDate = DateTime.UtcNow.AddMonths(1);
                subscription.EndDate = subscription.RenewalDate;
            }
            else if (dto.BillingCycle == "Yearly")
            {
                subscription.RenewalDate = DateTime.UtcNow.AddYears(1);
                subscription.EndDate = subscription.RenewalDate;
            }
        }

        _context.Subscriptions.Add(subscription);
        await _context.SaveChangesAsync();

        return MapToDto(subscription);
    }

    /// <summary>
    /// קבלת מידע על מנוי לפי ID
    /// </summary>
    public async Task<SubscriptionDto?> GetSubscriptionByIdAsync(int subscriptionId)
    {
        var subscription = await _context.Subscriptions
            .FirstOrDefaultAsync(s => s.Id == subscriptionId);

        return subscription == null ? null : MapToDto(subscription);
    }

    /// <summary>
    /// קבלת מנוי פעיל של משתמש
    /// </summary>
    public async Task<SubscriptionDto?> GetUserActiveSubscriptionAsync(int userId)
    {
        var subscription = await _context.Subscriptions
            .Include(s => s.CoveredArtists)
            .Include(s => s.CoveredServiceProviders)
            .Where(s => s.UserId == userId)
            .Where(s => s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trial)
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync();

        return subscription == null ? null : MapToDto(subscription);
    }

    /// <summary>
    /// עדכון סטטוס מנוי
    /// </summary>
    public async Task<SubscriptionDto> UpdateSubscriptionStatusAsync(int subscriptionId, UpdateSubscriptionStatusDto dto)
    {
        var subscription = await _context.Subscriptions.FindAsync(subscriptionId);
        if (subscription == null)
        {
            throw new ArgumentException("מנוי לא נמצא");
        }

        subscription.Status = dto.Status;

        if (dto.Status == SubscriptionStatus.Cancelled && dto.Reason != null)
        {
            subscription.CancelledAt = DateTime.UtcNow;
            subscription.CancellationReason = dto.Reason;
        }

        if (dto.Status == SubscriptionStatus.Expired)
        {
            subscription.EndDate = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        return MapToDto(subscription);
    }

    /// <summary>
    /// שדרוג תוכנית מנוי
    /// </summary>
    public async Task<SubscriptionDto> UpgradeSubscriptionAsync(int subscriptionId, UpgradeSubscriptionDto dto)
    {
        var subscription = await _context.Subscriptions.FindAsync(subscriptionId);
        if (subscription == null)
        {
            throw new ArgumentException("מנוי לא נמצא");
        }

        // בדיקה שהמנוי פעיל
        if (!subscription.IsCurrentlyActive())
        {
            throw new InvalidOperationException("לא ניתן לשדרג מנוי לא פעיל");
        }

        // בדיקה שמדובר בשדרוג ולא בשנמוך
        if (dto.NewPlan <= subscription.Plan)
        {
            throw new InvalidOperationException("ניתן רק לשדרג תוכנית, לא לשנמך");
        }

        var oldPlan = subscription.Plan;
        subscription.Plan = dto.NewPlan;
        subscription.BillingCycle = dto.BillingCycle;
        subscription.Price = GetPlanPrice(dto.NewPlan, dto.BillingCycle);

        // אם מעבר ממנוי ניסיון לתשלום
        if (subscription.IsTrial)
        {
            subscription.IsTrial = false;
            subscription.Status = SubscriptionStatus.Active;
            subscription.TrialEndDate = null;
        }

        await _context.SaveChangesAsync();

        return MapToDto(subscription);
    }

    /// <summary>
    /// ביטול מנוי
    /// </summary>
    public async Task<SubscriptionDto> CancelSubscriptionAsync(int subscriptionId, CancelSubscriptionDto dto)
    {
        var subscription = await _context.Subscriptions
            .Include(s => s.CoveredArtists)
            .Include(s => s.CoveredServiceProviders)
            .FirstOrDefaultAsync(s => s.Id == subscriptionId);

        if (subscription == null)
        {
            throw new ArgumentException("מנוי לא נמצא");
        }

        subscription.CancelledAt = DateTime.UtcNow;
        subscription.CancellationReason = dto.Reason;
        subscription.IsAutoRenew = false;

        if (dto.CancelImmediately)
        {
            // ביטול מיידי
            subscription.Status = SubscriptionStatus.Cancelled;
            subscription.EndDate = DateTime.UtcNow;
        }
        else
        {
            // ביטול בסוף התקופה ששולמה
            subscription.Status = SubscriptionStatus.Cancelled;
            // EndDate נשאר כמו שהוא - המשתמש ימשיך ליהנות עד תום התקופה
        }

        await _context.SaveChangesAsync();

        return MapToDto(subscription);
    }

    /// <summary>
    /// חידוש מנוי מבוטל
    /// </summary>
    public async Task<SubscriptionDto> RenewSubscriptionAsync(int subscriptionId)
    {
        var subscription = await _context.Subscriptions
            .Include(s => s.CoveredArtists)
            .Include(s => s.CoveredServiceProviders)
            .FirstOrDefaultAsync(s => s.Id == subscriptionId);

        if (subscription == null)
        {
            throw new ArgumentException("מנוי לא נמצא");
        }

        if (subscription.Status != SubscriptionStatus.Cancelled && subscription.Status != SubscriptionStatus.Expired)
        {
            throw new InvalidOperationException("ניתן לחדש רק מנוי מבוטל או שפג תוקפו");
        }

        // חידוש המנוי
        subscription.Status = SubscriptionStatus.Active;
        subscription.IsAutoRenew = true;
        subscription.CancelledAt = null;
        subscription.CancellationReason = null;

        // עדכון תאריכים
        var now = DateTime.UtcNow;
        subscription.StartDate = now;

        if (subscription.BillingCycle == "Monthly")
        {
            subscription.RenewalDate = now.AddMonths(1);
            subscription.EndDate = subscription.RenewalDate;
        }
        else if (subscription.BillingCycle == "Yearly")
        {
            subscription.RenewalDate = now.AddYears(1);
            subscription.EndDate = subscription.RenewalDate;
        }

        await _context.SaveChangesAsync();

        return MapToDto(subscription);
    }

    /// <summary>
    /// בדיקה האם משתמש יכול לגשת לפיצ'ר מסוים
    /// </summary>
    public async Task<FeatureAccessDto> CheckFeatureAccessAsync(int userId, string featureName)
    {
        var user = await _context.Users
            .Include(u => u.Subscriptions)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return new FeatureAccessDto
            {
                HasAccess = false,
                Reason = "משתמש לא נמצא"
            };
        }

        // מציאת מנוי פעיל
        var activeSubscription = user.Subscriptions?
            .FirstOrDefault(s => s.IsCurrentlyActive());

        // אם אין מנוי או שהמנוי לא פעיל
        if (activeSubscription == null)
        {
            return new FeatureAccessDto
            {
                HasAccess = false,
                Reason = "נדרש מנוי פעיל",
                RequiredPlan = SubscriptionPlan.Regular
            };
        }

        // פיצ'רים שדורשים מנוי רגיל
        var regularFeatures = new[] { "recommended_tag", "search_priority", "homepage", "gallery", "video" };

        // פיצ'רים שדורשים מנוי פרימיום
        var premiumFeatures = new[] { "premium_visibility", "top_placement" };

        if (regularFeatures.Contains(featureName.ToLower()))
        {
            bool hasAccess = activeSubscription.Plan >= SubscriptionPlan.Regular;
            return new FeatureAccessDto
            {
                HasAccess = hasAccess,
                Reason = hasAccess ? null : "נדרש מנוי רגיל לפחות",
                RequiredPlan = hasAccess ? null : SubscriptionPlan.Regular
            };
        }

        if (premiumFeatures.Contains(featureName.ToLower()))
        {
            bool hasAccess = activeSubscription.Plan == SubscriptionPlan.Premium;
            return new FeatureAccessDto
            {
                HasAccess = hasAccess,
                Reason = hasAccess ? null : "נדרש מנוי פרימיום",
                RequiredPlan = hasAccess ? null : SubscriptionPlan.Premium
            };
        }

        // פיצ'ר לא ידוע - נותנים גישה
        return new FeatureAccessDto
        {
            HasAccess = true
        };
    }

    /// <summary>
    /// בדיקה האם משתמש פרימיום
    /// </summary>
    public async Task<bool> IsPremiumUserAsync(int userId)
    {
        var user = await _context.Users
            .Include(u => u.Subscriptions)
            .FirstOrDefaultAsync(u => u.Id == userId);

        return user?.IsPremium() ?? false;
    }

    /// <summary>
    /// עדכון סטטוסים של מנויים שפג תוקפם
    /// זה צריך לרוץ באופן תקופתי (למשל, כל יום ב-background job)
    /// </summary>
    public async Task UpdateExpiredSubscriptionsAsync()
    {
        var now = DateTime.UtcNow;

        // מציאת כל המנויים שפג תוקפם אבל עדיין לא מסומנים כ-Expired
        var expiredSubscriptions = await _context.Subscriptions
            .Include(s => s.CoveredArtists)
            .Include(s => s.CoveredServiceProviders)
            .Where(s => (s.Status == SubscriptionStatus.Active ||
                        s.Status == SubscriptionStatus.Trial ||
                        s.Status == SubscriptionStatus.Cancelled) &&
                       s.EndDate.HasValue &&
                       s.EndDate.Value < now)
            .ToListAsync();

        foreach (var subscription in expiredSubscriptions)
        {
            subscription.Status = SubscriptionStatus.Expired;

            // הורדת כל הפרופילים המקושרים ל-Free tier
            foreach (var artist in subscription.CoveredArtists)
            {
                artist.Tier = ProfileTier.Free;
                artist.SubscriptionId = null;
            }

            foreach (var serviceProvider in subscription.CoveredServiceProviders)
            {
                serviceProvider.Tier = ProfileTier.Free;
                serviceProvider.SubscriptionId = null;
                serviceProvider.IsPrimaryProfile = false;
            }
        }

        if (expiredSubscriptions.Any())
        {
            await _context.SaveChangesAsync();
        }
    }

    /// <summary>
    /// קישור פרופיל למנוי ושדרוג ל-Subscribed tier
    /// </summary>
    public async Task LinkProfileToSubscriptionAsync(int subscriptionId, int? artistId, int? serviceProviderId, bool isPrimary = false)
    {
        var subscription = await _context.Subscriptions
            .Include(s => s.CoveredArtists)
            .Include(s => s.CoveredServiceProviders)
            .FirstOrDefaultAsync(s => s.Id == subscriptionId);

        if (subscription == null)
        {
            throw new ArgumentException("מנוי לא נמצא");
        }

        if (!subscription.IsCurrentlyActive())
        {
            throw new InvalidOperationException("המנוי אינו פעיל");
        }

        // קישור Artist
        if (artistId.HasValue)
        {
            var artist = await _context.Artists.FindAsync(artistId.Value);
            if (artist == null)
            {
                throw new ArgumentException("אמן לא נמצא");
            }

            artist.Tier = ProfileTier.Subscribed;
            artist.SubscriptionId = subscriptionId;
        }

        // קישור ServiceProvider
        if (serviceProviderId.HasValue)
        {
            var serviceProvider = await _context.ServiceProviders.FindAsync(serviceProviderId.Value);
            if (serviceProvider == null)
            {
                throw new ArgumentException("בעל מקצוע לא נמצא");
            }

            serviceProvider.Tier = ProfileTier.Subscribed;
            serviceProvider.SubscriptionId = subscriptionId;
            serviceProvider.IsPrimaryProfile = isPrimary;
        }

        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// ניתוק פרופיל ממנוי והורדה ל-Free tier
    /// </summary>
    public async Task UnlinkProfileFromSubscriptionAsync(int? artistId, int? serviceProviderId)
    {
        // ניתוק Artist
        if (artistId.HasValue)
        {
            var artist = await _context.Artists.FindAsync(artistId.Value);
            if (artist != null)
            {
                artist.Tier = ProfileTier.Free;
                artist.SubscriptionId = null;
            }
        }

        // ניתוק ServiceProvider
        if (serviceProviderId.HasValue)
        {
            var serviceProvider = await _context.ServiceProviders.FindAsync(serviceProviderId.Value);
            if (serviceProvider != null)
            {
                serviceProvider.Tier = ProfileTier.Free;
                serviceProvider.SubscriptionId = null;
                serviceProvider.IsPrimaryProfile = false;
            }
        }

        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// חישוב מחיר כולל לפי מספר פרופילים
    /// כל מנוי (Regular או Premium) כולל 1 פרופיל בלבד
    /// כל פרופיל נוסף עולה 30₪/חודש
    /// </summary>
    public decimal CalculateTotalPrice(SubscriptionPlan plan, int totalProfiles, string billingCycle)
    {
        if (plan == SubscriptionPlan.Free || totalProfiles == 0)
            return 0;

        // כל מנוי (Regular או Premium) כולל רק פרופיל אחד
        int includedProfiles = 1;

        // חישוב פרופילים נוספים
        int additionalProfiles = Math.Max(0, totalProfiles - includedProfiles);

        // מחיר בסיס
        decimal basePrice = GetPlanPrice(plan, billingCycle);

        // מחיר לפרופיל נוסף (30₪ לחודש)
        decimal addonPricePerProfile = 30m;
        if (billingCycle == "Yearly")
        {
            addonPricePerProfile *= 10; // הנחה של חודשיים לתשלום שנתי (10 חודשים במחיר של 12)
        }

        decimal totalPrice = basePrice + (additionalProfiles * addonPricePerProfile);

        return totalPrice;
    }

    // ========== Private Helper Methods ==========

    /// <summary>
    /// קביעת מחיר לפי תוכנית ותדירות חיוב
    /// </summary>
    private decimal GetPlanPrice(SubscriptionPlan plan, string billingCycle)
    {
        if (plan == SubscriptionPlan.Free)
            return 0;

        decimal monthlyPrice = plan switch
        {
            SubscriptionPlan.Regular => 49m,
            SubscriptionPlan.Premium => 99m,
            _ => 0m
        };

        // אם תשלום שנתי - 10 חודשים במחיר של 12
        if (billingCycle == "Yearly")
        {
            return monthlyPrice * 10; // הנחה של חודשיים
        }

        return monthlyPrice;
    }

    /// <summary>
    /// המרת Entity ל-DTO
    /// </summary>
    private SubscriptionDto MapToDto(Subscription subscription)
    {
        var totalProfilesUsed = (subscription.CoveredArtists?.Count ?? 0) +
                                (subscription.CoveredServiceProviders?.Count ?? 0);

        return new SubscriptionDto
        {
            Id = subscription.Id,
            UserId = subscription.UserId,
            Plan = subscription.Plan,
            PlanName = GetPlanName(subscription.Plan),
            Status = subscription.Status,
            StatusName = GetStatusName(subscription.Status),
            IsTrial = subscription.IsTrial,
            StartDate = subscription.StartDate,
            EndDate = subscription.EndDate,
            RenewalDate = subscription.RenewalDate,
            TrialEndDate = subscription.TrialEndDate,
            IsAutoRenew = subscription.IsAutoRenew,
            CancelledAt = subscription.CancelledAt,
            CancellationReason = subscription.CancellationReason,
            Price = subscription.Price,
            Currency = subscription.Currency,
            BillingCycle = subscription.BillingCycle,
            CreatedAt = subscription.CreatedAt,
            IsActive = subscription.IsCurrentlyActive(),
            IsPremiumActive = subscription.IsPremium(),
            DaysRemaining = subscription.DaysRemaining(),
            TotalProfilesUsed = totalProfilesUsed
        };
    }

    private string GetPlanName(SubscriptionPlan plan)
    {
        return plan switch
        {
            SubscriptionPlan.Free => "חינמי",
            SubscriptionPlan.Regular => "רגיל",
            SubscriptionPlan.Premium => "פרימיום",
            _ => "לא ידוע"
        };
    }

    private string GetStatusName(SubscriptionStatus status)
    {
        return status switch
        {
            SubscriptionStatus.PendingPayment => "ממתין לתשלום",
            SubscriptionStatus.Trial => "ניסיון",
            SubscriptionStatus.Active => "פעיל",
            SubscriptionStatus.Cancelled => "מבוטל",
            SubscriptionStatus.Expired => "פג תוקף",
            SubscriptionStatus.Suspended => "מושהה",
            _ => "לא ידוע"
        };
    }
}
