using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IMusicServiceProviderService
{
    Task<PagedResult<MusicServiceProviderListDto>> GetServiceProvidersAsync(
        string? search,
        int? categoryId,
        int? cityId,
        int? status,
        bool? isFeatured,
        bool? isTeacher,
        int pageNumber,
        int pageSize);

    Task<MusicServiceProviderDto?> GetServiceProviderByIdAsync(int id);

    Task<MusicServiceProviderDto?> GetServiceProviderByUserIdAsync(int userId);

    Task<MusicServiceProviderDto> CreateServiceProviderAsync(CreateMusicServiceProviderDto dto);

    Task<MusicServiceProviderDto> UpdateServiceProviderAsync(int id, UpdateMusicServiceProviderDto dto);

    Task<bool> DeleteServiceProviderAsync(int id);

    Task<bool> ApproveServiceProviderAsync(int id);

    Task<bool> RejectServiceProviderAsync(int id);

    Task<bool> UserHasServiceProviderProfileAsync(int userId);

    Task LinkToUserAsync(int providerId, int userId);

    Task UnlinkFromUserAsync(int providerId);
}
