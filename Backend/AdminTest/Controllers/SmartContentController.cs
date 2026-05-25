using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SmartContentController : ControllerBase
{
    private readonly ISmartContentImportService _smartContentImportService;
    private readonly ILogger<SmartContentController> _logger;

    public SmartContentController(
        ISmartContentImportService smartContentImportService,
        ILogger<SmartContentController> logger)
    {
        _smartContentImportService = smartContentImportService;
        _logger = logger;
    }

    [HttpPost("import-from-url")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ImportContentFromUrlResponseDto>> ImportFromUrl([FromBody] ImportContentFromUrlRequestDto dto)
    {
        try
        {
            if (!ModelState.IsValid)
            {
                var errors = string.Join(", ", ModelState.Values
                    .SelectMany(v => v.Errors)
                    .Select(e => e.ErrorMessage));

                return Ok(new ImportContentFromUrlResponseDto
                {
                    Success = false,
                    SourceUrl = dto.Url,
                    Message = errors
                });
            }

            return Ok(await _smartContentImportService.ImportFromUrlAsync(dto.Url, dto.ContentType));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error importing smart content from URL: Url={Url} Type={ContentType}", dto.Url, dto.ContentType);
            return Ok(new ImportContentFromUrlResponseDto
            {
                Success = false,
                SourceUrl = dto.Url,
                Message = "אירעה שגיאה בשליפת התוכן מהקישור"
            });
        }
    }
}
