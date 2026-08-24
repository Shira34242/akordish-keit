using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers;

[Route("api/admin/[controller]")]
[ApiController]
[Authorize(Roles = "Admin")]
public class BumpController : ControllerBase
{
    private readonly AkordishKeitDbContext _context;
    private readonly ILogger<BumpController> _logger;
    private readonly ContentExposureCacheVersion _exposureCacheVersion;

    public BumpController(
        AkordishKeitDbContext context,
        ContentExposureCacheVersion exposureCacheVersion,
        ILogger<BumpController> logger)
    {
        _context = context;
        _exposureCacheVersion = exposureCacheVersion;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> Bump([FromBody] BumpRequestDto request)
    {
        if (request.Ids == null || request.Ids.Count == 0)
            return BadRequest("נדרש לפחות מזהה אחד");

        if (string.IsNullOrWhiteSpace(request.EntityType))
            return BadRequest("חסר סוג ישות");

        var ids = request.Ids.Where(id => id > 0).Distinct().ToList();
        if (ids.Count == 0)
            return BadRequest(new { message = "לא נבחרו פריטים תקינים להקפצה" });

        var supportedTypes = new[] { "Song", "Article", "Playlist", "ServiceProvider", "Teacher", "Artist" };
        if (!supportedTypes.Contains(request.EntityType))
            return BadRequest(new { message = "סוג התוכן אינו תומך כרגע בהקפצה" });

        var now = DateTime.UtcNow;
        var changed = await BumpEntitiesAsync(request.EntityType, ids, now);
        if (changed != ids.Count)
            return BadRequest(new { message = "אחד או יותר מהפריטים לא נמצאו. לא בוצעה הקפצה חלקית." });

        if (request.EntityType == "Article")
            _exposureCacheVersion.InvalidateArticles();

        _logger.LogInformation(
            "Bumped {Count} {EntityType} entities (IDs: {Ids})",
            ids.Count,
            request.EntityType,
            string.Join(",", ids));

        return Ok(new { bumpedCount = ids.Count, expiresAt = now.AddHours(24) });
    }

    [HttpGet("active-schedules")]
    public async Task<IActionResult> GetActiveSchedules([FromQuery] string entityType)
    {
        if (string.IsNullOrWhiteSpace(entityType))
            return BadRequest("חסר סוג ישות");

        var schedules = await _context.BumpSchedules
            .Where(s => s.EntityType == entityType && s.RemainingTimes > 0)
            .Select(s => new
            {
                s.EntityId,
                s.RemainingTimes,
                s.IntervalHours,
                s.NextBumpAt
            })
            .ToListAsync();

        return Ok(schedules);
    }

    private async Task<int> BumpEntitiesAsync(string entityType, List<int> entityIds, DateTime bumpedAt)
    {
        var existingCount = entityType switch
        {
            "Song" => await _context.Songs.CountAsync(e => entityIds.Contains(e.Id) && !e.IsDeleted),
            "Article" => await _context.Articles.CountAsync(e => entityIds.Contains(e.Id) && !e.IsDeleted),
            "Playlist" => await _context.Playlists.CountAsync(e => entityIds.Contains(e.Id)),
            "ServiceProvider" or "Teacher" => await _context.ServiceProviders.CountAsync(e => entityIds.Contains(e.Id) && !e.IsDeleted),
            "Artist" => await _context.Artists.CountAsync(e => entityIds.Contains(e.Id) && !e.IsDeleted),
            _ => throw new InvalidOperationException($"Unknown bump entity type: {entityType}")
        };

        if (existingCount != entityIds.Count)
            return 0;

        return entityType switch
        {
            "Song" => await _context.Songs
                    .Where(e => entityIds.Contains(e.Id) && !e.IsDeleted)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(e => e.BumpedAt, bumpedAt)
                        .SetProperty(e => e.BumpCount, e => e.BumpCount + 1)),
            "Article" => await _context.Articles
                    .Where(e => entityIds.Contains(e.Id) && !e.IsDeleted)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(e => e.BumpedAt, bumpedAt)
                        .SetProperty(e => e.BumpCount, e => e.BumpCount + 1)),
            "Playlist" => await _context.Playlists
                    .Where(e => entityIds.Contains(e.Id))
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(e => e.BumpedAt, bumpedAt)
                        .SetProperty(e => e.BumpCount, e => e.BumpCount + 1)),
            "ServiceProvider" or "Teacher" => await _context.ServiceProviders
                    .Where(e => entityIds.Contains(e.Id) && !e.IsDeleted)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(e => e.BumpedAt, bumpedAt)
                        .SetProperty(e => e.BumpCount, e => e.BumpCount + 1)),
            "Artist" => await _context.Artists
                    .Where(e => entityIds.Contains(e.Id) && !e.IsDeleted)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(e => e.BumpedAt, bumpedAt)
                        .SetProperty(e => e.BumpCount, e => e.BumpCount + 1)),
            _ => throw new InvalidOperationException($"Unknown bump entity type: {entityType}")
        };
    }
}
