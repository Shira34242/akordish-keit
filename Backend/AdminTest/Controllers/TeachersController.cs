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
    private const int MaxManagedPagesPerUser = 5;
    private readonly ITeacherService _service;
    private readonly AkordishKeitDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly ISongService _songService;
    private readonly IArticleService _articleService;
    private readonly ILogger<TeachersController> _logger;

    public TeachersController(
        ITeacherService service,
        AkordishKeitDbContext context,
        INotificationService notificationService,
        ISongService songService,
        IArticleService articleService,
        ILogger<TeachersController> logger)
    {
        _service = service;
        _context = context;
        _notificationService = notificationService;
        _songService = songService;
        _articleService = articleService;
        _logger = logger;
    }

    // GET: api/Teachers
    [HttpGet]
    public async Task<ActionResult<PagedResult<TeacherListDto>>> GetTeachers(
        [FromQuery] string? search = null,
        [FromQuery] int? instrumentId = null,
        [FromQuery] int? cityId = null,
        [FromQuery] int? targetAudience = null,
        [FromQuery] int? language = null,
        [FromQuery] int? status = null,
        [FromQuery] bool? isFeatured = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10)
    {
        var result = await _service.GetTeachersAsync(
            search, instrumentId, cityId, targetAudience, language, status, isFeatured, pageNumber, pageSize);

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

    // GET: api/Teachers/5/songs
    [HttpGet("{id}/songs")]
    public async Task<ActionResult<List<SongDto>>> GetTeacherSongs(int id, [FromQuery] int limit = 12)
    {
        var exists = await _context.ServiceProviders
            .AnyAsync(sp => sp.Id == id && sp.IsTeacher && !sp.IsDeleted);

        if (!exists)
        {
            return NotFound(new { message = "׳”׳׳•׳¨׳” ׳׳ ׳ ׳׳¦׳" });
        }

        var songs = await _songService.GetApprovedSongsByUploaderProfileAsync("serviceProvider", id, limit);
        return Ok(songs);
    }

    // GET: api/Teachers/5/articles
    [HttpGet("{id}/articles")]
    public async Task<ActionResult<List<ArticleDto>>> GetTeacherArticles(int id, [FromQuery] int limit = 12)
    {
        var exists = await _context.ServiceProviders
            .AnyAsync(sp => sp.Id == id && sp.IsTeacher && !sp.IsDeleted);

        if (!exists)
        {
            return NotFound(new { message = "׳”׳׳•׳¨׳” ׳׳ ׳ ׳׳¦׳" });
        }

        var articles = await _articleService.GetPublishedArticlesByUploaderProfileAsync("serviceProvider", id, limit);
        return Ok(articles);
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

            var hasInstrument = dto.Instruments != null && dto.Instruments.Any();
            var hasOtherInstrument = !string.IsNullOrWhiteSpace(dto.OtherInstrument);
            if (!hasInstrument && !hasOtherInstrument)
                return BadRequest("חובה לבחור לפחות כלי נגינה אחד");

            var managedPagesCount = await CountManagedPagesAsync(userId);
            if (managedPagesCount >= MaxManagedPagesPerUser)
                return BadRequest($"אפשר לנהל עד {MaxManagedPagesPerUser} דפים בלבד");

            var existingTeacher = await _context.ServiceProviders
                .FirstOrDefaultAsync(sp => sp.UserId == userId
                    && sp.IsTeacher
                    && !sp.IsDeleted
                    && sp.DisplayName == dto.DisplayName);

            if (existingTeacher != null)
            {
                if (dto.AgencyId.HasValue)
                {
                    var existingAgency = await _context.Agencies
                        .FirstOrDefaultAsync(a => a.Id == dto.AgencyId.Value && !a.IsDeleted && a.IsActive);

                    if (existingAgency == null)
                        return BadRequest("הסוכנות לא נמצאה או אינה פעילה");

                    await LinkTeacherToAgencyAsync(existingAgency.Id, existingTeacher.Id);
                    await _context.SaveChangesAsync();

                    var existingResult = await _service.GetTeacherByIdAsync(existingTeacher.Id);
                    return Ok(existingResult);
                }

                return BadRequest("כבר יצרת פרופיל מורה בשם הזה");
            }

            Agency? agency = null;
            if (dto.AgencyId.HasValue)
            {
                agency = await _context.Agencies
                    .FirstOrDefaultAsync(a => a.Id == dto.AgencyId.Value && !a.IsDeleted && a.IsActive);

                if (agency == null)
                    return BadRequest("הסוכנות לא נמצאה או אינה פעילה");
            }

            // בדיקת מנוי פעיל (אופציונלי - לקביעת Premium)
            var activeSubscription = await _context.Subscriptions
                .Where(s => s.UserId == userId)
                .Where(s => s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trial)
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            // קביעת האם זה הפרופיל הראשי (הראשון למשתמש)
            bool isPrimaryProfile = managedPagesCount == 0;

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
                BannerImageUrl = dto.BannerImageUrl,
                BannerBlur = Math.Clamp(dto.BannerBlur, 0, 20),
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

            if (dto.Testimonials != null && dto.Testimonials.Any())
            {
                foreach (var item in dto.Testimonials.Where(t => !string.IsNullOrWhiteSpace(t.Text)).OrderBy(t => t.Order))
                {
                    _context.TeacherTestimonials.Add(new TeacherTestimonial
                    {
                        TeacherId = teacher.Id,
                        StudentName = string.IsNullOrWhiteSpace(item.StudentName) ? null : item.StudentName.Trim(),
                        Text = item.Text.Trim(),
                        Order = item.Order
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

            if (dto.SocialLinks != null && dto.SocialLinks.Any())
            {
                foreach (var link in dto.SocialLinks.Where(link => !string.IsNullOrWhiteSpace(link.Url)))
                {
                    _context.ServiceProviderSocialLinks.Add(new MusicServiceProviderSocialLink
                    {
                        ServiceProviderId = serviceProvider.Id,
                        Platform = link.Platform,
                        Url = link.Url
                    });
                }
            }

            if (agency != null)
            {
                await LinkTeacherToAgencyAsync(agency.Id, serviceProvider.Id);
            }

            await _context.SaveChangesAsync();

            // החזרת פרטי המורה המלאים
            var result = await _service.GetTeacherByIdAsync(teacher.Id);

            await _notificationService.NotifyTeacherSubmittedAsync(userId, teacher.Id, serviceProvider.DisplayName);

            _logger.LogInformation("Teacher profile created (pending): TeacherId={TeacherId} UserId={UserId} Name={Name}",
                teacher.Id, userId, serviceProvider.DisplayName);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Create teacher profile failed: UserId={UserId}", GetCurrentUserId());
            return StatusCode(500, $"שגיאה ביצירת פרופיל מורה: {ex.Message}");
        }
    }

    private async Task LinkTeacherToAgencyAsync(int agencyId, int serviceProviderId)
    {
        var link = await _context.AgencyProfiles
            .FirstOrDefaultAsync(p => p.ProfileType == "serviceProvider" && p.ProfileId == serviceProviderId);

        if (link == null)
        {
            link = new AgencyProfile
            {
                ProfileType = "serviceProvider",
                ProfileId = serviceProviderId,
                CreatedAt = DateTime.UtcNow
            };
            _context.AgencyProfiles.Add(link);
        }

        link.AgencyId = agencyId;
        link.ContactMode = AgencyContactMode.Agency;
        link.ShowBadge = true;
        link.IsFeaturedByAgency = false;
        link.DisplayOrder = 0;
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

        _logger.LogInformation("Teacher deleted: TeacherId={TeacherId}", id);
        return NoContent();
    }

    // POST: api/Teachers/5/approve
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> ApproveTeacher(int id)
    {
        var result = await _service.ApproveTeacherAsync(id);

        if (!result)
        {
            return NotFound(new { message = "המורה לא נמצא" });
        }

        _logger.LogInformation("Teacher approved: TeacherId={TeacherId}", id);
        return Ok(new { message = "המורה אושר בהצלחה" });
    }

    // POST: api/Teachers/5/reject
    [HttpPost("{id}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> RejectTeacher(int id)
    {
        var result = await _service.RejectTeacherAsync(id);

        if (!result)
        {
            return NotFound(new { message = "המורה לא נמצא" });
        }

        _logger.LogInformation("Teacher rejected: TeacherId={TeacherId}", id);
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

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }

    // POST: api/Teachers/5/duplicate
    [HttpPost("{id}/duplicate")]
    public async Task<ActionResult<TeacherDto>> DuplicateTeacher(int id)
    {
        try
        {
            var duplicate = await _service.DuplicateTeacherAsync(id);
            return Ok(duplicate);
        }
        catch (InvalidOperationException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    private async Task<int> CountManagedPagesAsync(int userId)
    {
        var artistsCount = await _context.Artists
            .CountAsync(a => a.UserId == userId && !a.IsDeleted);

        var providersCount = await _context.ServiceProviders
            .CountAsync(sp => sp.UserId == userId && !sp.IsDeleted);

        return artistsCount + providersCount;
    }
}
