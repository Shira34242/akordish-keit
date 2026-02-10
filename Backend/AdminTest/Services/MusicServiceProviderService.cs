using AkordishKeit.Data;
using AkordishKeit.Extensions;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class MusicServiceProviderService : IMusicServiceProviderService
{
    private readonly AkordishKeitDbContext _context;

    public MusicServiceProviderService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<MusicServiceProviderListDto>> GetServiceProvidersAsync(
        string? search,
        int? categoryId,
        int? cityId,
        int? status,
        bool? isFeatured,
        bool? isTeacher,
        int pageNumber,
        int pageSize)
    {
        var query = _context.ServiceProviders
            .Include(sp => sp.User)
            .Include(sp => sp.Categories)
                .ThenInclude(c => c.Category)
            .Where(sp => !sp.IsDeleted)
            .AsQueryable();

        // Apply filters
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(sp =>
                sp.DisplayName.Contains(search) ||
                (sp.User != null && sp.User.Username.Contains(search)) ||
                (sp.User != null && sp.User.Email.Contains(search)));
        }

        if (categoryId.HasValue)
        {
            query = query.Where(sp => sp.Categories.Any(c => c.CategoryId == categoryId.Value));
        }

        if (cityId.HasValue)
        {
            query = query.Where(sp => sp.CityId == cityId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(sp => sp.Status == (ProfileStatus)status.Value);
        }

        if (isFeatured.HasValue)
        {
            query = query.Where(sp => sp.IsFeatured == isFeatured.Value);
        }

        if (isTeacher.HasValue)
        {
            query = query.Where(sp => sp.IsTeacher == isTeacher.Value);
        }

        // Order by: Featured > Tier (Subscribed) > CreatedAt
        // קדימות לפי האיפיון: מומלצים ראשון, מנויים משלמים לפני חינמיים, ואז לפי תאריך
        query = query
            .OrderByDescending(sp => sp.IsFeatured)      // מומלצים ראשון
            .ThenByDescending(sp => sp.Tier)             // מנויים משלמים (Subscribed=1) לפני חינמיים (Free=0)
            .ThenByDescending(sp => sp.CreatedAt);       // החדשים לפני

        // Get paginated entities
        var pagedEntities = await query.ToPagedResultAsync(pageNumber, pageSize);

        // Map to DTOs
        var dtos = pagedEntities.Items.Select(MapToListDto).ToList();

        return new PagedResult<MusicServiceProviderListDto>
        {
            Items = dtos,
            TotalCount = pagedEntities.TotalCount,
            PageNumber = pagedEntities.PageNumber,
            PageSize = pagedEntities.PageSize
        };
    }

    public async Task<MusicServiceProviderDto?> GetServiceProviderByIdAsync(int id)
    {
        var serviceProvider = await _context.ServiceProviders
            .Include(sp => sp.User)
            .Include(sp => sp.Categories)
                .ThenInclude(c => c.Category)
            .Include(sp => sp.GalleryImages)
            .FirstOrDefaultAsync(sp => sp.Id == id && !sp.IsDeleted);

        return serviceProvider == null ? null : MapToDto(serviceProvider);
    }

    public async Task<MusicServiceProviderDto?> GetServiceProviderByUserIdAsync(int userId)
    {
        var serviceProvider = await _context.ServiceProviders
            .Include(sp => sp.User)
            .Include(sp => sp.Categories)
                .ThenInclude(c => c.Category)
            .Include(sp => sp.GalleryImages)
            .FirstOrDefaultAsync(sp => sp.UserId == userId && !sp.IsDeleted);

        return serviceProvider == null ? null : MapToDto(serviceProvider);
    }

    public async Task<MusicServiceProviderDto> CreateServiceProviderAsync(CreateMusicServiceProviderDto dto)
    {
        // Only check for duplicate TEACHER profile - users can have multiple professional profiles
        if (dto.IsTeacher && dto.UserId.HasValue)
        {
            var existingTeacher = await _context.ServiceProviders
                .FirstOrDefaultAsync(sp => sp.UserId == dto.UserId && sp.IsTeacher == true && !sp.IsDeleted);

            if (existingTeacher != null)
            {
                throw new InvalidOperationException("למשתמש כבר יש פרופיל מורה");
            }
        }
        // Allow multiple professional profiles (isTeacher=false) - no additional check needed

        var serviceProvider = new MusicServiceProvider
        {
            UserId = dto.UserId,
            DisplayName = dto.DisplayName,
            ProfileImageUrl = dto.ProfileImageUrl,
            ShortBio = dto.ShortBio,
            FullDescription = dto.FullDescription,
            IsTeacher = dto.IsTeacher,
            CityId = dto.CityId,
            Location = dto.Location,
            YearsOfExperience = dto.YearsOfExperience,
            WorkingHours = dto.WorkingHours,
            WhatsAppNumber = dto.WhatsAppNumber,
            PhoneNumber = dto.PhoneNumber,
            Email = dto.Email,
            WebsiteUrl = dto.WebsiteUrl,
            VideoUrl = dto.VideoUrl,
            IsFeatured = dto.IsFeatured,
            Status = (ProfileStatus)dto.Status,
            CreatedAt = DateTime.UtcNow
        };

        // Add categories
        if (dto.Categories != null && dto.Categories.Any())
        {
            foreach (var categoryDto in dto.Categories)
            {
                serviceProvider.Categories.Add(new MusicServiceProviderCategoryMapping
                {
                    CategoryId = categoryDto.CategoryId,
                    SubCategory = categoryDto.SubCategory
                });
            }
        }

        // Add gallery images
        if (dto.GalleryImages != null && dto.GalleryImages.Any())
        {
            foreach (var imageDto in dto.GalleryImages)
            {
                serviceProvider.GalleryImages.Add(new MusicServiceProviderGalleryImage
                {
                    ImageUrl = imageDto.ImageUrl,
                    Caption = imageDto.Caption,
                    Order = imageDto.Order,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        _context.ServiceProviders.Add(serviceProvider);
        await _context.SaveChangesAsync();

        return (await GetServiceProviderByIdAsync(serviceProvider.Id))!;
    }

    public async Task<MusicServiceProviderDto> UpdateServiceProviderAsync(int id, UpdateMusicServiceProviderDto dto)
    {
        var serviceProvider = await _context.ServiceProviders
            .Include(sp => sp.Categories)
            .Include(sp => sp.GalleryImages)
            .FirstOrDefaultAsync(sp => sp.Id == id && !sp.IsDeleted);

        if (serviceProvider == null)
        {
            throw new InvalidOperationException("בעל המקצוע לא נמצא");
        }

        // Update basic fields
        serviceProvider.DisplayName = dto.DisplayName;
        serviceProvider.ProfileImageUrl = dto.ProfileImageUrl;
        serviceProvider.ShortBio = dto.ShortBio;
        serviceProvider.FullDescription = dto.FullDescription;
        serviceProvider.CityId = dto.CityId;
        serviceProvider.Location = dto.Location;
        serviceProvider.YearsOfExperience = dto.YearsOfExperience;
        serviceProvider.WorkingHours = dto.WorkingHours;
        serviceProvider.WhatsAppNumber = dto.WhatsAppNumber;
        serviceProvider.PhoneNumber = dto.PhoneNumber;
        serviceProvider.Email = dto.Email;
        serviceProvider.WebsiteUrl = dto.WebsiteUrl;
        serviceProvider.VideoUrl = dto.VideoUrl;
        serviceProvider.IsFeatured = dto.IsFeatured;
        serviceProvider.Status = (ProfileStatus)dto.Status;
        serviceProvider.UpdatedAt = DateTime.UtcNow;

        // Update categories
        serviceProvider.Categories.Clear();
        if (dto.Categories != null && dto.Categories.Any())
        {
            foreach (var categoryDto in dto.Categories)
            {
                serviceProvider.Categories.Add(new MusicServiceProviderCategoryMapping
                {
                    ServiceProviderId = serviceProvider.Id,
                    CategoryId = categoryDto.CategoryId,
                    SubCategory = categoryDto.SubCategory
                });
            }
        }

        // Update gallery images
        serviceProvider.GalleryImages.Clear();
        if (dto.GalleryImages != null && dto.GalleryImages.Any())
        {
            foreach (var imageDto in dto.GalleryImages)
            {
                serviceProvider.GalleryImages.Add(new MusicServiceProviderGalleryImage
                {
                    ServiceProviderId = serviceProvider.Id,
                    ImageUrl = imageDto.ImageUrl,
                    Caption = imageDto.Caption,
                    Order = imageDto.Order,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await _context.SaveChangesAsync();

        return (await GetServiceProviderByIdAsync(id))!;
    }

    public async Task<bool> DeleteServiceProviderAsync(int id)
    {
        var serviceProvider = await _context.ServiceProviders
            .FirstOrDefaultAsync(sp => sp.Id == id && !sp.IsDeleted);

        if (serviceProvider == null)
        {
            return false;
        }

        serviceProvider.IsDeleted = true;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> ApproveServiceProviderAsync(int id)
    {
        var serviceProvider = await _context.ServiceProviders
            .FirstOrDefaultAsync(sp => sp.Id == id && !sp.IsDeleted);

        if (serviceProvider == null)
        {
            return false;
        }

        serviceProvider.Status = ProfileStatus.Active;
        serviceProvider.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> RejectServiceProviderAsync(int id)
    {
        var serviceProvider = await _context.ServiceProviders
            .FirstOrDefaultAsync(sp => sp.Id == id && !sp.IsDeleted);

        if (serviceProvider == null)
        {
            return false;
        }

        serviceProvider.Status = ProfileStatus.Suspended;
        serviceProvider.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> UserHasServiceProviderProfileAsync(int userId)
    {
        return await _context.ServiceProviders
            .AnyAsync(sp => sp.UserId == userId && !sp.IsDeleted);
    }

    public async Task LinkToUserAsync(int providerId, int userId)
    {
        var provider = await _context.ServiceProviders
            .FirstOrDefaultAsync(sp => sp.Id == providerId && !sp.IsDeleted);

        if (provider == null)
        {
            throw new InvalidOperationException("בעל המקצוע לא נמצא");
        }

        if (provider.UserId.HasValue)
        {
            throw new InvalidOperationException("בעל המקצוע כבר מקושר למשתמש");
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new InvalidOperationException("המשתמש לא נמצא");
        }

        // Only prevent linking if trying to create duplicate TEACHER
        if (provider.IsTeacher)
        {
            var userHasTeacher = await _context.ServiceProviders
                .AnyAsync(sp => sp.UserId == userId && sp.IsTeacher == true && !sp.IsDeleted);
            if (userHasTeacher)
            {
                throw new InvalidOperationException("למשתמש כבר יש פרופיל מורה");
            }
        }
        // Allow linking multiple professional profiles to same user

        provider.UserId = userId;
        provider.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    public async Task UnlinkFromUserAsync(int providerId)
    {
        var provider = await _context.ServiceProviders
            .FirstOrDefaultAsync(sp => sp.Id == providerId && !sp.IsDeleted);

        if (provider == null)
        {
            throw new InvalidOperationException("בעל המקצוע לא נמצא");
        }

        if (!provider.UserId.HasValue)
        {
            throw new InvalidOperationException("בעל המקצוע לא מקושר למשתמש");
        }

        provider.UserId = null;
        provider.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    // ═══════════════════════════════════════════════════════════
    //                    Mapping Methods
    // ═══════════════════════════════════════════════════════════

    private static MusicServiceProviderDto MapToDto(MusicServiceProvider entity)
    {
        return new MusicServiceProviderDto
        {
            Id = entity.Id,
            UserId = entity.UserId,
            UserName = entity.User?.Username,
            UserEmail = entity.User?.Email,
            DisplayName = entity.DisplayName,
            ProfileImageUrl = entity.ProfileImageUrl,
            ShortBio = entity.ShortBio,
            FullDescription = entity.FullDescription,
            IsTeacher = entity.IsTeacher,
            CityId = entity.CityId,
            CityName = null, // City name should be fetched from CitiesController
            Location = entity.Location,
            YearsOfExperience = entity.YearsOfExperience,
            WorkingHours = entity.WorkingHours,
            WhatsAppNumber = entity.WhatsAppNumber,
            PhoneNumber = entity.PhoneNumber,
            Email = entity.Email,
            WebsiteUrl = entity.WebsiteUrl,
            VideoUrl = entity.VideoUrl,
            IsFeatured = entity.IsFeatured,
            Status = (int)entity.Status,
            StatusName = entity.Status.ToString(),
            CreatedAt = entity.CreatedAt,
            UpdatedAt = entity.UpdatedAt,
            Categories = entity.Categories.Select(c => new ServiceProviderCategoryDto
            {
                Id = c.Id,
                CategoryId = c.CategoryId,
                CategoryName = c.Category.Name,
                SubCategory = c.SubCategory
            }).ToList(),
            GalleryImages = entity.GalleryImages.OrderBy(g => g.Order).Select(g => new GalleryImageDto
            {
                Id = g.Id,
                ImageUrl = g.ImageUrl,
                Caption = g.Caption,
                Order = g.Order
            }).ToList()
        };
    }

    private static MusicServiceProviderListDto MapToListDto(MusicServiceProvider entity)
    {
        return new MusicServiceProviderListDto
        {
            Id = entity.Id,
            UserId = entity.UserId,
            DisplayName = entity.DisplayName,
            UserName = entity.User?.Username,
            ProfileImageUrl = entity.ProfileImageUrl,
            CityId = entity.CityId,
            CityName = null, // City name should be fetched from CitiesController
            Location = entity.Location,
            YearsOfExperience = entity.YearsOfExperience,
            IsTeacher = entity.IsTeacher,
            IsFeatured = entity.IsFeatured,
            Status = (int)entity.Status,
            StatusName = entity.Status.ToString(),
            CreatedAt = entity.CreatedAt,
            CategoriesCount = entity.Categories.Count,
            CategoryName = entity.Categories.FirstOrDefault()?.Category?.Name // Get first category name
        };
    }
}
