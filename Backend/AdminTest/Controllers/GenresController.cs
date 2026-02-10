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

    public GenresController(AkordishKeitDbContext context)
    {
        _context = context;
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
            if (!GenreExists(id))
            {
                return NotFound();
            }
            else
            {
                throw;
            }
        }

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

        // Check dependencies (SongGenres)
        // If we have cascade delete on SongGenres it might delete links, but usually we want to block if used?
        // Let's assume block if linked to songs?
        // SongGenre is join table. 
        // If we delete Genre, we delete SongGenre links. That's usually acceptable or we block.
        // Let's rely on DB constraint or simple delete.
        // But context.Genres.Remove(genre) will fail if FK constraint exists and cascade is not set.
        // Let's try remove.
        
        _context.Genres.Remove(genre);
        try {
            await _context.SaveChangesAsync();
        } catch (Exception) {
            return BadRequest("Cannot delete genre heavily used or system error.");
        }

        return NoContent();
    }

    private bool GenreExists(int id)
    {
        return _context.Genres.Any(e => e.Id == id);
    }
}
