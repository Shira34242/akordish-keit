using AkordishKeit.Extensions;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class ArticleCategoriesController : ControllerBase
{
    [HttpGet]
    public ActionResult<PagedResult<SystemItemDto>> GetArticleCategories([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 100, [FromQuery] string? search = null)
    {
        var allCategories = Enum.GetValues<ArticleCategory>()
            .Select(c => new SystemItemDto
            {
                Id = (int)c,
                Name = c.GetDisplayName()
            })
            .ToList();

        // Apply search filter if provided
        if (!string.IsNullOrWhiteSpace(search))
        {
            allCategories = allCategories.Where(c => c.Name.Contains(search, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        var totalCount = allCategories.Count;

        var categories = allCategories
            .OrderBy(c => c.Name)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var result = new PagedResult<SystemItemDto>
        {
            Items = categories,
            TotalCount = totalCount,
            PageNumber = pageNumber,
            PageSize = pageSize
        };

        return result;
    }

    [HttpGet("{id}")]
    public ActionResult<SystemItemDto> GetArticleCategory(int id)
    {
        if (!Enum.IsDefined(typeof(ArticleCategory), id))
        {
            return NotFound();
        }

        var category = (ArticleCategory)id;
        var result = new SystemItemDto
        {
            Id = id,
            Name = category.GetDisplayName()
        };

        return result;
    }
}
