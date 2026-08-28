using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace AkordishKeit.Services;

public class MarketingCampaignService : IMarketingCampaignService
{
    private const string VisitEvent = "visit";
    private const string SignupEvent = "signup";
    private readonly AkordishKeitDbContext _context;
    private readonly ILogger<MarketingCampaignService> _logger;

    public MarketingCampaignService(AkordishKeitDbContext context, ILogger<MarketingCampaignService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<MarketingCampaignDashboardDto> GetDashboardAsync(DateTime? dateFrom, DateTime? dateTo, string frontendBaseUrl, string backendBaseUrl)
    {
        var end = (dateTo ?? DateTime.UtcNow).ToUniversalTime();
        var start = (dateFrom ?? end.AddDays(-30)).ToUniversalTime();
        if (end <= start || end - start > TimeSpan.FromDays(366))
            throw new ArgumentException("טווח התאריכים אינו תקין");

        var campaigns = await _context.MarketingCampaigns.AsNoTracking()
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync();

        var stats = await _context.MarketingCampaignEvents.AsNoTracking()
            .Where(x => x.OccurredAt >= start && x.OccurredAt < end)
            .GroupBy(x => x.MarketingCampaignId)
            .Select(group => new
            {
                CampaignId = group.Key,
                Visits = group.Count(x => x.EventType == VisitEvent),
                UniqueVisitors = group.Where(x => x.EventType == VisitEvent).Select(x => x.VisitorId).Distinct().Count(),
                Signups = group.Count(x => x.EventType == SignupEvent),
                LastVisitAt = group.Where(x => x.EventType == VisitEvent).Max(x => (DateTime?)x.OccurredAt)
            })
            .ToDictionaryAsync(x => x.CampaignId);

        var rows = campaigns.Select(campaign =>
        {
            stats.TryGetValue(campaign.Id, out var row);
            var unique = row?.UniqueVisitors ?? 0;
            var signups = row?.Signups ?? 0;
            return new MarketingCampaignSummaryDto
            {
                Id = campaign.Id,
                Name = campaign.Name,
                Source = campaign.Source,
                Code = campaign.Code,
                TargetPath = campaign.TargetPath,
                TrackingUrl = BuildTrackingUrl(frontendBaseUrl, backendBaseUrl, campaign),
                IsExternal = IsExternalTarget(campaign.TargetPath),
                IsActive = campaign.IsActive,
                CreatedAt = campaign.CreatedAt,
                Visits = row?.Visits ?? 0,
                UniqueVisitors = unique,
                Signups = signups,
                ConversionRate = unique == 0 ? 0 : Math.Round(signups * 100m / unique, 1),
                LastVisitAt = row?.LastVisitAt
            };
        }).ToList();

        var totalVisits = rows.Sum(x => x.Visits);
        var totalSignups = rows.Where(x => !x.IsExternal).Sum(x => x.Signups);
        var totalUnique = await _context.MarketingCampaignEvents.AsNoTracking()
            .Where(x => x.EventType == VisitEvent && x.OccurredAt >= start && x.OccurredAt < end)
            .Select(x => x.VisitorId).Distinct().CountAsync();
        var totalInternalUnique = await _context.MarketingCampaignEvents.AsNoTracking()
            .Where(x => x.EventType == VisitEvent && x.OccurredAt >= start && x.OccurredAt < end &&
                        x.MarketingCampaign.TargetPath.StartsWith("/"))
            .Select(x => x.VisitorId).Distinct().CountAsync();

        return new MarketingCampaignDashboardDto
        {
            DateFrom = start,
            DateTo = end,
            TotalVisits = totalVisits,
            UniqueVisitors = totalUnique,
            TotalSignups = totalSignups,
            ConversionRate = totalInternalUnique == 0 ? 0 : Math.Round(totalSignups * 100m / totalInternalUnique, 1),
            Campaigns = rows
        };
    }

    public async Task<MarketingCampaignSummaryDto> CreateAsync(CreateMarketingCampaignRequest request, int createdByUserId, string frontendBaseUrl, string backendBaseUrl)
    {
        var targetPath = NormalizeTargetPath(request.TargetPath);
        var campaign = new MarketingCampaign
        {
            Name = request.Name.Trim(),
            Source = request.Source.Trim(),
            Code = await GenerateUniqueCodeAsync(),
            TargetPath = targetPath,
            CreatedByUserId = createdByUserId,
            CreatedAt = DateTime.UtcNow,
            IsActive = true
        };
        _context.MarketingCampaigns.Add(campaign);
        await _context.SaveChangesAsync();

        return new MarketingCampaignSummaryDto
        {
            Id = campaign.Id,
            Name = campaign.Name,
            Source = campaign.Source,
            Code = campaign.Code,
            TargetPath = campaign.TargetPath,
            TrackingUrl = BuildTrackingUrl(frontendBaseUrl, backendBaseUrl, campaign),
            IsExternal = IsExternalTarget(campaign.TargetPath),
            IsActive = true,
            CreatedAt = campaign.CreatedAt
        };
    }

    public async Task<bool> SetStatusAsync(int id, bool isActive)
    {
        var campaign = await _context.MarketingCampaigns.FindAsync(id);
        if (campaign == null) return false;
        campaign.IsActive = isActive;
        campaign.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<MarketingCampaignSummaryDto?> UpdateAsync(
        int id,
        UpdateMarketingCampaignRequest request,
        string frontendBaseUrl,
        string backendBaseUrl)
    {
        var campaign = await _context.MarketingCampaigns.FindAsync(id);
        if (campaign == null) return null;

        campaign.Name = request.Name.Trim();
        campaign.Source = request.Source.Trim();
        campaign.TargetPath = NormalizeTargetPath(request.TargetPath);
        campaign.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return new MarketingCampaignSummaryDto
        {
            Id = campaign.Id,
            Name = campaign.Name,
            Source = campaign.Source,
            Code = campaign.Code,
            TargetPath = campaign.TargetPath,
            TrackingUrl = BuildTrackingUrl(frontendBaseUrl, backendBaseUrl, campaign),
            IsExternal = IsExternalTarget(campaign.TargetPath),
            IsActive = campaign.IsActive,
            CreatedAt = campaign.CreatedAt
        };
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var campaign = await _context.MarketingCampaigns.FindAsync(id);
        if (campaign == null) return false;

        _context.MarketingCampaigns.Remove(campaign);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> TrackVisitAsync(TrackMarketingCampaignVisitRequest request, int? userId, string? ipAddress, string? userAgent)
    {
        var code = NormalizeCode(request.CampaignCode);
        var visitorId = NormalizeVisitorId(request.VisitorId);
        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(visitorId) || IsAutomatedAgent(userAgent)) return false;

        var campaign = await _context.MarketingCampaigns.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Code == code && x.IsActive);
        if (campaign == null) return false;

        var duplicateAfter = DateTime.UtcNow.AddMinutes(-30);
        var duplicate = await _context.MarketingCampaignEvents.AnyAsync(x =>
            x.MarketingCampaignId == campaign.Id && x.EventType == VisitEvent &&
            x.VisitorId == visitorId && x.OccurredAt >= duplicateAfter);
        if (duplicate) return false;

        _context.MarketingCampaignEvents.Add(new MarketingCampaignEvent
        {
            MarketingCampaignId = campaign.Id,
            EventType = VisitEvent,
            VisitorId = visitorId,
            UserId = userId,
            PagePath = Truncate(request.PagePath, 500),
            Referrer = Truncate(request.Referrer, 500),
            IpAddress = Truncate(ipAddress, 64),
            UserAgent = Truncate(userAgent, 500),
            OccurredAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<string?> ResolveTrackedClickAsync(
        string campaignCode,
        string visitorId,
        string frontendBaseUrl,
        string? referrer,
        string? ipAddress,
        string? userAgent)
    {
        var code = NormalizeCode(campaignCode);
        var normalizedVisitorId = NormalizeVisitorId(visitorId);
        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(normalizedVisitorId)) return null;

        var campaign = await _context.MarketingCampaigns.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Code == code);
        if (campaign == null) return null;

        var destination = IsExternalTarget(campaign.TargetPath)
            ? campaign.TargetPath
            : $"{frontendBaseUrl.TrimEnd('/')}{AppendTrackingParameters(campaign.TargetPath, campaign)}";

        if (!campaign.IsActive || IsAutomatedAgent(userAgent)) return destination;

        try
        {
            var duplicateAfter = DateTime.UtcNow.AddMinutes(-30);
            var duplicate = await _context.MarketingCampaignEvents.AnyAsync(x =>
                x.MarketingCampaignId == campaign.Id && x.EventType == VisitEvent &&
                x.VisitorId == normalizedVisitorId && x.OccurredAt >= duplicateAfter);

            if (!duplicate)
            {
                _context.MarketingCampaignEvents.Add(new MarketingCampaignEvent
                {
                    MarketingCampaignId = campaign.Id,
                    EventType = VisitEvent,
                    VisitorId = normalizedVisitorId,
                    PagePath = Truncate(campaign.TargetPath, 500),
                    Referrer = Truncate(referrer, 500),
                    IpAddress = Truncate(ipAddress, 64),
                    UserAgent = Truncate(userAgent, 500),
                    OccurredAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Marketing click tracking failed for campaign {CampaignId}", campaign.Id);
        }

        return destination;
    }

    public async Task RecordSignupAsync(string? campaignCode, string? visitorId, int userId, string? ipAddress, string? userAgent)
    {
        try
        {
            var code = NormalizeCode(campaignCode);
            var normalizedVisitorId = NormalizeVisitorId(visitorId);
            if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(normalizedVisitorId)) return;

            var campaignId = await _context.MarketingCampaigns.AsNoTracking()
                .Where(x => x.Code == code)
                .Select(x => (int?)x.Id)
                .FirstOrDefaultAsync();
            if (!campaignId.HasValue) return;

            var exists = await _context.MarketingCampaignEvents.AnyAsync(x =>
                x.MarketingCampaignId == campaignId.Value && x.EventType == SignupEvent && x.UserId == userId);
            if (exists) return;

            _context.MarketingCampaignEvents.Add(new MarketingCampaignEvent
            {
                MarketingCampaignId = campaignId.Value,
                EventType = SignupEvent,
                VisitorId = normalizedVisitorId,
                UserId = userId,
                IpAddress = Truncate(ipAddress, 64),
                UserAgent = Truncate(userAgent, 500),
                OccurredAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Marketing signup attribution failed for user {UserId}", userId);
        }
    }

    private async Task<string> GenerateUniqueCodeAsync()
    {
        for (var attempt = 0; attempt < 8; attempt++)
        {
            var code = RandomNumberGenerator.GetHexString(6).ToLowerInvariant();
            if (!await _context.MarketingCampaigns.AnyAsync(x => x.Code == code)) return code;
        }
        throw new InvalidOperationException("לא ניתן ליצור מזהה קמפיין ייחודי");
    }

    private static string NormalizeTargetPath(string value)
    {
        var path = value.Trim();
        if (path.StartsWith('/') && !path.StartsWith("//"))
        {
            if (path.Contains('\\') || path.Any(char.IsControl))
                throw new ArgumentException("יש להזין נתיב פנימי תקין באתר שמתחיל ב-/");
            return path;
        }

        if (Uri.TryCreate(path, UriKind.Absolute, out var externalUri) &&
            externalUri.Scheme == Uri.UriSchemeHttps &&
            !string.IsNullOrWhiteSpace(externalUri.Host) &&
            string.IsNullOrEmpty(externalUri.UserInfo) &&
            !path.Any(char.IsControl))
        {
            var normalizedUrl = externalUri.AbsoluteUri;
            if (normalizedUrl.Length > 500)
                throw new ArgumentException("הכתובת החיצונית ארוכה מדי");
            return normalizedUrl;
        }

        throw new ArgumentException("יש להזין נתיב פנימי שמתחיל ב-/ או כתובת חיצונית שמתחילה ב-https://");
    }

    private static string BuildTrackingUrl(string frontendBaseUrl, string backendBaseUrl, MarketingCampaign campaign)
        => $"{backendBaseUrl.TrimEnd('/')}/r/{Uri.EscapeDataString(campaign.Code)}";

    private static bool IsExternalTarget(string targetPath) =>
        Uri.TryCreate(targetPath, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps;

    private static string AppendTrackingParameters(string targetPath, MarketingCampaign campaign)
    {
        var fragmentIndex = targetPath.IndexOf('#');
        var fragment = fragmentIndex >= 0 ? targetPath[fragmentIndex..] : string.Empty;
        var pathWithoutFragment = fragmentIndex >= 0 ? targetPath[..fragmentIndex] : targetPath;
        var separator = pathWithoutFragment.Contains('?') ? "&" : "?";
        return $"{pathWithoutFragment}{separator}" +
               $"utm_source={Uri.EscapeDataString(campaign.Source)}&utm_medium=collaboration&" +
               $"utm_campaign={Uri.EscapeDataString(campaign.Name)}&ak_campaign={Uri.EscapeDataString(campaign.Code)}{fragment}";
    }

    private static string NormalizeCode(string? value) =>
        new string((value ?? string.Empty).Trim().Where(c => char.IsLetterOrDigit(c) || c == '-').Take(32).ToArray()).ToLowerInvariant();

    private static string NormalizeVisitorId(string? value) =>
        new string((value ?? string.Empty).Trim().Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').Take(64).ToArray());

    private static bool IsAutomatedAgent(string? userAgent)
    {
        var value = (userAgent ?? string.Empty).ToLowerInvariant();
        string[] markers = ["bot", "crawler", "spider", "preview", "facebookexternalhit", "telegrambot", "slackbot", "discordbot", "safelinks", "linkchecker", "urlcheck", "proofpoint", "barracuda"];
        return string.IsNullOrWhiteSpace(value) || markers.Any(value.Contains);
    }

    private static string? Truncate(string? value, int maxLength) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(value.Trim().Length, maxLength)];
}
