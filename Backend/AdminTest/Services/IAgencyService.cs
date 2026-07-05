using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IAgencyService
{
    Task<PagedResult<AgencyListDto>> GetAgenciesAsync(string? search, bool? isActive, int pageNumber, int pageSize);
    Task<List<AgencyListDto>> GetIndexBannersAsync(int limit);
    Task<AgencyDto?> GetAgencyByIdAsync(int id);
    Task<AgencyPublicDto?> GetAgencyBySlugAsync(string slug);
    Task<AgencyBadgeDto?> GetBadgeForProfileAsync(string profileType, int profileId);
    Task<AgencyDto> CreateAgencyAsync(CreateAgencyDto dto);
    Task<AgencyDto> UpdateAgencyAsync(int id, UpdateAgencyDto dto);
    Task<bool> DeleteAgencyAsync(int id);
    Task<AgencyProfileDto> AddProfileAsync(int agencyId, UpsertAgencyProfileDto dto);
    Task<bool> RemoveProfileAsync(int agencyId, int profileLinkId);
    Task<AgencyContentDto> AddContentAsync(int agencyId, UpsertAgencyContentDto dto);
    Task<bool> RemoveContentAsync(int agencyId, int contentLinkId);
    Task<List<AgencyGalleryImageDto>> GetGalleryImagesAsync(int agencyId);
    Task<AgencyGalleryImageDto> AddGalleryImageAsync(int agencyId, AgencyGalleryImageDto dto);
    Task<bool> RemoveGalleryImageAsync(int agencyId, int imageId);
    Task<List<AgencySocialLinkDto>> GetSocialLinksAsync(int agencyId);
    Task<AgencySocialLinkDto> UpsertSocialLinkAsync(int agencyId, AgencySocialLinkDto dto);
    Task<bool> RemoveSocialLinkAsync(int agencyId, int linkId);
}
