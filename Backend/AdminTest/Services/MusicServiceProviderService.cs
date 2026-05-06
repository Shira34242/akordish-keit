using AkordishKeit.Data;
using AkordishKeit.Controllers;
using AkordishKeit.Extensions;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class MusicServiceProviderService : IMusicServiceProviderService
{
    private readonly AkordishKeitDbContext _context;
    private readonly INotificationService _notificationService;

    public MusicServiceProviderService(AkordishKeitDbContext context, INotificationService notificationService)
    {
        _context = context;
        _notificationService = notificationService;
    }

    public async Task<PagedResult<MusicServiceProviderListDto>> GetServiceProvidersAsync(
        string? search,
        int? categoryId,
        int? cityId,
        string? cityName,
        int? status,
        bool? isFeatured,
        bool? isTeacher,
        int pageNumber,
        int pageSize)
    {
        var query = _context.ServiceProviders
            .AsNoTracking()
            .Include(sp => sp.User)
            .Include(sp => sp.Categories)
                .ThenInclude(c => c.Category)
            .Include(sp => sp.Branches)
            .Where(sp => !sp.IsDeleted)
            .AsQueryable();

        var searchCity = FindCityByText(search);
        var cityNameCity = FindCityByText(cityName);
        var cityIdsForFilter = new List<int>();

        if (cityId.HasValue)
        {
            cityIdsForFilter.Add(cityId.Value);
        }

        if (searchCity != null)
        {
            cityIdsForFilter.Add(searchCity.Id);
        }

        if (cityNameCity != null)
        {
            cityIdsForFilter.Add(cityNameCity.Id);
        }

        cityIdsForFilter = cityIdsForFilter.Distinct().ToList();
        var normalizedCityName = cityName?.Trim();
        var normalizedSearch = search?.Trim();
        var shouldUseSearchAsText = !string.IsNullOrWhiteSpace(normalizedSearch) && searchCity == null;
        var cityTextTerms = BuildCityTextTerms(normalizedCityName, searchCity, cityNameCity);
        var cityTerm1 = cityTextTerms.ElementAtOrDefault(0);
        var cityTerm2 = cityTextTerms.ElementAtOrDefault(1);
        var cityTerm3 = cityTextTerms.ElementAtOrDefault(2);

        // Apply filters
        if (shouldUseSearchAsText)
        {
            query = query.Where(sp =>
                sp.DisplayName.Contains(normalizedSearch!) ||
                (sp.Location != null && sp.Location.Contains(normalizedSearch!)) ||
                (sp.User != null && sp.User.Username.Contains(normalizedSearch!)) ||
                (sp.User != null && sp.User.Email.Contains(normalizedSearch!)) ||
                sp.Categories.Any(c => c.Category.Name.Contains(normalizedSearch!) || (c.SubCategory != null && c.SubCategory.Contains(normalizedSearch!))) ||
                _context.ServiceProviderBranches.Any(b =>
                    b.ServiceProviderId == sp.Id &&
                    (
                    b.Name.Contains(normalizedSearch!) ||
                    (b.Address != null && b.Address.Contains(normalizedSearch!)) ||
                    (b.PhoneNumber != null && b.PhoneNumber.Contains(normalizedSearch!)) ||
                    (b.Email != null && b.Email.Contains(normalizedSearch!)) ||
                    (b.OpeningHours != null && b.OpeningHours.Contains(normalizedSearch!))
                    )));
        }

        if (categoryId.HasValue)
        {
            query = query.Where(sp => sp.Categories.Any(c => c.CategoryId == categoryId.Value));
        }

        if (cityIdsForFilter.Count > 0 || !string.IsNullOrWhiteSpace(normalizedCityName))
        {
            query = query.Where(sp =>
                (sp.CityId.HasValue && cityIdsForFilter.Contains(sp.CityId.Value)) ||
                _context.ServiceProviderBranches.Any(b =>
                    b.ServiceProviderId == sp.Id &&
                    (
                    (b.CityId.HasValue && cityIdsForFilter.Contains(b.CityId.Value)) ||
                    (!string.IsNullOrEmpty(cityTerm1) && (b.Name.Contains(cityTerm1) || (b.Address != null && b.Address.Contains(cityTerm1)))) ||
                    (!string.IsNullOrEmpty(cityTerm2) && (b.Name.Contains(cityTerm2) || (b.Address != null && b.Address.Contains(cityTerm2)))) ||
                    (!string.IsNullOrEmpty(cityTerm3) && (b.Name.Contains(cityTerm3) || (b.Address != null && b.Address.Contains(cityTerm3))))
                    )));
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
            .AsNoTracking()
            .Include(sp => sp.User)
            .Include(sp => sp.Categories)
                .ThenInclude(c => c.Category)
            .Include(sp => sp.GalleryImages)
            .Include(sp => sp.SocialLinks)
            .Include(sp => sp.CustomerTestimonials)
            .Include(sp => sp.Branches)
            .AsSplitQuery()
            .FirstOrDefaultAsync(sp => sp.Id == id && !sp.IsDeleted);

        return serviceProvider == null ? null : MapToDto(serviceProvider);
    }

    public async Task<MusicServiceProviderDto?> GetServiceProviderByUserIdAsync(int userId)
    {
        var serviceProvider = await _context.ServiceProviders
            .AsNoTracking()
            .Include(sp => sp.User)
            .Include(sp => sp.Categories)
                .ThenInclude(c => c.Category)
            .Include(sp => sp.GalleryImages)
            .Include(sp => sp.SocialLinks)
            .Include(sp => sp.CustomerTestimonials)
            .Include(sp => sp.Branches)
            .AsSplitQuery()
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
            ParkingType = dto.ParkingType,
            HasAccessibleEntrance = dto.HasAccessibleEntrance,
            IsAnash = dto.IsAnash,
            WhatsAppNumber = dto.WhatsAppNumber,
            PhoneNumber = dto.PhoneNumber,
            Email = dto.Email,
            WebsiteUrl = dto.WebsiteUrl,
            BannerImageUrl = dto.BannerImageUrl,
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

        if (dto.SocialLinks != null && dto.SocialLinks.Any())
        {
            foreach (var linkDto in dto.SocialLinks.Where(link => !string.IsNullOrWhiteSpace(link.Url)))
            {
                serviceProvider.SocialLinks.Add(new MusicServiceProviderSocialLink
                {
                    Platform = linkDto.Platform,
                    Url = linkDto.Url
                });
            }
        }

        AddCustomerTestimonials(serviceProvider, dto.CustomerTestimonials);
        AddBranches(serviceProvider, dto.Branches);

        _context.ServiceProviders.Add(serviceProvider);
        await _context.SaveChangesAsync();

        return (await GetServiceProviderByIdAsync(serviceProvider.Id))!;
    }

    public async Task<MusicServiceProviderDto> UpdateServiceProviderAsync(int id, UpdateMusicServiceProviderDto dto)
    {
        var serviceProvider = await _context.ServiceProviders
            .Include(sp => sp.Categories)
            .Include(sp => sp.GalleryImages)
            .Include(sp => sp.SocialLinks)
            .Include(sp => sp.CustomerTestimonials)
            .Include(sp => sp.Branches)
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
        serviceProvider.ParkingType = dto.ParkingType;
        serviceProvider.HasAccessibleEntrance = dto.HasAccessibleEntrance;
        serviceProvider.IsAnash = dto.IsAnash;
        serviceProvider.WhatsAppNumber = dto.WhatsAppNumber;
        serviceProvider.PhoneNumber = dto.PhoneNumber;
        serviceProvider.Email = dto.Email;
        serviceProvider.WebsiteUrl = dto.WebsiteUrl;
        serviceProvider.BannerImageUrl = dto.BannerImageUrl;
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

        serviceProvider.SocialLinks.Clear();
        if (dto.SocialLinks != null && dto.SocialLinks.Any())
        {
            foreach (var linkDto in dto.SocialLinks.Where(link => !string.IsNullOrWhiteSpace(link.Url)))
            {
                serviceProvider.SocialLinks.Add(new MusicServiceProviderSocialLink
                {
                    ServiceProviderId = serviceProvider.Id,
                    Platform = linkDto.Platform,
                    Url = linkDto.Url
                });
            }
        }

        serviceProvider.CustomerTestimonials.Clear();
        AddCustomerTestimonials(serviceProvider, dto.CustomerTestimonials);

        serviceProvider.Branches.Clear();
        AddBranches(serviceProvider, dto.Branches);

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

        if (serviceProvider.UserId.HasValue)
        {
            await _notificationService.NotifyServiceProviderApprovedAsync(
                serviceProvider.UserId.Value,
                serviceProvider.Id,
                serviceProvider.DisplayName);
        }

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

    public async Task<MusicServiceProviderDto> DuplicateServiceProviderAsync(int id)
    {
        var original = await _context.ServiceProviders
            .Include(sp => sp.Categories)
            .Include(sp => sp.GalleryImages)
            .Include(sp => sp.SocialLinks)
            .Include(sp => sp.CustomerTestimonials)
            .Include(sp => sp.Branches)
            .FirstOrDefaultAsync(sp => sp.Id == id && !sp.IsDeleted);

        if (original == null)
            throw new InvalidOperationException("בעל המקצוע לא נמצא");

        var newProvider = new MusicServiceProvider
        {
            UserId = null,
            DisplayName = original.DisplayName + " - עותק",
            ProfileImageUrl = original.ProfileImageUrl,
            ShortBio = original.ShortBio,
            FullDescription = original.FullDescription,
            IsTeacher = original.IsTeacher,
            CityId = original.CityId,
            Location = original.Location,
            YearsOfExperience = original.YearsOfExperience,
            WorkingHours = original.WorkingHours,
            ParkingType = original.ParkingType,
            HasAccessibleEntrance = original.HasAccessibleEntrance,
            IsAnash = original.IsAnash,
            WhatsAppNumber = original.WhatsAppNumber,
            PhoneNumber = original.PhoneNumber,
            Email = original.Email,
            WebsiteUrl = original.WebsiteUrl,
            BannerImageUrl = original.BannerImageUrl,
            VideoUrl = original.VideoUrl,
            IsFeatured = false,
            Status = ProfileStatus.Pending,
            Tier = ProfileTier.Free,
            IsPrimaryProfile = false,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false
        };

        // Copy categories
        foreach (var cat in original.Categories)
        {
            newProvider.Categories.Add(new MusicServiceProviderCategoryMapping
            {
                CategoryId = cat.CategoryId,
                SubCategory = cat.SubCategory
            });
        }

        // Copy gallery images
        foreach (var img in original.GalleryImages)
        {
            newProvider.GalleryImages.Add(new MusicServiceProviderGalleryImage
            {
                ImageUrl = img.ImageUrl,
                Caption = img.Caption,
                Order = img.Order,
                CreatedAt = DateTime.UtcNow
            });
        }

        foreach (var link in original.SocialLinks)
        {
            newProvider.SocialLinks.Add(new MusicServiceProviderSocialLink
            {
                Platform = link.Platform,
                Url = link.Url
            });
        }

        foreach (var testimonial in original.CustomerTestimonials)
        {
            newProvider.CustomerTestimonials.Add(new MusicServiceProviderTestimonial
            {
                ClientName = testimonial.ClientName,
                Text = testimonial.Text,
                Order = testimonial.Order
            });
        }

        foreach (var branch in original.Branches)
        {
            newProvider.Branches.Add(new MusicServiceProviderBranch
            {
                Name = branch.Name,
                Address = branch.Address,
                CityId = branch.CityId,
                ImageUrl = branch.ImageUrl,
                PhoneNumber = branch.PhoneNumber,
                Email = branch.Email,
                OpeningHours = branch.OpeningHours,
                Order = branch.Order,
                CreatedAt = DateTime.UtcNow
            });
        }

        _context.ServiceProviders.Add(newProvider);
        await _context.SaveChangesAsync();

        return (await GetServiceProviderByIdAsync(newProvider.Id))!;
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
            ParkingType = entity.ParkingType,
            HasAccessibleEntrance = entity.HasAccessibleEntrance,
            IsAnash = entity.IsAnash,
            WhatsAppNumber = entity.WhatsAppNumber,
            PhoneNumber = entity.PhoneNumber,
            Email = entity.Email,
            WebsiteUrl = entity.WebsiteUrl,
            BannerImageUrl = entity.BannerImageUrl,
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
            }).ToList(),
            SocialLinks = entity.SocialLinks.Select(sl => new SocialLinkDto
            {
                Id = sl.Id,
                Platform = sl.Platform,
                Url = sl.Url
            }).ToList(),
            CustomerTestimonials = entity.CustomerTestimonials.OrderBy(t => t.Order).Select(t => new ServiceProviderTestimonialDto
            {
                Id = t.Id,
                ClientName = t.ClientName,
                Text = t.Text,
                Order = t.Order
            }).ToList(),
            Branches = entity.Branches.OrderBy(b => b.Order).Select(b => new ServiceProviderBranchDto
            {
                Id = b.Id,
                Name = b.Name,
                CityId = b.CityId,
                ImageUrl = b.ImageUrl,
                Address = b.Address,
                PhoneNumber = b.PhoneNumber,
                Email = b.Email,
                OpeningHours = b.OpeningHours,
                Order = b.Order
            }).ToList()
        };
    }

    private static void AddBranches(
        MusicServiceProvider serviceProvider,
        IEnumerable<CreateServiceProviderBranchDto>? branches)
    {
        if (branches == null) return;

        foreach (var branchDto in branches.Where(b => !string.IsNullOrWhiteSpace(b.Name)))
        {
            serviceProvider.Branches.Add(new MusicServiceProviderBranch
            {
                Name = branchDto.Name,
                CityId = branchDto.CityId,
                ImageUrl = branchDto.ImageUrl,
                Address = branchDto.Address,
                PhoneNumber = branchDto.PhoneNumber,
                Email = branchDto.Email,
                OpeningHours = branchDto.OpeningHours,
                Order = branchDto.Order,
                CreatedAt = DateTime.UtcNow
            });
        }
    }

    private static void AddCustomerTestimonials(
        MusicServiceProvider serviceProvider,
        IEnumerable<CreateServiceProviderTestimonialDto>? testimonials)
    {
        if (testimonials == null) return;

        foreach (var testimonialDto in testimonials.Where(t => !string.IsNullOrWhiteSpace(t.Text)))
        {
            serviceProvider.CustomerTestimonials.Add(new MusicServiceProviderTestimonial
            {
                ClientName = testimonialDto.ClientName,
                Text = testimonialDto.Text,
                Order = testimonialDto.Order
            });
        }
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
            CategoryName = entity.Categories.FirstOrDefault()?.Category?.Name, // Get first category name
            BranchCityIds = GetBranchCityIds(entity.Branches)
        };
    }

    private static List<int> GetBranchCityIds(IEnumerable<MusicServiceProviderBranch> branches)
    {
        return branches
            .SelectMany(branch =>
            {
                var cityIds = new List<int>();
                if (branch.CityId.HasValue)
                {
                    cityIds.Add(branch.CityId.Value);
                }

                var inferredCity = FindCityByText(branch.Address) ?? FindCityByText(branch.Name);
                if (inferredCity != null)
                {
                    cityIds.Add(inferredCity.Id);
                }

                return cityIds;
            })
            .Distinct()
            .ToList();
    }

    private static List<string> BuildCityTextTerms(string? requestedCityName, CityDto? searchCity, CityDto? cityNameCity)
    {
        var terms = new List<string>();

        AddTerm(requestedCityName);
        AddCity(searchCity);
        AddCity(cityNameCity);

        return terms
            .Where(term => term.Length >= 2)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Take(3)
            .ToList();

        void AddCity(CityDto? city)
        {
            if (city == null) return;

            AddTerm(city.Name);
            AddTerm(city.EnglishName);
        }

        void AddTerm(string? value)
        {
            var term = value?.Trim();
            if (!string.IsNullOrWhiteSpace(term))
            {
                terms.Add(term);
            }
        }
    }

    private static CityDto? FindCityByText(string? text)
    {
        var normalized = text?.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        return CitiesController.GetIsraeliCities().FirstOrDefault(city =>
            city.Name.Equals(normalized, StringComparison.OrdinalIgnoreCase) ||
            city.Name.Contains(normalized, StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains(city.Name, StringComparison.OrdinalIgnoreCase) ||
            (!string.IsNullOrWhiteSpace(city.EnglishName) &&
                (city.EnglishName.Equals(normalized, StringComparison.OrdinalIgnoreCase) ||
                 city.EnglishName.Contains(normalized, StringComparison.OrdinalIgnoreCase) ||
                 normalized.Contains(city.EnglishName, StringComparison.OrdinalIgnoreCase))));
    }
}
