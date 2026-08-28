using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/email-article-ingestion")]
public sealed class EmailArticleIngestionController : ControllerBase
{
    private readonly IEmailArticleIngestionService _ingestionService;
    private readonly ILogger<EmailArticleIngestionController> _logger;

    public EmailArticleIngestionController(
        IEmailArticleIngestionService ingestionService,
        ILogger<EmailArticleIngestionController> logger)
    {
        _ingestionService = ingestionService;
        _logger = logger;
    }

    [HttpGet("producers")]
    [AllowAnonymous]
    [EnableRateLimiting("email-article-ingest")]
    public async Task<ActionResult<object>> GetApprovedProducers()
    {
        if (!_ingestionService.IsEnabled)
            return NotFound();

        if (!await _ingestionService.IsAuthorizedAsync(
                Request.Headers.Authorization.FirstOrDefault(),
                HttpContext.RequestAborted))
            return Unauthorized(new { message = "Invalid ingestion credentials" });

        return Ok(new { senders = _ingestionService.ApprovedSenderEmails });
    }

    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting("email-article-ingest")]
    [Consumes("multipart/form-data", "application/x-www-form-urlencoded")]
    [RequestSizeLimit(31_457_280)]
    public async Task<ActionResult<EmailArticleIngestionResponseDto>> Ingest(
        [FromForm] EmailArticleIngestionRequestDto request)
    {
        if (!_ingestionService.IsEnabled)
            return NotFound();

        if (!await _ingestionService.IsAuthorizedAsync(
                Request.Headers.Authorization.FirstOrDefault(),
                HttpContext.RequestAborted))
            return Unauthorized(new { message = "Invalid ingestion credentials" });

        try
        {
            return Ok(await _ingestionService.IngestAsync(request));
        }
        catch (UnauthorizedAccessException ex)
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Email article ingestion could not create a draft");
            return UnprocessableEntity(new { message = ex.Message });
        }
    }
}
