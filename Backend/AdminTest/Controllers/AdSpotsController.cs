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
    public class AdSpotsController : ControllerBase
    {
        private readonly AkordishKeitDbContext _context;

        public AdSpotsController(AkordishKeitDbContext context)
        {
            _context = context;
        }

        // GET: api/AdSpots
        [HttpGet]
        public async Task<ActionResult<PagedResult<AdSpotDto>>> GetAdSpots(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10)
        {
            var now = DateTime.UtcNow;

            var adSpotsQuery = _context.AdSpots
                .Select(spot => new AdSpotDto
                {
                    Id = spot.Id,
                    Name = spot.Name,
                    TechnicalId = spot.TechnicalId,
                    Dimensions = spot.Dimensions,
                    IsActive = spot.IsActive,
                    RotationIntervalMs = spot.RotationIntervalMs,
                    Description = spot.Description,
                    CreatedAt = spot.CreatedAt,
                    TotalCampaigns = spot.Campaigns.Count,
                    ActiveCampaigns = spot.Campaigns.Count(c => c.Status == AdCampaignStatus.Active && c.StartDate <= now && c.EndDate >= now),
                    TotalRevenue = spot.Campaigns.Sum(c => c.Budget),
                    Availability = spot.Campaigns.Any(c => c.Status == AdCampaignStatus.Active && c.StartDate <= now && c.EndDate >= now)
                        ? "Occupied"
                        : "Available",
                    NextAvailableDate = spot.Campaigns
                        .Where(c => c.Status == AdCampaignStatus.Active && c.EndDate >= now)
                        .OrderBy(c => c.EndDate)
                        .Select(c => (DateTime?)c.EndDate)
                        .FirstOrDefault()
                })
                .OrderByDescending(s => s.CreatedAt);

            var pagedResult = await adSpotsQuery.ToPagedResultAsync(pageNumber, pageSize);

            return Ok(pagedResult);
        }

        // GET: api/AdSpots/5
        [HttpGet("{id}")]
        public async Task<ActionResult<AdSpotDto>> GetAdSpot(int id)
        {
            var now = DateTime.UtcNow;

            var adSpot = await _context.AdSpots
                .Where(s => s.Id == id)
                .Select(spot => new AdSpotDto
                {
                    Id = spot.Id,
                    Name = spot.Name,
                    TechnicalId = spot.TechnicalId,
                    Dimensions = spot.Dimensions,
                    IsActive = spot.IsActive,
                    RotationIntervalMs = spot.RotationIntervalMs,
                    Description = spot.Description,
                    CreatedAt = spot.CreatedAt,
                    TotalCampaigns = spot.Campaigns.Count,
                    ActiveCampaigns = spot.Campaigns.Count(c => c.Status == AdCampaignStatus.Active && c.StartDate <= now && c.EndDate >= now),
                    TotalRevenue = spot.Campaigns.Sum(c => c.Budget),
                    Availability = spot.Campaigns.Any(c => c.Status == AdCampaignStatus.Active && c.StartDate <= now && c.EndDate >= now)
                        ? "Occupied"
                        : "Available",
                    NextAvailableDate = spot.Campaigns
                        .Where(c => c.Status == AdCampaignStatus.Active && c.EndDate >= now)
                        .OrderBy(c => c.EndDate)
                        .Select(c => (DateTime?)c.EndDate)
                        .FirstOrDefault()
                })
                .FirstOrDefaultAsync();

            if (adSpot == null)
            {
                return NotFound();
            }

            return Ok(adSpot);
        }

        // POST: api/AdSpots
        [HttpPost]
        public async Task<ActionResult<AdSpotDto>> CreateAdSpot(CreateAdSpotDto dto)
        {
            // Check if TechnicalId already exists
            if (await _context.AdSpots.AnyAsync(s => s.TechnicalId == dto.TechnicalId))
            {
                return BadRequest(new { message = "Technical ID already exists" });
            }

            var adSpot = new AdSpot
            {
                Name = dto.Name,
                TechnicalId = dto.TechnicalId,
                Dimensions = dto.Dimensions,
                RotationIntervalMs = dto.RotationIntervalMs,
                Description = dto.Description,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.AdSpots.Add(adSpot);
            await _context.SaveChangesAsync();

            var adSpotDto = new AdSpotDto
            {
                Id = adSpot.Id,
                Name = adSpot.Name,
                TechnicalId = adSpot.TechnicalId,
                Dimensions = adSpot.Dimensions,
                IsActive = adSpot.IsActive,
                RotationIntervalMs = adSpot.RotationIntervalMs,
                Description = adSpot.Description,
                CreatedAt = adSpot.CreatedAt,
                TotalCampaigns = 0,
                ActiveCampaigns = 0,
                TotalRevenue = 0,
                Availability = "Available"
            };

            return CreatedAtAction(nameof(GetAdSpot), new { id = adSpot.Id }, adSpotDto);
        }

        // PUT: api/AdSpots/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateAdSpot(int id, UpdateAdSpotDto dto)
        {
            var adSpot = await _context.AdSpots.FindAsync(id);

            if (adSpot == null)
            {
                return NotFound();
            }

            // Check if TechnicalId already exists (excluding current spot)
            if (await _context.AdSpots.AnyAsync(s => s.TechnicalId == dto.TechnicalId && s.Id != id))
            {
                return BadRequest(new { message = "Technical ID already exists" });
            }

            adSpot.Name = dto.Name;
            adSpot.TechnicalId = dto.TechnicalId;
            adSpot.Dimensions = dto.Dimensions;
            adSpot.IsActive = dto.IsActive;
            adSpot.RotationIntervalMs = dto.RotationIntervalMs;
            adSpot.Description = dto.Description;
            adSpot.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/AdSpots/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteAdSpot(int id)
        {
            var adSpot = await _context.AdSpots
                .Include(s => s.Campaigns)
                .FirstOrDefaultAsync(s => s.Id == id);

            if (adSpot == null)
            {
                return NotFound();
            }

            // Check if spot has active campaigns
            var now = DateTime.UtcNow;
            if (adSpot.Campaigns.Any(c => c.Status == AdCampaignStatus.Active && c.StartDate <= now && c.EndDate >= now))
            {
                return BadRequest(new { message = "Cannot delete ad spot with active campaigns" });
            }

            _context.AdSpots.Remove(adSpot);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
