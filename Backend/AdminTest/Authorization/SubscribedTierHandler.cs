using AkordishKeit.Data;
using AkordishKeit.Models.Enum;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AkordishKeit.Authorization;

/// <summary>
/// Handler לבדיקת Subscribed Tier
/// בודק אם למשתמש יש לפחות פרופיל אחד (Artist או ServiceProvider) עם Tier = Subscribed
/// </summary>
public class SubscribedTierHandler : AuthorizationHandler<SubscribedTierRequirement>
{
    private readonly AkordishKeitDbContext _context;

    public SubscribedTierHandler(AkordishKeitDbContext context)
    {
        _context = context;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        SubscribedTierRequirement requirement)
    {
        // קבלת User ID מה-Claims
        var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)
                       ?? context.User.FindFirst("sub")
                       ?? context.User.FindFirst("userId");

        if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out int userId))
        {
            // אין User ID - לא מאושר
            return;
        }

        // בדיקה אם למשתמש יש Artist עם Tier = Subscribed
        var hasSubscribedArtist = await _context.Artists
            .AnyAsync(a => a.UserId == userId && a.Tier == ProfileTier.Subscribed);

        if (hasSubscribedArtist)
        {
            context.Succeed(requirement);
            return;
        }

        // בדיקה אם למשתמש יש ServiceProvider עם Tier = Subscribed
        var hasSubscribedServiceProvider = await _context.ServiceProviders
            .AnyAsync(sp => sp.UserId == userId && sp.Tier == ProfileTier.Subscribed);

        if (hasSubscribedServiceProvider)
        {
            context.Succeed(requirement);
            return;
        }

        // אין פרופיל Subscribed - לא מאושר (context.Fail() לא נדרש)
    }
}
