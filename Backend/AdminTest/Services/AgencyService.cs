using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using AkordishKeit.Data;
using AkordishKeit.Extensions;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AkordishKeit.Services;

public class AgencyService : IAgencyService
{
    private readonly AkordishKeitDbContext _context;
    private readonly ILogger<AgencyService> _logger;

    public AgencyService(AkordishKeitDbContext context, ILogger<AgencyService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<PagedResult<AgencyListDto>> GetAgenciesAsync(string? search, bool? isActive, int pageNumber, int pageSize)
    {
        var query = _context.Agencies
            .AsNoTracking()
            .Include(a => a.Profiles)
            .Include(a => a.Contents)
            .Where(a => !a.IsDeleted)
            .AsQueryable();

        var normalized = search?.Trim();
        if (!string.IsNullOrWhiteSpace(normalized))
        {
            query = query.Where(a =>
                a.Name.Contains(normalized) ||
                a.Slug.Contains(normalized) ||
                (a.Email != null && a.Email.Contains(normalized)));
        }

        if (isActive.HasValue)
        {
            query = query.Where(a => a.IsActive == isActive.Value);
        }

        query = query.OrderBy(a => a.DisplayOrder).ThenBy(a => a.Name);

        var paged = await query.ToPagedResultAsync(pageNumber, pageSize);
        return new PagedResult<AgencyListDto>
        {
            Items = paged.Items.Select(MapToListDto).ToList(),
            TotalCount = paged.TotalCount,
            PageNumber = paged.PageNumber,
            PageSize = paged.PageSize
        };
    }

    public async Task<List<AgencyListDto>> GetIndexBannersAsync(int limit)
    {
        var agencies = await _context.Agencies
            .AsNoTracking()
            .Include(a => a.Profiles)
            .Include(a => a.Contents)
            .Where(a => !a.IsDeleted && a.IsActive && a.ShowInIndexBanner)
            .OrderBy(a => a.DisplayOrder)
            .ThenBy(a => a.Name)
            .Take(limit)
            .ToListAsync();

        return agencies.Select(MapToListDto).ToList();
    }

    public async Task<AgencyDto?> GetAgencyByIdAsync(int id)
    {
        var agency = await GetAgencyQuery()
            .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

        return agency == null ? null : await MapToDtoAsync(agency);
    }

    public async Task<AgencyPublicDto?> GetAgencyBySlugAsync(string slug)
    {
        var agency = await GetAgencyQuery()
            .FirstOrDefaultAsync(a => a.Slug == slug && !a.IsDeleted && a.IsActive);

        if (agency == null) return null;

        var dto = await MapToPublicDtoAsync(agency);
        return dto;
    }

    public async Task<AgencyBadgeDto?> GetBadgeForProfileAsync(string profileType, int profileId)
    {
        var normalizedType = NormalizeProfileType(profileType);
        if (normalizedType == null) return null;

        var link = await _context.AgencyProfiles
            .AsNoTracking()
            .Include(p => p.Agency)
            .Where(p => p.ProfileType == normalizedType && p.ProfileId == profileId)
            .Where(p => !p.Agency.IsDeleted && p.Agency.IsActive)
            .OrderBy(p => p.DisplayOrder)
            .FirstOrDefaultAsync();

        return link == null ? null : new AgencyBadgeDto
        {
            AgencyId = link.AgencyId,
            AgencyName = link.Agency.Name,
            AgencySlug = link.Agency.Slug,
            LogoUrl = link.Agency.LogoUrl,
            BrandPrimaryColor = link.Agency.BrandPrimaryColor,
            BrandSecondaryColor = link.Agency.BrandSecondaryColor,
            BrandTextColor = link.Agency.BrandTextColor,
            ContactMode = link.ContactMode,
            ShowBadge = link.ShowBadge,
            PhoneNumber = link.Agency.PhoneNumber,
            WhatsAppNumber = link.Agency.WhatsAppNumber,
            Email = link.Agency.Email,
            WebsiteUrl = link.Agency.WebsiteUrl
        };
    }

    public async Task<AgencyDto> CreateAgencyAsync(CreateAgencyDto dto)
    {
        var slug = await EnsureUniqueSlugAsync(dto.Slug, dto.Name);
        var agency = new Agency
        {
            Name = dto.Name.Trim(),
            Slug = slug,
            LogoUrl = Clean(dto.LogoUrl),
            BannerImageUrl = Clean(dto.BannerImageUrl),
            BannerBlur = Math.Clamp(dto.BannerBlur, 0, 20),
            ShortDescription = Clean(dto.ShortDescription),
            FullDescription = Clean(dto.FullDescription),
            PhoneNumber = Clean(dto.PhoneNumber),
            WhatsAppNumber = Clean(dto.WhatsAppNumber),
            Email = Clean(dto.Email),
            WebsiteUrl = Clean(dto.WebsiteUrl),
            BrandPrimaryColor = CleanColor(dto.BrandPrimaryColor),
            BrandSecondaryColor = CleanColor(dto.BrandSecondaryColor),
            BrandTextColor = CleanColor(dto.BrandTextColor),
            IsActive = dto.IsActive,
            ShowInIndexBanner = dto.ShowInIndexBanner,
            DisplayOrder = dto.DisplayOrder,
            CreatedAt = DateTime.UtcNow
        };

        _context.Agencies.Add(agency);
        await _context.SaveChangesAsync();
        return (await GetAgencyByIdAsync(agency.Id))!;
    }

    public async Task<AgencyDto> UpdateAgencyAsync(int id, UpdateAgencyDto dto)
    {
        var agency = await _context.Agencies.FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);
        if (agency == null) throw new KeyNotFoundException("הסוכנות לא נמצאה");

        agency.Name = dto.Name.Trim();
        agency.Slug = await EnsureUniqueSlugAsync(dto.Slug, dto.Name, id);
        agency.LogoUrl = Clean(dto.LogoUrl);
        agency.BannerImageUrl = Clean(dto.BannerImageUrl);
        agency.BannerBlur = Math.Clamp(dto.BannerBlur, 0, 20);
        agency.ShortDescription = Clean(dto.ShortDescription);
        agency.FullDescription = Clean(dto.FullDescription);
        agency.PhoneNumber = Clean(dto.PhoneNumber);
        agency.WhatsAppNumber = Clean(dto.WhatsAppNumber);
        agency.Email = Clean(dto.Email);
        agency.WebsiteUrl = Clean(dto.WebsiteUrl);
        agency.BrandPrimaryColor = CleanColor(dto.BrandPrimaryColor);
        agency.BrandSecondaryColor = CleanColor(dto.BrandSecondaryColor);
        agency.BrandTextColor = CleanColor(dto.BrandTextColor);
        agency.IsActive = dto.IsActive;
        agency.ShowInIndexBanner = dto.ShowInIndexBanner;
        agency.DisplayOrder = dto.DisplayOrder;
        agency.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return (await GetAgencyByIdAsync(id))!;
    }

