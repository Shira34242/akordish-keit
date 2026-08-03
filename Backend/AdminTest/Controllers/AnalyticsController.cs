using AkordishKeit.Data;
using AkordishKeit.Models.Entities;
using AkordishKeit.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Roles = "Admin")]
public class AnalyticsController : ControllerBase
{
    private static readonly DateTime AnalyticsMeasurementCorrectionUtc = new(2026, 8, 3, 0, 0, 0, DateTimeKind.Utc);
    private static readonly string[] TrackedButtonTypes = ["ticket", "contact", "notification_link"];
    private static readonly string[] AgencyButtonTypes =
    [
        "agency_view", "agency_banner_click", "agency_contact_phone", "agency_contact_whatsapp",
        "agency_contact_email", "agency_contact_website", "agency_contact_panel",
        "agency_profile_click", "agency_content_click"
    ];
    private static readonly string[] AgencyLeadTypes =
        ["agency_contact_phone", "agency_contact_whatsapp", "agency_contact_email", "agency_contact_website"];

    private readonly AkordishKeitDbContext _context;

    public AnalyticsController(AkordishKeitDbContext context) => _context = context;

    [HttpPost("event-view")]
    [AllowAnonymous]
    [EnableRateLimiting("analytics-tracking")]
    public async Task<IActionResult> TrackEventView([FromBody] TrackEventViewDto dto)
    {
        if (dto.EventId.HasValue && !await _context.Events.AnyAsync(e => e.Id == dto.EventId.Value))
            return NotFound(new { message = "Event not found" });

        var identity = GetRequestIdentity();
        _context.EventViews.Add(new EventView
        {
            EventId = dto.EventId,
            UserId = identity.UserId,
            IpAddress = identity.IpAddress,
            UserAgent = identity.UserAgent,
            ViewedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();
        return Ok(new { tracked = true });
    }

    [HttpPost("button-click")]
    [AllowAnonymous]
    [EnableRateLimiting("analytics-tracking")]
    public async Task<IActionResult> TrackButtonClick([FromBody] TrackButtonClickDto dto)
    {
        var buttonType = dto.ButtonType?.Trim();
        if (string.IsNullOrWhiteSpace(buttonType) || buttonType.Length > 50)
            return BadRequest(new { message = "Invalid button type" });

        var identity = GetRequestIdentity();
        _context.ButtonClicks.Add(new ButtonClick
        {
            ButtonType = buttonType,
            ItemId = dto.ItemId,
            ItemLabel = Truncate(dto.ItemLabel?.Trim(), 200),
            UserId = identity.UserId,
            IpAddress = identity.IpAddress,
            UserAgent = identity.UserAgent,
            ClickedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();
        return Ok(new { tracked = true });
    }

    [HttpPost("browser-check")]
    [AllowAnonymous]
    [EnableRateLimiting("analytics-tracking")]
    public async Task<IActionResult> TrackAdBlockCheck([FromBody] TrackAdBlockCheckDto dto)
    {
        var identity = GetRequestIdentity();
        _context.AdBlockChecks.Add(new AdBlockCheck
        {
            Detected = dto.Detected,
            PagePath = NormalizePagePath(dto.PagePath),
            DeviceType = Truncate(dto.DeviceType?.Trim(), 30),
            UserId = identity.UserId,
            IpAddress = identity.IpAddress,
            UserAgent = identity.UserAgent,
            CheckedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();
        return Ok(new { tracked = true });
    }

    [HttpPost("page-view")]
    [AllowAnonymous]
    [EnableRateLimiting("analytics-tracking")]
    public async Task<IActionResult> TrackPageView([FromBody] TrackPageViewDto dto)
    {
        var pagePath = NormalizePagePath(dto.PagePath);
        if (pagePath.StartsWith("/admin", StringComparison.OrdinalIgnoreCase))
            return Ok(new { tracked = false });

        var identity = GetRequestIdentity();
        var deviceType = NormalizeDeviceType(dto.DeviceType);
        _context.ButtonClicks.Add(new ButtonClick
        {
            ButtonType = $"page_view_{deviceType}",
            ItemLabel = pagePath,
            UserId = identity.UserId,
            IpAddress = identity.IpAddress,
            UserAgent = identity.UserAgent,
            ClickedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();
        return Ok(new { tracked = true });
    }

    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboard([FromQuery] DateTime? dateFrom, [FromQuery] DateTime? dateTo)
    {
        var rangeResult = ResolveRange(dateFrom, dateTo);
        if (rangeResult.Error != null) return BadRequest(new { message = rangeResult.Error });
        var range = rangeResult.Range!;

        var eventListQuery = _context.EventViews.AsNoTracking()
            .Where(v => v.EventId == null && v.ViewedAt >= range.StartUtc && v.ViewedAt < range.EndUtc);
        var eventListViews = await eventListQuery.CountAsync();
        var eventListUnique = await eventListQuery.Select(v => new
        {
            v.UserId,
            IpAddress = v.UserId.HasValue ? null : v.IpAddress,
            UserAgent = v.UserId.HasValue ? null : v.UserAgent
        }).Distinct().CountAsync();
        var eventListTotal = await _context.EventViews.CountAsync(v => v.EventId == null);

        var topEvents = await _context.EventViews.AsNoTracking()
            .Where(v => v.EventId != null && v.ViewedAt >= range.StartUtc && v.ViewedAt < range.EndUtc)
            .GroupBy(v => v.EventId)
            .Select(g => new
            {
                EventId = g.Key,
                Views = g.Count(),
                UniqueVisitors = g.Select(v => new
                {
                    v.UserId,
                    IpAddress = v.UserId.HasValue ? null : v.IpAddress,
                    UserAgent = v.UserId.HasValue ? null : v.UserAgent
                }).Distinct().Count()
            })
            .OrderByDescending(x => x.Views).Take(10).ToListAsync();
        var eventIds = topEvents.Where(x => x.EventId.HasValue).Select(x => x.EventId!.Value).ToList();
        var eventNames = await _context.Events.AsNoTracking().Where(e => eventIds.Contains(e.Id))
            .Select(e => new { e.Id, e.Name }).ToDictionaryAsync(e => e.Id, e => e.Name);
        var eventTotals = await _context.EventViews.AsNoTracking()
            .Where(v => v.EventId.HasValue && eventIds.Contains(v.EventId.Value))
            .GroupBy(v => v.EventId!.Value).Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count);

        var buttonPeriodQuery = _context.ButtonClicks.AsNoTracking()
            .Where(c => c.ClickedAt >= range.StartUtc && c.ClickedAt < range.EndUtc);
        var ticketClicks = await buttonPeriodQuery.CountAsync(c => c.ButtonType == "ticket");
        var contactClicks = await buttonPeriodQuery.CountAsync(c => c.ButtonType == "contact");
        var notificationClicks = await buttonPeriodQuery.CountAsync(c => c.ButtonType == "notification_link");
        var ticketClicksTotal = await _context.ButtonClicks.CountAsync(c => c.ButtonType == "ticket");
        var contactClicksTotal = await _context.ButtonClicks.CountAsync(c => c.ButtonType == "contact");
        var notificationClicksTotal = await _context.ButtonClicks.CountAsync(c => c.ButtonType == "notification_link");
        var clickUniqueVisitors = await buttonPeriodQuery.Where(c => TrackedButtonTypes.Contains(c.ButtonType))
            .Select(v => new
            {
                v.UserId,
                IpAddress = v.UserId.HasValue ? null : v.IpAddress,
                UserAgent = v.UserId.HasValue ? null : v.UserAgent
            }).Distinct().CountAsync();
        var topTicketEvents = await buttonPeriodQuery.Where(c => c.ButtonType == "ticket" && c.ItemId != null)
            .GroupBy(c => new { c.ItemId, c.ItemLabel })
            .Select(g => new
            {
                g.Key.ItemId,
                g.Key.ItemLabel,
                Clicks = g.Count(),
                UniqueVisitors = g.Select(v => new
                {
                    v.UserId,
                    IpAddress = v.UserId.HasValue ? null : v.IpAddress,
                    UserAgent = v.UserId.HasValue ? null : v.UserAgent
                }).Distinct().Count()
            }).OrderByDescending(x => x.Clicks).Take(10).ToListAsync();
        var ticketItemIds = topTicketEvents.Where(x => x.ItemId.HasValue).Select(x => x.ItemId!.Value).ToList();
        var ticketTotals = await _context.ButtonClicks.AsNoTracking()
            .Where(c => c.ButtonType == "ticket" && c.ItemId.HasValue && ticketItemIds.Contains(c.ItemId.Value))
            .GroupBy(c => c.ItemId!.Value).Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count);

        var pageViewsQuery = buttonPeriodQuery.Where(c => c.ButtonType == "page_view" || c.ButtonType.StartsWith("page_view_"));
        var pageViews = await pageViewsQuery.CountAsync();
        var pageUniqueVisitors = await pageViewsQuery.Select(v => new
        {
            v.UserId,
            IpAddress = v.UserId.HasValue ? null : v.IpAddress,
            UserAgent = v.UserId.HasValue ? null : v.UserAgent
        }).Distinct().CountAsync();
        var topPages = await pageViewsQuery.GroupBy(v => v.ItemLabel ?? "/")
            .Select(g => new
            {
                PagePath = g.Key,
                Views = g.Count(),
                UniqueVisitors = g.Select(v => new
                {
                    v.UserId,
                    IpAddress = v.UserId.HasValue ? null : v.IpAddress,
                    UserAgent = v.UserId.HasValue ? null : v.UserAgent
                }).Distinct().Count()
            }).OrderByDescending(x => x.Views).Take(15).ToListAsync();
        var deviceRows = await pageViewsQuery.GroupBy(v => v.ButtonType)
            .Select(g => new
            {
                Type = g.Key,
                Views = g.Count(),
                UniqueVisitors = g.Select(v => new
                {
                    v.UserId,
                    IpAddress = v.UserId.HasValue ? null : v.IpAddress,
                    UserAgent = v.UserId.HasValue ? null : v.UserAgent
                }).Distinct().Count()
            }).ToListAsync();
        var desktopDevice = deviceRows.FirstOrDefault(x => x.Type == "page_view_desktop");
        var tabletDevice = deviceRows.FirstOrDefault(x => x.Type == "page_view_tablet");
        var mobileDevice = deviceRows.FirstOrDefault(x => x.Type == "page_view_mobile");
        var unclassifiedQuery = pageViewsQuery
            .Where(x => x.ButtonType == "page_view" || x.ButtonType == "page_view_unknown");
        var unclassifiedViews = await unclassifiedQuery.CountAsync();
        var unclassifiedUniqueVisitors = await unclassifiedQuery.Select(v => new
        {
            v.UserId,
            IpAddress = v.UserId.HasValue ? null : v.IpAddress,
            UserAgent = v.UserId.HasValue ? null : v.UserAgent
        }).Distinct().CountAsync();

        var articleQuery = _context.ArticleViews.AsNoTracking()
            .Where(v => v.ViewedAt >= range.StartUtc && v.ViewedAt < range.EndUtc);
        var articleViews = await articleQuery.CountAsync();
        var articleUnique = await articleQuery.Select(v => new
        {
            v.UserId,
            IpAddress = v.UserId.HasValue ? null : v.IpAddress,
            UserAgent = v.UserId.HasValue ? null : v.UserAgent
        }).Distinct().CountAsync();
        var articleViewsTotal = await _context.Articles.Where(a => !a.IsDeleted).SumAsync(a => (long)a.ViewCount);

        var chordQuery = _context.SongViews.AsNoTracking()
            .Where(v => v.ViewedAt >= range.StartUtc && v.ViewedAt < range.EndUtc);
        var chordViews = await chordQuery.CountAsync();
        var chordUnique = await chordQuery.Select(v => new
        {
            v.UserId,
            IpAddress = v.UserId.HasValue ? null : v.IpAddress,
            UserAgent = v.UserId.HasValue ? null : v.UserAgent
        }).Distinct().CountAsync();
        var chordViewsTotal = await _context.Songs.Where(s => !s.IsDeleted).SumAsync(s => (long)s.ViewCount);
        var topChordSongs = await chordQuery.GroupBy(v => v.SongId)
            .Select(g => new
            {
                SongId = g.Key,
                Views = g.Count(),
                UniqueVisitors = g.Select(v => new
                {
                    v.UserId,
                    IpAddress = v.UserId.HasValue ? null : v.IpAddress,
                    UserAgent = v.UserId.HasValue ? null : v.UserAgent
                }).Distinct().Count()
            }).OrderByDescending(x => x.Views).Take(10).ToListAsync();
        var chordSongIds = topChordSongs.Select(x => x.SongId).ToList();
        var chordSongs = await _context.Songs.AsNoTracking().Where(s => chordSongIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => new { s.Title, s.ViewCount });

        var podcastQuery = _context.PodcastEpisodeViews.AsNoTracking()
            .Where(v => v.ViewedAt >= range.StartUtc && v.ViewedAt < range.EndUtc);
        var podcastViews = await podcastQuery.CountAsync();
        var podcastUnique = await podcastQuery.Select(v => new
        {
            v.UserId,
            IpAddress = v.UserId.HasValue ? null : v.IpAddress,
            UserAgent = v.UserId.HasValue ? null : v.UserAgent
        }).Distinct().CountAsync();
        var podcastViewsTotal = await _context.PodcastEpisodes.Where(e => !e.IsDeleted).SumAsync(e => (long)e.ViewCount);
        var topPodcastEpisodes = await podcastQuery.GroupBy(v => v.PodcastEpisodeId)
            .Select(g => new
            {
                EpisodeId = g.Key,
                Views = g.Count(),
                UniqueVisitors = g.Select(v => new
                {
                    v.UserId,
                    IpAddress = v.UserId.HasValue ? null : v.IpAddress,
                    UserAgent = v.UserId.HasValue ? null : v.UserAgent
                }).Distinct().Count()
            }).OrderByDescending(x => x.Views).Take(10).ToListAsync();
        var podcastEpisodeIds = topPodcastEpisodes.Select(x => x.EpisodeId).ToList();
        var podcastEpisodes = await _context.PodcastEpisodes.AsNoTracking().Where(e => podcastEpisodeIds.Contains(e.Id))
            .Select(e => new { e.Id, e.Title, e.ViewCount }).ToDictionaryAsync(e => e.Id);

        var contentUniqueVisitors = await articleQuery.Select(v => new
            {
                v.UserId,
                IpAddress = v.UserId.HasValue ? null : v.IpAddress,
                UserAgent = v.UserId.HasValue ? null : v.UserAgent
            })
            .Concat(chordQuery.Select(v => new
            {
                v.UserId,
                IpAddress = v.UserId.HasValue ? null : v.IpAddress,
                UserAgent = v.UserId.HasValue ? null : v.UserAgent
            }))
            .Concat(eventListQuery.Select(v => new
            {
                v.UserId,
                IpAddress = v.UserId.HasValue ? null : v.IpAddress,
                UserAgent = v.UserId.HasValue ? null : v.UserAgent
            }))
            .Concat(podcastQuery.Select(v => new
            {
                v.UserId,
                IpAddress = v.UserId.HasValue ? null : v.IpAddress,
                UserAgent = v.UserId.HasValue ? null : v.UserAgent
            })).Distinct().CountAsync();

        var adsAllTimeViews = await _context.AdCampaigns.SumAsync(c => (long)c.ViewCount);
        var adsAllTimeClicks = await _context.AdCampaigns.SumAsync(c => (long)c.ClickCount);
        var adViewsQuery = _context.AdCampaignViews.AsNoTracking()
            .Where(v => v.ViewedAt >= range.StartUtc && v.ViewedAt < range.EndUtc);
        var adClicksQuery = _context.AdCampaignClicks.AsNoTracking()
            .Where(v => v.ClickedAt >= range.StartUtc && v.ClickedAt < range.EndUtc);
        var adViews = await adViewsQuery.CountAsync();
        var adClicks = await adClicksQuery.CountAsync();
        var adUnique = await adViewsQuery.Select(v => new
        {
            v.UserId,
            IpAddress = v.UserId.HasValue ? null : v.IpAddress,
            UserAgent = v.UserId.HasValue ? null : v.UserAgent
        }).Distinct().CountAsync();
        var adViewStats = await adViewsQuery.GroupBy(v => v.AdCampaignId)
            .Select(g => new { Id = g.Key, Views = g.Count() }).ToListAsync();
        var adClickStats = await adClicksQuery.GroupBy(v => v.AdCampaignId)
            .Select(g => new { Id = g.Key, Clicks = g.Count() }).ToListAsync();
        var topAdIds = adViewStats.OrderByDescending(x => x.Views).Take(10).Select(x => x.Id).ToList();
        var adCampaigns = await _context.AdCampaigns.AsNoTracking().Where(c => topAdIds.Contains(c.Id))
            .Select(c => new { c.Id, c.Name, ClientName = c.Client != null ? c.Client.BusinessName : "לקוח מזדמן" })
            .ToDictionaryAsync(c => c.Id);
        var now = DateTime.UtcNow;
        var activeCampaigns = await _context.AdCampaigns.CountAsync(c =>
            c.Status == Models.Enums.AdCampaignStatus.Active && c.StartDate <= now && c.EndDate >= now);

        var adBlockQuery = _context.AdBlockChecks.AsNoTracking()
            .Where(x => x.CheckedAt >= range.StartUtc && x.CheckedAt < range.EndUtc);
        var adBlockChecks = await adBlockQuery.CountAsync();
        var adBlockDetected = await adBlockQuery.CountAsync(x => x.Detected);
        var adBlockDaily = await adBlockQuery.GroupBy(x => x.CheckedAt.Date)
            .Select(g => new { Date = g.Key, Checks = g.Count(), Detected = g.Count(x => x.Detected) })
            .OrderBy(x => x.Date).ToListAsync();
        var adBlockTopPages = await adBlockQuery.GroupBy(x => x.PagePath ?? "/")
            .Select(g => new { PagePath = g.Key, Checks = g.Count(), Detected = g.Count(x => x.Detected) })
            .OrderByDescending(x => x.Detected).ThenByDescending(x => x.Checks).Take(10).ToListAsync();

        var previousArticles = await _context.ArticleViews.CountAsync(v => v.ViewedAt >= range.PreviousStartUtc && v.ViewedAt < range.StartUtc);
        var previousChords = await _context.SongViews.CountAsync(v => v.ViewedAt >= range.PreviousStartUtc && v.ViewedAt < range.StartUtc);
        var previousEvents = await _context.EventViews.CountAsync(v => v.EventId == null && v.ViewedAt >= range.PreviousStartUtc && v.ViewedAt < range.StartUtc);
        var previousPodcasts = await _context.PodcastEpisodeViews.CountAsync(v => v.ViewedAt >= range.PreviousStartUtc && v.ViewedAt < range.StartUtc);
        var previousClicks = await _context.ButtonClicks.CountAsync(v => TrackedButtonTypes.Contains(v.ButtonType) && v.ClickedAt >= range.PreviousStartUtc && v.ClickedAt < range.StartUtc);
        var previousPageViews = await _context.ButtonClicks.CountAsync(v =>
            (v.ButtonType == "page_view" || v.ButtonType.StartsWith("page_view_")) &&
            v.ClickedAt >= range.PreviousStartUtc && v.ClickedAt < range.StartUtc);

        var articleDaily = await articleQuery.GroupBy(v => EF.Functions.AtTimeZone(EF.Functions.AtTimeZone(v.ViewedAt, "UTC"), "Israel Standard Time").Date).Select(g => new DailyCount(g.Key, g.Count())).ToListAsync();
        var chordDaily = await chordQuery.GroupBy(v => EF.Functions.AtTimeZone(EF.Functions.AtTimeZone(v.ViewedAt, "UTC"), "Israel Standard Time").Date).Select(g => new DailyCount(g.Key, g.Count())).ToListAsync();
        var eventDaily = await eventListQuery.GroupBy(v => EF.Functions.AtTimeZone(EF.Functions.AtTimeZone(v.ViewedAt, "UTC"), "Israel Standard Time").Date).Select(g => new DailyCount(g.Key, g.Count())).ToListAsync();
        var podcastDaily = await podcastQuery.GroupBy(v => EF.Functions.AtTimeZone(EF.Functions.AtTimeZone(v.ViewedAt, "UTC"), "Israel Standard Time").Date).Select(g => new DailyCount(g.Key, g.Count())).ToListAsync();
        var clickDaily = await buttonPeriodQuery.Where(v => TrackedButtonTypes.Contains(v.ButtonType))
            .GroupBy(v => EF.Functions.AtTimeZone(EF.Functions.AtTimeZone(v.ClickedAt, "UTC"), "Israel Standard Time").Date).Select(g => new DailyCount(g.Key, g.Count())).ToListAsync();
        var pageDaily = await pageViewsQuery.GroupBy(v => EF.Functions.AtTimeZone(EF.Functions.AtTimeZone(v.ClickedAt, "UTC"), "Israel Standard Time").Date).Select(g => new DailyCount(g.Key, g.Count())).ToListAsync();
        var useMonthlyTrend = range.Days > 120;
        var articleBuckets = ToBuckets(articleDaily, useMonthlyTrend);
        var chordBuckets = ToBuckets(chordDaily, useMonthlyTrend);
        var eventBuckets = ToBuckets(eventDaily, useMonthlyTrend);
        var podcastBuckets = ToBuckets(podcastDaily, useMonthlyTrend);
        var clickBuckets = ToBuckets(clickDaily, useMonthlyTrend);
        var pageBuckets = ToBuckets(pageDaily, useMonthlyTrend);
        var trendDates = useMonthlyTrend
            ? EnumerateMonths(range.FromLocal, range.ToLocal).ToList()
            : Enumerable.Range(0, range.Days).Select(offset => range.FromLocal.AddDays(offset)).ToList();
        var trend = trendDates.Select(date => new
        {
            date,
            articles = articleBuckets.GetValueOrDefault(date),
            chords = chordBuckets.GetValueOrDefault(date),
            events = eventBuckets.GetValueOrDefault(date),
            clicks = clickBuckets.GetValueOrDefault(date),
            podcasts = podcastBuckets.GetValueOrDefault(date),
            pages = pageBuckets.GetValueOrDefault(date)
        }).ToList();

        return Ok(new
        {
            period = new
            {
                dateFrom = range.FromLocal,
                dateTo = range.ToLocal,
                days = range.Days,
                trendGranularity = useMonthlyTrend ? "month" : "day"
            },
            dataQuality = new
            {
                isHistoricalDataPartial = range.StartUtc < AnalyticsMeasurementCorrectionUtc,
                reliableFrom = AnalyticsMeasurementCorrectionUtc,
                note = "נתוני עבר מלפני שדרוג המדידה עשויים להיות חלקיים; לא נמחק או שונה מידע היסטורי קיים."
            },
            traffic = new
            {
                views = pageViews,
                uniqueVisitors = pageUniqueVisitors,
                previousViews = previousPageViews,
                topPages,
                devices = new
                {
                    desktop = new { views = desktopDevice?.Views ?? 0, uniqueVisitors = desktopDevice?.UniqueVisitors ?? 0 },
                    tablet = new { views = tabletDevice?.Views ?? 0, uniqueVisitors = tabletDevice?.UniqueVisitors ?? 0 },
                    mobile = new { views = mobileDevice?.Views ?? 0, uniqueVisitors = mobileDevice?.UniqueVisitors ?? 0 },
                    unclassified = new { views = unclassifiedViews, uniqueVisitors = unclassifiedUniqueVisitors }
                }
            },
            events = new
            {
                listPageViews = new { total = eventListTotal, last30Days = eventListViews, uniqueLast30Days = eventListUnique },
                topEvents = topEvents.Select(x => new
                {
                    x.EventId,
                    eventName = x.EventId.HasValue ? eventNames.GetValueOrDefault(x.EventId.Value, "—") : "—",
                    totalViews = x.EventId.HasValue ? eventTotals.GetValueOrDefault(x.EventId.Value) : x.Views,
                    viewsLast30 = x.Views,
                    x.UniqueVisitors
                })
            },
            buttons = new
            {
                uniqueVisitors = clickUniqueVisitors,
                ticketClicks = new { total = ticketClicksTotal, last30Days = ticketClicks },
                contactClicks = new { total = contactClicksTotal, last30Days = contactClicks },
                notificationLinkClicks = new { total = notificationClicksTotal, last30Days = notificationClicks },
                topTicketEvents = topTicketEvents.Select(x => new
                {
                    x.ItemId,
                    x.ItemLabel,
                    totalClicks = x.ItemId.HasValue ? ticketTotals.GetValueOrDefault(x.ItemId.Value) : x.Clicks,
                    clicksLast30 = x.Clicks,
                    x.UniqueVisitors
                })
            },
            ads = new
            {
                totalViews = adViews,
                totalClicks = adClicks,
                uniqueVisitors = adUnique,
                allTimeViews = adsAllTimeViews,
                allTimeClicks = adsAllTimeClicks,
                activeCampaigns,
                topCampaigns = topAdIds.Select(id =>
                {
                    var views = adViewStats.FirstOrDefault(x => x.Id == id)?.Views ?? 0;
                    var clicks = adClickStats.FirstOrDefault(x => x.Id == id)?.Clicks ?? 0;
                    adCampaigns.TryGetValue(id, out var detail);
                    return new
                    {
                        id,
                        name = detail?.Name ?? $"Campaign #{id}",
                        clientName = detail?.ClientName ?? "לקוח מזדמן",
                        viewCount = views,
                        clickCount = clicks,
                        ctr = views > 0 ? Math.Round((double)clicks / views * 100, 2) : 0
                    };
                })
            },
            articles = new { totalViews = articleViewsTotal, viewsLast30Days = articleViews, uniqueVisitors = articleUnique },
            chords = new
            {
                totalViews = chordViewsTotal,
                viewsLast30Days = chordViews,
                uniqueVisitors = chordUnique,
                topSongs = topChordSongs.Select(x => new
                {
                    songId = x.SongId,
                    songTitle = chordSongs.TryGetValue(x.SongId, out var song) ? song.Title : $"Song #{x.SongId}",
                    views = x.Views,
                    x.UniqueVisitors,
                    totalViews = chordSongs.TryGetValue(x.SongId, out var namedSong) ? namedSong.ViewCount : x.Views
                })
            },
            podcasts = new
            {
                totalViews = podcastViewsTotal,
                viewsLast30Days = podcastViews,
                uniqueVisitors = podcastUnique,
                topEpisodes = topPodcastEpisodes.Select(x => new
                {
                    episodeId = x.EpisodeId,
                    episodeTitle = podcastEpisodes.TryGetValue(x.EpisodeId, out var episode) ? episode.Title : $"פרק #{x.EpisodeId}",
                    views = x.Views,
                    x.UniqueVisitors,
                    totalViews = podcastEpisodes.TryGetValue(x.EpisodeId, out var namedEpisode) ? namedEpisode.ViewCount : x.Views
                })
            },
            contentUniqueVisitors,
            adBlock = new
            {
                totalChecks = adBlockChecks,
                detectedCount = adBlockDetected,
                detectionRate = adBlockChecks > 0 ? Math.Round((double)adBlockDetected / adBlockChecks * 100, 1) : 0,
                daily = adBlockDaily.Select(x => new
                {
                    date = x.Date,
                    x.Checks,
                    x.Detected,
                    rate = x.Checks > 0 ? Math.Round((double)x.Detected / x.Checks * 100, 1) : 0
                }),
                topPages = adBlockTopPages.Select(x => new
                {
                    x.PagePath,
                    x.Checks,
                    x.Detected,
                    rate = x.Checks > 0 ? Math.Round((double)x.Detected / x.Checks * 100, 1) : 0
                })
            },
            comparison = new
            {
                contentViews = new
                {
                    current = articleViews + chordViews + eventListViews + podcastViews,
                    previous = previousArticles + previousChords + previousEvents + previousPodcasts
                },
                clicks = new { current = ticketClicks + contactClicks + notificationClicks, previous = previousClicks }
            },
            trend
        });
    }

    [HttpGet("agencies")]
    public async Task<IActionResult> GetAgencyAnalytics([FromQuery] DateTime? dateFrom, [FromQuery] DateTime? dateTo)
    {
        var rangeResult = ResolveRange(dateFrom, dateTo);
        if (rangeResult.Error != null) return BadRequest(new { message = rangeResult.Error });
        var range = rangeResult.Range!;

        var interactions = await _context.ButtonClicks.AsNoTracking()
            .Where(c => AgencyButtonTypes.Contains(c.ButtonType))
            .Where(c => c.ClickedAt >= range.StartUtc && c.ClickedAt < range.EndUtc)
            .ToListAsync();
        var agencyIds = interactions.Where(c => c.ItemId.HasValue).Select(c => c.ItemId!.Value).Distinct().ToList();
        var agencyNames = await _context.Agencies.AsNoTracking().Where(a => agencyIds.Contains(a.Id))
            .Select(a => new { a.Id, a.Name, a.Slug }).ToDictionaryAsync(a => a.Id);

        var byAgency = interactions.Where(c => c.ItemId.HasValue).GroupBy(c => c.ItemId!.Value)
            .Select(g =>
            {
                agencyNames.TryGetValue(g.Key, out var agency);
                return new
                {
                    agencyId = g.Key,
                    agencyName = agency?.Name ?? $"Agency #{g.Key}",
                    agencySlug = agency?.Slug,
                    pageViews = g.Count(c => c.ButtonType == "agency_view"),
                    uniqueVisitors = CountUnique(g),
                    bannerClicks = g.Count(c => c.ButtonType == "agency_banner_click"),
                    contactClicks = g.Count(c => AgencyLeadTypes.Contains(c.ButtonType)),
                    contactPanelOpens = g.Count(c => c.ButtonType == "agency_contact_panel"),
                    profileClicks = g.Count(c => c.ButtonType == "agency_profile_click"),
                    contentClicks = g.Count(c => c.ButtonType == "agency_content_click"),
                    totalInteractions = g.Count()
                };
            }).OrderByDescending(x => x.totalInteractions).ToList();
        var topDetails = interactions.Where(c => c.ItemId.HasValue && !string.IsNullOrWhiteSpace(c.ItemLabel))
            .GroupBy(c => new { c.ButtonType, c.ItemId, c.ItemLabel })
            .Select(g => new { g.Key.ButtonType, g.Key.ItemId, g.Key.ItemLabel, Count = g.Count(), UniqueVisitors = CountUnique(g) })
            .OrderByDescending(x => x.Count).Take(30).ToList();

        return Ok(new
        {
            period = new { dateFrom = range.FromLocal, dateTo = range.ToLocal },
            totals = new
            {
                pageViews = interactions.Count(c => c.ButtonType == "agency_view"),
                uniqueVisitors = CountUnique(interactions),
                bannerClicks = interactions.Count(c => c.ButtonType == "agency_banner_click"),
                contactClicks = interactions.Count(c => AgencyLeadTypes.Contains(c.ButtonType)),
                contactPanelOpens = interactions.Count(c => c.ButtonType == "agency_contact_panel"),
                profileClicks = interactions.Count(c => c.ButtonType == "agency_profile_click"),
                contentClicks = interactions.Count(c => c.ButtonType == "agency_content_click"),
                totalInteractions = interactions.Count
            },
            byAgency,
            topDetails
        });
    }

    [HttpGet("articles")]
    public async Task<IActionResult> GetArticleAnalytics(
        [FromQuery] DateTime? dateFrom,
        [FromQuery] DateTime? dateTo,
        [FromQuery] string sortBy = "views",
        [FromQuery] int limit = 100)
    {
        var rangeResult = ResolveRange(dateFrom, dateTo);
        if (rangeResult.Error != null) return BadRequest(new { message = rangeResult.Error });
        var range = rangeResult.Range!;
        limit = Math.Clamp(limit, 1, 250);

        var viewStats = await _context.ArticleViews.AsNoTracking()
            .Where(v => v.ViewedAt >= range.StartUtc && v.ViewedAt < range.EndUtc)
            .GroupBy(v => v.ArticleId)
            .Select(g => new
            {
                ArticleId = g.Key,
                Views = g.Count(),
                UniqueVisitors = g.Select(v => new
                {
                    v.UserId,
                    IpAddress = v.UserId.HasValue ? null : v.IpAddress,
                    UserAgent = v.UserId.HasValue ? null : v.UserAgent
                }).Distinct().Count()
            }).ToDictionaryAsync(x => x.ArticleId);

        var articles = await _context.Articles.AsNoTracking()
            .Where(a => !a.IsDeleted && a.Status == (int)AkordishKeit.Models.Enum.ArticleStatus.Published)
            .Select(a => new
            {
                a.Id,
                a.Title,
                a.Slug,
                a.FeaturedImageUrl,
                a.ContentType,
                TotalViewCount = a.ViewCount,
                a.LikeCount
            }).ToListAsync();
        var articleIds = articles.Select(a => a.Id).ToList();
        var feedback = await _context.ArticleFeedbacks.AsNoTracking().Where(f => articleIds.Contains(f.ArticleId))
            .GroupBy(f => f.ArticleId)
            .Select(g => new
            {
                ArticleId = g.Key,
                Yes = g.Count(f => f.IsPositive),
                No = g.Count(f => !f.IsPositive)
            }).ToDictionaryAsync(x => x.ArticleId);

        var rows = articles.Select(a =>
        {
            viewStats.TryGetValue(a.Id, out var stats);
            feedback.TryGetValue(a.Id, out var votes);
            var yes = votes?.Yes ?? 0;
            var no = votes?.No ?? 0;
            var totalFeedback = yes + no;
            return new
            {
                a.Id,
                a.Title,
                a.Slug,
                a.FeaturedImageUrl,
                a.ContentType,
                viewCount = stats?.Views ?? 0,
                uniqueVisitors = stats?.UniqueVisitors ?? 0,
                a.TotalViewCount,
                a.LikeCount,
                feedbackYes = yes,
                feedbackNo = no,
                feedbackTotal = totalFeedback,
                yesPct = totalFeedback > 0 ? (int)Math.Round((double)yes / totalFeedback * 100) : 0
            };
        });

        rows = sortBy switch
        {
            "likes" => rows.OrderByDescending(x => x.LikeCount).ThenByDescending(x => x.viewCount),
            "feedback" => rows.OrderByDescending(x => x.feedbackTotal).ThenByDescending(x => x.viewCount),
            _ => rows.OrderByDescending(x => x.viewCount).ThenByDescending(x => x.uniqueVisitors)
        };

        return Ok(rows.Take(limit));
    }

    private (int? UserId, string? IpAddress, string UserAgent) GetRequestIdentity() =>
        (GetUserId(), HttpContext.Connection.RemoteIpAddress?.ToString(), AnalyticsIdentity.GetVisitorKey(Request));

    private int? GetUserId()
    {
        if (User.Identity?.IsAuthenticated != true) return null;
        var claim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
        return claim != null && int.TryParse(claim.Value, out var id) ? id : null;
    }

    private static (AnalyticsRange? Range, string? Error) ResolveRange(DateTime? dateFrom, DateTime? dateTo)
    {
        var timeZone = GetIsraelTimeZone();
        var today = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, timeZone).Date;
        var from = dateFrom?.Date ?? today.AddDays(-29);
        var to = dateTo?.Date ?? today;
        if (from > to) return (null, "dateFrom must be before or equal to dateTo");
        var days = (to - from).Days + 1;
        if (days > 36525) return (null, "Date range is too large");
        var startUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(from, DateTimeKind.Unspecified), timeZone);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(to.AddDays(1), DateTimeKind.Unspecified), timeZone);
        var previousStartUtc = TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(from.AddDays(-days), DateTimeKind.Unspecified), timeZone);
        return (new AnalyticsRange(from, to, startUtc, endUtc, previousStartUtc, days), null);
    }

    private static TimeZoneInfo GetIsraelTimeZone()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Israel Standard Time"); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById("Asia/Jerusalem"); }
    }

    private static Dictionary<DateTime, int> ToBuckets(IEnumerable<DailyCount> rows, bool monthly) =>
        rows.GroupBy(x => monthly ? new DateTime(x.Date.Year, x.Date.Month, 1) : x.Date.Date)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Count));


    private static IEnumerable<DateTime> EnumerateMonths(DateTime from, DateTime to)
    {
        for (var current = new DateTime(from.Year, from.Month, 1); current <= to; current = current.AddMonths(1))
            yield return current;
    }

    private static int CountUnique(IEnumerable<ButtonClick> rows) => rows
        .Select(x => x.UserId.HasValue
            ? $"u:{x.UserId.Value}"
            : $"g:{x.IpAddress ?? "unknown"}|{x.UserAgent ?? "unknown"}")
        .Distinct(StringComparer.Ordinal).Count();

    private static string NormalizePagePath(string? value)
    {
        var path = string.IsNullOrWhiteSpace(value) ? "/" : value.Trim();
        var queryIndex = path.IndexOfAny(['?', '#']);
        if (queryIndex >= 0) path = path[..queryIndex];
        if (!path.StartsWith('/')) path = $"/{path}";
        return Truncate(path, 200) ?? "/";
    }

    private static string NormalizeDeviceType(string? value) => value?.Trim().ToLowerInvariant() switch
    {
        "desktop" => "desktop",
        "tablet" => "tablet",
        "mobile" => "mobile",
        _ => "unknown"
    };

    private static string? Truncate(string? value, int maxLength) =>
        value?.Length > maxLength ? value[..maxLength] : value;

    private sealed record AnalyticsRange(DateTime FromLocal, DateTime ToLocal, DateTime StartUtc, DateTime EndUtc, DateTime PreviousStartUtc, int Days);
    private sealed record DailyCount(DateTime Date, int Count);
}

public class TrackEventViewDto
{
    public int? EventId { get; set; }
}

public class TrackButtonClickDto
{
    public string? ButtonType { get; set; }
    public int? ItemId { get; set; }
    public string? ItemLabel { get; set; }
}

public class TrackAdBlockCheckDto
{
    public bool Detected { get; set; }
    public string? PagePath { get; set; }
    public string? DeviceType { get; set; }
}

public class TrackPageViewDto
{
    public string? PagePath { get; set; }
    public string? DeviceType { get; set; }
}
