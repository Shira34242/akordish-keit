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
        var category = await _context.ArticleCategories.FindAsync(id);
        if (category == null) return NotFound();

        await DeleteCategoriesAndDetachReferencesAsync(new[] { id });

        return NoContent();
    }

    [HttpPost("bulk-delete")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> BulkDelete([FromBody] BulkDeleteDto dto)
    {
        if (dto?.Ids == null || dto.Ids.Length == 0) return BadRequest("לא נבחרו פריטים למחיקה");

        var categories = await _context.ArticleCategories
            .Where(c => dto.Ids.Contains(c.Id))
            .ToListAsync();

        var categoryIds = categories.Select(c => c.Id).ToArray();
        await DeleteCategoriesAndDetachReferencesAsync(categoryIds);

        return Ok(new { deletedCount = categories.Count });
    }

    private async Task DeleteCategoriesAndDetachReferencesAsync(int[] categoryIds)
    {
        var ids = categoryIds.Distinct().ToArray();
        if (ids.Length == 0) return;

        var idList = string.Join(",", ids);

        await using var transaction = await _context.Database.BeginTransactionAsync();

        await _context.Database.ExecuteSqlRawAsync($@"
DECLARE @dropLegacyArticleCategoryFks nvarchar(max) = N'';

SELECT @dropLegacyArticleCategoryFks +=
    N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(parentTable.schema_id)) + N'.' + QUOTENAME(parentTable.name) +
    N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';'
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.tables parentTable ON parentTable.object_id = fk.parent_object_id
JOIN sys.tables referencedTable ON referencedTable.object_id = fk.referenced_object_id
WHERE parentTable.name = N'Articles'
  AND referencedTable.name = N'ArticleCategories';

IF @dropLegacyArticleCategoryFks <> N''
BEGIN
    EXEC sp_executesql @dropLegacyArticleCategoryFks;
END

IF OBJECT_ID(N'Articles', N'U') IS NOT NULL
   AND COL_LENGTH(N'Articles', N'CategoryId') IS NOT NULL
   AND COLUMNPROPERTY(OBJECT_ID(N'Articles'), N'CategoryId', 'AllowsNull') = 1
BEGIN
    UPDATE [Articles]
    SET [CategoryId] = NULL
    WHERE [CategoryId] IN ({idList});
END

IF OBJECT_ID(N'ArticleArticleCategories', N'U') IS NOT NULL
BEGIN
    DELETE FROM [ArticleArticleCategories]
    WHERE [CategoryId] IN ({idList});
END

IF OBJECT_ID(N'NewsPageSections', N'U') IS NOT NULL
   AND COL_LENGTH(N'NewsPageSections', N'CategoryId') IS NOT NULL
BEGIN
    UPDATE [NewsPageSections]
    SET [CategoryId] = NULL
    WHERE [CategoryId] IN ({idList});
END

IF OBJECT_ID(N'ArticleCategories', N'U') IS NOT NULL
BEGIN
    DELETE FROM [ArticleCategories]
    WHERE [Id] IN ({idList});
END");

        await transaction.CommitAsync();
    }
}