    public async Task<bool> DeleteAgencyAsync(int id)
    {
        var agency = await _context.Agencies.FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);
        if (agency == null) return false;
        agency.IsDeleted = true;
        agency.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<AgencyProfileDto> AddProfileAsync(int agencyId, UpsertAgencyProfileDto dto)
    {
        var agencyExists = await _context.Agencies.AnyAsync(a => a.Id == agencyId && !a.IsDeleted);
        if (!agencyExists) throw new KeyNotFoundException("הסוכנות לא נמצאה");

        var profileType = NormalizeProfileType(dto.ProfileType)
            ?? throw new InvalidOperationException("סוג פרופיל לא תקין");

        await EnsureProfileExistsAsync(profileType, dto.ProfileId);

        var linkedElsewhere = await _context.AgencyProfiles
            .AnyAsync(p => p.ProfileType == profileType && p.ProfileId == dto.ProfileId && p.AgencyId != agencyId);
        if (linkedElsewhere)
        {
            throw new InvalidOperationException("הפרופיל כבר משויך לסוכנות אחרת");
        }

        var link = await _context.AgencyProfiles
            .FirstOrDefaultAsync(p => p.AgencyId == agencyId && p.ProfileType == profileType && p.ProfileId == dto.ProfileId);

        if (link == null)
        {
            link = new AgencyProfile
            {
                AgencyId = agencyId,
                ProfileType = profileType,
                ProfileId = dto.ProfileId,
                CreatedAt = DateTime.UtcNow
            };
            _context.AgencyProfiles.Add(link);
        }

        link.ContactMode = dto.ContactMode;
        link.ShowBadge = dto.ShowBadge;
        link.IsFeaturedByAgency = dto.IsFeaturedByAgency;
        link.DisplayOrder = dto.DisplayOrder;

        await _context.SaveChangesAsync();
        return await EnrichProfileDtoAsync(link);
    }

