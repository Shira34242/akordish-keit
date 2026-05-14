using AkordishKeit.Data;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class GenresController : ControllerBase
{
    private readonly AkordishKeitDbContext _context;
    private readonly ILogger<GenresController> _logger;

    public GenresController(AkordishKeitDbContext context, ILogger<GenresController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<SystemItemDto>>> GetGenres([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        var query = _context.Genres.AsQueryable();

        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(g => g.Name.Contains(search));
        }

        var totalCount = await query.CountAsync();

        var genres = await query
            .OrderBy(g => g.Name)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(g => new SystemItemDto
            {
                Id = g.Id,
                Name = g.Name
            })
            .ToListAsync();

        var result = new PagedResult<SystemItemDto>
        {
            Items = genres,
            TotalCount = totalCount,
            PageNumber = pageNumber,
            PageSize = pageSize
        };

        return result;
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SystemItemDto>> GetGenre(int id)
    {
        var genre = await _context.Genres
            .Where(g => g.Id == id)
            .Select(g => new SystemItemDto
            {
                Id = g.Id,
                Name = g.Name
            })
            .FirstOrDefaultAsync();

        if (genre == null)
        {
            return NotFound();
        }

        return genre;
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SystemItemDto>> PostGenre(CreateSystemItemDto dto)
    {
        var genre = new Genre
        {
            Name = dto.Name
        };

        _context.Genres.Add(genre);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Genre created: GenreId={GenreId} Name={Name}", genre.Id, genre.Name);
        var result = new SystemItemDto
        {
            Id = genre.Id,
            Name = genre.Name
        };

        return CreatedAtAction("GetGenre", new { id = genre.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> PutGenre(int id, CreateSystemItemDto dto)
    {
        var genre = await _context.Genres.FindAsync(id);

        if (genre == null)
        {
            return NotFound();
        }

        genre.Name = dto.Name;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!await _context.Genres.AnyAsync(e => e.Id == id))
            {
                return NotFound();
            }
            else
            {
                throw;
            }
        }

        _logger.LogInformation("Genre updated: GenreId={GenreId} Name={Name}", id, dto.Name);
        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteGenre(int id)
    {
        var genre = await _context.Genres.FindAsync(id);
        if (genre == null)
        {
            return NotFound();
        }

        _context.Genres.Remove(genre);
        try {
            await _context.SaveChangesAsync();
        } catch (Exception) {
            return BadRequest("Cannot delete genre heavily used or system error.");
        }

        _logger.LogInformation("Genre deleted: GenreId={GenreId} Name={Name}", id, genre.Name);
        return NoContent();
    }

    [HttpPost("bulk-delete")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> BulkDelete([FromBody] BulkDeleteDto dto)
    {
        if (dto?.Ids == null || dto.Ids.Length == 0) return BadRequest("לא נבחרו פריטים למחיקה");

        var genres = await _context.Genres.Where(g => dto.Ids.Contains(g.Id)).ToListAsync();
        _context.Genres.RemoveRange(genres);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (Exception)
        {
            return BadRequest("לא ניתן למחוק חלק מהפריטים (ייתכן שהם בשימוש)");
        }

        _logger.LogInformation("Genres bulk-deleted: Count={Count} Ids={Ids}",
            genres.Count, string.Join(",", dto.Ids));
        return Ok(new { deletedCount = genres.Count });
    }

}
