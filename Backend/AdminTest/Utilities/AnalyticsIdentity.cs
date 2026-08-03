using Microsoft.AspNetCore.Http;

namespace AkordishKeit.Utilities;

public static class AnalyticsIdentity
{
    private const string VisitorHeader = "X-Akordish-Visitor-Id";

    public static string GetVisitorKey(HttpRequest request)
    {
        var visitorId = request.Headers[VisitorHeader].ToString().Trim();
        if (Guid.TryParse(visitorId, out var parsed))
            return $"visitor:{parsed:D}";

        var userAgent = request.Headers["User-Agent"].ToString();
        return userAgent.Length > 500 ? userAgent[..500] : userAgent;
    }
}