    public async Task<bool> RemoveProfileAsync(int agencyId, int profileLinkId)
    {
        var link = await _context.AgencyProfiles.FirstOrDefaultAsync(p => p.Id == profileLinkId && p.AgencyId == agencyId);
        if (link == null) return false;
        _context.AgencyProfiles.Remove(link);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<AgencyContentDto> AddContentAsync(int agencyId, UpsertAgencyContentDto dto)
    {
        var agencyExists = await _context.Agencies.AnyAsync(a => a.Id == agencyId && !a.IsDeleted);
        if (!agencyExists) throw new KeyNotFoundException("הסוכנות לא נמצאה");

        var contentType = NormalizeContentType(dto.ContentType)
            ?? throw new InvalidOperationException("סוג תוכן לא תקין");

        await EnsureContentExistsAsync(contentType, dto.ContentId);

        var link = await _context.AgencyContents
            .FirstOrDefaultAsync(c => c.AgencyId == agencyId && c.ContentType == contentType && c.ContentId == dto.ContentId);

        if (link == null)
        {
            link = new AgencyContent
            {
                AgencyId = agencyId,
                ContentType = contentType,
                ContentId = dto.ContentId,
                CreatedAt = DateTime.UtcNow
            };
            _context.AgencyContents.Add(link);
        }

        link.IsFeatured = dto.IsFeatured;
        link.DisplayOrder = dto.DisplayOrder;

        await _context.SaveChangesAsync();
        return await EnrichContentDtoAsync(link);
    }

    public async Task<bool> RemoveContentAsync(int agencyId, int contentLinkId)
    {
        var link = await _context.AgencyContents.FirstOrDefaultAsync(c => c.Id == contentLinkId && c.AgencyId == agencyId);
        if (link == null) return false;
        _context.AgencyContents.Remove(link);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<AgencyGalleryImageDto>> GetGalleryImagesAsync(int agencyId)
    {
        return await _context.AgencyGalleryImages
            .AsNoTracking()
            .Where(g => g.AgencyId == agencyId)
            .OrderBy(g => g.DisplayOrder)
            .Select(g => new AgencyGalleryImageDto
            {
                Id = g.Id,
                AgencyId = g.AgencyId,
                MediaType = g.MediaType,
                ImageUrl = g.ImageUrl,
                VideoUrl = g.VideoUrl,
                Title = g.Title,
                Caption = g.Caption,
                DisplayOrder = g.DisplayOrder
            })
            .ToListAsync();
    }

    public async Task<AgencyGalleryImageDto> AddGalleryImageAsync(int agencyId, AgencyGalleryImageDto dto)
    {
        var agencyExists = await _context.Agencies.AnyAsync(a => a.Id == agencyId && !a.IsDeleted);
        if (!agencyExists) throw new KeyNotFoundException("הסוכנות לא נמצאה");

        var mediaType = NormalizeGalleryMediaType(dto.MediaType)
            ?? throw new InvalidOperationException("סוג מדיה לא תקין");
        var imageUrl = Clean(dto.ImageUrl);
        var videoUrl = Clean(dto.VideoUrl);

        if (mediaType == "image" && imageUrl == null)
        {
            throw new InvalidOperationException("תמונה חייבת קישור תמונה");
        }

        if (mediaType == "video" && videoUrl == null)
        {
            throw new InvalidOperationException("וידאו חייב קישור וידאו");
        }

        var image = new AgencyGalleryImage
        {
            AgencyId = agencyId,
            MediaType = mediaType,
            ImageUrl = imageUrl,
            VideoUrl = videoUrl,
            Title = Clean(dto.Title),
            Caption = Clean(dto.Caption),
            DisplayOrder = dto.DisplayOrder,
            CreatedAt = DateTime.UtcNow
        };
        _context.AgencyGalleryImages.Add(image);
        await _context.SaveChangesAsync();

        return new AgencyGalleryImageDto
        {
            Id = image.Id,
            AgencyId = image.AgencyId,
            MediaType = image.MediaType,
            ImageUrl = image.ImageUrl,
            VideoUrl = image.VideoUrl,
            Title = image.Title,
            Caption = image.Caption,
            DisplayOrder = image.DisplayOrder
        };
    }

    public async Task<bool> RemoveGalleryImageAsync(int agencyId, int imageId)
    {
        var image = await _context.AgencyGalleryImages
            .FirstOrDefaultAsync(g => g.Id == imageId && g.AgencyId == agencyId);
        if (image == null) return false;
        _context.AgencyGalleryImages.Remove(image);
        await _context.SaveChangesAsync();
        return true;
    }

    public async Task<List<AgencySocialLinkDto>> GetSocialLinksAsync(int agencyId)
    {
        return await _context.AgencySocialLinks
            .AsNoTracking()
            .Where(s => s.AgencyId == agencyId)
            .Select(s => new AgencySocialLinkDto
            {
                Id = s.Id,
                AgencyId = s.AgencyId,
                Platform = s.Platform,
                Url = s.Url
            })
            .ToListAsync();
    }

    public async Task<AgencySocialLinkDto> UpsertSocialLinkAsync(int agencyId, AgencySocialLinkDto dto)
    {
        var agencyExists = await _context.Agencies.AnyAsync(a => a.Id == agencyId && !a.IsDeleted);
        if (!agencyExists) throw new KeyNotFoundException("הסוכנות לא נמצאה");

        var link = dto.Id > 0
            ? await _context.AgencySocialLinks.FirstOrDefaultAsync(s => s.Id == dto.Id && s.AgencyId == agencyId)
            : null;

        if (link == null)
        {
            link = new AgencySocialLink { AgencyId = agencyId };
            _context.AgencySocialLinks.Add(link);
        }

        link.Platform = dto.Platform;
        link.Url = dto.Url;
        await _context.SaveChangesAsync();

        return new AgencySocialLinkDto
        {
            Id = link.Id,
            AgencyId = link.AgencyId,
            Platform = link.Platform,
            Url = link.Url
        };
    }

    public async Task<bool> RemoveSocialLinkAsync(int agencyId, int linkId)
    {
        var link = await _context.AgencySocialLinks
            .FirstOrDefaultAsync(s => s.Id == linkId && s.AgencyId == agencyId);
        if (link == null) return false;
        _context.AgencySocialLinks.Remove(link);
        await _context.SaveChangesAsync();
        return true;
    }

    private IQueryable<Agency> GetAgencyQuery()
    {
        return _context.Agencies
            .AsNoTracking()
            .AsSplitQuery()
            .Include(a => a.Profiles)
            .Include(a => a.Contents)
            .Include(a => a.GalleryImages)
            .Include(a => a.SocialLinks);
    }

    private async Task<AgencyDto> MapToDtoAsync(Agency agency)
    {
        try
        {
            var profiles = new List<AgencyProfileDto>();
            foreach (var p in agency.Profiles.OrderBy(p => p.DisplayOrder))
            {
                profiles.Add(await EnrichProfileDtoAsync(p));
            }

            var contents = new List<AgencyContentDto>();
            foreach (var c in agency.Contents.OrderBy(c => c.DisplayOrder))
            {
                contents.Add(await EnrichContentDtoAsync(c));
            }

            return new AgencyDto
            {
                Id = agency.Id,
                Name = agency.Name,
                Slug = agency.Slug,
                LogoUrl = agency.LogoUrl,
                BannerImageUrl = agency.BannerImageUrl,
                BannerBlur = agency.BannerBlur,
                ShortDescription = agency.ShortDescription,
                FullDescription = agency.FullDescription,
                PhoneNumber = agency.PhoneNumber,
                WhatsAppNumber = agency.WhatsAppNumber,
                Email = agency.Email,
                WebsiteUrl = agency.WebsiteUrl,
                BrandPrimaryColor = agency.BrandPrimaryColor,
                BrandSecondaryColor = agency.BrandSecondaryColor,
                BrandTextColor = agency.BrandTextColor,
                IsActive = agency.IsActive,
                ShowInIndexBanner = agency.ShowInIndexBanner,
                DisplayOrder = agency.DisplayOrder,
                ProfilesCount = agency.Profiles.Count,
                ContentsCount = agency.Contents.Count,
                CreatedAt = agency.CreatedAt,
                Profiles = profiles.ToList(),
                Contents = contents.ToList(),
                GalleryImages = agency.GalleryImages.OrderBy(g => g.DisplayOrder).Select(g => new AgencyGalleryImageDto
                {
                    Id = g.Id,
                    AgencyId = g.AgencyId,
                    MediaType = g.MediaType,
                    ImageUrl = g.ImageUrl,
                    VideoUrl = g.VideoUrl,
                    Title = g.Title,
                    Caption = g.Caption,
                    DisplayOrder = g.DisplayOrder
                }).ToList(),
                SocialLinks = agency.SocialLinks.Select(s => new AgencySocialLinkDto
                {
                    Id = s.Id,
                    AgencyId = s.AgencyId,
                    Platform = s.Platform,
                    Url = s.Url
                }).ToList()
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "MapToDtoAsync failed — AgencyId={AgencyId} AgencyName={AgencyName} ProfilesCount={ProfilesCount} ContentsCount={ContentsCount}",
                agency.Id, agency.Name, agency.Profiles?.Count ?? -1, agency.Contents?.Count ?? -1);
            throw;
        }
    }

    private async Task<AgencyPublicDto> MapToPublicDtoAsync(Agency agency)
    {
        var baseDto = await MapToDtoAsync(agency);
        var publicProfiles = new List<AgencyProfileDto>();
        foreach (var profile in baseDto.Profiles)
        {
            if (await IsPublicProfileActiveAsync(profile))
            {
                publicProfiles.Add(profile);
            }
        }

        var publicDto = new AgencyPublicDto
        {
            Id = baseDto.Id,
            Name = baseDto.Name,
            Slug = baseDto.Slug,
            LogoUrl = baseDto.LogoUrl,
            BannerImageUrl = baseDto.BannerImageUrl,
            BannerBlur = baseDto.BannerBlur,
            ShortDescription = baseDto.ShortDescription,
            FullDescription = baseDto.FullDescription,
            PhoneNumber = baseDto.PhoneNumber,
            WhatsAppNumber = baseDto.WhatsAppNumber,
            Email = baseDto.Email,
            WebsiteUrl = baseDto.WebsiteUrl,
            BrandPrimaryColor = baseDto.BrandPrimaryColor,
            BrandSecondaryColor = baseDto.BrandSecondaryColor,
            BrandTextColor = baseDto.BrandTextColor,
            IsActive = baseDto.IsActive,
            ShowInIndexBanner = baseDto.ShowInIndexBanner,
            DisplayOrder = baseDto.DisplayOrder,
            ProfilesCount = publicProfiles.Count,
            ContentsCount = baseDto.ContentsCount,
            CreatedAt = baseDto.CreatedAt,
            Profiles = publicProfiles,
            Contents = baseDto.Contents,
            GalleryImages = baseDto.GalleryImages,
            SocialLinks = baseDto.SocialLinks
        };

        foreach (var profile in publicProfiles)
        {
            var card = new AgencyProfileCardDto
            {
                Id = profile.ProfileId,
                ProfileType = profile.ProfileType,
                Name = profile.ProfileName ?? string.Empty,
                ImageUrl = profile.ProfileImageUrl,
                ProfileUrl = profile.ProfileUrl ?? string.Empty,
                IsTeacher = profile.IsTeacher,
                ContactMode = profile.ContactMode
            };

            if (profile.ProfileType == "artist")
            {
                publicDto.Artists.Add(card);
            }
            else if (profile.IsTeacher)
            {
                publicDto.Teachers.Add(card);
            }
            else
            {
                publicDto.ServiceProviders.Add(card);
            }
        }

        await FillContentAsync(publicDto, agency);
        return publicDto;
    }

    private async Task FillContentAsync(AgencyPublicDto dto, Agency agency)
    {
        try
        {
            var directArticleIds = agency.Contents.Where(c => c.ContentType == "article").OrderBy(c => c.DisplayOrder).Select(c => c.ContentId).ToList();
            var directSongIds = agency.Contents.Where(c => c.ContentType == "song").OrderBy(c => c.DisplayOrder).Select(c => c.ContentId).ToList();
            var directPodcastIds = agency.Contents.Where(c => c.ContentType == "podcast").OrderBy(c => c.DisplayOrder).Select(c => c.ContentId).ToList();

            dto.DirectArticles = await GetArticlesByIdsAsync(directArticleIds);
            dto.DirectSongs = await GetSongsByIdsAsync(directSongIds);
            dto.DirectPodcasts = await GetPodcastsByIdsAsync(directPodcastIds);

            var memberProfiles = dto.Profiles.Select(p => new { p.ProfileType, p.ProfileId }).ToList();
            var artistIds = memberProfiles.Where(p => p.ProfileType == "artist").Select(p => p.ProfileId).ToList();
            var providerIds = memberProfiles.Where(p => p.ProfileType == "serviceProvider").Select(p => p.ProfileId).ToList();

            var memberArticleEntities = await _context.Articles
                .AsNoTracking()
                .Include(a => a.ArticleCategories).ThenInclude(c => c.Category)
                .Include(a => a.ArticleTags).ThenInclude(t => t.Tag)
                .Where(a => !a.IsDeleted && a.Status == (int)ArticleStatus.Published)
                .Where(a =>
                    (a.UploaderProfileType == "artist" && a.UploaderProfileId.HasValue && artistIds.Contains(a.UploaderProfileId.Value)) ||
                    (a.UploaderProfileType == "serviceProvider" && a.UploaderProfileId.HasValue && providerIds.Contains(a.UploaderProfileId.Value)))
                .OrderByDescending(a => a.PublishDate)
                .Take(12)
                .ToListAsync();
            dto.MemberArticles = memberArticleEntities.Select(MapArticle).ToList();

            var memberSongEntities = await _context.Songs
                .AsNoTracking()
                .Include(s => s.SongArtists).ThenInclude(sa => sa.Artist)
                .Where(s => s.IsApproved && !s.IsDeleted)
                .Where(s =>
                    (s.UploaderProfileType == "artist" && s.UploaderProfileId.HasValue && artistIds.Contains(s.UploaderProfileId.Value)) ||
                    (s.UploaderProfileType == "serviceProvider" && s.UploaderProfileId.HasValue && providerIds.Contains(s.UploaderProfileId.Value)))
                .OrderByDescending(s => s.CreatedAt)
                .Take(12)
                .ToListAsync();
            dto.MemberSongs = memberSongEntities.Select(MapSong).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "FillContentAsync failed — AgencyId={AgencyId} AgencyName={AgencyName} ProfilesCount={ProfilesCount} ContentsCount={ContentsCount}",
                agency.Id, agency.Name, agency.Profiles?.Count ?? -1, agency.Contents?.Count ?? -1);
            throw;
        }
    }

    private async Task<bool> IsPublicProfileActiveAsync(AgencyProfileDto profile)
    {
        if (profile.ProfileType == "artist")
        {
            return await _context.Artists
                .AsNoTracking()
                .AnyAsync(a => a.Id == profile.ProfileId && !a.IsDeleted && a.Status == ArtistStatus.Active);
        }

        return await _context.ServiceProviders
            .AsNoTracking()
            .AnyAsync(p => p.Id == profile.ProfileId && !p.IsDeleted && p.Status == ProfileStatus.Active);
    }

    private async Task<List<ArticleDto>> GetArticlesByIdsAsync(List<int> ids)
    {
        if (ids.Count == 0) return new List<ArticleDto>();
        var order = ids.Select((id, index) => new { id, index }).ToDictionary(x => x.id, x => x.index);
        var articleEntities = await _context.Articles
            .AsNoTracking()
            .Include(a => a.ArticleCategories).ThenInclude(c => c.Category)
            .Include(a => a.ArticleTags).ThenInclude(t => t.Tag)
            .Where(a => ids.Contains(a.Id) && !a.IsDeleted && a.Status == (int)ArticleStatus.Published)
            .ToListAsync();
        var articles = articleEntities.Select(MapArticle).ToList();
        return articles.OrderBy(a => order.GetValueOrDefault(a.Id)).ToList();
    }

    private async Task<List<SongDto>> GetSongsByIdsAsync(List<int> ids)
    {
        if (ids.Count == 0) return new List<SongDto>();
        var order = ids.Select((id, index) => new { id, index }).ToDictionary(x => x.id, x => x.index);
        var songEntities = await _context.Songs
            .AsNoTracking()
            .Include(s => s.SongArtists).ThenInclude(sa => sa.Artist)
            .Where(s => ids.Contains(s.Id) && s.IsApproved && !s.IsDeleted)
            .ToListAsync();
        var songs = songEntities.Select(MapSong).ToList();
        return songs.OrderBy(s => order.GetValueOrDefault(s.Id)).ToList();
    }

    private async Task<List<PodcastDto>> GetPodcastsByIdsAsync(List<int> ids)
    {
        if (ids.Count == 0) return new List<PodcastDto>();

        var order = ids.Select((id, index) => new { id, index }).ToDictionary(x => x.id, x => x.index);
        var podcastEntities = await _context.Podcasts
            .AsNoTracking()
            .Include(p => p.Episodes)
            .Where(p => ids.Contains(p.Id) && p.IsActive && !p.IsDeleted)
            .ToListAsync();

        var podcasts = podcastEntities.Select(p =>
        {
            var activeEpisodes = p.Episodes.Where(e => !e.IsDeleted && e.IsActive).ToList();
            var latest = activeEpisodes.OrderByDescending(e => e.PublishedAt).FirstOrDefault();
            return new PodcastDto
            {
                Id = p.Id,
                Name = p.Name,
                Slug = p.Slug,
                Description = p.Description,
                ImageUrl = p.ImageUrl,
                DisplayOrder = p.DisplayOrder,
                IsActive = p.IsActive,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                EpisodeCount = activeEpisodes.Count,
                LatestEpisode = latest == null ? null : new PodcastEpisodeDto
                {
                    Id = latest.Id,
                    PodcastId = latest.PodcastId,
                    PodcastName = p.Name,
                    PodcastSlug = p.Slug,
                    Title = latest.Title,
                    Slug = latest.Slug,
                    Description = latest.Description,
                    EpisodeNumber = latest.EpisodeNumber,
                    SourceUrl = latest.SourceUrl,
                    EmbedUrl = latest.EmbedUrl,
                    ThumbnailUrl = latest.ThumbnailUrl,
                    Platform = latest.Platform,
                    ViewCount = latest.ViewCount,
                    PublishedAt = latest.PublishedAt,
                    DisplayOrder = latest.DisplayOrder,
                    IsActive = latest.IsActive,
                    CreatedAt = latest.CreatedAt,
                    UpdatedAt = latest.UpdatedAt
                }
            };
        }).ToList();

        return podcasts.OrderBy(p => order.GetValueOrDefault(p.Id)).ToList();
    }

    private static ArticleDto MapArticle(Article article)
    {
        return new ArticleDto
        {
            Id = article.Id,
            Title = article.Title,
            Subtitle = article.Subtitle,
            Content = article.Content,
            FeaturedImageUrl = article.FeaturedImageUrl,
            PublishDate = article.PublishDate,
            CreatedAt = article.CreatedAt,
            UpdatedAt = article.UpdatedAt,
            AuthorName = article.AuthorName,
            CategoryIds = article.ArticleCategories.Select(c => c.CategoryId).ToList(),
            CategoryNames = article.ArticleCategories.Select(c => c.Category.Name).ToList(),
            ContentType = article.ContentType,
            ContentTypeName = article.ContentType.ToString(),
            Slug = article.Slug,
            ShortDescription = article.ShortDescription,
            IsFeatured = article.IsFeatured,
            DisplayOrder = article.DisplayOrder,
            Status = article.Status,
            StatusName = article.Status.ToString(),
            IsPremium = article.IsPremium,
            ViewCount = article.ViewCount,
            LikeCount = article.LikeCount,
            ReadTimeMinutes = article.ReadTimeMinutes,
            Tags = article.ArticleTags.Select(t => t.Tag.Name).ToList()
        };
    }

    private static SongDto MapSong(Song song)
    {
        return new SongDto
        {
            Id = song.Id,
            Title = song.Title,
            Artists = song.SongArtists
                .Where(sa => sa.ArtistId.HasValue && sa.Artist != null)
                .Select(sa => new ArtistBasicDto
            {
                Id = sa.ArtistId.GetValueOrDefault(),
                Name = sa.Artist!.Name,
                ImageUrl = sa.Artist.ImageUrl
            }).ToList(),
            LyricsWithChords = song.LyricsWithChords,
            OriginalKeyId = song.OriginalKeyId,
            OriginalKeyName = string.Empty,
            YoutubeUrl = song.YouTubeUrl,
            SpotifyUrl = song.SpotifyUrl,
            ImageUrl = song.ImageUrl,
            IsApproved = song.IsApproved,
            ViewCount = song.ViewCount,
            PlayCount = song.PlayCount,
            CreatedAt = song.CreatedAt,
            UpdatedAt = song.UpdatedAt,
            UploadedByUserId = song.UploadedByUserId,
            UploaderUserId = song.UploaderUserId,
            UploaderProfileType = song.UploaderProfileType,
            UploaderProfileId = song.UploaderProfileId
        };
    }

    private static AgencyListDto MapToListDto(Agency agency)
    {
        return new AgencyListDto
        {
            Id = agency.Id,
            Name = agency.Name,
            Slug = agency.Slug,
            LogoUrl = agency.LogoUrl,
            BannerImageUrl = agency.BannerImageUrl,
            BannerBlur = agency.BannerBlur,
            ShortDescription = agency.ShortDescription,
            BrandPrimaryColor = agency.BrandPrimaryColor,
            BrandSecondaryColor = agency.BrandSecondaryColor,
            BrandTextColor = agency.BrandTextColor,
            IsActive = agency.IsActive,
            ShowInIndexBanner = agency.ShowInIndexBanner,
            DisplayOrder = agency.DisplayOrder,
            ProfilesCount = agency.Profiles.Count,
            ContentsCount = agency.Contents.Count,
            CreatedAt = agency.CreatedAt
        };
    }

    private async Task<AgencyProfileDto> EnrichProfileDtoAsync(AgencyProfile profile)
    {
        try
        {
            var dto = new AgencyProfileDto
            {
                Id = profile.Id,
                AgencyId = profile.AgencyId,
                ProfileType = profile.ProfileType,
                ProfileId = profile.ProfileId,
                ContactMode = profile.ContactMode,
                ShowBadge = profile.ShowBadge,
                IsFeaturedByAgency = profile.IsFeaturedByAgency,
                DisplayOrder = profile.DisplayOrder
            };

            if (profile.ProfileType == "artist")
            {
                var artist = await _context.Artists.AsNoTracking().FirstOrDefaultAsync(a => a.Id == profile.ProfileId && !a.IsDeleted);
                dto.ProfileName = artist?.Name;
                dto.ProfileImageUrl = artist?.ImageUrl;
                dto.ProfileUrl = artist == null ? null : $"/artist/{artist.Id}";
            }
            else
            {
                var provider = await _context.ServiceProviders.AsNoTracking().FirstOrDefaultAsync(p => p.Id == profile.ProfileId && !p.IsDeleted);
                dto.ProfileName = provider?.DisplayName;
                dto.ProfileImageUrl = provider?.ProfileImageUrl;
                dto.IsTeacher = provider?.IsTeacher ?? false;
                dto.ProfileUrl = provider == null ? null : (provider.IsTeacher ? $"/teacher/{provider.Id}" : $"/professional/{provider.Id}");
            }

            return dto;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "EnrichProfileDtoAsync failed — AgencyProfileLinkId={LinkId} AgencyId={AgencyId} ProfileType={ProfileType} ProfileId={ProfileId}",
                profile.Id, profile.AgencyId, profile.ProfileType, profile.ProfileId);
            throw;
        }
    }

