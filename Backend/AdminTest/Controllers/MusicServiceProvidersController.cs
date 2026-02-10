using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AkordishKeit.Data;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class MusicServiceProvidersController : ControllerBase
{
    private readonly IMusicServiceProviderService _service;
    private readonly AkordishKeitDbContext _context;

    public MusicServiceProvidersController(IMusicServiceProviderService service, AkordishKeitDbContext context)
    {
        _service = service;
        _context = context;
    }

    // GET: api/MusicServiceProviders
    [HttpGet]
    public async Task<ActionResult<PagedResult<MusicServiceProviderListDto>>> GetServiceProviders(
        [FromQuery] string? search = null,
        [FromQuery] int? categoryId = null,
        [FromQuery] int? cityId = null,
        [FromQuery] int? status = null,
        [FromQuery] bool? isFeatured = null,
        [FromQuery] bool? isTeacher = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10)
    {
        var result = await _service.GetServiceProvidersAsync(
            search, categoryId, cityId, status, isFeatured, isTeacher, pageNumber, pageSize);

        return Ok(result);
    }

    // GET: api/MusicServiceProviders/5
    [HttpGet("{id}")]
    public async Task<ActionResult<MusicServiceProviderDto>> GetServiceProvider(int id)
    {
        var serviceProvider = await _service.GetServiceProviderByIdAsync(id);

        if (serviceProvider == null)
        {
            return NotFound(new { message = "בעל המקצוע לא נמצא" });
        }

        return Ok(serviceProvider);
    }

    // GET: api/MusicServiceProviders/user/5
    [HttpGet("user/{userId}")]
    public async Task<ActionResult<MusicServiceProviderDto>> GetServiceProviderByUser(int userId)
    {
        var serviceProvider = await _service.GetServiceProviderByUserIdAsync(userId);

        if (serviceProvider == null)
        {
            return NotFound(new { message = "בעל המקצוע לא נמצא" });
        }

        return Ok(serviceProvider);
    }

    // POST: api/MusicServiceProviders
    [HttpPost]
    public async Task<ActionResult<MusicServiceProviderDto>> CreateServiceProvider(
        [FromBody] CreateMusicServiceProviderDto dto)
    {
        try
        {
            var serviceProvider = await _service.CreateServiceProviderAsync(dto);

            return CreatedAtAction(
                nameof(GetServiceProvider),
                new { id = serviceProvider.Id },
                serviceProvider);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // PUT: api/MusicServiceProviders/5
    [HttpPut("{id}")]
    public async Task<ActionResult<MusicServiceProviderDto>> UpdateServiceProvider(
        int id,
        [FromBody] UpdateMusicServiceProviderDto dto)
    {
        try
        {
            var serviceProvider = await _service.UpdateServiceProviderAsync(id, dto);

            return Ok(serviceProvider);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ========================================
    // יצירת פרופיל בעל מקצוע - לציבור
    // ========================================

    /// <summary>
    /// יצירת פרופיל בעל מקצוע חדש (משתמש מחובר עם מנוי פעיל)
    /// </summary>
    [HttpPost("create-profile")]
    [Authorize]
    public async Task<ActionResult<MusicServiceProviderDto>> CreateServiceProviderProfile([FromBody] CreateMusicServiceProviderDto dto)
    {
        try
        {
            // קבלת המשתמש המחובר
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                return Unauthorized("משתמש לא מזוהה");

            // וולידציה
            if (string.IsNullOrWhiteSpace(dto.DisplayName))
                return BadRequest("שם התצוגה הוא שדה חובה");

            if (dto.Categories == null || !dto.Categories.Any())
                return BadRequest("חובה לבחור לפחות קטגוריה אחת");

            // בדיקה אם המשתמש כבר יצר פרופיל של בעל מקצוע (לא מורה)
            var existingProvider = await _context.ServiceProviders
                .FirstOrDefaultAsync(sp => sp.UserId == userId && !sp.IsTeacher && !sp.IsDeleted);

            if (existingProvider != null)
                return BadRequest("כבר יצרת פרופיל של בעל מקצוע");

            // בדיקת מנוי פעיל (אופציונלי - לקביעת Premium)
            var activeSubscription = await _context.Subscriptions
                .Where(s => s.UserId == userId)
                .Where(s => s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trial)
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            // קביעת האם זה הפרופיל הראשי (הראשון למשתמש)
            var existingProfilesByUser = await _context.ServiceProviders
                .Where(sp => sp.UserId == userId && !sp.IsDeleted)
                .CountAsync();

            bool isPrimaryProfile = existingProfilesByUser == 0;

            // יצירת Service Provider
            var serviceProvider = new MusicServiceProvider
            {
                UserId = userId,
                DisplayName = dto.DisplayName,
                ProfileImageUrl = dto.ProfileImageUrl,
                ShortBio = dto.ShortBio,
                FullDescription = dto.FullDescription,
                IsTeacher = false, // Service providers are NOT teachers
                CityId = dto.CityId,
                Location = dto.Location,
                PhoneNumber = dto.PhoneNumber,
                WhatsAppNumber = dto.WhatsAppNumber,
                Email = dto.Email,
                WebsiteUrl = dto.WebsiteUrl,
                VideoUrl = dto.VideoUrl,
                YearsOfExperience = dto.YearsOfExperience,
                WorkingHours = dto.WorkingHours,
                IsFeatured = false,
                Status = ProfileStatus.Pending,
                IsPrimaryProfile = isPrimaryProfile,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

            // קישור למנוי אם קיים
            if (activeSubscription != null)
            {
                serviceProvider.SubscriptionId = activeSubscription.Id;
                serviceProvider.Tier = ProfileTier.Subscribed;
            }
            else
            {
                serviceProvider.Tier = ProfileTier.Free;
            }

            _context.ServiceProviders.Add(serviceProvider);
            await _context.SaveChangesAsync();

            // הוספת קטגוריות
            if (dto.Categories != null && dto.Categories.Any())
            {
                foreach (var category in dto.Categories)
                {
                    _context.ServiceProviderCategoryMappings.Add(new MusicServiceProviderCategoryMapping
                    {
                        ServiceProviderId = serviceProvider.Id,
                        CategoryId = category.CategoryId,
                        SubCategory = category.SubCategory
                    });
                }
            }

            // הוספת גלריה - תמיד מותר להוסיף גלריה
            if (dto.GalleryImages != null && dto.GalleryImages.Any())
            {
                foreach (var img in dto.GalleryImages)
                {
                    _context.ServiceProviderGalleryImages.Add(new MusicServiceProviderGalleryImage
                    {
                        ServiceProviderId = serviceProvider.Id,
                        ImageUrl = img.ImageUrl,
                        Caption = img.Caption,
                        Order = img.Order
                    });
                }
            }

            await _context.SaveChangesAsync();

            // החזרת פרטי בעל המקצוע המלאים
            var result = await _service.GetServiceProviderByIdAsync(serviceProvider.Id);

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה ביצירת פרופיל בעל מקצוע: {ex.Message}");
        }
    }

    // DELETE: api/MusicServiceProviders/5
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteServiceProvider(int id)
    {
        var result = await _service.DeleteServiceProviderAsync(id);

        if (!result)
        {
            return NotFound(new { message = "בעל המקצוע לא נמצא" });
        }

        return NoContent();
    }

    // POST: api/MusicServiceProviders/5/approve
    [HttpPost("{id}/approve")]
    public async Task<ActionResult> ApproveServiceProvider(int id)
    {
        var result = await _service.ApproveServiceProviderAsync(id);

        if (!result)
        {
            return NotFound(new { message = "בעל המקצוע לא נמצא" });
        }

        return Ok(new { message = "בעל המקצוע אושר בהצלחה" });
    }

    // POST: api/MusicServiceProviders/5/reject
    [HttpPost("{id}/reject")]
    public async Task<ActionResult> RejectServiceProvider(int id)
    {
        var result = await _service.RejectServiceProviderAsync(id);

        if (!result)
        {
            return NotFound(new { message = "בעל המקצוע לא נמצא" });
        }

        return Ok(new { message = "בעל המקצוע נדחה" });
    }

    // GET: api/MusicServiceProviders/check-user/5
    [HttpGet("check-user/{userId}")]
    public async Task<ActionResult<bool>> CheckUserHasProfile(int userId)
    {
        var hasProfile = await _service.UserHasServiceProviderProfileAsync(userId);

        return Ok(hasProfile);
    }

    // POST: api/MusicServiceProviders/5/link-user/10
    [HttpPost("{id}/link-user/{userId}")]
    public async Task<ActionResult> LinkToUser(int id, int userId)
    {
        try
        {
            await _service.LinkToUserAsync(id, userId);
            return Ok(new { message = "בעל המקצוע קושר למשתמש בהצלחה" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST: api/MusicServiceProviders/5/unlink-user
    [HttpPost("{id}/unlink-user")]
    public async Task<ActionResult> UnlinkFromUser(int id)
    {
        try
        {
            await _service.UnlinkFromUserAsync(id);
            return Ok(new { message = "בעל המקצוע נותק מהמשתמש בהצלחה" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
