using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enums;
using AkordishKeit.Extensions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AdCampaignsController : ControllerBase
    {
        private readonly AkordishKeitDbContext _context;

        public AdCampaignsController(AkordishKeitDbContext context)
        {
            _context = context;
        }

        // GET: api/AdCampaigns
        [HttpGet]
        public async Task<ActionResult<PagedResult<AdCampaignDto>>> GetAdCampaigns(
            [FromQuery] string? status = null,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10)
        {
            var now = DateTime.UtcNow;
            var query = _context.AdCampaigns.AsQueryable();

            // Filter by status if provided
            if (!string.IsNullOrEmpty(status) && Enum.TryParse<AdCampaignStatus>(status, true, out var statusEnum))
            {
                query = query.Where(c => c.Status == statusEnum);
            }

            var campaignsQuery = query
                .Include(c => c.AdSpot)
                .Include(c => c.Client)
                .Select(c => new AdCampaignDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    AdSpotId = c.AdSpotId,
                    AdSpotName = c.AdSpot.Name,
                    ClientId = c.ClientId,
                    ClientName = c.Client.BusinessName,
                    KnownUrl = c.KnownUrl,
                    MediaUrl = c.MediaUrl,
                    MobileMediaUrl = c.MobileMediaUrl,
                    Priority = c.Priority,
                    Status = c.Status.ToString(),
                    StartDate = c.StartDate,
                    EndDate = c.EndDate,
                    Budget = c.Budget,
                    ViewCount = c.ViewCount,
                    ClickCount = c.ClickCount,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt,
                    DaysRemaining = c.EndDate > now ? (int)(c.EndDate - now).TotalDays : 0,
                    ClickThroughRate = c.ViewCount > 0 ? (double)c.ClickCount / c.ViewCount * 100 : 0
                })
                .OrderByDescending(c => c.CreatedAt);

            var pagedResult = await campaignsQuery.ToPagedResultAsync(pageNumber, pageSize);

            return Ok(pagedResult);
        }

        // GET: api/AdCampaigns/active
        [HttpGet("active")]
        public async Task<ActionResult<IEnumerable<AdCampaignDto>>> GetActiveCampaigns()
        {
            var now = DateTime.UtcNow;

            var campaigns = await _context.AdCampaigns
                .Where(c => c.Status == AdCampaignStatus.Active && c.StartDate <= now && c.EndDate >= now)
                .Include(c => c.AdSpot)
                .Include(c => c.Client)
                .Select(c => new AdCampaignDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    AdSpotId = c.AdSpotId,
                    AdSpotName = c.AdSpot.Name,
                    ClientId = c.ClientId,
                    ClientName = c.Client.BusinessName,
                    KnownUrl = c.KnownUrl,
                    MediaUrl = c.MediaUrl,
                    MobileMediaUrl = c.MobileMediaUrl,
                    Priority = c.Priority,
                    Status = c.Status.ToString(),
                    StartDate = c.StartDate,
                    EndDate = c.EndDate,
                    Budget = c.Budget,
                    ViewCount = c.ViewCount,
                    ClickCount = c.ClickCount,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt,
                    DaysRemaining = (int)(c.EndDate - now).TotalDays,
                    ClickThroughRate = c.ViewCount > 0 ? (double)c.ClickCount / c.ViewCount * 100 : 0
                })
                .OrderByDescending(c => c.Priority)
                .ToListAsync();

            return Ok(campaigns);
        }

        // GET: api/AdCampaigns/5
        [HttpGet("{id}")]
        public async Task<ActionResult<AdCampaignDto>> GetAdCampaign(int id)
        {
            var now = DateTime.UtcNow;

            var campaign = await _context.AdCampaigns
                .Where(c => c.Id == id)
                .Include(c => c.AdSpot)
                .Include(c => c.Client)
                .Select(c => new AdCampaignDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    AdSpotId = c.AdSpotId,
                    AdSpotName = c.AdSpot.Name,
                    ClientId = c.ClientId,
                    ClientName = c.Client.BusinessName,
                    KnownUrl = c.KnownUrl,
                    MediaUrl = c.MediaUrl,
                    MobileMediaUrl = c.MobileMediaUrl,
                    Priority = c.Priority,
                    Status = c.Status.ToString(),
                    StartDate = c.StartDate,
                    EndDate = c.EndDate,
                    Budget = c.Budget,
                    ViewCount = c.ViewCount,
                    ClickCount = c.ClickCount,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt,
                    DaysRemaining = c.EndDate > now ? (int)(c.EndDate - now).TotalDays : 0,
                    ClickThroughRate = c.ViewCount > 0 ? (double)c.ClickCount / c.ViewCount * 100 : 0
                })
                .FirstOrDefaultAsync();

            if (campaign == null)
            {
                return NotFound();
            }

            return Ok(campaign);
        }

        // GET: api/AdCampaigns/spot/5
        [HttpGet("spot/{spotId}")]
        public async Task<ActionResult<IEnumerable<AdCampaignDto>>> GetCampaignsBySpot(int spotId)
        {
            var now = DateTime.UtcNow;

            var campaigns = await _context.AdCampaigns
                .Where(c => c.AdSpotId == spotId)
                .Include(c => c.AdSpot)
                .Include(c => c.Client)
                .Select(c => new AdCampaignDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    AdSpotId = c.AdSpotId,
                    AdSpotName = c.AdSpot.Name,
                    ClientId = c.ClientId,
                    ClientName = c.Client.BusinessName,
                    KnownUrl = c.KnownUrl,
                    MediaUrl = c.MediaUrl,
                    MobileMediaUrl = c.MobileMediaUrl,
                    Priority = c.Priority,
                    Status = c.Status.ToString(),
                    StartDate = c.StartDate,
                    EndDate = c.EndDate,
                    Budget = c.Budget,
                    ViewCount = c.ViewCount,
                    ClickCount = c.ClickCount,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt,
                    DaysRemaining = c.EndDate > now ? (int)(c.EndDate - now).TotalDays : 0,
                    ClickThroughRate = c.ViewCount > 0 ? (double)c.ClickCount / c.ViewCount * 100 : 0
                })
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();

            return Ok(campaigns);
        }

        // GET: api/AdCampaigns/client/5
        [HttpGet("client/{clientId}")]
        public async Task<ActionResult<IEnumerable<AdCampaignDto>>> GetCampaignsByClient(int clientId)
        {
            var now = DateTime.UtcNow;

            var campaigns = await _context.AdCampaigns
                .Where(c => c.ClientId == clientId)
                .Include(c => c.AdSpot)
                .Include(c => c.Client)
                .Select(c => new AdCampaignDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    AdSpotId = c.AdSpotId,
                    AdSpotName = c.AdSpot.Name,
                    ClientId = c.ClientId,
                    ClientName = c.Client.BusinessName,
                    KnownUrl = c.KnownUrl,
                    MediaUrl = c.MediaUrl,
                    MobileMediaUrl = c.MobileMediaUrl,
                    Priority = c.Priority,
                    Status = c.Status.ToString(),
                    StartDate = c.StartDate,
                    EndDate = c.EndDate,
                    Budget = c.Budget,
                    ViewCount = c.ViewCount,
                    ClickCount = c.ClickCount,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt,
                    DaysRemaining = c.EndDate > now ? (int)(c.EndDate - now).TotalDays : 0,
                    ClickThroughRate = c.ViewCount > 0 ? (double)c.ClickCount / c.ViewCount * 100 : 0
                })
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();

            return Ok(campaigns);
        }

        // GET: api/AdCampaigns/stats
        [HttpGet("stats")]
        public async Task<ActionResult<AdCampaignStatsDto>> GetStats()
        {
            var now = DateTime.UtcNow;

            var stats = new AdCampaignStatsDto
            {
                TotalCampaigns = await _context.AdCampaigns.CountAsync(),
                ActiveCampaigns = await _context.AdCampaigns.CountAsync(c =>
                    c.Status == AdCampaignStatus.Active && c.StartDate <= now && c.EndDate >= now),
                TotalRevenue = await _context.AdCampaigns.SumAsync(c => c.Budget),
                TotalClicks = await _context.AdCampaigns.SumAsync(c => c.ClickCount),
                TotalViews = await _context.AdCampaigns.SumAsync(c => c.ViewCount)
            };

            var totalViews = await _context.AdCampaigns.SumAsync(c => c.ViewCount);
            stats.AverageClickThroughRate = totalViews > 0
                ? (double)stats.TotalClicks / totalViews * 100
                : 0;

            return Ok(stats);
        }

        // GET: api/AdCampaigns/CheckAvailability
        [HttpGet("CheckAvailability")]
        public async Task<ActionResult<object>> CheckAdSpotAvailability(
            [FromQuery] int adSpotId,
            [FromQuery] DateTime startDate,
            [FromQuery] DateTime endDate,
            [FromQuery] int priority,
            [FromQuery] int? excludeCampaignId = null)
        {
            // Check for overlapping campaigns on the same spot with same priority
            var overlappingCampaigns = await _context.AdCampaigns
                .Where(c =>
                    c.AdSpotId == adSpotId &&
                    c.Status == AdCampaignStatus.Active &&
                    (excludeCampaignId == null || c.Id != excludeCampaignId) &&
                    ((startDate >= c.StartDate && startDate <= c.EndDate) ||
                     (endDate >= c.StartDate && endDate <= c.EndDate) ||
                     (startDate <= c.StartDate && endDate >= c.EndDate)))
                .Include(c => c.Client)
                .Select(c => new
                {
                    c.Id,
                    c.Name,
                    ClientName = c.Client.BusinessName,
                    c.StartDate,
                    c.EndDate,
                    c.Priority
                })
                .ToListAsync();

            // Check if the specific priority is taken
            var priorityTaken = overlappingCampaigns.Any(c => c.Priority == priority);

            // Check if we've reached the maximum of 5 campaigns in this date range
            var totalCampaignsInRange = overlappingCampaigns.Count;
            var maxCampaignsReached = totalCampaignsInRange >= 5;

            // Get list of taken priorities
            var takenPriorities = overlappingCampaigns.Select(c => c.Priority).Distinct().OrderBy(p => p).ToList();

            // Get available priorities (1-5 minus taken ones)
            var availablePriorities = Enumerable.Range(1, 5).Except(takenPriorities).ToList();

            return Ok(new
            {
                isAvailable = !priorityTaken && !maxCampaignsReached,
                priorityTaken,
                maxCampaignsReached,
                totalCampaignsInRange,
                takenPriorities,
                availablePriorities,
                overlappingCampaigns
            });
        }

        // POST: api/AdCampaigns
        [HttpPost]
        public async Task<ActionResult<AdCampaignDto>> CreateAdCampaign(CreateAdCampaignDto dto)
        {
            // Validate AdSpot exists
            var adSpot = await _context.AdSpots.FindAsync(dto.AdSpotId);
            if (adSpot == null)
            {
                return BadRequest(new { message = "Ad Spot not found" });
            }

            // Validate Client exists
            var client = await _context.Clients.FindAsync(dto.ClientId);
            if (client == null)
            {
                return BadRequest(new { message = "Client not found" });
            }

            // Check for overlapping campaigns on the same spot
            var overlappingCampaigns = await _context.AdCampaigns
                .Where(c =>
                    c.AdSpotId == dto.AdSpotId &&
                    c.Status == AdCampaignStatus.Active &&
                    ((dto.StartDate >= c.StartDate && dto.StartDate <= c.EndDate) ||
                     (dto.EndDate >= c.StartDate && dto.EndDate <= c.EndDate) ||
                     (dto.StartDate <= c.StartDate && dto.EndDate >= c.EndDate)))
                .ToListAsync();

            // Check if maximum 5 campaigns reached
            if (overlappingCampaigns.Count >= 5)
            {
                return BadRequest(new { message = "Maximum of 5 campaigns allowed for this spot in the selected date range" });
            }

            // Check if priority is already taken
            var priorityTaken = overlappingCampaigns.Any(c => c.Priority == dto.Priority);
            if (priorityTaken)
            {
                return BadRequest(new { message = $"Priority {dto.Priority} is already taken by another campaign in this date range" });
            }

            var campaign = new AdCampaign
            {
                Name = dto.Name,
                AdSpotId = dto.AdSpotId,
                ClientId = dto.ClientId,
                KnownUrl = dto.KnownUrl,
                MediaUrl = dto.MediaUrl,
                MobileMediaUrl = dto.MobileMediaUrl,
                Priority = dto.Priority,
                Status = dto.Status,
                StartDate = dto.StartDate,
                EndDate = dto.EndDate,
                Budget = dto.Budget,
                ViewCount = 0,
                ClickCount = 0,
                CreatedAt = DateTime.UtcNow
            };

            _context.AdCampaigns.Add(campaign);
            await _context.SaveChangesAsync();

            // Reload with navigation properties
            await _context.Entry(campaign).Reference(c => c.AdSpot).LoadAsync();
            await _context.Entry(campaign).Reference(c => c.Client).LoadAsync();

            var now = DateTime.UtcNow;
            var campaignDto = new AdCampaignDto
            {
                Id = campaign.Id,
                Name = campaign.Name,
                AdSpotId = campaign.AdSpotId,
                AdSpotName = campaign.AdSpot.Name,
                ClientId = campaign.ClientId,
                ClientName = campaign.Client.BusinessName,
                KnownUrl = campaign.KnownUrl,
                MediaUrl = campaign.MediaUrl,
                MobileMediaUrl = campaign.MobileMediaUrl,
                Priority = campaign.Priority,
                Status = campaign.Status.ToString(),
                StartDate = campaign.StartDate,
                EndDate = campaign.EndDate,
                Budget = campaign.Budget,
                ViewCount = campaign.ViewCount,
                ClickCount = campaign.ClickCount,
                CreatedAt = campaign.CreatedAt,
                DaysRemaining = campaign.EndDate > now ? (int)(campaign.EndDate - now).TotalDays : 0,
                ClickThroughRate = 0
            };

            return CreatedAtAction(nameof(GetAdCampaign), new { id = campaign.Id }, campaignDto);
        }

        // PUT: api/AdCampaigns/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateAdCampaign(int id, UpdateAdCampaignDto dto)
        {
            var campaign = await _context.AdCampaigns.FindAsync(id);

            if (campaign == null)
            {
                return NotFound();
            }

            // Validate AdSpot exists
            if (!await _context.AdSpots.AnyAsync(s => s.Id == dto.AdSpotId))
            {
                return BadRequest(new { message = "Ad Spot not found" });
            }

            // Validate Client exists
            if (!await _context.Clients.AnyAsync(c => c.Id == dto.ClientId))
            {
                return BadRequest(new { message = "Client not found" });
            }

            // Check for overlapping campaigns (excluding current one)
            var overlappingCampaigns = await _context.AdCampaigns
                .Where(c =>
                    c.Id != id &&
                    c.AdSpotId == dto.AdSpotId &&
                    c.Status == AdCampaignStatus.Active &&
                    ((dto.StartDate >= c.StartDate && dto.StartDate <= c.EndDate) ||
                     (dto.EndDate >= c.StartDate && dto.EndDate <= c.EndDate) ||
                     (dto.StartDate <= c.StartDate && dto.EndDate >= c.EndDate)))
                .ToListAsync();

            // Check if maximum 5 campaigns reached
            if (overlappingCampaigns.Count >= 5)
            {
                return BadRequest(new { message = "Maximum of 5 campaigns allowed for this spot in the selected date range" });
            }

            // Check if priority is already taken
            var priorityTaken = overlappingCampaigns.Any(c => c.Priority == dto.Priority);
            if (priorityTaken)
            {
                return BadRequest(new { message = $"Priority {dto.Priority} is already taken by another campaign in this date range" });
            }

            campaign.Name = dto.Name;
            campaign.AdSpotId = dto.AdSpotId;
            campaign.ClientId = dto.ClientId;
            campaign.KnownUrl = dto.KnownUrl;
            campaign.MediaUrl = dto.MediaUrl;
            campaign.MobileMediaUrl = dto.MobileMediaUrl;
            campaign.Priority = dto.Priority;
            campaign.Status = dto.Status;
            campaign.StartDate = dto.StartDate;
            campaign.EndDate = dto.EndDate;
            campaign.Budget = dto.Budget;
            campaign.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/AdCampaigns/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAdCampaign(int id)
        {
            var campaign = await _context.AdCampaigns.FindAsync(id);

            if (campaign == null)
            {
                return NotFound();
            }

            _context.AdCampaigns.Remove(campaign);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // POST: api/AdCampaigns/5/track-view
        [HttpPost("{id}/track-view")]
        public async Task<IActionResult> TrackView(int id)
        {
            var campaign = await _context.AdCampaigns.FindAsync(id);

            if (campaign == null)
            {
                return NotFound();
            }

            // Get user info if authenticated
            int? userId = null;
            if (User.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out var parsedUserId))
                {
                    userId = parsedUserId;
                }
            }

            // Get IP address
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

            // Get User Agent
            var userAgent = Request.Headers["User-Agent"].ToString();

            // Get Referrer
            var referrer = Request.Headers["Referer"].ToString();

            // Check if this is a unique view (within last 24 hours)
            var cutoffTime = DateTime.UtcNow.AddHours(-24);
            bool isUniqueView = false;

            if (userId.HasValue)
            {
                // For logged-in users: check by UserId
                isUniqueView = !await _context.AdCampaignViews
                    .AnyAsync(av => av.AdCampaignId == id &&
                                   av.UserId == userId &&
                                   av.ViewedAt >= cutoffTime);
            }
            else if (!string.IsNullOrEmpty(ipAddress))
            {
                // For guest users: check by IP + UserAgent
                isUniqueView = !await _context.AdCampaignViews
                    .AnyAsync(av => av.AdCampaignId == id &&
                                   av.IpAddress == ipAddress &&
                                   av.UserAgent == userAgent &&
                                   av.ViewedAt >= cutoffTime);
            }
            else
            {
                // No tracking info available, count as unique
                isUniqueView = true;
            }

            // Only increment if this is a unique view
            if (isUniqueView)
            {
                // Record the view
                var adView = new AdCampaignView
                {
                    AdCampaignId = id,
                    UserId = userId,
                    IpAddress = ipAddress,
                    UserAgent = userAgent,
                    Referrer = referrer,
                    ViewedAt = DateTime.UtcNow
                };

                _context.AdCampaignViews.Add(adView);
                campaign.ViewCount++;
                await _context.SaveChangesAsync();
            }

            return Ok(new { viewCount = campaign.ViewCount });
        }

        // POST: api/AdCampaigns/5/track-click
        [HttpPost("{id}/track-click")]
        public async Task<IActionResult> TrackClick(int id)
        {
            var campaign = await _context.AdCampaigns.FindAsync(id);

            if (campaign == null)
            {
                return NotFound();
            }

            // Get user info if authenticated
            int? userId = null;
            if (User.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out var parsedUserId))
                {
                    userId = parsedUserId;
                }
            }

            // Get IP address
            var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();

            // Get User Agent
            var userAgent = Request.Headers["User-Agent"].ToString();

            // Get Referrer
            var referrer = Request.Headers["Referer"].ToString();

            // Check if this is a unique click (within last 24 hours)
            var cutoffTime = DateTime.UtcNow.AddHours(-24);
            bool isUniqueClick = false;

            if (userId.HasValue)
            {
                // For logged-in users: check by UserId
                isUniqueClick = !await _context.AdCampaignClicks
                    .AnyAsync(ac => ac.AdCampaignId == id &&
                                   ac.UserId == userId &&
                                   ac.ClickedAt >= cutoffTime);
            }
            else if (!string.IsNullOrEmpty(ipAddress))
            {
                // For guest users: check by IP + UserAgent
                isUniqueClick = !await _context.AdCampaignClicks
                    .AnyAsync(ac => ac.AdCampaignId == id &&
                                   ac.IpAddress == ipAddress &&
                                   ac.UserAgent == userAgent &&
                                   ac.ClickedAt >= cutoffTime);
            }
            else
            {
                // No tracking info available, count as unique
                isUniqueClick = true;
            }

            // Only increment if this is a unique click
            if (isUniqueClick)
            {
                // Record the click
                var adClick = new AdCampaignClick
                {
                    AdCampaignId = id,
                    UserId = userId,
                    IpAddress = ipAddress,
                    UserAgent = userAgent,
                    Referrer = referrer,
                    ClickedAt = DateTime.UtcNow
                };

                _context.AdCampaignClicks.Add(adClick);
                campaign.ClickCount++;
                await _context.SaveChangesAsync();
            }

            return Ok(new { clickCount = campaign.ClickCount });
        }

        // GET: api/AdCampaigns/Public/GetAd?spotTechnicalId=header-banner
        [HttpGet("Public/GetAd")]
        public async Task<ActionResult<object>> GetAdForSpot([FromQuery] string spotTechnicalId)
        {
            if (string.IsNullOrEmpty(spotTechnicalId))
            {
                return BadRequest(new { message = "Spot technical ID is required" });
            }

            var now = DateTime.UtcNow;

            // Find the spot
            var adSpot = await _context.AdSpots
                .FirstOrDefaultAsync(s => s.TechnicalId == spotTechnicalId && s.IsActive);

            if (adSpot == null)
            {
                return NotFound(new { message = "Ad spot not found or inactive" });
            }

            // Get all active campaigns for this spot in current date range, ordered by priority
            var campaigns = await _context.AdCampaigns
                .Where(c =>
                    c.AdSpotId == adSpot.Id &&
                    c.Status == AdCampaignStatus.Active &&
                    c.StartDate <= now &&
                    c.EndDate >= now)
                .Include(c => c.Client)
                .OrderBy(c => c.Priority) // Priority 1 is highest
                .Select(c => new
                {
                    c.Id,
                    c.Name,
                    c.MediaUrl,
                    c.MobileMediaUrl,
                    c.KnownUrl,
                    c.Priority,
                    ClientName = c.Client.BusinessName
                })
                .ToListAsync();

            if (!campaigns.Any())
            {
                return NotFound(new { message = "No active campaigns found for this spot" });
            }

            return Ok(new
            {
                spotId = adSpot.Id,
                spotName = adSpot.Name,
                spotTechnicalId = adSpot.TechnicalId,
                dimensions = adSpot.Dimensions,
                rotationIntervalMs = adSpot.RotationIntervalMs,
                campaigns = campaigns,
                totalCampaigns = campaigns.Count
            });
        }

        // GET: api/AdCampaigns/Public/GetAdByPriority?spotTechnicalId=header-banner&priority=1
        [HttpGet("Public/GetAdByPriority")]
        public async Task<ActionResult<object>> GetAdByPriority(
            [FromQuery] string spotTechnicalId,
            [FromQuery] int priority = 1)
        {
            if (string.IsNullOrEmpty(spotTechnicalId))
            {
                return BadRequest(new { message = "Spot technical ID is required" });
            }

            var now = DateTime.UtcNow;

            // Find the spot
            var adSpot = await _context.AdSpots
                .FirstOrDefaultAsync(s => s.TechnicalId == spotTechnicalId && s.IsActive);

            if (adSpot == null)
            {
                return NotFound(new { message = "Ad spot not found or inactive" });
            }

            // Get campaign with specific priority
            var campaign = await _context.AdCampaigns
                .Where(c =>
                    c.AdSpotId == adSpot.Id &&
                    c.Status == AdCampaignStatus.Active &&
                    c.StartDate <= now &&
                    c.EndDate >= now &&
                    c.Priority == priority)
                .Include(c => c.Client)
                .Select(c => new
                {
                    c.Id,
                    c.Name,
                    c.MediaUrl,
                    c.MobileMediaUrl,
                    c.KnownUrl,
                    c.Priority,
                    ClientName = c.Client.BusinessName
                })
                .FirstOrDefaultAsync();

            if (campaign == null)
            {
                return NotFound(new { message = $"No active campaign found with priority {priority} for this spot" });
            }

            return Ok(new
            {
                spotId = adSpot.Id,
                spotName = adSpot.Name,
                spotTechnicalId = adSpot.TechnicalId,
                dimensions = adSpot.Dimensions,
                rotationIntervalMs = adSpot.RotationIntervalMs,
                campaign = campaign
            });
        }
    }
}
