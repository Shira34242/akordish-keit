using AkordishKeit.Services;

namespace AkordishKeit.Middleware;

public class SiteAccessGateMiddleware
{
    private const string SiteGateEnabledKey = "site_access_gate_enabled";
    private const string SiteGatePasswordHashKey = "site_access_gate_password_hash";
    private const string SiteGatePasswordVersionKey = "site_access_gate_password_version";
    private const string SiteGateCookieName = "site-access-gate";

    private readonly RequestDelegate _next;

    public SiteAccessGateMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ISystemSettingsService settingsService)
    {
        if (!ShouldCheck(context.Request))
        {
            await _next(context);
            return;
        }

        var enabled = await settingsService.GetBoolAsync(SiteGateEnabledKey);
        if (!enabled)
        {
            await _next(context);
            return;
        }

        var passwordHash = await settingsService.GetValueAsync(SiteGatePasswordHashKey);
        var version = await settingsService.GetValueAsync(SiteGatePasswordVersionKey);
        var hasAccess = !string.IsNullOrWhiteSpace(passwordHash)
            && !string.IsNullOrWhiteSpace(version)
            && context.Request.Cookies.TryGetValue(SiteGateCookieName, out var cookieValue)
            && cookieValue == version;

        if (hasAccess)
        {
            await _next(context);
            return;
        }

        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new
        {
            code = "SITE_ACCESS_REQUIRED",
            message = "נדרשת סיסמת כניסה לאתר"
        });
    }

    private static bool ShouldCheck(HttpRequest request)
    {
        if (HttpMethods.IsOptions(request.Method))
            return false;

        if (!request.Path.StartsWithSegments("/api"))
            return false;

        if (request.Path.StartsWithSegments("/api/SystemSettings/access-gate"))
            return false;

        if (IsPublicJoinEndpoint(request))
            return false;

        return true;
    }

    private static bool IsPublicJoinEndpoint(HttpRequest request)
    {
        var path = request.Path;
        var value = path.Value ?? string.Empty;

        if (path.StartsWithSegments("/api/Auth"))
            return true;

        if (HttpMethods.IsPost(request.Method)
            && path.StartsWithSegments("/api/ComingSoonSubscriptions"))
            return true;

        if (HttpMethods.IsPost(request.Method)
            && path.StartsWithSegments("/api/SiteInterest/register"))
            return true;

        if ((HttpMethods.IsGet(request.Method) || HttpMethods.IsPost(request.Method))
            && path.StartsWithSegments("/api/Email/unsubscribe"))
            return true;

        if (HttpMethods.IsGet(request.Method)
            && (path.StartsWithSegments("/api/Cities")
                || path.StartsWithSegments("/api/Instruments")
                || path.StartsWithSegments("/api/MusicServiceProviderCategories")
                || path.StartsWithSegments("/api/Agencies/slug")))
            return true;

        if (HttpMethods.IsPost(request.Method)
            && (path.StartsWithSegments("/api/Teachers/create-profile")
                || path.StartsWithSegments("/api/MusicServiceProviders/create-profile")
                || path.StartsWithSegments("/api/Media/upload")
                || string.Equals(value, "/api/Songs", StringComparison.OrdinalIgnoreCase)
                || path.StartsWithSegments("/api/Songs/youtube-metadata")
                || path.StartsWithSegments("/api/Songs/detect-key")
                || path.StartsWithSegments("/api/Songs/import-from-url")))
            return true;

        if (HttpMethods.IsGet(request.Method)
            && path.StartsWithSegments("/api/Songs")
            && (value.Contains("/autocomplete/", StringComparison.OrdinalIgnoreCase)
                || path.StartsWithSegments("/api/Songs/check-duplicate")
                || path.StartsWithSegments("/api/Songs/youtube-search")
                || path.StartsWithSegments("/api/Songs/musical-keys")
                || path.StartsWithSegments("/api/Songs/daily-limit-status")))
            return true;

        if (HttpMethods.IsGet(request.Method)
            && path.StartsWithSegments("/api/Subscriptions/user"))
            return true;

        return false;
    }
}
