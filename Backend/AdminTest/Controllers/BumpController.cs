using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers;

[Route("api/admin/[controller]")]
[ApiController]
[Authorize]
public class BumpController : ControllerBase
{
    private readonly AkordishKeitDbContext _context;
    private readonly ILogger<BumpController> _logger;

    public BumpController(
        AkordishKeitDbContext context,
        ILogger<BumpController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Bump([FromBody] BumpRequestDto request)
    {
        if (request.Ids == null || request.Ids.Count == 0)
            return BadRequest("נדרש לפחות מזהה אחד");

        if (string.IsNullOrWhiteSpace(request.EntityType))
            return BadRequest("חסר סוג ישות");

        var now = DateTime.UtcNow;

        if (request.Schedule != null && request.Schedule.Times > 0)
        {
            foreach (var id in request.Ids)
            {
                // Bump now (first occurrence)
                await BumpEntityAsync(request.EntityType, id, now);

                // Create schedule for remaining times
                var schedule = new BumpSchedule
                {
                    EntityType = request.EntityType,
                    EntityId = id,
                    TotalTimes = request.Schedule.Times,
                    RemainingTimes = request.Schedule.Times - 1, // first bump done now
                    IntervalHours = request.Schedule.IntervalHours,
                    NextBumpAt = now.AddHours(request.Schedule.IntervalHours),
                    CreatedAt = now
                };

                if (schedule.RemainingTimes > 0)
                    _context.BumpSchedules.Add(schedule);
            }
        }
        else
        {
            foreach (var id in request.Ids)
            {
                await BumpEntityAsync(request.EntityType, id, now);
            }
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Bumped {Count} {EntityType} entities (IDs: {Ids})",
            request.Ids.Count,
            request.EntityType,
            string.Join(",", request.Ids));

        return Ok(new { bumpedCount = request.Ids.Count });
    }

    private async Task BumpEntityAsync(string entityType, int entityId, DateTime bumpedAt)
    {
        switch (entityType)
        {
            case "Song":
                await _context.Songs
                    .Where(e => e.Id == entityId)
                    .ExecuteUpdateAsync(s => s.SetProperty(e => e.BumpedAt, bumpedAt));
                break;
            case "Article":
                await _context.Articles
                    .Where(e => e.Id == entityId)
                    .ExecuteUpdateAsync(s => s.SetProperty(e => e.BumpedAt, bumpedAt));
                break;
            case "Playlist":
                await _context.Playlists
                    .Where(e => e.Id == entityId)
                    .ExecuteUpdateAsync(s => s.SetProperty(e => e.BumpedAt, bumpedAt));
                break;
            case "ServiceProvider":
                await _context.ServiceProviders
                    .Where(e => e.Id == entityId)
                    .ExecuteUpdateAsync(s => s.SetProperty(e => e.BumpedAt, bumpedAt));
                break;
        }
    }
}
