using AkordishKeit.Data;
using AkordishKeit.Extensions;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class TeacherService : ITeacherService
{
    private readonly AkordishKeitDbContext _context;

    public TeacherService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<TeacherListDto>> GetTeachersAsync(
        string? search,
        int? instrumentId,
        int? cityId,
        int? status,
        bool? isFeatured,
        int pageNumber,
        int pageSize)
    {
        var query = _context.Teachers
            .Include(t => t.ServiceProvider)
                .ThenInclude(sp => sp.User)
            .Include(t => t.ServiceProvider.Categories)
                .ThenInclude(c => c.Category)
            .Include(t => t.Instruments)
                .ThenInclude(ti => ti.Instrument)
            .Where(t => !t.ServiceProvider.IsDeleted && t.ServiceProvider.IsTeacher)
            .AsQueryable();

        // Apply filters
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(t =>
                t.ServiceProvider.DisplayName.Contains(search) ||
                t.ServiceProvider.User.Username.Contains(search) ||
                t.ServiceProvider.User.Email.Contains(search));
        }

        if (instrumentId.HasValue)
        {
            query = query.Where(t => t.Instruments.Any(i => i.InstrumentId == instrumentId.Value));
        }

        if (cityId.HasValue)
        {
            query = query.Where(t => t.ServiceProvider.CityId == cityId.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(t => t.ServiceProvider.Status == (ProfileStatus)status.Value);
        }

        if (isFeatured.HasValue)
        {
            query = query.Where(t => t.ServiceProvider.IsFeatured == isFeatured.Value);
        }

        // Order by: Featured > Tier (Subscribed) > CreatedAt
        // קדימות לפי האיפיון: מומלצים ראשון, מנויים משלמים לפני חינמיים, ואז לפי תאריך
        query = query
            .OrderByDescending(t => t.ServiceProvider.IsFeatured)      // מומלצים ראשון
            .ThenByDescending(t => t.ServiceProvider.Tier)             // מנויים משלמים (Subscribed=1) לפני חינמיים (Free=0)
            .ThenByDescending(t => t.ServiceProvider.CreatedAt);       // החדשים לפני

        // Get paginated entities
        var pagedEntities = await query.ToPagedResultAsync(pageNumber, pageSize);

        // Map to DTOs
        var dtos = pagedEntities.Items.Select(MapToListDto).ToList();

        return new PagedResult<TeacherListDto>
        {
            Items = dtos,
            TotalCount = pagedEntities.TotalCount,
            PageNumber = pagedEntities.PageNumber,
            PageSize = pagedEntities.PageSize
        };
    }

    public async Task<TeacherDto?> GetTeacherByIdAsync(int id)
    {
        var teacher = await _context.Teachers
            .Include(t => t.ServiceProvider)
                .ThenInclude(sp => sp.User)
            .Include(t => t.ServiceProvider.Categories)
                .ThenInclude(c => c.Category)
            .Include(t => t.ServiceProvider.GalleryImages)
            .Include(t => t.Instruments)
                .ThenInclude(ti => ti.Instrument)
            .FirstOrDefaultAsync(t => t.Id == id && !t.ServiceProvider.IsDeleted);

        return teacher == null ? null : MapToDto(teacher);
    }

    public async Task<TeacherDto?> GetTeacherByUserIdAsync(int userId)
    {
        var teacher = await _context.Teachers
            .Include(t => t.ServiceProvider)
                .ThenInclude(sp => sp.User)
            .Include(t => t.ServiceProvider.Categories)
                .ThenInclude(c => c.Category)
            .Include(t => t.ServiceProvider.GalleryImages)
            .Include(t => t.Instruments)
                .ThenInclude(ti => ti.Instrument)
            .FirstOrDefaultAsync(t => t.ServiceProvider.UserId == userId && !t.ServiceProvider.IsDeleted);

        return teacher == null ? null : MapToDto(teacher);
    }

    public async Task<TeacherDto> CreateTeacherAsync(CreateTeacherDto dto)
    {
        // Check if user already has a service provider profile
        if (dto.UserId != null)
        {
            var existingProfile = await _context.ServiceProviders
                .FirstOrDefaultAsync(sp => sp.UserId == dto.UserId && !sp.IsDeleted);

            if (existingProfile != null)
            {
                throw new InvalidOperationException("המשתמש כבר ה irshירשם כבעל מקצוע או מורה");
            }
        }
        // Create MusicServiceProvider
        var serviceProvider = new MusicServiceProvider
        {
            UserId = dto.UserId,
            DisplayName = dto.DisplayName,
            ProfileImageUrl = dto.ProfileImageUrl,
            ShortBio = dto.ShortBio,
            FullDescription = dto.FullDescription,
            IsTeacher = true,  // Always true for teachers
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

        // Create Teacher
        var teacher = new Teacher
        {
            Id = serviceProvider.Id,
            PriceList = dto.PriceList,
            Languages = dto.Languages,
            TargetAudience = dto.TargetAudience,
            Availability = dto.Availability,
            Education = dto.Education,
            LessonTypes = dto.LessonTypes,
            Specializations = dto.Specializations
        };

        // Add instruments
        foreach (var instrumentDto in dto.Instruments)
        {
            teacher.Instruments.Add(new TeacherInstrument
            {
                InstrumentId = instrumentDto.InstrumentId,
                IsPrimary = instrumentDto.IsPrimary
            });
        }

        _context.Teachers.Add(teacher);
        await _context.SaveChangesAsync();

        return (await GetTeacherByIdAsync(teacher.Id))!;
    }

    public async Task<TeacherDto> UpdateTeacherAsync(int id, UpdateTeacherDto dto)
    {
        var teacher = await _context.Teachers
            .Include(t => t.ServiceProvider)
                .ThenInclude(sp => sp.Categories)
            .Include(t => t.ServiceProvider.GalleryImages)
            .Include(t => t.Instruments)
            .FirstOrDefaultAsync(t => t.Id == id && !t.ServiceProvider.IsDeleted);

        if (teacher == null)
        {
            throw new InvalidOperationException("המורה לא נמצא");
        }

        // Update ServiceProvider fields
        teacher.ServiceProvider.DisplayName = dto.DisplayName;
        teacher.ServiceProvider.ProfileImageUrl = dto.ProfileImageUrl;
        teacher.ServiceProvider.ShortBio = dto.ShortBio;
        teacher.ServiceProvider.FullDescription = dto.FullDescription;
        teacher.ServiceProvider.CityId = dto.CityId;
        teacher.ServiceProvider.Location = dto.Location;
        teacher.ServiceProvider.YearsOfExperience = dto.YearsOfExperience;
        teacher.ServiceProvider.WorkingHours = dto.WorkingHours;
        teacher.ServiceProvider.WhatsAppNumber = dto.WhatsAppNumber;
        teacher.ServiceProvider.PhoneNumber = dto.PhoneNumber;
        teacher.ServiceProvider.Email = dto.Email;
        teacher.ServiceProvider.WebsiteUrl = dto.WebsiteUrl;
        teacher.ServiceProvider.VideoUrl = dto.VideoUrl;
        teacher.ServiceProvider.IsFeatured = dto.IsFeatured;
        teacher.ServiceProvider.Status = (ProfileStatus)dto.Status;
        teacher.ServiceProvider.UpdatedAt = DateTime.UtcNow;

        // Update categories
        teacher.ServiceProvider.Categories.Clear();
        if (dto.Categories != null && dto.Categories.Any())
        {
            foreach (var categoryDto in dto.Categories)
            {
                teacher.ServiceProvider.Categories.Add(new MusicServiceProviderCategoryMapping
                {
                    ServiceProviderId = teacher.ServiceProvider.Id,
                    CategoryId = categoryDto.CategoryId,
                    SubCategory = categoryDto.SubCategory
                });
            }
        }

        // Update gallery images
        teacher.ServiceProvider.GalleryImages.Clear();
        if (dto.GalleryImages != null && dto.GalleryImages.Any())
        {
            foreach (var imageDto in dto.GalleryImages)
            {
                teacher.ServiceProvider.GalleryImages.Add(new MusicServiceProviderGalleryImage
                {
                    ServiceProviderId = teacher.ServiceProvider.Id,
                    ImageUrl = imageDto.ImageUrl,
                    Caption = imageDto.Caption,
                    Order = imageDto.Order,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        // Update Teacher fields
        teacher.PriceList = dto.PriceList;
        teacher.Languages = dto.Languages;
        teacher.TargetAudience = dto.TargetAudience;
        teacher.Availability = dto.Availability;
        teacher.Education = dto.Education;
        teacher.LessonTypes = dto.LessonTypes;
        teacher.Specializations = dto.Specializations;

        // Update instruments
        teacher.Instruments.Clear();
        foreach (var instrumentDto in dto.Instruments)
        {
            teacher.Instruments.Add(new TeacherInstrument
            {
                TeacherId = teacher.Id,
                InstrumentId = instrumentDto.InstrumentId,
                IsPrimary = instrumentDto.IsPrimary
            });
        }

        await _context.SaveChangesAsync();

        return (await GetTeacherByIdAsync(id))!;
    }

    public async Task<bool> DeleteTeacherAsync(int id)
    {
        var teacher = await _context.Teachers
            .Include(t => t.ServiceProvider)
            .FirstOrDefaultAsync(t => t.Id == id && !t.ServiceProvider.IsDeleted);

        if (teacher == null)
        {
            return false;
        }

        teacher.ServiceProvider.IsDeleted = true;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> ApproveTeacherAsync(int id)
    {
        var teacher = await _context.Teachers
            .Include(t => t.ServiceProvider)
            .FirstOrDefaultAsync(t => t.Id == id && !t.ServiceProvider.IsDeleted);

        if (teacher == null)
        {
            return false;
        }

        teacher.ServiceProvider.Status = ProfileStatus.Active;
        teacher.ServiceProvider.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> RejectTeacherAsync(int id)
    {
        var teacher = await _context.Teachers
            .Include(t => t.ServiceProvider)
            .FirstOrDefaultAsync(t => t.Id == id && !t.ServiceProvider.IsDeleted);

        if (teacher == null)
        {
            return false;
        }

        teacher.ServiceProvider.Status = ProfileStatus.Suspended;
        teacher.ServiceProvider.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task LinkToUserAsync(int teacherId, int userId)
    {
        var teacher = await _context.Teachers
            .Include(t => t.ServiceProvider)
            .FirstOrDefaultAsync(t => t.Id == teacherId && !t.ServiceProvider.IsDeleted);

        if (teacher == null)
        {
            throw new InvalidOperationException("המורה לא נמצא");
        }

        if (teacher.ServiceProvider.UserId.HasValue)
        {
            throw new InvalidOperationException("המורה כבר מקושר למשתמש");
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new InvalidOperationException("המשתמש לא נמצא");
        }

        var userHasProfile = await _context.ServiceProviders
            .AnyAsync(sp => sp.UserId == userId && !sp.IsDeleted);
        if (userHasProfile)
        {
            throw new InvalidOperationException("למשתמש כבר יש פרופיל בעל מקצוע");
        }

        teacher.ServiceProvider.UserId = userId;
        teacher.ServiceProvider.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    public async Task UnlinkFromUserAsync(int teacherId)
    {
        var teacher = await _context.Teachers
            .Include(t => t.ServiceProvider)
            .FirstOrDefaultAsync(t => t.Id == teacherId && !t.ServiceProvider.IsDeleted);

        if (teacher == null)
        {
            throw new InvalidOperationException("המורה לא נמצא");
        }

        if (!teacher.ServiceProvider.UserId.HasValue)
        {
            throw new InvalidOperationException("המורה לא מקושר למשתמש");
        }

        teacher.ServiceProvider.UserId = null;
        teacher.ServiceProvider.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }

    // ═══════════════════════════════════════════════════════════
    //                    Mapping Methods
    // ═══════════════════════════════════════════════════════════

    private static TeacherDto MapToDto(Teacher entity)
    {
        return new TeacherDto
        {
            Id = entity.Id,
            UserId = entity.ServiceProvider.UserId,
            UserName = entity.ServiceProvider.User?.Username,
            UserEmail = entity.ServiceProvider.User?.Email,
            DisplayName = entity.ServiceProvider.DisplayName,
            ProfileImageUrl = entity.ServiceProvider.ProfileImageUrl,
            ShortBio = entity.ServiceProvider.ShortBio,
            FullDescription = entity.ServiceProvider.FullDescription,
            IsTeacher = entity.ServiceProvider.IsTeacher,
            CityId = entity.ServiceProvider.CityId,
            CityName = null, // City name should be fetched from CitiesController
            Location = entity.ServiceProvider.Location,
            YearsOfExperience = entity.ServiceProvider.YearsOfExperience,
            WorkingHours = entity.ServiceProvider.WorkingHours,
            WhatsAppNumber = entity.ServiceProvider.WhatsAppNumber,
            PhoneNumber = entity.ServiceProvider.PhoneNumber,
            Email = entity.ServiceProvider.Email,
            WebsiteUrl = entity.ServiceProvider.WebsiteUrl,
            VideoUrl = entity.ServiceProvider.VideoUrl,
            IsFeatured = entity.ServiceProvider.IsFeatured,
            Status = (int)entity.ServiceProvider.Status,
            StatusName = entity.ServiceProvider.Status.ToString(),
            CreatedAt = entity.ServiceProvider.CreatedAt,
            UpdatedAt = entity.ServiceProvider.UpdatedAt,
            Categories = entity.ServiceProvider.Categories.Select(c => new ServiceProviderCategoryDto
            {
                Id = c.Id,
                CategoryId = c.CategoryId,
                CategoryName = c.Category.Name,
                SubCategory = c.SubCategory
            }).ToList(),
            GalleryImages = entity.ServiceProvider.GalleryImages.OrderBy(g => g.Order).Select(g => new GalleryImageDto
            {
                Id = g.Id,
                ImageUrl = g.ImageUrl,
                Caption = g.Caption,
                Order = g.Order
            }).ToList(),
            PriceList = entity.PriceList,
            Languages = entity.Languages,
            TargetAudience = entity.TargetAudience,
            Availability = entity.Availability,
            Education = entity.Education,
            LessonTypes = entity.LessonTypes,
            Specializations = entity.Specializations,
            Instruments = entity.Instruments.Select(i => new TeacherInstrumentDto
            {
                Id = i.Id,
                InstrumentId = i.InstrumentId,
                InstrumentName = i.Instrument.Name,
                IsPrimary = i.IsPrimary
            }).ToList()
        };
    }

    private static TeacherListDto MapToListDto(Teacher entity)
    {
        var primaryInstrument = entity.Instruments.FirstOrDefault(i => i.IsPrimary);

        return new TeacherListDto
        {
            Id = entity.Id,
            UserId = entity.ServiceProvider.UserId,
            DisplayName = entity.ServiceProvider.DisplayName,
            UserName = entity.ServiceProvider.User?.Username,
            ProfileImageUrl = entity.ServiceProvider.ProfileImageUrl,
            CityId = entity.ServiceProvider.CityId,
            CityName = null, // City name should be fetched from CitiesController
            Location = entity.ServiceProvider.Location,
            YearsOfExperience = entity.ServiceProvider.YearsOfExperience,
            IsTeacher = entity.ServiceProvider.IsTeacher,
            IsFeatured = entity.ServiceProvider.IsFeatured,
            Status = (int)entity.ServiceProvider.Status,
            StatusName = entity.ServiceProvider.Status.ToString(),
            CreatedAt = entity.ServiceProvider.CreatedAt,
            CategoriesCount = entity.ServiceProvider.Categories.Count,
            InstrumentsCount = entity.Instruments.Count,
            PrimaryInstrument = primaryInstrument?.Instrument.Name,
            InstrumentIds = entity.Instruments.Select(i => i.InstrumentId).ToList(),
            Languages = entity.Languages,
            TargetAudience = entity.TargetAudience
        };
    }
}
