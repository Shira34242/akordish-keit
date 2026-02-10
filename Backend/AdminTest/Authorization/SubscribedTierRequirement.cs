using Microsoft.AspNetCore.Authorization;

namespace AkordishKeit.Authorization;

/// <summary>
/// דרישה שהמשתמש יש לו פרופיל עם Tier = Subscribed
/// </summary>
public class SubscribedTierRequirement : IAuthorizationRequirement
{
    // אין צורך בשדות נוספים - רק לבדוק שיש Subscribed tier
}
