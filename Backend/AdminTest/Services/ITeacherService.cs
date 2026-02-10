using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface ITeacherService
{
    Task<PagedResult<TeacherListDto>> GetTeachersAsync(
        string? search,
        int? instrumentId,
        int? cityId,
        int? status,
        bool? isFeatured,
        int pageNumber,
        int pageSize);

    Task<TeacherDto?> GetTeacherByIdAsync(int id);

    Task<TeacherDto?> GetTeacherByUserIdAsync(int userId);

    Task<TeacherDto> CreateTeacherAsync(CreateTeacherDto dto);

    Task<TeacherDto> UpdateTeacherAsync(int id, UpdateTeacherDto dto);

    Task<bool> DeleteTeacherAsync(int id);

    Task<bool> ApproveTeacherAsync(int id);

    Task<bool> RejectTeacherAsync(int id);

    Task LinkToUserAsync(int teacherId, int userId);

    Task UnlinkFromUserAsync(int teacherId);
}