    private async Task<AgencyContentDto> EnrichContentDtoAsync(AgencyContent content)
    {
        try
        {
            var title = content.ContentType switch
            {
                "article" => await _context.Articles.AsNoTracking().Where(a => a.Id == content.ContentId).Select(a => a.Title).FirstOrDefaultAsync(),
                "podcast" => await _context.Podcasts.AsNoTracking().Where(p => p.Id == content.ContentId).Select(p => p.Name).FirstOrDefaultAsync(),
                _ => await _context.Songs.AsNoTracking().Where(s => s.Id == content.ContentId).Select(s => s.Title).FirstOrDefaultAsync()
            };

            return new AgencyContentDto
            {
                Id = content.Id,
                AgencyId = content.AgencyId,
                ContentType = content.ContentType,
                ContentId = content.ContentId,
                IsFeatured = content.IsFeatured,
                DisplayOrder = content.DisplayOrder,
                Title = title
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "EnrichContentDtoAsync failed — AgencyContentLinkId={LinkId} AgencyId={AgencyId} ContentType={ContentType} ContentId={ContentId}",
                content.Id, content.AgencyId, content.ContentType, content.ContentId);
            throw;
        }
    }

    private async Task EnsureProfileExistsAsync(string profileType, int profileId)
    {
        var exists = profileType == "artist"
            ? await _context.Artists.AnyAsync(a => a.Id == profileId && !a.IsDeleted)
            : await _context.ServiceProviders.AnyAsync(p => p.Id == profileId && !p.IsDeleted);
        if (!exists) throw new KeyNotFoundException("הפרופיל לא נמצא");
    }

