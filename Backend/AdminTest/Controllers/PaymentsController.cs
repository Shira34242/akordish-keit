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

    public PaymentsController(IPaymentService paymentService)
    {
        _paymentService = paymentService;
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

        try
        {
            var result = await _paymentService.CreateCheckoutSessionAsync(userId, dto);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
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

        try
        {
            var activated = await _paymentService.VerifyAndActivateSessionAsync(sessionId, userId);
            return Ok(new { activated });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
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
            return BadRequest(new { message = "Payload ריק" });

        try
        {
            await _paymentService.HandleWebhookAsync(payload, string.Empty);
            return Ok(new { received = true });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            // מחזירים 200 כדי ש-Cardcom לא ינסה שוב
            return Ok(new { received = true, warning = ex.Message });
        }
    }
}
