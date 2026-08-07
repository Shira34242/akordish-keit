using System.Text.RegularExpressions;

namespace AkordishKeit.Services.EmailPipeline;

public class EmailUtmStep : IEmailUtmStep
{
    private static readonly Regex HrefRegex = new(
        @"<a\s[^>]*?href\s*=\s*([""'])(.+?)\1",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex MailtoTelRegex = new(
        @"^(mailto|tel):",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public string Apply(string html, UtmSettings settings)
    {
        if (!settings.Enabled) return html;
        if (string.IsNullOrWhiteSpace(settings.Source)) return html;

        return HrefRegex.Replace(html, match =>
        {
            var quote = match.Groups[1].Value;
            var url = match.Groups[2].Value;

            if (ShouldSkip(url)) return match.Value;

            var newUrl = AppendUtm(url, settings);
            return $"<a href={quote}{newUrl}{quote}";
        });
    }

    private static bool ShouldSkip(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return true;
        if (url.StartsWith("#")) return true;
        if (MailtoTelRegex.IsMatch(url)) return true;

        if (url.Contains("unsubscribe", StringComparison.OrdinalIgnoreCase))
            return true;

        return false;
    }

    private static string AppendUtm(string url, UtmSettings settings)
    {
        var utmParams = BuildUtmQuery(settings);
        if (string.IsNullOrEmpty(utmParams)) return url;

        var separator = url.Contains('?') ? "&" : "?";

        var fragment = string.Empty;
        var fragmentIndex = url.IndexOf('#');
        if (fragmentIndex >= 0)
        {
            fragment = url[fragmentIndex..];
            url = url[..fragmentIndex];
        }

        var existingParams = url.Contains('?')
            ? url[(url.IndexOf('?') + 1)..]
            : string.Empty;

        if (!string.IsNullOrEmpty(existingParams))
        {
            utmParams = RemoveDuplicateUtm(existingParams, utmParams);
        }

        return $"{url}{separator}{utmParams}{fragment}";
    }

    private static string BuildUtmQuery(UtmSettings settings)
    {
        var parts = new List<string>
        {
            $"utm_source={Uri.EscapeDataString(settings.Source ?? "akordishkayt")}",
            $"utm_medium={Uri.EscapeDataString(settings.Medium ?? "email")}",
            $"utm_campaign={Uri.EscapeDataString(settings.Campaign ?? "unknown")}"
        };

        if (!string.IsNullOrWhiteSpace(settings.Content))
            parts.Add($"utm_content={Uri.EscapeDataString(settings.Content)}");

        return string.Join("&", parts);
    }

    private static string RemoveDuplicateUtm(string existingQuery, string newUtmParams)
    {
        var utmKeys = new[] { "utm_source=", "utm_medium=", "utm_campaign=", "utm_content=", "utm_term=" };
        var existing = existingQuery;
        foreach (var key in utmKeys)
        {
            existing = Regex.Replace(existing,
                $@"&?{Regex.Escape(key)}[^&]*",
                string.Empty,
                RegexOptions.IgnoreCase);
        }
        existing = existing.TrimStart('&');

        if (string.IsNullOrEmpty(existing))
            return newUtmParams;

        return $"{existing}&{newUtmParams}";
    }

    public string PreviewUrl(string url, UtmSettings settings)
    {
        if (!settings.Enabled || string.IsNullOrWhiteSpace(settings.Source))
            return url;

        if (ShouldSkip(url)) return url;
        return AppendUtm(url, settings);
    }
}