    private async Task EnsureContentExistsAsync(string contentType, int contentId)
    {
        var exists = contentType switch
        {
            "article" => await _context.Articles.AnyAsync(a => a.Id == contentId && !a.IsDeleted),
            "podcast" => await _context.Podcasts.AnyAsync(p => p.Id == contentId && !p.IsDeleted),
            _ => await _context.Songs.AnyAsync(s => s.Id == contentId)
        };
        if (!exists) throw new KeyNotFoundException("התוכן לא נמצא");
    }

    private async Task<string> EnsureUniqueSlugAsync(string? requestedSlug, string name, int? currentId = null)
    {
        var baseSlug = Slugify(string.IsNullOrWhiteSpace(requestedSlug) ? name : requestedSlug);
        var slug = baseSlug;
        var counter = 2;
        while (await _context.Agencies.AnyAsync(a => a.Slug == slug && !a.IsDeleted && (!currentId.HasValue || a.Id != currentId.Value)))
        {
            slug = $"{baseSlug}-{counter++}";
        }
        return slug;
    }

    private static string Slugify(string value)
    {
        var normalized = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var chars = normalized.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray();
        var clean = new string(chars).Normalize(NormalizationForm.FormC);
        clean = Regex.Replace(clean, @"[^\p{L}\p{N}]+", "-").Trim('-');
        return string.IsNullOrWhiteSpace(clean) ? $"agency-{DateTime.UtcNow.Ticks}" : clean;
    }

    private static string? NormalizeProfileType(string? profileType)
    {
        return profileType?.Trim() switch
        {
            "artist" => "artist",
            "serviceProvider" => "serviceProvider",
            "teacher" => "serviceProvider",
            _ => null
        };
    }

    private static string? NormalizeContentType(string? contentType)
    {
        return contentType?.Trim() switch
        {
            "article" => "article",
            "song" => "song",
            "podcast" => "podcast",
            _ => null
        };
    }

    private static string? NormalizeGalleryMediaType(string? mediaType)
    {
        return mediaType?.Trim() switch
        {
            null or "" => "image",
            "image" => "image",
            "video" => "video",
            _ => null
        };
    }

    private static string? Clean(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrWhiteSpace(trimmed) ? null : trimmed;
    }

    private static string? CleanColor(string? value)
    {
        var trimmed = Clean(value);
        if (trimmed == null) return null;
        return Regex.IsMatch(trimmed, "^#[0-9a-fA-F]{6}$") ? trimmed : null;
    }
}
