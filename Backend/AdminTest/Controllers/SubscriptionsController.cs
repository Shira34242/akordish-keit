
using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers;

/// <summary>
/// API לניהול מנויים
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class SubscriptionsController : ControllerBase
{
    private readonly ISubscriptionService _subscriptionService;
    private readonly ILogger<SubscriptionsController> _logger;

    public SubscriptionsController(
        ISubscriptionService subscriptionService,
        ILogger<SubscriptionsController> logger)
    {
        _subscriptionService = subscriptionService;
        _logger = logger;
    }

    /// <summary>
    /// יצירת מנוי חדש (Admin בלבד)
    /// POST /api/subscriptions
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<SubscriptionDto>> CreateSubscription([FromBody] CreateSubscriptionDto dto)
    {
        try
        {
            var subscription = await _subscriptionService.CreateSubscriptionAsync(dto);
            return CreatedAtAction(nameof(GetSubscription), new { id = subscription.Id }, subscription);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating subscription");
            return StatusCode(500, new { message = "שגיאה ביצירת מנוי" });
        }
    }

    /// <summary>
    /// יצירת מנוי חדש למשתמש מחובר (ללא תשלום בפועל בשלב זה)
    /// POST /api/subscriptions/create-for-user
    /// </summary>
    [HttpPost("create-for-user")]
    [Authorize]
    public async Task<ActionResult<SubscriptionDto>> CreateSubscriptionForUser([FromBody] CreateSubscriptionDto dto)
    {
        try
        {
            // וידוא שהמשתמש יוצר מנוי לעצמו בלבד
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                return Unauthorized(new { message = "משתמש לא מזוהה" });

            if (dto.UserId != userId)
                return Forbid(); // משתמש לא יכול ליצור מנוי עבור משתמש אחר

            var subscription = await _subscriptionService.CreateSubscriptionAsync(dto);
            return CreatedAtAction(nameof(GetSubscription), new { id = subscription.Id }, subscription);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating subscription for user");
            return StatusCode(500, new { message = "שגיאה ביצירת מנוי" });
        }
    }

    /// <summary>
    /// קבלת מידע על מנוי לפי ID
    /// GET /api/subscriptions/{id}
    /// </summary>
    [HttpGet("{id}")]
    [Authorize]
    public async Task<ActionResult<SubscriptionDto>> GetSubscription(int id)
    {
        try
        {
            var subscription = await _subscriptionService.GetSubscriptionByIdAsync(id);
            if (subscription == null)
            {
                return NotFound(new { message = "מנוי לא נמצא" });
            }

            return Ok(subscription);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting subscription {Id}", id);
            return StatusCode(500, new { message = "שגיאה בקבלת מידע על מנוי" });
        }
    }

    /// <summary>
    /// קבלת מנוי פעיל של משתמש
    /// GET /api/subscriptions/user/{userId}
    /// </summary>
    [HttpGet("user/{userId}/active")]
    public async Task<ActionResult<SubscriptionDto?>> GetUserActiveSubscription(int userId)
    {
        try
        {
            var subscription = await _subscriptionService.GetUserActiveSubscriptionAsync(userId);
            
            // מחזיר null אם אין מנוי - לא שגיאה 404
            return Ok(subscription);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting subscription for user {UserId}", userId);
            return StatusCode(500, new { message = "שגיאה בקבלת מידע על מנוי" });
        }
    }

    /// <summary>
    /// שדרוג תוכנית מנוי
    /// PUT /api/subscriptions/{id}/upgrade
    /// </summary>
    [HttpPut("{id}/upgrade")]
    [Authorize]
    public async Task<ActionResult<SubscriptionDto>> UpgradeSubscription(
        int id,
        [FromBody] UpgradeSubscriptionDto dto)
    {
        try
        {
            var subscription = await _subscriptionService.UpgradeSubscriptionAsync(id, dto);
            return Ok(subscription);
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error upgrading subscription {Id}", id);
            return StatusCode(500, new { message = "שגיאה בשדרוג מנוי" });
        }
    }

    /// <summary>
    /// ביטול מנוי
    /// PUT /api/subscriptions/{id}/cancel
    /// </summary>
    [HttpPut("{id}/cancel")]
    [Authorize]
    public async Task<ActionResult<SubscriptionDto>> CancelSubscription(
        int id,
        [FromBody] CancelSubscriptionDto dto)
    {
        try
        {
            var subscription = await _subscriptionService.CancelSubscriptionAsync(id, dto);
            return Ok(subscription);
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling subscription {Id}", id);
            return StatusCode(500, new { message = "שגיאה בביטול מנוי" });
        }
    }

    /// <summary>
    /// חידוש מנוי מבוטל
    /// PUT /api/subscriptions/{id}/renew
    /// </summary>
    [HttpPut("{id}/renew")]
    [Authorize]
    public async Task<ActionResult<SubscriptionDto>> RenewSubscription(int id)
    {
        try
        {
            var subscription = await _subscriptionService.RenewSubscriptionAsync(id);
            return Ok(subscription);
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error renewing subscription {Id}", id);
            return StatusCode(500, new { message = "שגיאה בחידוש מנוי" });
        }
    }

    /// <summary>
    /// קישור פרופיל למנוי
    /// POST /api/subscriptions/{id}/link-profile
    /// </summary>
    [HttpPost("{id}/link-profile")]
    [Authorize]
    public async Task<ActionResult> LinkProfileToSubscription(
        int id,
        [FromBody] LinkProfileDto dto)
    {
        try
        {
            await _subscriptionService.LinkProfileToSubscriptionAsync(
                id,
                dto.ArtistId,
                dto.ServiceProviderId,
                dto.IsPrimary);
            return Ok(new { message = "פרופיל קושר למנוי בהצלחה" });
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error linking profile to subscription {Id}", id);
            return StatusCode(500, new { message = "שגיאה בקישור פרופיל למנוי" });
        }
    }

    /// <summary>
    /// ניתוק פרופיל ממנוי
    /// POST /api/subscriptions/unlink-profile
    /// </summary>
    [HttpPost("unlink-profile")]
    [Authorize]
    public async Task<ActionResult> UnlinkProfileFromSubscription([FromBody] UnlinkProfileDto dto)
    {
        try
        {
            await _subscriptionService.UnlinkProfileFromSubscriptionAsync(
                dto.ArtistId,
                dto.ServiceProviderId);
            return Ok(new { message = "פרופיל נותק ממנוי בהצלחה" });
        }
        catch (ArgumentException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error unlinking profile from subscription");
            return StatusCode(500, new { message = "שגיאה בניתוק פרופיל ממנוי" });
        }
    }

    /// <summary>
    /// בדיקה האם משתמש יכול לגשת לפיצ'ר מסוים
    /// GET /api/subscriptions/check-access/{userId}/{featureName}
    /// </summary>
    [HttpGet("check-access/{userId}/{featureName}")]
    [Authorize]
    public async Task<ActionResult<FeatureAccessDto>> CheckFeatureAccess(int userId, string featureName)
    {
        try
        {
            var result = await _subscriptionService.CheckFeatureAccessAsync(userId, featureName);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking feature access for user {UserId}, feature {FeatureName}", userId, featureName);
            return StatusCode(500, new { message = "שגיאה בבדיקת גישה לפיצ'ר" });
        }
    }

    /// <summary>
    /// בדיקה האם משתמש פרימיום
    /// GET /api/subscriptions/is-premium/{userId}
    /// </summary>
    [HttpGet("is-premium/{userId}")]
    [Authorize]
    public async Task<ActionResult<bool>> IsPremiumUser(int userId)
    {
        try
        {
            var isPremium = await _subscriptionService.IsPremiumUserAsync(userId);
            return Ok(new { isPremium });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking if user {UserId} is premium", userId);
            return StatusCode(500, new { message = "שגיאה בבדיקת סטטוס פרימיום" });
        }
    }

    /// <summary>
    /// עדכון מנויים שפג תוקפם (Admin only - צריך לרוץ בבקגראונד)
    /// POST /api/subscriptions/update-expired
    /// </summary>
    [HttpPost("update-expired")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> UpdateExpiredSubscriptions()
    {
        try
        {
            await _subscriptionService.UpdateExpiredSubscriptionsAsync();
            return Ok(new { message = "מנויים עודכנו בהצלחה" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating expired subscriptions");
            return StatusCode(500, new { message = "שגיאה בעדכון מנויים" });
        }
    }
}
