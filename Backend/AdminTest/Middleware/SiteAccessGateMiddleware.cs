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

        return true;
    }
}
