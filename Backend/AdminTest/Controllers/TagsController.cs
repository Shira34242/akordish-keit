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

    /// <summary>
    /// תגים פופולאריים — ממוינים לפי כמות שימוש בכתבות (יורד).
    /// משמש את טופס הכתבה כדי להציע תגים נפוצים לבחירה מהירה.
    /// </summary>
    [HttpGet("popular")]
    public async Task<ActionResult<List<SystemItemDto>>> GetPopularTags([FromQuery] int limit = 20)
    {
        if (limit <= 0 || limit > 100) limit = 20;

        var tags = await _context.Tags
            .OrderByDescending(t => t.ArticleTags.Count)
            .ThenBy(t => t.Name)
            .Take(limit)
            .Select(t => new SystemItemDto { Id = t.Id, Name = t.Name })
            .ToListAsync();

        return tags;
    }

    /// <summary>
    /// חיפוש תגים לפי טקסט (להשלמה אוטומטית בטופס הכתבה).
    /// </summary>
    [HttpGet("search")]
    public async Task<ActionResult<List<SystemItemDto>>> SearchTags([FromQuery] string q = "", [FromQuery] int limit = 10)
    {
        if (limit <= 0 || limit > 50) limit = 10;
        var query = _context.Tags.AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
        {
            query = query.Where(t => t.Name.Contains(q));
        }
        var tags = await query
            .OrderByDescending(t => t.ArticleTags.Count)
            .ThenBy(t => t.Name)
            .Take(limit)
            .Select(t => new SystemItemDto { Id = t.Id, Name = t.Name })
            .ToListAsync();
        return tags;
    }

    /// <summary>
    /// מחזיר תג קיים לפי שם, או יוצר אם לא קיים. משמש בטופס הכתבה להוספת תג חדש.
    /// </summary>
    [HttpPost("find-or-create")]
    public async Task<ActionResult<SystemItemDto>> FindOrCreateTag([FromBody] CreateSystemItemDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest("שם תג חובה");
        }

        var name = dto.Name.Trim();
        var existing = await _context.Tags.FirstOrDefaultAsync(t => t.Name == name);
        if (existing != null)
        {
            return new SystemItemDto { Id = existing.Id, Name = existing.Name };
        }

        var tag = new Tag { Name = name };
        _context.Tags.Add(tag);
        await _context.SaveChangesAsync();

        return new SystemItemDto { Id = tag.Id, Name = tag.Name };
    }

    [HttpPost("bulk-delete")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> BulkDelete([FromBody] BulkDeleteDto dto)
    {
        if (dto?.Ids == null || dto.Ids.Length == 0) return BadRequest("לא נבחרו פריטים למחיקה");

        var tags = await _context.Tags.Where(t => dto.Ids.Contains(t.Id)).ToListAsync();
        _context.Tags.RemoveRange(tags);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (Exception)
        {
            return BadRequest("לא ניתן למחוק חלק מהפריטים (ייתכן שהם בשימוש)");
        }

        return Ok(new { deletedCount = tags.Count });
    }

    private bool TagExists(int id)
    {
        return _context.Tags.Any(e => e.Id == id);
    }
}
