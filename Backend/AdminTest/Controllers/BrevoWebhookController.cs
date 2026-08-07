using System.Text.Json;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class BrevoWebhookController : ControllerBase
{
    private readonly EmailTrackingService _trackingService;
    private readonly ILogger<BrevoWebhookController> _logger;

    public BrevoWebhookController(
        EmailTrackingService trackingService,
        ILogger<BrevoWebhookController> logger)
    {
        _trackingService = trackingService;
        _logger = logger;
    }

    [HttpPost("brevo")]
    [Consumes("application/json")]
    public async Task<IActionResult> BrevoEvent()
    {
        try
        {
            using var reader = new StreamReader(Request.Body);
            var body = await reader.ReadToEndAsync();

            if (string.IsNullOrWhiteSpace(body))
            {
                _logger.LogWarning("Brevo webhook received empty body");
                return Ok(new { received = true });
            }

            BrevoWebhookPayload? payload;
            try
            {
                payload = JsonSerializer.Deserialize<BrevoWebhookPayload>(body, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Brevo webhook invalid JSON");
                return Ok(new { received = true, error = "invalid json" });
            }

            if (payload == null || string.IsNullOrWhiteSpace(payload.Event))
            {
                return Ok(new { received = true, ignored = "no event" });
            }

            if (!_trackingService.IsValidEvent(payload.Event))
            {
                _logger.LogInformation("Brevo webhook ignored event: {EventType}", payload.Event);
                return Ok(new { received = true, ignored = payload.Event });
            }

            await _trackingService.ProcessWebhookEventAsync(payload);

            return Ok(new { received = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Brevo webhook processing error");
            return StatusCode(500, new { received = false, error = "internal" });
        }
    }
}
