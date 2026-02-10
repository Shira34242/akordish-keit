using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class TeachersController : ControllerBase
{
    private readonly ITeacherService _service;
    private readonly AkordishKeitDbContext _context;

    public TeachersController(ITeacherService service, AkordishKeitDbContext context)
    {
        _service = service;
        _context = context;
    }

    // GET: api/Teachers
    [HttpGet]
    public async Task<ActionResult<PagedResult<TeacherListDto>>> GetTeachers(
        [FromQuery] string? search = null,
        [FromQuery] int? instrumentId = null,
        [FromQuery] int? cityId = null,
        [FromQuery] int? status = null,
        [FromQuery] bool? isFeatured = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10)
    {
        var result = await _service.GetTeachersAsync(
            search, instrumentId, cityId, status, isFeatured, pageNumber, pageSize);

        return Ok(result);
    }

    // GET: api/Teachers/5
    [HttpGet("{id}")]
    public async Task<ActionResult<TeacherDto>> GetTeacher(int id)
    {
        var teacher = await _service.GetTeacherByIdAsync(id);

        if (teacher == null)
        {
            return NotFound(new { message = "המורה לא נמצא" });
        }

        return Ok(teacher);
    }

    // GET: api/Teachers/user/5
    [HttpGet("user/{userId}")]
    public async Task<ActionResult<TeacherDto>> GetTeacherByUser(int userId)
    {
        var teacher = await _service.GetTeacherByUserIdAsync(userId);

        if (teacher == null)
        {
            return NotFound(new { message = "המורה לא נמצא" });
        }

        return Ok(teacher);
    }

    // POST: api/Teachers
    [HttpPost]
    public async Task<ActionResult<TeacherDto>> CreateTeacher([FromBody] CreateTeacherDto dto)
    {
        try
        {
            var teacher = await _service.CreateTeacherAsync(dto);

            return CreatedAtAction(nameof(GetTeacher), new { id = teacher.Id }, teacher);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // PUT: api/Teachers/5
    [HttpPut("{id}")]
    public async Task<ActionResult<TeacherDto>> UpdateTeacher(
        int id,
        [FromBody] UpdateTeacherDto dto)
    {
        try
        {
            var teacher = await _service.UpdateTeacherAsync(id, dto);

            return Ok(teacher);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // ========================================
    // יצירת פרופיל מורה - לציבור
    // ========================================

    /// <summary>
    /// יצירת פרופיל מורה חדש (משתמש מחובר עם מנוי פעיל)
    /// </summary>
    [HttpPost("create-profile")]
    [Authorize]
    public async Task<ActionResult<TeacherDto>> CreateTeacherProfile([FromBody] CreateTeacherDto dto)
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

            if (dto.Instruments == null || !dto.Instruments.Any())
                return BadRequest("חובה לבחור לפחות כלי נגינה אחד");

            // בדיקה אם המשתמש כבר יצר פרופיל מורה
            var existingTeacher = await _context.ServiceProviders
                .FirstOrDefaultAsync(sp => sp.UserId == userId && sp.IsTeacher && !sp.IsDeleted);

            if (existingTeacher != null)
                return BadRequest("כבר יצרת פרופיל מורה");

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

            // יצירת Service Provider (הבסיס)
            var serviceProvider = new MusicServiceProvider
            {
                UserId = userId,
                DisplayName = dto.DisplayName,
                ProfileImageUrl = dto.ProfileImageUrl,
                ShortBio = dto.ShortBio,
                FullDescription = dto.FullDescription,
                IsTeacher = true,
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

            // יצירת Teacher (הרחבה)
            var teacher = new Teacher
            {
                Id = serviceProvider.Id, // Same ID as ServiceProvider (1:1 relationship)
                PriceList = dto.PriceList,
                Languages = dto.Languages,
                TargetAudience = dto.TargetAudience,
                Availability = dto.Availability,
                Education = dto.Education,
                LessonTypes = dto.LessonTypes,
                Specializations = dto.Specializations
            };

            _context.Teachers.Add(teacher);

            // הוספת כלי נגינה
            if (dto.Instruments != null && dto.Instruments.Any())
            {
                foreach (var instrument in dto.Instruments)
                {
                    _context.TeacherInstruments.Add(new TeacherInstrument
                    {
                        TeacherId = teacher.Id,
                        InstrumentId = instrument.InstrumentId,
                        IsPrimary = instrument.IsPrimary
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

            // החזרת פרטי המורה המלאים
            var result = await _service.GetTeacherByIdAsync(teacher.Id);

            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"שגיאה ביצירת פרופיל מורה: {ex.Message}");
        }
    }

    // DELETE: api/Teachers/5
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteTeacher(int id)
    {
        var result = await _service.DeleteTeacherAsync(id);

        if (!result)
        {
            return NotFound(new { message = "המורה לא נמצא" });
        }

        return NoContent();
    }

    // POST: api/Teachers/5/approve
    [HttpPost("{id}/approve")]
    public async Task<ActionResult> ApproveTeacher(int id)
    {
        var result = await _service.ApproveTeacherAsync(id);

        if (!result)
        {
            return NotFound(new { message = "המורה לא נמצא" });
        }

        return Ok(new { message = "המורה אושר בהצלחה" });
    }

    // POST: api/Teachers/5/reject
    [HttpPost("{id}/reject")]
    public async Task<ActionResult> RejectTeacher(int id)
    {
        var result = await _service.RejectTeacherAsync(id);

        if (!result)
        {
            return NotFound(new { message = "המורה לא נמצא" });
        }

        return Ok(new { message = "המורה נדחה" });
    }

    // POST: api/Teachers/5/link-user/10
    [HttpPost("{id}/link-user/{userId}")]
    public async Task<ActionResult> LinkToUser(int id, int userId)
    {
        try
        {
            await _service.LinkToUserAsync(id, userId);
            return Ok(new { message = "המורה קושר למשתמש בהצלחה" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST: api/Teachers/5/unlink-user
    [HttpPost("{id}/unlink-user")]
    public async Task<ActionResult> UnlinkFromUser(int id)
    {
        try
        {
            await _service.UnlinkFromUserAsync(id);
            return Ok(new { message = "המורה נותק מהמשתמש בהצלחה" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
