using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

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

    public async Task<MarketingCampaignDashboardDto> GetDashboardAsync(DateTime? dateFrom, DateTime? dateTo, string frontendBaseUrl)
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
                TrackingUrl = BuildTrackingUrl(frontendBaseUrl, campaign),
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
        var totalSignups = rows.Sum(x => x.Signups);
        var totalUnique = await _context.MarketingCampaignEvents.AsNoTracking()
            .Where(x => x.EventType == VisitEvent && x.OccurredAt >= start && x.OccurredAt < end)
            .Select(x => x.VisitorId).Distinct().CountAsync();

        return new MarketingCampaignDashboardDto
        {
            DateFrom = start,
            DateTo = end,
            TotalVisits = totalVisits,
            UniqueVisitors = totalUnique,
            TotalSignups = totalSignups,
            ConversionRate = totalUnique == 0 ? 0 : Math.Round(totalSignups * 100m / totalUnique, 1),
            Campaigns = rows
        };
    }

    public async Task<MarketingCampaignSummaryDto> CreateAsync(CreateMarketingCampaignRequest request, int createdByUserId, string frontendBaseUrl)
    {
        var targetPath = NormalizeTargetPath(request.TargetPath);
        var campaign = new MarketingCampaign
        {
            Name = request.Name.Trim(),
            Source = request.Source.Trim(),
            Code = await ResolveUniqueCodeAsync(request.Code),
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
            TrackingUrl = BuildTrackingUrl(frontendBaseUrl, campaign),
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
        string frontendBaseUrl)
    {
        var campaign = await _context.MarketingCampaigns.FindAsync(id);
        if (campaign == null) return null;

        campaign.Name = request.Name.Trim();
        campaign.Source = request.Source.Trim();
        campaign.TargetPath = NormalizeTargetPath(request.TargetPath);
        if (!string.IsNullOrWhiteSpace(request.Code))
            campaign.Code = await ResolveUniqueCodeAsync(request.Code, campaign.Id);
        campaign.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return new MarketingCampaignSummaryDto
        {
            Id = campaign.Id,
            Name = campaign.Name,
            Source = campaign.Source,
            Code = campaign.Code,
            TargetPath = campaign.TargetPath,
            TrackingUrl = BuildTrackingUrl(frontendBaseUrl, campaign),
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

    public async Task<MarketingCampaignRedirectDto?> ResolveAsync(string code)
    {
        var normalizedCode = NormalizeCode(code);
        if (string.IsNullOrEmpty(normalizedCode)) return null;

        var campaign = await _context.MarketingCampaigns.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Code == normalizedCode);
        if (campaign == null) return null;

        return new MarketingCampaignRedirectDto
        {
            DestinationPath = campaign.IsActive
                ? AppendTrackingParameters(campaign.TargetPath, campaign)
                : campaign.TargetPath
        };
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

    private async Task<string> ResolveUniqueCodeAsync(string? requestedCode, int? excludedCampaignId = null)
    {
        if (!string.IsNullOrWhiteSpace(requestedCode))
        {
            var customCode = requestedCode.Trim().ToLowerInvariant();
            if (customCode.Length < 3 ||
                !Regex.IsMatch(customCode, "^[a-z0-9]+(?:-[a-z0-9]+)*$"))
                throw new ArgumentException("סיומת הקישור יכולה לכלול 3–32 תווים: אותיות באנגלית, מספרים ומקפים בין המילים");

            var exists = await _context.MarketingCampaigns.AsNoTracking()
                .AnyAsync(x => x.Code == customCode && (!excludedCampaignId.HasValue || x.Id != excludedCampaignId.Value));
            if (exists) throw new ArgumentException("סיומת הקישור כבר נמצאת בשימוש. יש לבחור סיומת אחרת");
            return customCode;
        }

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
        // Do not use UriKind.Absolute here: on Linux, rooted site paths such as
        // "/chords" can be interpreted as absolute file URIs and rejected.
        if (string.IsNullOrWhiteSpace(path) ||
            !path.StartsWith('/') ||
            path.StartsWith("//") ||
            path.Equals("/go", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/go/", StringComparison.OrdinalIgnoreCase) ||
            path.Contains('\\') ||
            path.Any(char.IsControl))
            throw new ArgumentException("יש להזין נתיב פנימי באתר שמתחיל ב-/");
        return path;
    }

    private static string BuildTrackingUrl(string frontendBaseUrl, MarketingCampaign campaign)
    {
        return $"{frontendBaseUrl.TrimEnd('/')}/go/{Uri.EscapeDataString(campaign.Code)}";
    }

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
        string[] markers = ["bot", "crawler", "spider", "preview", "facebookexternalhit", "telegrambot", "slackbot", "discordbot"];
        return string.IsNullOrWhiteSpace(value) || markers.Any(value.Contains);
    }

    private static string? Truncate(string? value, int maxLength) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim()[..Math.Min(value.Trim().Length, maxLength)];
}
