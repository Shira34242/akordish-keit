using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IUserKnownChordService
{
    Task<List<UserKnownChordDto>> GetUserKnownChordsAsync(int userId, string? instrument = null);
    Task<UserKnownChordDto?> AddKnownChordAsync(AddUserKnownChordDto dto, int userId);
    Task<bool> RemoveKnownChordAsync(string instrument, string chordName, int userId);
    Task<KnownChordSongSummaryDto> BuildSummaryAsync(KnownChordSongSummaryRequestDto dto, int userId);
    Task<PagedResult<KnownChordSongMatchDto>> GetMatchingSongsAsync(int userId, string instrument, int maxMissing, string? sortBy, int page, int pageSize);
}
