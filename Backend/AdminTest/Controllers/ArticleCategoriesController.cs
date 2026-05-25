using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ArticleCategoriesController : ControllerBase
{
    private readonly AkordishKeitDbContext _context;

    public ArticleCategoriesController(AkordishKeitDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<ArticleCategoryDto>>> GetArticleCategories(
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 100,
        [FromQuery] string? search = null)
    {
        var query = _context.ArticleCategories.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(c => c.DisplayName.Contains(search) || c.Name.Contains(search));
        }

        var totalCount = await query.CountAsync();

        var categories = await query
            .OrderBy(c => c.Section)
            .ThenBy(c => c.DisplayName)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new ArticleCategoryDto
            {
                Id = c.Id,
                Name = c.DisplayName,
                Section = (int)c.Section
            })
            .ToListAsync();

        return new PagedResult<ArticleCategoryDto>
        {
            Items = categories,
            TotalCount = totalCount,
            PageNumber = pageNumber,
            PageSize = pageSize
        };
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ArticleCategoryDto>> GetArticleCategory(int id)
    {
        var category = await _context.ArticleCategories
            .Where(c => c.Id == id)
            .Select(c => new ArticleCategoryDto
            {
                Id = c.Id,
                Name = c.DisplayName,
                Section = (int)c.Section
            })
            .FirstOrDefaultAsync();

        if (category == null) return NotFound();

        return category;
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ArticleCategoryDto>> PostArticleCategory(CreateArticleCategoryDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest("שם הקטגוריה חובה");
        }

        if (!Enum.IsDefined(typeof(ArticleCategorySection), dto.Section))
        {
            return BadRequest("אזור באתר לא תקין");
        }

        var name = dto.Name.Trim();

        if (await _context.ArticleCategories.AnyAsync(c => c.Name == name || c.DisplayName == name))
        {
            return BadRequest("קטגוריה בשם זה כבר קיימת");
        }

        var category = new ArticleCategoryEntity
        {
            Id = await GetNextCategoryIdAsync(),
            Name = name,
            DisplayName = name,
            Section = (ArticleCategorySection)dto.Section
        };

        _context.ArticleCategories.Add(category);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetArticleCategory), new { id = category.Id },
            new ArticleCategoryDto { Id = category.Id, Name = category.DisplayName, Section = (int)category.Section });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> PutArticleCategory(int id, CreateArticleCategoryDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
        {
            return BadRequest("שם הקטגוריה חובה");
        }

        if (!Enum.IsDefined(typeof(ArticleCategorySection), dto.Section))
        {
            return BadRequest("אזור באתר לא תקין");
        }

        var category = await _context.ArticleCategories.FindAsync(id);
        if (category == null) return NotFound();

        var name = dto.Name.Trim();

        if (await _context.ArticleCategories.AnyAsync(c => c.Id != id && (c.Name == name || c.DisplayName == name)))
        {
            return BadRequest("קטגוריה בשם זה כבר קיימת");
        }

        category.Name = name;
        category.DisplayName = name;
        category.Section = (ArticleCategorySection)dto.Section;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteArticleCategory(int id)
    {
        try
        {
            await DeleteCategoriesAndDetachReferencesAsync(new[] { id });
        }
        catch (Exception ex)
        {
            return BadRequest(new
            {
                message = $"לא ניתן למחוק את הקטגוריה. סיבה: {ex.GetBaseException().Message}"
            });
        }

        return NoContent();
    }

    [HttpPost("bulk-delete")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> BulkDelete([FromBody] BulkDeleteDto dto)
    {
        if (dto?.Ids == null || dto.Ids.Length == 0) return BadRequest("לא נבחרו פריטים למחיקה");

        var categoryIds = await _context.ArticleCategories
            .Where(c => dto.Ids.Contains(c.Id))
            .Select(c => c.Id)
            .ToArrayAsync();

        try
        {
            await DeleteCategoriesAndDetachReferencesAsync(categoryIds);
        }
        catch (Exception ex)
        {
            return BadRequest(new
            {
                message = $"לא ניתן למחוק את הקטגוריות. סיבה: {ex.GetBaseException().Message}"
            });
        }

        return Ok(new { deletedCount = categoryIds.Length });
    }

    private async Task<int> GetNextCategoryIdAsync()
    {
        var maxId = await _context.ArticleCategories
            .Select(c => (int?)c.Id)
            .MaxAsync() ?? 0;

        return maxId + 1;
    }

    private async Task DeleteCategoriesAndDetachReferencesAsync(int[] categoryIds)
    {
        var ids = categoryIds.Distinct().ToArray();
        if (ids.Length == 0) return;

        await using var transaction = await _context.Database.BeginTransactionAsync();

        var articleLinks = await _context.ArticleArticleCategories
            .Where(ac => ids.Contains(ac.CategoryId))
            .ToListAsync();
        _context.ArticleArticleCategories.RemoveRange(articleLinks);

        var pageLinks = await _context.NewsPageSectionCategories
            .Where(link => ids.Contains(link.CategoryId))
            .ToListAsync();
        var affectedSectionIds = pageLinks
            .Select(link => link.NewsPageSectionId)
            .Distinct()
            .ToArray();
        _context.NewsPageSectionCategories.RemoveRange(pageLinks);

        var affectedSections = await _context.NewsPageSections
            .Include(section => section.Categories)
            .Where(section =>
                affectedSectionIds.Contains(section.Id)
                || (section.CategoryId.HasValue && ids.Contains(section.CategoryId.Value)))
            .ToListAsync();

        foreach (var section in affectedSections)
        {
            var remainingIds = section.Categories
                .Where(link => !ids.Contains(link.CategoryId))
                .Select(link => link.CategoryId)
                .Distinct()
                .ToList();

            section.CategoryId = remainingIds.Count > 0 ? remainingIds[0] : null;
            section.IsActive = remainingIds.Count > 0 && section.IsActive;
            section.UpdatedAt = DateTime.UtcNow;
        }

        var categories = await _context.ArticleCategories
            .Where(c => ids.Contains(c.Id))
            .ToListAsync();
        _context.ArticleCategories.RemoveRange(categories);

        await _context.SaveChangesAsync();

        await transaction.CommitAsync();
    }
}
