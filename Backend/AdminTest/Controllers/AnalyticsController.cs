using AkordishKeit.Data;
using AkordishKeit.Models.Entities;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AnalyticsController : ControllerBase
    {
        private readonly AkordishKeitDbContext _context;

        public AnalyticsController(AkordishKeitDbContext context)
        {
            _context = context;
        }

        // POST: api/analytics/event-view
        // body: { "eventId": 5 }  — או null עבור דף הרשימה
        [HttpPost("event-view")]
        public async Task<IActionResult> TrackEventView([FromBody] TrackEventViewDto dto)
        {
            var userId = GetUserId();
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var ua = Request.Headers["User-Agent"].ToString();
            var cutoff = DateTime.UtcNow.AddHours(-24);

            bool isUnique;
            if (userId.HasValue)
            {
                isUnique = !await _context.EventViews.AnyAsync(v =>
                    v.EventId == dto.EventId && v.UserId == userId && v.ViewedAt >= cutoff);
            }
            else if (!string.IsNullOrEmpty(ip))
            {
                isUnique = !await _context.EventViews.AnyAsync(v =>
                    v.EventId == dto.EventId && v.IpAddress == ip && v.UserAgent == ua && v.ViewedAt >= cutoff);
            }
            else
            {
                isUnique = true;
            }

            if (isUnique)
            {
                _context.EventViews.Add(new EventView
                {
                    EventId = dto.EventId,
                    UserId = userId,
                    IpAddress = ip,
                    UserAgent = ua,
                    ViewedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }

            return Ok(new { tracked = isUnique });
        }

        // POST: api/analytics/button-click
        // body: { "buttonType": "ticket", "itemId": 5, "itemLabel": "שם ההופעה" }
        [HttpPost("button-click")]
        public async Task<IActionResult> TrackButtonClick([FromBody] TrackButtonClickDto dto)
        {
            var userId = GetUserId();
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
            var ua = Request.Headers["User-Agent"].ToString();

            _context.ButtonClicks.Add(new ButtonClick
            {
                ButtonType = dto.ButtonType,
                ItemId = dto.ItemId,
                ItemLabel = dto.ItemLabel,
                UserId = userId,
                IpAddress = ip,
                UserAgent = ua,
                ClickedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();

            return Ok(new { tracked = true });
        }

        // GET: api/analytics/dashboard
        [HttpGet("dashboard")]
        public async Task<IActionResult> GetDashboard()
        {
            var now = DateTime.UtcNow;
            var last30Days = now.AddDays(-30);
            var last7Days = now.AddDays(-7);

            // ─── צפיות בדף הופעות (רשימה) ───────────────────────────────────
            var eventsListViewsTotal = await _context.EventViews
                .CountAsync(v => v.EventId == null);
            var eventsListViewsLast30 = await _context.EventViews
                .CountAsync(v => v.EventId == null && v.ViewedAt >= last30Days);
            var eventsListViewsUniqueLast30 = await _context.EventViews
                .Where(v => v.EventId == null && v.ViewedAt >= last30Days)
                .GroupBy(v => new { v.UserId, v.IpAddress, v.UserAgent })
                .CountAsync();

            // ─── צפיות בהופעות בודדות ───────────────────────────────────────
            var topEvents = await _context.EventViews
                .Where(v => v.EventId != null)
                .GroupBy(v => v.EventId)
                .Select(g => new
                {
                    EventId = g.Key,
                    TotalViews = g.Count(),
                    ViewsLast30 = g.Count(v => v.ViewedAt >= last30Days)
                })
                .OrderByDescending(x => x.TotalViews)
                .Take(10)
                .ToListAsync();

            // צירוף שמות הופעות
            var eventIds = topEvents
                .Where(e => e.EventId.HasValue)
                .Select(e => e.EventId!.Value)
                .ToList();
            var eventNames = await _context.Events
                .Where(e => eventIds.Contains(e.Id))
                .Select(e => new { e.Id, e.Name })
                .ToDictionaryAsync(e => e.Id, e => e.Name);

            var topEventsWithNames = topEvents.Select(e => new
            {
                e.EventId,
                EventName = e.EventId.HasValue && eventNames.ContainsKey(e.EventId.Value)
                    ? eventNames[e.EventId.Value] : "—",
                e.TotalViews,
                e.ViewsLast30
            });

            // ─── קליקים על לחצנים ────────────────────────────────────────────
            var ticketClicksTotal = await _context.ButtonClicks
                .CountAsync(c => c.ButtonType == "ticket");
            var ticketClicksLast30 = await _context.ButtonClicks
                .CountAsync(c => c.ButtonType == "ticket" && c.ClickedAt >= last30Days);

            var contactClicksTotal = await _context.ButtonClicks
                .CountAsync(c => c.ButtonType == "contact");
            var contactClicksLast30 = await _context.ButtonClicks
                .CountAsync(c => c.ButtonType == "contact" && c.ClickedAt >= last30Days);

            var notificationLinkClicksTotal = await _context.ButtonClicks
                .CountAsync(c => c.ButtonType == "notification_link");
            var notificationLinkClicksLast30 = await _context.ButtonClicks
                .CountAsync(c => c.ButtonType == "notification_link" && c.ClickedAt >= last30Days);

            // ─── Top טיקט קליקים לפי הופעה ──────────────────────────────────
            var topTicketEvents = await _context.ButtonClicks
                .Where(c => c.ButtonType == "ticket" && c.ItemId != null)
                .GroupBy(c => new { c.ItemId, c.ItemLabel })
                .Select(g => new
                {
                    g.Key.ItemId,
                    g.Key.ItemLabel,
                    TotalClicks = g.Count(),
                    ClicksLast30 = g.Count(c => c.ClickedAt >= last30Days)
                })
                .OrderByDescending(x => x.TotalClicks)
                .Take(10)
                .ToListAsync();

            // ─── פרסומות (קיים במערכת) ────────────────────────────────────────
            var adsTotalViews = await _context.AdCampaigns.SumAsync(c => (long)c.ViewCount);
            var adsTotalClicks = await _context.AdCampaigns.SumAsync(c => (long)c.ClickCount);
            var adsActiveCampaigns = await _context.AdCampaigns.CountAsync(c =>
                c.Status == Models.Enums.AdCampaignStatus.Active &&
                c.StartDate <= now && c.EndDate >= now);

            var topAdCampaigns = await _context.AdCampaigns
                .Include(c => c.Client)
                .OrderByDescending(c => c.ViewCount)
                .Take(10)
                .Select(c => new
                {
                    c.Id,
                    c.Name,
                    ClientName = c.Client.BusinessName,
                    c.ViewCount,
                    c.ClickCount,
                    Ctr = c.ViewCount > 0 ? Math.Round((double)c.ClickCount / c.ViewCount * 100, 1) : 0
                })
                .ToListAsync();

            // ─── כתבות (קיים במערכת) ─────────────────────────────────────────
            var articlesViewsTotal = await _context.ArticleViews.CountAsync();
            var articlesViewsLast30 = await _context.ArticleViews
                .CountAsync(v => v.ViewedAt >= last30Days);

            return Ok(new
            {
                events = new
                {
                    listPageViews = new
                    {
                        total = eventsListViewsTotal,
                        last30Days = eventsListViewsLast30,
                        uniqueLast30Days = eventsListViewsUniqueLast30
                    },
                    topEvents = topEventsWithNames
                },
                buttons = new
                {
                    ticketClicks = new { total = ticketClicksTotal, last30Days = ticketClicksLast30 },
                    contactClicks = new { total = contactClicksTotal, last30Days = contactClicksLast30 },
                    notificationLinkClicks = new { total = notificationLinkClicksTotal, last30Days = notificationLinkClicksLast30 },
                    topTicketEvents
                },
                ads = new
                {
                    totalViews = adsTotalViews,
                    totalClicks = adsTotalClicks,
                    activeCampaigns = adsActiveCampaigns,
                    topCampaigns = topAdCampaigns
                },
                articles = new
                {
                    totalViews = articlesViewsTotal,
                    viewsLast30Days = articlesViewsLast30
                }
            });
        }

        private int? GetUserId()
        {
            if (User.Identity?.IsAuthenticated != true) return null;
            var claim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
            return claim != null && int.TryParse(claim.Value, out var id) ? id : null;
        }
    }

    public class TrackEventViewDto
    {
        public int? EventId { get; set; }
    }

    public class TrackButtonClickDto
    {
        public string ButtonType { get; set; } = string.Empty;
        public int? ItemId { get; set; }
        public string? ItemLabel { get; set; }
    }
}
