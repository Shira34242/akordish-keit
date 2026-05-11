using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class NewsPageSectionsController : ControllerBase
{
    private readonly INewsPageSectionService _service;

    public NewsPageSectionsController(INewsPageSectionService service)
    {
        _service = service;
    }

    /// <summary>
    /// GET /api/news-page-sections
    /// מחזיר את הפסים הפעילים עם הכתבות שלהם — לשימוש דף חדשות המוזיקה
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<NewsPageSectionDto>>> GetActiveSections()
    {
        var sections = await _service.GetActiveSectionsWithArticlesAsync();
        return Ok(sections);
    }

    /// <summary>
    /// GET /api/news-page-sections/all
    /// מחזיר את כל הפסים (כולל לא פעילים) — לממשק הניהול
    /// </summary>
    [HttpGet("all")]
    public async Task<ActionResult<List<NewsPageSectionDto>>> GetAllSections()
    {
        var sections = await _service.GetAllSectionsAsync();
        return Ok(sections);
    }

    /// <summary>
    /// GET /api/news-page-sections/{id}
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<NewsPageSectionDto>> GetSection(int id)
    {
        var section = await _service.GetSectionByIdAsync(id);
        if (section == null) return NotFound();
        return Ok(section);
    }

    /// <summary>
    /// POST /api/news-page-sections
    /// יצירת פס חדש (ממשק ניהול)
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<NewsPageSectionDto>> CreateSection([FromBody] CreateNewsPageSectionDto dto)
    {
        var section = await _service.CreateSectionAsync(dto);
        return CreatedAtAction(nameof(GetSection), new { id = section.Id }, section);
    }

    /// <summary>
    /// PUT /api/news-page-sections/{id}
    /// עדכון פס קיים (ממשק ניהול)
    /// </summary>
    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<NewsPageSectionDto>> UpdateSection(int id, [FromBody] UpdateNewsPageSectionDto dto)
    {
        var section = await _service.UpdateSectionAsync(id, dto);
        if (section == null) return NotFound();
        return Ok(section);
    }

    /// <summary>
    /// DELETE /api/news-page-sections/{id}
    /// מחיקת פס (ממשק ניהול)
    /// </summary>
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteSection(int id)
    {
        var result = await _service.DeleteSectionAsync(id);
        if (!result) return NotFound();
        return NoContent();
    }
}
