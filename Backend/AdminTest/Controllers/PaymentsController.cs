using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly IPaymentService _paymentService;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(IPaymentService paymentService, ILogger<PaymentsController> logger)
    {
        _paymentService = paymentService;
        _logger = logger;
    }

    // ════════════════════════════════════════════════════════════
    //   POST /api/payments/create-checkout
    //   יצירת דף תשלום — דורש התחברות
    // ════════════════════════════════════════════════════════════

    [HttpPost("create-checkout")]
    [Authorize]
    public async Task<ActionResult<CreateCheckoutResponseDto>> CreateCheckout(
        [FromBody] CreateCheckoutSessionDto dto)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out int userId))
            return Unauthorized(new { message = "לא מזוהה" });

        _logger.LogInformation("Checkout session requested: UserId={UserId} IP={IP}",
            userId, HttpContext.Connection.RemoteIpAddress);
        try
        {
            var result = await _paymentService.CreateCheckoutSessionAsync(userId, dto);
            _logger.LogInformation("Checkout session created: UserId={UserId} SessionId={SessionId}",
                userId, result.SessionId);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning("Checkout failed — bad argument: UserId={UserId} Error={Error}", userId, ex.Message);
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Checkout failed — conflict: UserId={UserId} Error={Error}", userId, ex.Message);
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Checkout session error: UserId={UserId}", userId);
            return StatusCode(500, new { message = $"שגיאת שרת: {ex.Message}" });
        }
    }

    // ════════════════════════════════════════════════════════════
    //   GET /api/payments/verify-session?sessionId=xxx
    //   אימות ישיר לאחר redirect מ-Cardcom
    // ════════════════════════════════════════════════════════════

    [HttpGet("verify-session")]
    [Authorize]
    public async Task<ActionResult> VerifySession([FromQuery] string sessionId)
    {
        if (string.IsNullOrEmpty(sessionId))
            return BadRequest(new { message = "חסר session ID" });

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdStr, out int userId))
            return Unauthorized(new { message = "לא מזוהה" });

        _logger.LogInformation("Payment session verification requested: UserId={UserId} SessionId={SessionId} IP={IP}",
            userId, sessionId, HttpContext.Connection.RemoteIpAddress);
        try
        {
            var activated = await _paymentService.VerifyAndActivateSessionAsync(sessionId, userId);
            _logger.LogInformation("Payment session verified: UserId={UserId} SessionId={SessionId} Activated={Activated}",
                userId, sessionId, activated);
            return Ok(new { activated });
        }
        catch (UnauthorizedAccessException)
        {
            _logger.LogWarning("Payment verify forbidden — session mismatch: UserId={UserId} SessionId={SessionId}",
                userId, sessionId);
            return Forbid();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Payment verify error: UserId={UserId} SessionId={SessionId}", userId, sessionId);
            return StatusCode(500, new { message = $"שגיאת שרת: {ex.Message}" });
        }
    }

    // ════════════════════════════════════════════════════════════
    //   POST /api/payments/webhook
    //   Webhook מ-Cardcom — ללא Authentication (מאומת מול API)
    // ════════════════════════════════════════════════════════════

    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook()
    {
        string payload;
        using (var reader = new StreamReader(HttpContext.Request.Body))
        {
            payload = await reader.ReadToEndAsync();
        }

        if (string.IsNullOrEmpty(payload))
        {
            _logger.LogWarning("Payment webhook received empty payload IP={IP}",
                HttpContext.Connection.RemoteIpAddress);
            return BadRequest(new { message = "Payload ריק" });
        }

        _logger.LogInformation("Payment webhook received: PayloadLength={Length} IP={IP}",
            payload.Length, HttpContext.Connection.RemoteIpAddress);
        try
        {
            await _paymentService.HandleWebhookAsync(payload, string.Empty);
            _logger.LogInformation("Payment webhook processed successfully");
            return Ok(new { received = true });
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning("Payment webhook bad argument: {Error}", ex.Message);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            // מחזירים 200 כדי ש-Cardcom לא ינסה שוב
            _logger.LogError(ex, "Payment webhook processing error");
            return Ok(new { received = true, warning = ex.Message });
        }
    }
}
