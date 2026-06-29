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
    private const int MaxManagedPagesPerUser = 5;
    private readonly IMusicServiceProviderService _service;
    private readonly AkordishKeitDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly ISongService _songService;
    private readonly IArticleService _articleService;
    private readonly ILogger<MusicServiceProvidersController> _logger;

    public MusicServiceProvidersController(
        IMusicServiceProviderService service,
        AkordishKeitDbContext context,
        INotificationService notificationService,
        ISongService songService,
        IArticleService articleService,
        ILogger<MusicServiceProvidersController> logger)
    {
        _service = service;
        _context = context;
        _notificationService = notificationService;
        _songService = songService;
        _articleService = articleService;
        _logger = logger;
    }

    // GET: api/MusicServiceProviders
    [HttpGet]
    public async Task<ActionResult<PagedResult<MusicServiceProviderListDto>>> GetServiceProviders(
        [FromQuery] string? search = null,
        [FromQuery] int? categoryId = null,
        [FromQuery] int? cityId = null,
        [FromQuery] string? cityName = null,
        [FromQuery] int? status = null,
        [FromQuery] bool? isFeatured = null,
        [FromQuery] bool? isTeacher = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10)
    {
        var result = await _service.GetServiceProvidersAsync(
            search, categoryId, cityId, cityName, status, isFeatured, isTeacher, pageNumber, pageSize);

        return Ok(result);
    }

    // GET: api/MusicServiceProviders/5
    [HttpGet("{id}")]
    public async Task<ActionResult<MusicServiceProviderDto>> GetServiceProvider(int id)
    {
        var serviceProvider = await _service.GetServiceProviderByIdAsync(id);

        if (serviceProvider == null)
        {
            return NotFound(new { message = "׳‘׳¢׳ ׳”׳׳§׳¦׳•׳¢ ׳׳ ׳ ׳׳¦׳" });
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
            return NotFound(new { message = "׳‘׳¢׳ ׳”׳׳§׳¦׳•׳¢ ׳׳ ׳ ׳׳¦׳" });
        }

        return Ok(serviceProvider);
    }

    // GET: api/MusicServiceProviders/5/songs
    [HttpGet("{id}/songs")]
    public async Task<ActionResult<List<SongDto>>> GetServiceProviderSongs(int id, [FromQuery] int limit = 12)
    {
        var exists = await _context.ServiceProviders
            .AnyAsync(sp => sp.Id == id && !sp.IsDeleted);

        if (!exists)
        {
            return NotFound(new { message = "׳³ג€˜׳³ֲ¢׳³ֲ ׳³ג€׳³ֲ׳³ֲ§׳³ֲ¦׳³ג€¢׳³ֲ¢ ׳³ֲ׳³ֲ ׳³ֲ ׳³ֲ׳³ֲ¦׳³ֲ" });
        }

        var songs = await _songService.GetApprovedSongsByUploaderProfileAsync("serviceProvider", id, limit);
        return Ok(songs);
    }

    // GET: api/MusicServiceProviders/5/articles
    [HttpGet("{id}/articles")]
    public async Task<ActionResult<List<ArticleDto>>> GetServiceProviderArticles(int id, [FromQuery] int limit = 12)
    {
        var exists = await _context.ServiceProviders
            .AnyAsync(sp => sp.Id == id && !sp.IsDeleted);

        if (!exists)
        {
            return NotFound(new { message = "׳³ג€˜׳³ֲ¢׳³ֲ ׳³ג€׳³ֲ׳³ֲ§׳³ֲ¦׳³ג€¢׳³ֲ¢ ׳³ֲ׳³ֲ ׳³ֲ ׳³ֲ׳³ֲ¦׳³ֲ" });
        }

        var articles = await _articleService.GetPublishedArticlesByUploaderProfileAsync("serviceProvider", id, limit);
        return Ok(articles);
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
    // ׳™׳¦׳™׳¨׳× ׳₪׳¨׳•׳₪׳™׳ ׳‘׳¢׳ ׳׳§׳¦׳•׳¢ - ׳׳¦׳™׳‘׳•׳¨
    // ========================================

    /// <summary>
    /// ׳™׳¦׳™׳¨׳× ׳₪׳¨׳•׳₪׳™׳ ׳‘׳¢׳ ׳׳§׳¦׳•׳¢ ׳—׳“׳© (׳׳©׳×׳׳© ׳׳—׳•׳‘׳¨ ׳¢׳ ׳׳ ׳•׳™ ׳₪׳¢׳™׳)
    /// </summary>
    [HttpPost("create-profile")]
    [Authorize]
    public async Task<ActionResult<MusicServiceProviderDto>> CreateServiceProviderProfile([FromBody] CreateMusicServiceProviderDto dto)
    {
        try
        {
            // ׳§׳‘׳׳× ׳”׳׳©׳×׳׳© ׳”׳׳—׳•׳‘׳¨
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                return Unauthorized("׳׳©׳×׳׳© ׳׳ ׳׳–׳•׳”׳”");

            // ׳•׳•׳׳™׳“׳¦׳™׳”
            if (string.IsNullOrWhiteSpace(dto.DisplayName))
                return BadRequest("׳©׳ ׳”׳×׳¦׳•׳’׳” ׳”׳•׳ ׳©׳“׳” ׳—׳•׳‘׳”");

            if (dto.Categories == null || !dto.Categories.Any())
                return BadRequest("חובה לבחור לפחות קטגוריה אחת");

            var managedPagesCount = await CountManagedPagesAsync(userId);
            if (managedPagesCount >= MaxManagedPagesPerUser)
                return BadRequest($"׳׳₪׳©׳¨ ׳׳ ׳”׳ ׳¢׳“ {MaxManagedPagesPerUser} ׳“׳₪׳™׳ ׳‘׳׳‘׳“");

            var existingProvider = await _context.ServiceProviders
                .FirstOrDefaultAsync(sp => sp.UserId == userId
                    && !sp.IsTeacher
                    && !sp.IsDeleted
                    && sp.DisplayName == dto.DisplayName);

            if (existingProvider != null)
            {
                if (dto.AgencyId.HasValue)
                {
                    var existingAgency = await _context.Agencies
                        .FirstOrDefaultAsync(a => a.Id == dto.AgencyId.Value && !a.IsDeleted && a.IsActive);

                    if (existingAgency == null)
                        return BadRequest("׳”׳¡׳•׳›׳ ׳•׳× ׳׳ ׳ ׳׳¦׳׳” ׳׳• ׳׳™׳ ׳” ׳₪׳¢׳™׳׳”");

                    await LinkServiceProviderToAgencyAsync(existingAgency.Id, existingProvider.Id);
                    await _context.SaveChangesAsync();

                    var existingResult = await _service.GetServiceProviderByIdAsync(existingProvider.Id);
                    return Ok(existingResult);
                }

                return BadRequest("׳›׳‘׳¨ ׳™׳¦׳¨׳× ׳₪׳¨׳•׳₪׳™׳ ׳‘׳¢׳ ׳׳§׳¦׳•׳¢ ׳‘׳©׳ ׳”׳–׳”");
            }

            Agency? agency = null;
            if (dto.AgencyId.HasValue)
            {
                agency = await _context.Agencies
                    .FirstOrDefaultAsync(a => a.Id == dto.AgencyId.Value && !a.IsDeleted && a.IsActive);

                if (agency == null)
                    return BadRequest("׳”׳¡׳•׳›׳ ׳•׳× ׳׳ ׳ ׳׳¦׳׳” ׳׳• ׳׳™׳ ׳” ׳₪׳¢׳™׳׳”");
            }

            // ׳‘׳“׳™׳§׳× ׳׳ ׳•׳™ ׳₪׳¢׳™׳ (׳׳•׳₪׳¦׳™׳•׳ ׳׳™ - ׳׳§׳‘׳™׳¢׳× Premium)
            var activeSubscription = await _context.Subscriptions
                .Where(s => s.UserId == userId)
                .Where(s => s.Status == SubscriptionStatus.Active || s.Status == SubscriptionStatus.Trial)
                .OrderByDescending(s => s.CreatedAt)
                .FirstOrDefaultAsync();

            // ׳§׳‘׳™׳¢׳× ׳”׳׳ ׳–׳” ׳”׳₪׳¨׳•׳₪׳™׳ ׳”׳¨׳׳©׳™ (׳”׳¨׳׳©׳•׳ ׳׳׳©׳×׳׳©)
            bool isPrimaryProfile = managedPagesCount == 0;

            // ׳™׳¦׳™׳¨׳× Service Provider
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
                BannerImageUrl = dto.BannerImageUrl,
                VideoUrl = dto.VideoUrl,
                YearsOfExperience = dto.YearsOfExperience,
                WorkingHours = dto.WorkingHours,
                ParkingType = dto.ParkingType,
                HasAccessibleEntrance = dto.HasAccessibleEntrance,
                IsAnash = dto.IsAnash,
                IsFeatured = false,
                Status = ProfileStatus.Pending,
                IsPrimaryProfile = isPrimaryProfile,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
            };

            // ׳§׳™׳©׳•׳¨ ׳׳׳ ׳•׳™ ׳׳ ׳§׳™׳™׳
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

            // ׳”׳•׳¡׳₪׳× ׳§׳˜׳’׳•׳¨׳™׳•׳×
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

            // ׳”׳•׳¡׳₪׳× ׳’׳׳¨׳™׳” - ׳×׳׳™׳“ ׳׳•׳×׳¨ ׳׳”׳•׳¡׳™׳£ ׳’׳׳¨׳™׳”
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

            if (dto.CustomerTestimonials != null && dto.CustomerTestimonials.Any())
            {
                foreach (var testimonial in dto.CustomerTestimonials.Where(item => !string.IsNullOrWhiteSpace(item.Text)))
                {
                    _context.ServiceProviderTestimonials.Add(new MusicServiceProviderTestimonial
                    {
                        ServiceProviderId = serviceProvider.Id,
                        ClientName = testimonial.ClientName,
                        Text = testimonial.Text,
                        Order = testimonial.Order
                    });
                }
            }

            if (dto.Branches != null && dto.Branches.Any())
            {
                foreach (var branch in dto.Branches.Where(item => !string.IsNullOrWhiteSpace(item.Name)))
                {
                    _context.ServiceProviderBranches.Add(new MusicServiceProviderBranch
                    {
                        ServiceProviderId = serviceProvider.Id,
                        Name = branch.Name,
                        CityId = branch.CityId,
                        ImageUrl = branch.ImageUrl,
                        Address = branch.Address,
                        PhoneNumber = branch.PhoneNumber,
                        Email = branch.Email,
                        OpeningHours = branch.OpeningHours,
                        Order = branch.Order,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }

            if (agency != null)
            {
                await LinkServiceProviderToAgencyAsync(agency.Id, serviceProvider.Id);
            }

            await _context.SaveChangesAsync();

            // ׳”׳—׳–׳¨׳× ׳₪׳¨׳˜׳™ ׳‘׳¢׳ ׳”׳׳§׳¦׳•׳¢ ׳”׳׳׳׳™׳
            var result = await _service.GetServiceProviderByIdAsync(serviceProvider.Id);

            await _notificationService.NotifyServiceProviderSubmittedAsync(userId, serviceProvider.Id, serviceProvider.DisplayName);

            _logger.LogInformation("Service provider profile created (pending): ProviderId={ProviderId} UserId={UserId} Name={Name}",
                serviceProvider.Id, userId, serviceProvider.DisplayName);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Create service provider profile failed");
            return StatusCode(500, $"׳©׳’׳™׳׳” ׳‘׳™׳¦׳™׳¨׳× ׳₪׳¨׳•׳₪׳™׳ ׳‘׳¢׳ ׳׳§׳¦׳•׳¢: {ex.Message}");
        }
    }

    private async Task LinkServiceProviderToAgencyAsync(int agencyId, int serviceProviderId)
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

    // DELETE: api/MusicServiceProviders/5
    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteServiceProvider(int id)
    {
        var result = await _service.DeleteServiceProviderAsync(id);

        if (!result)
        {
            return NotFound(new { message = "׳‘׳¢׳ ׳”׳׳§׳¦׳•׳¢ ׳׳ ׳ ׳׳¦׳" });
        }

        return NoContent();
    }

    // POST: api/MusicServiceProviders/5/approve
    [HttpPost("{id}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> ApproveServiceProvider(int id)
    {
        var result = await _service.ApproveServiceProviderAsync(id);

        if (!result)
        {
            return NotFound(new { message = "׳‘׳¢׳ ׳”׳׳§׳¦׳•׳¢ ׳׳ ׳ ׳׳¦׳" });
        }

        _logger.LogInformation("Service provider approved: ProviderId={ProviderId}", id);
        return Ok(new { message = "׳‘׳¢׳ ׳”׳׳§׳¦׳•׳¢ ׳׳•׳©׳¨ ׳‘׳”׳¦׳׳—׳”" });
    }

    // POST: api/MusicServiceProviders/5/reject
    [HttpPost("{id}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> RejectServiceProvider(int id)
    {
        var result = await _service.RejectServiceProviderAsync(id);

        if (!result)
        {
            return NotFound(new { message = "׳‘׳¢׳ ׳”׳׳§׳¦׳•׳¢ ׳׳ ׳ ׳׳¦׳" });
        }

        _logger.LogInformation("Service provider rejected: ProviderId={ProviderId}", id);
        return Ok(new { message = "׳‘׳¢׳ ׳”׳׳§׳¦׳•׳¢ ׳ ׳“׳—׳”" });
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
            return Ok(new { message = "׳‘׳¢׳ ׳”׳׳§׳¦׳•׳¢ ׳§׳•׳©׳¨ ׳׳׳©׳×׳׳© ׳‘׳”׳¦׳׳—׳”" });
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
            return Ok(new { message = "׳‘׳¢׳ ׳”׳׳§׳¦׳•׳¢ ׳ ׳•׳×׳§ ׳׳”׳׳©׳×׳׳© ׳‘׳”׳¦׳׳—׳”" });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    // POST: api/MusicServiceProviders/5/duplicate
    [HttpPost("{id}/duplicate")]
    public async Task<ActionResult<MusicServiceProviderDto>> DuplicateServiceProvider(int id)
    {
        try
        {
            var duplicate = await _service.DuplicateServiceProviderAsync(id);
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
