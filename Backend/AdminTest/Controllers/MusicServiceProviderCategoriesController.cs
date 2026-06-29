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
                IsActive = c.IsActive,
                ShowInQuickCategories = c.ShowInQuickCategories,
                QuickCategoryType = c.QuickCategoryType,
                QuickCategoryInstrumentId = c.QuickCategoryInstrumentId,
                QuickCategoryLabel = c.QuickCategoryLabel,
                QuickCategoryImageUrl = c.QuickCategoryImageUrl,
                QuickCategoryOrder = c.QuickCategoryOrder
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
                IsActive = c.IsActive,
                ShowInQuickCategories = c.ShowInQuickCategories,
                QuickCategoryType = c.QuickCategoryType,
                QuickCategoryInstrumentId = c.QuickCategoryInstrumentId,
                QuickCategoryLabel = c.QuickCategoryLabel,
                QuickCategoryImageUrl = c.QuickCategoryImageUrl,
                QuickCategoryOrder = c.QuickCategoryOrder
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
        var quickCategoryValidation = await NormalizeQuickCategoryFieldsAsync(dto);
        if (quickCategoryValidation != null)
        {
            return quickCategoryValidation;
        }

        var category = new MusicServiceProviderCategory
        {
            Name = dto.Name,
            Description = dto.Description,
            IconUrl = dto.IconUrl,
            IsActive = dto.IsActive,
            ShowInQuickCategories = dto.ShowInQuickCategories,
            QuickCategoryType = dto.QuickCategoryType,
            QuickCategoryInstrumentId = dto.QuickCategoryInstrumentId,
            QuickCategoryLabel = dto.QuickCategoryLabel,
            QuickCategoryImageUrl = dto.QuickCategoryImageUrl,
            QuickCategoryOrder = dto.QuickCategoryOrder
        };

        _context.ServiceProviderCategories.Add(category);
        await _context.SaveChangesAsync();

        var result = new MusicServiceProviderCategoryDto
        {
            Id = category.Id,
            Name = category.Name,
            Description = category.Description,
            IconUrl = category.IconUrl,
            IsActive = category.IsActive,
            ShowInQuickCategories = category.ShowInQuickCategories,
            QuickCategoryType = category.QuickCategoryType,
            QuickCategoryInstrumentId = category.QuickCategoryInstrumentId,
            QuickCategoryLabel = category.QuickCategoryLabel,
            QuickCategoryImageUrl = category.QuickCategoryImageUrl,
            QuickCategoryOrder = category.QuickCategoryOrder
        };

        return CreatedAtAction("GetCategory", new { id = category.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> PutCategory(int id, CreateMusicServiceProviderCategoryDto dto)
    {
        var quickCategoryValidation = await NormalizeQuickCategoryFieldsAsync(dto);
        if (quickCategoryValidation != null)
        {
            return quickCategoryValidation;
        }

        var category = await _context.ServiceProviderCategories.FindAsync(id);

        if (category == null)
        {
            return NotFound();
        }

        category.Name = dto.Name;
        category.Description = dto.Description;
        category.IconUrl = dto.IconUrl;
        category.IsActive = dto.IsActive;
        category.ShowInQuickCategories = dto.ShowInQuickCategories;
        category.QuickCategoryType = dto.QuickCategoryType;
        category.QuickCategoryInstrumentId = dto.QuickCategoryInstrumentId;
        category.QuickCategoryLabel = dto.QuickCategoryLabel;
        category.QuickCategoryImageUrl = dto.QuickCategoryImageUrl;
        category.QuickCategoryOrder = dto.QuickCategoryOrder;

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

    [HttpPost("bulk-delete")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> BulkDelete([FromBody] BulkDeleteDto dto)
    {
        if (dto?.Ids == null || dto.Ids.Length == 0) return BadRequest("לא נבחרו פריטים למחיקה");

        var categories = await _context.ServiceProviderCategories.Where(c => dto.Ids.Contains(c.Id)).ToListAsync();
        _context.ServiceProviderCategories.RemoveRange(categories);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (Exception)
        {
            return BadRequest("לא ניתן למחוק חלק מהפריטים (ייתכן שהם בשימוש)");
        }

        return Ok(new { deletedCount = categories.Count });
    }

    private bool CategoryExists(int id)
    {
        return _context.ServiceProviderCategories.Any(e => e.Id == id);
    }

    private async Task<BadRequestObjectResult?> NormalizeQuickCategoryFieldsAsync(CreateMusicServiceProviderCategoryDto dto)
    {
        dto.QuickCategoryType = dto.QuickCategoryType == 1 ? 1 : 0;

        if (dto.QuickCategoryType != 1)
        {
            dto.QuickCategoryInstrumentId = null;
            return null;
        }

        if (!dto.QuickCategoryInstrumentId.HasValue)
        {
            return null;
        }

        var instrumentExists = await _context.Instruments.AnyAsync(i => i.Id == dto.QuickCategoryInstrumentId.Value);
        return instrumentExists ? null : BadRequest("Instrument does not exist.");
    }
}
