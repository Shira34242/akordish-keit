using AkordishKeit.Data;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class MusicServiceProviderCategoriesController : ControllerBase
{
    private readonly AkordishKeitDbContext _context;

    public MusicServiceProviderCategoriesController(AkordishKeitDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<MusicServiceProviderCategoryDto>>> GetCategories(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null)
    {
        var query = _context.ServiceProviderCategories.AsQueryable();

        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(c => c.Name.Contains(search));
        }

        var totalCount = await query.CountAsync();

        var categories = await query
            .OrderBy(c => c.Name)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new MusicServiceProviderCategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                IconUrl = c.IconUrl,
                IsActive = c.IsActive
            })
            .ToListAsync();

        var result = new PagedResult<MusicServiceProviderCategoryDto>
        {
            Items = categories,
            TotalCount = totalCount,
            PageNumber = pageNumber,
            PageSize = pageSize
        };

        return result;
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<MusicServiceProviderCategoryDto>> GetCategory(int id)
    {
        var category = await _context.ServiceProviderCategories
            .Where(c => c.Id == id)
            .Select(c => new MusicServiceProviderCategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                IconUrl = c.IconUrl,
                IsActive = c.IsActive
            })
            .FirstOrDefaultAsync();

        if (category == null)
        {
            return NotFound();
        }

        return category;
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<MusicServiceProviderCategoryDto>> PostCategory(CreateMusicServiceProviderCategoryDto dto)
    {
        var category = new MusicServiceProviderCategory
        {
            Name = dto.Name,
            Description = dto.Description,
            IconUrl = dto.IconUrl,
            IsActive = dto.IsActive
        };

        _context.ServiceProviderCategories.Add(category);
        await _context.SaveChangesAsync();

        var result = new MusicServiceProviderCategoryDto
        {
            Id = category.Id,
            Name = category.Name,
            Description = category.Description,
            IconUrl = category.IconUrl,
            IsActive = category.IsActive
        };

        return CreatedAtAction("GetCategory", new { id = category.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> PutCategory(int id, CreateMusicServiceProviderCategoryDto dto)
    {
        var category = await _context.ServiceProviderCategories.FindAsync(id);

        if (category == null)
        {
            return NotFound();
        }

        category.Name = dto.Name;
        category.Description = dto.Description;
        category.IconUrl = dto.IconUrl;
        category.IsActive = dto.IsActive;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!CategoryExists(id))
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
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var category = await _context.ServiceProviderCategories.FindAsync(id);
        if (category == null)
        {
            return NotFound();
        }

        _context.ServiceProviderCategories.Remove(category);
        try
        {
            await _context.SaveChangesAsync();
        }
        catch (Exception)
        {
            return BadRequest("Cannot delete category that is in use.");
        }

        return NoContent();
    }

    private bool CategoryExists(int id)
    {
        return _context.ServiceProviderCategories.Any(e => e.Id == id);
    }
}
