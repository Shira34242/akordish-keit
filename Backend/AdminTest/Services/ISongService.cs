using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface ISongService
{
    // ============================================
    // HIGH PRIORITY - Core CRUD Operations
    // ============================================

    /// <summary>
    /// Create a new song with all relationships (artists, genres, tags)
    /// </summary>
    Task<AddSongResponseDto> CreateSongAsync(AddSongRequestDto dto, int userId);

    /// <summary>
    /// Update an existing song with all relationships
    /// </summary>
    Task<AddSongResponseDto> UpdateSongAsync(int id, UpdateSongRequestDto dto, int userId);

    /// <summary>
    /// Get paginated list of songs with filters
    /// </summary>
    Task<PagedResult<SongDto>> GetSongsAsync(
        int page,
        int pageSize,
        string? search = null,
        int? artistId = null,
        int? genreId = null,
        int? keyId = null,
        string? sortBy = null,
        bool includeUnapproved = false);

    /// <summary>
    /// Get a single song by ID
    /// </summary>
    Task<SongDto?> GetSongByIdAsync(int id, bool includeUnapproved = false);

    /// <summary>
    /// Get a random approved song
    /// </summary>
    Task<SongDto?> GetRandomSongAsync();

    /// <summary>
    /// Check if a user can edit a specific song
    /// </summary>
    Task<bool> CanUserEditSongAsync(int songId, int userId);

    // ============================================
    // MEDIUM PRIORITY - Search & Discovery
    // ============================================

    /// <summary>
    /// Check for potential duplicate songs by title
    /// </summary>
    Task<DuplicateCheckResponseDto> CheckDuplicateAsync(string title);

    /// <summary>
    /// Generic autocomplete for artists, genres, people, tags
    /// </summary>
    Task<List<AutocompleteResultDto>> AutocompleteAsync(string entityType, string query, int maxResults = 10);

    /// <summary>
    /// Get popular songs ordered by view count
    /// </summary>
    Task<List<SongBasicDto>> GetPopularSongsAsync(int limit = 10);

    /// <summary>
    /// Toggle song approval status (Admin only)
    /// </summary>
    Task<bool> ToggleSongApprovalAsync(int id, bool isApproved);

    // ============================================
    // LOW PRIORITY - Reference Data
    // ============================================

    /// <summary>
    /// Get all musical keys
    /// </summary>
    Task<List<MusicalKeyDto>> GetMusicalKeysAsync();

    /// <summary>
    /// Get all genres
    /// </summary>
    Task<List<GenreDto>> GetAllGenresAsync();

    // ============================================
    // ANALYTICS - Already Implemented
    // ============================================

    /// <summary>
    /// Increment unique view count with tracking
    /// </summary>
    Task<int> IncrementViewCountAsync(int id, int? userId, string? ipAddress, string? userAgent, string? referrer);
}
