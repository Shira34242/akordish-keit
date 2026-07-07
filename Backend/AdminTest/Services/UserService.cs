using AkordishKeit.Data;
using AkordishKeit.Extensions;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class UserService : IUserService
{
    private readonly AkordishKeitDbContext _context;

    public UserService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<UserListDto>> GetUsersAsync(
        string? search,
        int? role,
        bool? isActive,
        int? contentTag,
        int? preferredInstrumentId,
        int pageNumber,
        int pageSize)
    {
        var query = _context.Users
            .Include(u => u.PreferredInstrument)
            .Where(u => !u.IsDeleted)
            .AsQueryable();

        // Apply filters
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(u =>
                u.Username.Contains(search) ||
                u.Email.Contains(search) ||
                (u.Phone != null && u.Phone.Contains(search)));
        }

        if (role.HasValue)
        {
            query = query.Where(u => u.Role == (UserRole)role.Value);
        }

        if (isActive.HasValue)
        {
            query = query.Where(u => u.IsActive == isActive.Value);
        }

        if (contentTag.HasValue)
        {
            query = query.Where(u => (int)u.ContentTag == contentTag.Value);
        }

        if (preferredInstrumentId.HasValue)
        {
            query = query.Where(u => u.PreferredInstrumentId == preferredInstrumentId.Value);
        }

        // Order by CreatedAt
        query = query.OrderByDescending(u => u.CreatedAt);

        // Get paginated entities
        var pagedEntities = await query.ToPagedResultAsync(pageNumber, pageSize);

        // Map to DTOs
        var dtos = pagedEntities.Items.Select(MapToListDto).ToList();

        return new PagedResult<UserListDto>
        {
            Items = dtos,
            TotalCount = pagedEntities.TotalCount,
            PageNumber = pagedEntities.PageNumber,
            PageSize = pagedEntities.PageSize
        };
    }


    public async Task<List<UserWithProfileDto>> SearchUsersWithProfilesAsync(string? query, int limit = 20, string? profileKind = null, bool includeAgencies = false)
    {
        var results = new List<UserWithProfileDto>();
        var q = query?.Trim().ToLower() ?? "";
        var kind = profileKind?.Trim().ToLower() ?? "all";
        var safeLimit = Math.Clamp(limit, 1, 100);

        // --- אמנים עם UserId ---
        if (kind == "all" || kind == "artist")
        {
        var artists = await _context.Artists
            .Where(a => !a.IsDeleted
                && (string.IsNullOrEmpty(q) || a.Name.ToLower().Contains(q)))
            .OrderBy(a => a.Name)
            .Take(safeLimit)
            .Select(a => new UserWithProfileDto
            {
                UserId = a.UserId,
                DisplayName = a.Name,
                ImageUrl = a.ImageUrl,
                ProfileType = "artist",
                ProfileId = a.Id,
                ProfileUrl = $"/artist/{a.Id}",
                Status = a.Status.ToString()
            })
            .ToListAsync();

        results.AddRange(artists);
        }

        // --- בעלי מקצוע / מורים עם UserId ---
        if (kind == "all" || kind == "teacher" || kind == "serviceprovider")
        {
        var providersQuery = _context.ServiceProviders
            .Where(p => !p.IsDeleted
                && (string.IsNullOrEmpty(q) || p.DisplayName.ToLower().Contains(q)));

        if (kind == "teacher")
        {
            providersQuery = providersQuery.Where(p => p.IsTeacher);
        }
        else if (kind == "serviceprovider")
        {
            providersQuery = providersQuery.Where(p => !p.IsTeacher);
        }

        var providers = await providersQuery
            .OrderBy(p => p.DisplayName)
            .Take(safeLimit)
            .Select(p => new UserWithProfileDto
            {
                UserId = p.UserId,
                DisplayName = p.DisplayName,
                ImageUrl = p.ProfileImageUrl,
                ProfileType = "serviceProvider",
                ProfileId = p.Id,
                ProfileUrl = p.IsTeacher ? $"/teacher/{p.Id}" : $"/provider/{p.Id}",
                IsTeacher = p.IsTeacher,
                Status = p.Status.ToString()
            })
            .ToListAsync();

        results.AddRange(providers);
        }

        if ((includeAgencies && kind == "all") || kind == "agency")
        {
            var agencies = await _context.Agencies
                .Where(a => !a.IsDeleted
                    && a.IsActive
                    && (string.IsNullOrEmpty(q) || a.Name.ToLower().Contains(q)))
                .OrderBy(a => a.Name)
                .Take(safeLimit)
                .Select(a => new UserWithProfileDto
                {
                    UserId = null,
                    DisplayName = a.Name,
                    ImageUrl = a.LogoUrl,
                    ProfileType = "agency",
                    ProfileId = a.Id,
                    ProfileUrl = $"/agency/{a.Slug}",
                    IsTeacher = false,
                    Status = a.IsActive ? "Active" : "Inactive"
                })
                .ToListAsync();

            results.AddRange(agencies);
        }

        if (kind == "all" || kind == "user")
        {
            var regularUsers = await _context.Users
                .Where(u => !u.IsDeleted
                    && u.Role == UserRole.Regular
                    && (string.IsNullOrEmpty(q)
                        || u.Username.ToLower().Contains(q)
                        || u.Email.ToLower().Contains(q)
                        || (u.Phone != null && u.Phone.Contains(q))))
                .OrderBy(u => u.Username)
                .Take(safeLimit)
                .Select(u => new UserWithProfileDto
                {
                    UserId = u.Id,
                    DisplayName = u.Username,
                    ImageUrl = u.ProfileImageUrl,
                    ProfileType = "user",
                    ProfileId = 0,
                    ProfileUrl = string.Empty,
                    IsTeacher = false,
                    Status = u.IsActive ? "Active" : "Inactive"
                })
                .ToListAsync();

            results.AddRange(regularUsers);
        }

        return results
            .OrderBy(r => r.DisplayName)
            .Take(safeLimit)
            .ToList();
    }

    public async Task<UserWithProfileDto?> GetUploaderProfileByUserIdAsync(int userId)
    {
        // בדוק קודם אם יש פרופיל אמן (כולל ממתין — לא רק פעיל)
        var artistEntity = await _context.Artists
            .Where(a => !a.IsDeleted && a.UserId == userId)
            .OrderByDescending(a => a.Status == ArtistStatus.Active)
            .FirstOrDefaultAsync();

        if (artistEntity != null)
        {
            return new UserWithProfileDto
            {
                UserId = userId,
                DisplayName = artistEntity.Name,
                ImageUrl = artistEntity.ImageUrl,
                ProfileType = "artist",
                ProfileId = artistEntity.Id,
                ProfileUrl = $"/artist/{artistEntity.Id}",
                IsTeacher = false,
                Status = artistEntity.Status.ToString(),
                Categories = new List<string>()
            };
        }

        // אחרת בדוק אם יש פרופיל בעל מקצוע / מורה (כולל ממתין)
        var providerEntity = await _context.ServiceProviders
            .Include(p => p.Categories)
            .ThenInclude(c => c.Category)
            .Where(p => !p.IsDeleted && p.UserId == userId)
            .OrderByDescending(p => p.IsPrimaryProfile)
            .ThenByDescending(p => p.Status == ProfileStatus.Active)
            .FirstOrDefaultAsync();

        if (providerEntity == null) return null;

        return new UserWithProfileDto
        {
            UserId = userId,
            DisplayName = providerEntity.DisplayName,
            ImageUrl = providerEntity.ProfileImageUrl,
            ProfileType = "serviceProvider",
            ProfileId = providerEntity.Id,
            ProfileUrl = providerEntity.IsTeacher ? $"/teacher/{providerEntity.Id}" : $"/provider/{providerEntity.Id}",
            IsTeacher = providerEntity.IsTeacher,
            Status = providerEntity.Status.ToString(),
            Categories = providerEntity.Categories
                .Select(c => c.Category.Name)
                .ToList()
        };
    }

    public async Task<MyProfileDto?> GetMyProfileAsync(int userId)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return null;
        return new MyProfileDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Phone = user.Phone,
            Address = user.Address,
            BirthDate = user.BirthDate,
            ProfileImageUrl = user.ProfileImageUrl,
            ContentTag = (int)user.ContentTag,
            UploadCount = user.UploadCount
        };
    }

    public async Task<AdminUserDetailDto?> GetAdminUserDetailAsync(int userId)
    {
        var user = await _context.Users
            .AsNoTracking()
            .Include(u => u.PreferredInstrument)
            .Include(u => u.Instruments)
                .ThenInclude(ui => ui.Instrument)
            .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);

        if (user == null) return null;

        var pages = new List<AdminUserPageDto>();

        var artistPages = await _context.Artists
            .AsNoTracking()
            .Where(a => a.UserId == userId && !a.IsDeleted)
            .OrderByDescending(a => a.IsPrimaryProfile)
            .ThenBy(a => a.Name)
            .Select(a => new AdminUserPageDto
            {
                ProfileType = "artist",
                ProfileId = a.Id,
                DisplayName = a.Name,
                ImageUrl = a.ImageUrl,
                ProfileUrl = $"/artist/{a.Id}",
                IsTeacher = false,
                Status = a.Status.ToString(),
                IsPrimary = a.IsPrimaryProfile,
                Categories = new List<string>()
            })
            .ToListAsync();

        var serviceProviderEntities = await _context.ServiceProviders
            .AsNoTracking()
            .Include(p => p.Categories)
                .ThenInclude(c => c.Category)
            .Where(p => p.UserId == userId)
            .Where(p => !p.IsDeleted)
            .OrderByDescending(p => p.IsPrimaryProfile)
            .ThenBy(p => p.DisplayName)
            .ToListAsync();

        var serviceProviderPages = serviceProviderEntities
            .Select(p => new AdminUserPageDto
            {
                ProfileType = "serviceProvider",
                ProfileId = p.Id,
                DisplayName = p.DisplayName,
                ImageUrl = p.ProfileImageUrl,
                ProfileUrl = p.IsTeacher ? $"/teacher/{p.Id}" : $"/professional/{p.Id}",
                IsTeacher = p.IsTeacher,
                Status = p.Status.ToString(),
                IsPrimary = p.IsPrimaryProfile,
                Categories = p.Categories
                    .Where(c => c.Category != null)
                    .Select(c => c.Category.Name)
                    .ToList()
            })
            .ToList();

        pages.AddRange(artistPages);
        pages.AddRange(serviceProviderPages);

        var artistPageIds = pages
            .Where(p => p.ProfileType == "artist")
            .Select(p => p.ProfileId)
            .ToList();
        var serviceProviderPageIds = pages
            .Where(p => p.ProfileType == "serviceProvider")
            .Select(p => p.ProfileId)
            .ToList();

        var agencies = pages.Count == 0
            ? new List<AdminUserAgencyDto>()
            : await _context.AgencyProfiles
                .AsNoTracking()
                .Include(ap => ap.Agency)
                .Where(ap => !ap.Agency.IsDeleted
                    && ((ap.ProfileType == "artist" && artistPageIds.Contains(ap.ProfileId))
                        || (ap.ProfileType == "serviceProvider" && serviceProviderPageIds.Contains(ap.ProfileId))))
                .OrderBy(ap => ap.Agency.Name)
                .Select(ap => new AdminUserAgencyDto
                {
                    Id = ap.Agency.Id,
                    Name = ap.Agency.Name,
                    Slug = ap.Agency.Slug,
                    LogoUrl = ap.Agency.LogoUrl,
                    ProfileType = ap.ProfileType,
                    ProfileId = ap.ProfileId,
                    ContactMode = ap.ContactMode.ToString(),
                    ShowBadge = ap.ShowBadge,
                    IsFeaturedByAgency = ap.IsFeaturedByAgency
                })
                .ToListAsync();

        var songsCount = await _context.Songs.CountAsync(s =>
            !s.IsDeleted && (s.UploadedByUserId == userId || s.UploaderUserId == userId));
        var articlesCount = await _context.Articles.CountAsync(a =>
            !a.IsDeleted && (a.SubmittedByUserId == userId || a.UploaderUserId == userId));
        var eventsCount = await _context.Events.CountAsync(e =>
            !e.IsDeleted && e.SubmittedByUserId == userId);
        var playlistsCount = await _context.Playlists.CountAsync(p => p.UserId == userId);
        var favoritesCount = await _context.Favorites.CountAsync(f => f.UserId == userId);
        var ratingsCount = await _context.SongRatings.CountAsync(r => r.UserId == userId);
        var knownChordsCount = await _context.UserKnownChords.CountAsync(kc => kc.UserId == userId);
        var notificationsCount = await _context.Notifications.CountAsync(n => n.UserId == userId && !n.IsDeleted);

        return new AdminUserDetailDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            ProfileImageUrl = user.ProfileImageUrl,
            Phone = user.Phone,
            Role = (int)user.Role,
            RoleName = user.Role.ToString(),
            Level = (int)user.ContentTag,
            Points = user.UploadCount,
            IsActive = user.IsActive,
            EmailConfirmed = user.EmailConfirmed,
            CreatedAt = user.CreatedAt,
            LastLoginAt = user.LastLoginAt,
            PreferredInstrumentId = user.PreferredInstrumentId,
            PreferredInstrumentName = user.PreferredInstrument?.Name,
            ContentTag = (int)user.ContentTag,
            UploadCount = user.UploadCount,
            GoogleId = user.GoogleId,
            Address = user.Address,
            BirthDate = user.BirthDate,
            CityId = user.CityId,
            OtherInstrumentName = user.OtherInstrumentName,
            InstrumentLevel = user.InstrumentLevel.HasValue ? (int)user.InstrumentLevel.Value : null,
            InstrumentLevelName = user.InstrumentLevel?.ToString(),
            MarketingConsent = user.MarketingConsent,
            MarketingConsentAt = user.MarketingConsentAt,
            MarketingConsentRevokedAt = user.MarketingConsentRevokedAt,
            UpdatedAt = user.UpdatedAt,
            VisitCount = user.VisitCount,
            LastProfileReminderAt = user.LastProfileReminderAt,
            ProfileReminderDismissCount = user.ProfileReminderDismissCount,
            LastUploadDate = user.LastUploadDate,
            ChordBookExportCount = user.ChordBookExportCount,
            Instruments = user.Instruments
                .Where(ui => ui.Instrument != null)
                .OrderByDescending(ui => ui.IsPrimary)
                .ThenBy(ui => ui.Instrument.Name)
                .Select(ui => new AdminUserInstrumentDto
                {
                    Id = ui.InstrumentId,
                    Name = ui.Instrument.Name,
                    EnglishName = ui.Instrument.EnglishName,
                    IsPrimary = ui.IsPrimary
                })
                .ToList(),
            Pages = pages
                .OrderByDescending(p => p.IsPrimary)
                .ThenBy(p => p.DisplayName)
                .ToList(),
            Agencies = agencies,
            ContentSummary = new AdminUserContentSummaryDto
            {
                Songs = songsCount,
                Articles = articlesCount,
                Events = eventsCount,
                Playlists = playlistsCount,
                Favorites = favoritesCount,
                Ratings = ratingsCount,
                KnownChords = knownChordsCount,
                Notifications = notificationsCount
            }
        };
    }

    public async Task<MyProfileDto?> UpdateMyProfileAsync(int userId, UpdateMyProfileDto dto)
    {
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return null;

        user.Phone = dto.Phone;
        user.Address = dto.Address;
        user.BirthDate = dto.BirthDate;
        if (dto.ProfileImageUrl != null)
            user.ProfileImageUrl = dto.ProfileImageUrl;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return new MyProfileDto
        {
            Id = user.Id,
            Username = user.Username,
            Email = user.Email,
            Phone = user.Phone,
            Address = user.Address,
            BirthDate = user.BirthDate,
            ProfileImageUrl = user.ProfileImageUrl,
            ContentTag = (int)user.ContentTag,
            UploadCount = user.UploadCount
        };
    }

    public async Task<UserListDto?> AdminUpdateUserAsync(int userId, AdminUpdateUserDto dto)
    {
        if (!Enum.IsDefined(typeof(UserRole), dto.Role))
            return null;

        var user = await _context.Users
            .Include(u => u.PreferredInstrument)
            .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);

        if (user == null) return null;

        user.Username = dto.Username.Trim();
        user.Email = dto.Email.Trim();
        user.Phone = string.IsNullOrWhiteSpace(dto.Phone) ? null : dto.Phone.Trim();
        user.Role = (UserRole)dto.Role;

        user.IsActive = dto.IsActive;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return MapToListDto(user);
    }

    public async Task<bool> AdminDeleteUserAsync(int userId)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);

        if (user == null) return false;

        user.IsDeleted = true;
        user.IsActive = false;
        user.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<UserWithProfileDto>> GetMyAllPagesAsync(int userId)
    {
        var results = new List<UserWithProfileDto>();

        // --- אמנים ---
        var artists = await _context.Artists
            .Where(a => !a.IsDeleted && a.UserId == userId)
            .OrderByDescending(a => a.IsPrimaryProfile)
            .ThenBy(a => a.Name)
            .ToListAsync();

        foreach (var artist in artists)
        {
            results.Add(new UserWithProfileDto
            {
                UserId = userId,
                DisplayName = artist.Name,
                ImageUrl = artist.ImageUrl,
                ProfileType = "artist",
                ProfileId = artist.Id,
                ProfileUrl = $"/artist/{artist.Id}",
                IsTeacher = false,
                Status = artist.Status.ToString(),
                Categories = new List<string>()
            });
        }

        // --- כל ה-ServiceProviders ---
        var providers = await _context.ServiceProviders
            .Include(p => p.Categories)
            .ThenInclude(c => c.Category)
            .Where(p => !p.IsDeleted && p.UserId == userId)
            .OrderByDescending(p => p.IsPrimaryProfile)
            .ToListAsync();

        foreach (var p in providers)
        {
            results.Add(new UserWithProfileDto
            {
                UserId = userId,
                DisplayName = p.DisplayName,
                ImageUrl = p.ProfileImageUrl,
                ProfileType = "serviceProvider",
                ProfileId = p.Id,
                ProfileUrl = p.IsTeacher ? $"/teacher/{p.Id}" : $"/provider/{p.Id}",
                IsTeacher = p.IsTeacher,
                Status = p.Status.ToString(),
                Categories = p.Categories.Select(c => c.Category.Name).ToList()
            });
        }

        return results;
    }

    public async Task<bool> RevokePageAsync(int userId, RevokePageDto dto)
    {
        if (dto.ProfileType == "artist")
        {
            var artist = await _context.Artists
                .FirstOrDefaultAsync(a => a.Id == dto.ProfileId && a.UserId == userId && !a.IsDeleted);
            if (artist == null) return false;
            artist.UserId = null;
        }
        else if (dto.ProfileType == "serviceProvider")
        {
            var provider = await _context.ServiceProviders
                .FirstOrDefaultAsync(p => p.Id == dto.ProfileId && p.UserId == userId && !p.IsDeleted);
            if (provider == null) return false;
            provider.UserId = null;
        }
        else
        {
            return false;
        }

        await NormalizeUserRoleAfterPageChangeAsync(userId);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RequestPageDeletionAsync(int userId, DeletePageRequestDto dto)
    {
        var page = await GetOwnedPageForRequestAsync(userId, dto.ProfileType, dto.ProfileId);
        if (page == null) return false;

        var admins = await _context.Users
            .Where(u => !u.IsDeleted
                && u.IsActive
                && (u.Role == UserRole.Admin || u.Role == UserRole.Manager))
            .Select(u => u.Id)
            .ToListAsync();

        if (admins.Count == 0) return true;

        var requester = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);

        var requesterName = requester?.Username ?? $"משתמש #{userId}";
        var title = "בקשה למחיקת דף";
        var message = $"{requesterName} ביקש למחוק את הדף \"{page.DisplayName}\". הדף לא נמחק אוטומטית ונדרש טיפול מנהל.";

        foreach (var adminId in admins)
        {
            _context.Notifications.Add(new Notification
            {
                UserId = adminId,
                Title = title,
                Message = message,
                Type = NotificationType.StatusUpdate,
                Category = GetPageNotificationCategory(page),
                RelatedEntityType = "PageDeletionRequest",
                RelatedEntityId = page.ProfileId,
                ActionUrl = page.ProfileUrl,
                CreatedByUserId = userId,
                CreatedAt = DateTime.UtcNow,
                IsRead = false,
                IsDeleted = false
            });
        }

        await _context.SaveChangesAsync();
        return true;
    }

    private async Task<UserWithProfileDto?> GetOwnedPageForRequestAsync(int userId, string profileType, int profileId)
    {
        if (profileType == "artist")
        {
            var artist = await _context.Artists
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == profileId && a.UserId == userId && !a.IsDeleted);

            if (artist == null) return null;

            return new UserWithProfileDto
            {
                UserId = userId,
                DisplayName = artist.Name,
                ImageUrl = artist.ImageUrl,
                ProfileType = "artist",
                ProfileId = artist.Id,
                ProfileUrl = $"/artist/{artist.Id}",
                IsTeacher = false,
                Status = artist.Status.ToString()
            };
        }

        if (profileType == "serviceProvider")
        {
            var provider = await _context.ServiceProviders
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == profileId && p.UserId == userId && !p.IsDeleted);

            if (provider == null) return null;

            return new UserWithProfileDto
            {
                UserId = userId,
                DisplayName = provider.DisplayName,
                ImageUrl = provider.ProfileImageUrl,
                ProfileType = "serviceProvider",
                ProfileId = provider.Id,
                ProfileUrl = provider.IsTeacher ? $"/teacher/{provider.Id}" : $"/professional/{provider.Id}",
                IsTeacher = provider.IsTeacher,
                Status = provider.Status.ToString()
            };
        }

        return null;
    }

    private static NotificationCategory GetPageNotificationCategory(UserWithProfileDto page)
    {
        if (page.ProfileType == "artist") return NotificationCategory.Artist;
        return page.IsTeacher ? NotificationCategory.Teacher : NotificationCategory.ServiceProvider;
    }

    private async Task NormalizeUserRoleAfterPageChangeAsync(int userId)
    {
        var hasArtist = await _context.Artists
            .AnyAsync(a => a.UserId == userId && !a.IsDeleted);

        var hasProvider = await _context.ServiceProviders
            .AnyAsync(p => p.UserId == userId && !p.IsDeleted);

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);

        if (user == null || user.Role >= UserRole.Manager)
        {
            return;
        }

        if (!hasArtist && !hasProvider)
        {
            user.Role = UserRole.Regular;
            user.UpdatedAt = DateTime.UtcNow;
            return;
        }

        if (hasArtist)
        {
            user.Role = UserRole.Artist;
            user.UpdatedAt = DateTime.UtcNow;
            return;
        }

        user.Role = UserRole.Teacher;
        user.UpdatedAt = DateTime.UtcNow;
    }

    // ═══════════════════════════════════════════════════════════
    //                    Mapping Methods
    // ═══════════════════════════════════════════════════════════

    public async Task<UserWithProfileDto?> SetPageVisibilityAsync(int userId, SetPageVisibilityDto dto)
    {
        if (dto.ProfileType == "artist")
        {
            var artist = await _context.Artists
                .FirstOrDefaultAsync(a => a.Id == dto.ProfileId && a.UserId == userId && !a.IsDeleted);

            if (artist == null || artist.Status == ArtistStatus.Pending)
                return null;

            artist.Status = dto.IsActive ? ArtistStatus.Active : ArtistStatus.Hidden;
            await _context.SaveChangesAsync();

            return new UserWithProfileDto
            {
                UserId = userId,
                DisplayName = artist.Name,
                ImageUrl = artist.ImageUrl,
                ProfileType = "artist",
                ProfileId = artist.Id,
                ProfileUrl = $"/artist/{artist.Id}",
                IsTeacher = false,
                Status = artist.Status.ToString(),
                Categories = new List<string>()
            };
        }

        if (dto.ProfileType == "serviceProvider")
        {
            var provider = await _context.ServiceProviders
                .Include(p => p.Categories)
                .ThenInclude(c => c.Category)
                .FirstOrDefaultAsync(p => p.Id == dto.ProfileId && p.UserId == userId && !p.IsDeleted);

            if (provider == null || provider.Status == ProfileStatus.Pending)
                return null;

            provider.Status = dto.IsActive ? ProfileStatus.Active : ProfileStatus.Suspended;
            await _context.SaveChangesAsync();

            return new UserWithProfileDto
            {
                UserId = userId,
                DisplayName = provider.DisplayName,
                ImageUrl = provider.ProfileImageUrl,
                ProfileType = "serviceProvider",
                ProfileId = provider.Id,
                ProfileUrl = provider.IsTeacher ? $"/teacher/{provider.Id}" : $"/provider/{provider.Id}",
                IsTeacher = provider.IsTeacher,
                Status = provider.Status.ToString(),
                Categories = provider.Categories.Select(c => c.Category.Name).ToList()
            };
        }

        return null;
    }

    private static UserListDto MapToListDto(User entity)
    {
        return new UserListDto
        {
            Id = entity.Id,
            Username = entity.Username,
            Email = entity.Email,
            ProfileImageUrl = entity.ProfileImageUrl,
            Phone = entity.Phone,
            Role = (int)entity.Role,
            RoleName = entity.Role.ToString(),
            Level = (int)entity.ContentTag,
            Points = entity.UploadCount,
            IsActive = entity.IsActive,
            EmailConfirmed = entity.EmailConfirmed,
            CreatedAt = entity.CreatedAt,
            LastLoginAt = entity.LastLoginAt,
            PreferredInstrumentId = entity.PreferredInstrumentId,
            PreferredInstrumentName = entity.PreferredInstrument?.Name,
            ContentTag = (int)entity.ContentTag,
            UploadCount = entity.UploadCount
        };
    }
}
