using AkordishKeit.Data;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class TagsController : ControllerBase
{
    private readonly AkordishKeitDbContext _context;

    public TagsController(AkordishKeitDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<SystemItemDto>>> GetTags([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        var query = _context.Tags.AsQueryable();

        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(t => t.Name.Contains(search));
        }

        var totalCount = await query.CountAsync();

        var tags = await query
            .OrderBy(t => t.Name)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new SystemItemDto
            {
                Id = t.Id,
                Name = t.Name
            })
            .ToListAsync();

        var result = new PagedResult<SystemItemDto>
        {
            Items = tags,
            TotalCount = totalCount,
            PageNumber = pageNumber,
            PageSize = pageSize
        };

        return result;
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SystemItemDto>> GetTag(int id)
    {
        var tag = await _context.Tags
            .Where(t => t.Id == id)
            .Select(t => new SystemItemDto
            {
                Id = t.Id,
                Name = t.Name
            })
            .FirstOrDefaultAsync();

        if (tag == null)
        {
            return NotFound();
        }

        return tag;
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SystemItemDto>> PostTag(CreateSystemItemDto dto)
    {
        var tag = new Tag
        {
            Name = dto.Name
        };

        _context.Tags.Add(tag);
        await _context.SaveChangesAsync();

        var result = new SystemItemDto
        {
            Id = tag.Id,
            Name = tag.Name
        };

        return CreatedAtAction("GetTag", new { id = tag.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> PutTag(int id, CreateSystemItemDto dto)
    {
        var tag = await _context.Tags.FindAsync(id);

        if (tag == null)
        {
            return NotFound();
        }

        tag.Name = dto.Name;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!TagExists(id))
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
    public async Task<IActionResult> DeleteTag(int id)
    {
        var tag = await _context.Tags.FindAsync(id);
        if (tag == null)
        {
            return NotFound();
        }

        _context.Tags.Remove(tag);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private bool TagExists(int id)
    {
        return _context.Tags.Any(e => e.Id == id);
    }
}
