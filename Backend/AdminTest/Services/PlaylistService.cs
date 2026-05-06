using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class PlaylistService : IPlaylistService
{
    private readonly AkordishKeitDbContext _context;
    private readonly ISystemSettingsService _systemSettings;
    private readonly IUserTagService _userTagService;

    public PlaylistService(
        AkordishKeitDbContext context,
        ISystemSettingsService systemSettings,
        IUserTagService userTagService)
    {
        _context = context;
        _systemSettings = systemSettings;
        _userTagService = userTagService;
    }

    public async Task<List<PlaylistDto>> GetUserPlaylistsAsync(int userId)
    {
        // מוודא שרשימת ברירת המחדל קיימת (יוצר אותה בפעם הראשונה)
        await EnsureDefaultPlaylistAsync(userId);

        var playlists = await _context.Playlists
            .Where(p => p.UserId == userId)
            .Select(p => new PlaylistDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                ImageUrl = p.ImageUrl,
                IsPublic = p.IsPublic,
                IsAdopted = p.IsAdopted,
                IsDefault = p.IsDefault,
                SongCount = p.PlaylistSongs.Count,
                ThumbnailSongImages = p.PlaylistSongs
                    .OrderBy(ps => ps.Order)
                    .Take(4)
                    .Where(ps => ps.Song.ImageUrl != null && ps.Song.ImageUrl != "")
                    .Select(ps => ps.Song.ImageUrl!)
                    .ToList(),
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt
            })
            .ToListAsync();

        // רשימת ברירת המחדל תמיד ראשונה
        return playlists
            .OrderByDescending(p => p.IsDefault)
            .ThenByDescending(p => p.CreatedAt)
            .ToList();
    }

    public async Task<PlaylistDetailDto?> GetPlaylistByIdAsync(int playlistId, int userId)
    {
        var playlist = await _context.Playlists
            .Include(p => p.PlaylistSongs)
                .ThenInclude(ps => ps.Song)
                    .ThenInclude(s => s.SongArtists)
                        .ThenInclude(sa => sa.Artist)
            .AsSplitQuery()
            .FirstOrDefaultAsync(p => p.Id == playlistId && (p.UserId == userId || p.IsPublic));

        if (playlist == null) return null;

        return new PlaylistDetailDto
        {
            Id = playlist.Id,
            UserId = playlist.UserId,
            Name = playlist.Name,
            Description = playlist.Description,
            ImageUrl = playlist.ImageUrl,
            IsPublic = playlist.IsPublic,
            IsAdopted = playlist.IsAdopted,
            IsDefault = playlist.IsDefault,
            Songs = playlist.PlaylistSongs
                .OrderBy(ps => ps.Order)
                .Select(ps => new PlaylistSongDto
                {
                    Id = ps.Id,
                    SongId = ps.Song.Id,
                    SongTitle = ps.Song.Title,
                    SongImageUrl = ps.Song.ImageUrl,
                    ArtistName = ps.Song.SongArtists.FirstOrDefault()?.Artist?.Name ?? "",
                    Order = ps.Order,
                    AddedAt = ps.AddedAt
                })
                .ToList(),
            CreatedAt = playlist.CreatedAt,
            UpdatedAt = playlist.UpdatedAt
        };
    }

    public async Task<List<PlaylistDto>> GetRecentPlaylistsAsync(int userId, int count = 2)
    {
        await EnsureDefaultPlaylistAsync(userId);

        // שולף את רשימת ברירת המחדל ישירות מה-DB
        var defaultPlaylist = await _context.Playlists
            .Where(p => p.UserId == userId && p.IsDefault)
            .Select(p => new PlaylistDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                ImageUrl = p.ImageUrl,
                IsPublic = p.IsPublic,
                IsAdopted = p.IsAdopted,
                IsDefault = p.IsDefault,
                SongCount = p.PlaylistSongs.Count,
                ThumbnailSongImages = p.PlaylistSongs
                    .OrderBy(ps => ps.Order)
                    .Take(4)
                    .Where(ps => ps.Song.ImageUrl != null && ps.Song.ImageUrl != "")
                    .Select(ps => ps.Song.ImageUrl!)
                    .ToList(),
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt
            })
            .FirstOrDefaultAsync();

        var recentCount = count - (defaultPlaylist != null ? 1 : 0);
        if (recentCount <= 0)
            return defaultPlaylist != null ? new List<PlaylistDto> { defaultPlaylist } : new List<PlaylistDto>();

        // שולף רק את הרשימות הנחוצות, ממוינות ב-DB
        var others = await _context.Playlists
            .Where(p => p.UserId == userId && !p.IsDefault)
            .OrderByDescending(p => p.UpdatedAt ?? p.CreatedAt)
            .Take(recentCount)
            .Select(p => new PlaylistDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                ImageUrl = p.ImageUrl,
                IsPublic = p.IsPublic,
                IsAdopted = p.IsAdopted,
                IsDefault = p.IsDefault,
                SongCount = p.PlaylistSongs.Count,
                ThumbnailSongImages = p.PlaylistSongs
                    .OrderBy(ps => ps.Order)
                    .Take(4)
                    .Where(ps => ps.Song.ImageUrl != null && ps.Song.ImageUrl != "")
                    .Select(ps => ps.Song.ImageUrl!)
                    .ToList(),
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt
            })
            .ToListAsync();

        var result = new List<PlaylistDto>();
        if (defaultPlaylist != null) result.Add(defaultPlaylist);
        result.AddRange(others);
        return result;
    }

    public async Task<PagedResult<PlaylistDto>> GetPublicPlaylistsAsync(int page = 1, int pageSize = 20)
    {
        var query = _context.Playlists
            .Where(p => p.IsPublic && !p.IsDefault && !p.IsAdopted && p.PlaylistSongs.Any())
            .OrderByDescending(p => p.CreatedAt);

        var totalCount = await query.CountAsync();

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new PlaylistDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                ImageUrl = p.ImageUrl,
                IsPublic = p.IsPublic,
                IsAdopted = p.IsAdopted,
                IsDefault = p.IsDefault,
                SongCount = p.PlaylistSongs.Count,
                ThumbnailSongImages = p.PlaylistSongs
                    .OrderBy(ps => ps.Order)
                    .Take(4)
                    .Where(ps => ps.Song.ImageUrl != null && ps.Song.ImageUrl != "")
                    .Select(ps => ps.Song.ImageUrl!)
                    .ToList(),
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt
            })
            .ToListAsync();

        return new PagedResult<PlaylistDto>
        {
            Items = items,
            TotalCount = totalCount,
            PageNumber = page,
            PageSize = pageSize
        };
    }

    private const int MaxPlaylistsPerUser = 4;
    private const int MaxSongsPerPlaylist = 7;

    public async Task<PlaylistDto> CreatePlaylistAsync(CreatePlaylistDto dto, int userId)
    {
        // בדיקת מגבלת רשימות: עד 4 רשימות (לא כולל ברירת מחדל)
        var existingCount = await _context.Playlists
            .CountAsync(p => p.UserId == userId && !p.IsDefault);

        if (existingCount >= MaxPlaylistsPerUser)
            throw new InvalidOperationException(
                $"ניתן לשמור עד {MaxPlaylistsPerUser} רשימות בלבד. מחק רשימה קיימת כדי ליצור חדשה.");

        var playlist = new Playlist
        {
            UserId = userId,
            Name = dto.Name,
            Description = dto.Description,
            ImageUrl = dto.ImageUrl,
            IsPublic = dto.IsPublic,
            CreatedAt = DateTime.UtcNow
        };

        _context.Playlists.Add(playlist);
        await _context.SaveChangesAsync();

        return new PlaylistDto
        {
            Id = playlist.Id,
            Name = playlist.Name,
            Description = playlist.Description,
            ImageUrl = playlist.ImageUrl,
            IsPublic = playlist.IsPublic,
            IsAdopted = false,
            IsDefault = false,
            SongCount = 0,
            CreatedAt = playlist.CreatedAt,
            UpdatedAt = playlist.UpdatedAt
        };
    }

    public async Task<PlaylistDto?> UpdatePlaylistAsync(int playlistId, UpdatePlaylistDto dto, int userId)
    {
        var playlist = await _context.Playlists
            .FirstOrDefaultAsync(p => p.Id == playlistId && p.UserId == userId);

        if (playlist == null) return null;
        if (playlist.IsDefault) return null;

        if (!string.IsNullOrWhiteSpace(dto.Name))
            playlist.Name = dto.Name;

        if (dto.Description != null)
            playlist.Description = dto.Description;

        if (dto.ImageUrl != null)
            playlist.ImageUrl = dto.ImageUrl;

        if (dto.IsPublic.HasValue)
            playlist.IsPublic = dto.IsPublic.Value;

        playlist.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return new PlaylistDto
        {
            Id = playlist.Id,
            Name = playlist.Name,
            Description = playlist.Description,
            ImageUrl = playlist.ImageUrl,
            IsPublic = playlist.IsPublic,
            IsAdopted = playlist.IsAdopted,
            IsDefault = playlist.IsDefault,
            SongCount = await _context.PlaylistSongs.CountAsync(ps => ps.PlaylistId == playlistId),
            CreatedAt = playlist.CreatedAt,
            UpdatedAt = playlist.UpdatedAt
        };
    }

    public async Task<bool> DeletePlaylistAsync(int playlistId, int userId)
    {
        var playlist = await _context.Playlists
            .FirstOrDefaultAsync(p => p.Id == playlistId && p.UserId == userId);

        if (playlist == null) return false;

        // רשימת ברירת המחדל מוגנת — לא ניתן למחוק
        if (playlist.IsDefault) return false;

        // Cascade Delete יסיר את כל PlaylistSongs אוטומטית
        _context.Playlists.Remove(playlist);
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> AddSongToPlaylistAsync(int playlistId, int songId, int userId)
    {
        // בדיקה שהרשימה שייכת למשתמש
        var playlist = await _context.Playlists
            .FirstOrDefaultAsync(p => p.Id == playlistId && p.UserId == userId);

        if (playlist == null) return false;

        // בדיקה שהשיר קיים
        var songExists = await _context.Songs.AnyAsync(s => s.Id == songId);
        if (!songExists) return false;

        // בדיקה שהשיר לא כבר ברשימה (האינדקס Unique יזרוק שגיאה אם ננסה להוסיף כפול)
        var alreadyExists = await _context.PlaylistSongs
            .AnyAsync(ps => ps.PlaylistId == playlistId && ps.SongId == songId);

        if (alreadyExists) return false;

        // בדיקת מגבלת שירים: עד 7 שירים ברשימה (לא כולל ברירת מחדל)
        if (!playlist.IsDefault)
        {
            var currentSongCount = await _context.PlaylistSongs
                .CountAsync(ps => ps.PlaylistId == playlistId);

            if (currentSongCount >= MaxSongsPerPlaylist)
                throw new InvalidOperationException(
                    $"ניתן להוסיף עד {MaxSongsPerPlaylist} שירים לרשימה בלבד.");
        }

        // חישוב הסדר הבא
        var maxOrder = await _context.PlaylistSongs
            .Where(ps => ps.PlaylistId == playlistId)
            .MaxAsync(ps => (int?)ps.Order) ?? 0;

        var playlistSong = new PlaylistSong
        {
            PlaylistId = playlistId,
            SongId = songId,
            Order = maxOrder + 1,
            AddedAt = DateTime.UtcNow
        };

        _context.PlaylistSongs.Add(playlistSong);

        // עדכון UpdatedAt של הרשימה
        playlist.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> RemoveSongFromPlaylistAsync(int playlistId, int songId, int userId)
    {
        // בדיקה שהרשימה שייכת למשתמש
        var playlist = await _context.Playlists
            .FirstOrDefaultAsync(p => p.Id == playlistId && p.UserId == userId);

        if (playlist == null) return false;

        var playlistSong = await _context.PlaylistSongs
            .FirstOrDefaultAsync(ps => ps.PlaylistId == playlistId && ps.SongId == songId);

        if (playlistSong == null) return false;

        // מחיקה אמיתית
        _context.PlaylistSongs.Remove(playlistSong);

        // עדכון UpdatedAt של הרשימה
        playlist.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // סידור מחדש של הסדרים
        var remainingSongs = await _context.PlaylistSongs
            .Where(ps => ps.PlaylistId == playlistId)
            .OrderBy(ps => ps.Order)
            .ToListAsync();

        for (int i = 0; i < remainingSongs.Count; i++)
        {
            remainingSongs[i].Order = i + 1;
        }

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<bool> ReorderPlaylistAsync(int playlistId, List<int> songIds, int userId)
    {
        // בדיקה שהרשימה שייכת למשתמש
        var playlist = await _context.Playlists
            .FirstOrDefaultAsync(p => p.Id == playlistId && p.UserId == userId);

        if (playlist == null) return false;

        // קבלת כל השירים ברשימה
        var playlistSongs = await _context.PlaylistSongs
            .Where(ps => ps.PlaylistId == playlistId)
            .ToListAsync();

        // O(n) במקום O(n²): Dictionary לחיפוש מהיר
        var songMap = playlistSongs.ToDictionary(ps => ps.SongId);
        for (int i = 0; i < songIds.Count; i++)
        {
            if (songMap.TryGetValue(songIds[i], out var playlistSong))
                playlistSong.Order = i + 1;
        }

        // עדכון UpdatedAt של הרשימה
        playlist.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<PlaylistDto?> AdoptPlaylistAsync(int playlistId, int userId)
    {
        // קבלת הרשימה המקורית (חייבת להיות ציבורית)
        var originalPlaylist = await _context.Playlists
            .Include(p => p.PlaylistSongs)
            .FirstOrDefaultAsync(p => p.Id == playlistId && p.IsPublic);

        if (originalPlaylist == null) return null;

        // בדיקת מגבלת רשימות
        var existingCount = await _context.Playlists
            .CountAsync(p => p.UserId == userId && !p.IsDefault);

        if (existingCount >= MaxPlaylistsPerUser)
            throw new InvalidOperationException(
                $"ניתן לשמור עד {MaxPlaylistsPerUser} רשימות בלבד. מחק רשימה קיימת כדי לאמץ חדשה.");

        // יצירת עותק של הרשימה
        var adoptedPlaylist = new Playlist
        {
            UserId = userId,
            Name = originalPlaylist.Name + " (רשימה שאמצתי)",
            Description = originalPlaylist.Description,
            ImageUrl = originalPlaylist.ImageUrl,
            IsPublic = false, // רשימה מאומצת היא פרטית כברירת מחדל
            IsAdopted = true, // סימון שהרשימה אומצה
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Playlists.Add(adoptedPlaylist);
        await _context.SaveChangesAsync();

        // העתקת כל השירים מהרשימה המקורית
        foreach (var originalSong in originalPlaylist.PlaylistSongs)
        {
            var adoptedSong = new PlaylistSong
            {
                PlaylistId = adoptedPlaylist.Id,
                SongId = originalSong.SongId,
                Order = originalSong.Order,
                AddedAt = DateTime.UtcNow
            };
            _context.PlaylistSongs.Add(adoptedSong);
        }

        await _context.SaveChangesAsync();

        // החזרת ה-DTO
        return new PlaylistDto
        {
            Id = adoptedPlaylist.Id,
            Name = adoptedPlaylist.Name,
            Description = adoptedPlaylist.Description,
            ImageUrl = adoptedPlaylist.ImageUrl,
            SongCount = originalPlaylist.PlaylistSongs.Count,
            IsPublic = adoptedPlaylist.IsPublic,
            IsAdopted = true,
            IsDefault = false,
            CreatedAt = adoptedPlaylist.CreatedAt
        };
    }

    public async Task<PlaylistDto?> DuplicatePlaylistAsync(int playlistId, int userId)
    {
        // קבלת הרשימה המקורית (חייבת להיות של המשתמש)
        var originalPlaylist = await _context.Playlists
            .Include(p => p.PlaylistSongs)
            .FirstOrDefaultAsync(p => p.Id == playlistId && p.UserId == userId);

        if (originalPlaylist == null) return null;

        // בדיקת מגבלת רשימות
        var existingCount = await _context.Playlists
            .CountAsync(p => p.UserId == userId && !p.IsDefault);

        if (existingCount >= MaxPlaylistsPerUser)
            throw new InvalidOperationException(
                $"ניתן לשמור עד {MaxPlaylistsPerUser} רשימות בלבד. מחק רשימה קיימת כדי לשכפל.");

        // יצירת עותק של הרשימה
        var duplicatedPlaylist = new Playlist
        {
            UserId = userId,
            Name = originalPlaylist.Name + " - עותק",
            Description = originalPlaylist.Description,
            ImageUrl = originalPlaylist.ImageUrl,
            IsPublic = originalPlaylist.IsPublic,
            IsAdopted = originalPlaylist.IsAdopted, // שמירת הסטטוס המקורי
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Playlists.Add(duplicatedPlaylist);
        await _context.SaveChangesAsync();

        // העתקת כל השירים מהרשימה המקורית
        foreach (var originalSong in originalPlaylist.PlaylistSongs)
        {
            var duplicatedSong = new PlaylistSong
            {
                PlaylistId = duplicatedPlaylist.Id,
                SongId = originalSong.SongId,
                Order = originalSong.Order,
                AddedAt = DateTime.UtcNow
            };
            _context.PlaylistSongs.Add(duplicatedSong);
        }

        await _context.SaveChangesAsync();

        // החזרת ה-DTO
        return new PlaylistDto
        {
            Id = duplicatedPlaylist.Id,
            Name = duplicatedPlaylist.Name,
            Description = duplicatedPlaylist.Description,
            ImageUrl = duplicatedPlaylist.ImageUrl,
            SongCount = originalPlaylist.PlaylistSongs.Count,
            IsPublic = duplicatedPlaylist.IsPublic,
            IsAdopted = duplicatedPlaylist.IsAdopted,
            IsDefault = false,
            CreatedAt = duplicatedPlaylist.CreatedAt
        };
    }

    // ════════════════════════════════════════════════════════
    //   DEFAULT PLAYLIST — "השמורים שלי"
    // ════════════════════════════════════════════════════════

    public async Task<Playlist> EnsureDefaultPlaylistAsync(int userId)
    {
        var existing = await _context.Playlists
            .FirstOrDefaultAsync(p => p.UserId == userId && p.IsDefault);

        if (existing != null) return existing;

        var existingSavedPlaylist = await _context.Playlists
            .FirstOrDefaultAsync(p => p.UserId == userId && p.Name == "השמורים שלי");

        if (existingSavedPlaylist != null)
        {
            existingSavedPlaylist.IsDefault = true;
            existingSavedPlaylist.IsPublic = false;
            existingSavedPlaylist.IsAdopted = false;
            existingSavedPlaylist.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return existingSavedPlaylist;
        }

        var defaultPlaylist = new Playlist
        {
            UserId = userId,
            Name = "השמורים שלי",
            Description = "רשימת ברירת המחדל שלי",
            IsPublic = false,
            IsAdopted = false,
            IsDefault = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Playlists.Add(defaultPlaylist);

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // race condition: בקשה מקבילה כבר יצרה את הרשימה
            _context.Entry(defaultPlaylist).State = EntityState.Detached;
            var concurrent = await _context.Playlists
                .FirstOrDefaultAsync(p => p.UserId == userId && p.IsDefault);
            if (concurrent != null) return concurrent;
            throw;
        }

        return defaultPlaylist;
    }

    public async Task<bool> SaveToDefaultPlaylistAsync(int songId, int userId)
    {
        var defaultPlaylist = await EnsureDefaultPlaylistAsync(userId);
        return await AddSongToPlaylistAsync(defaultPlaylist.Id, songId, userId);
    }

    public async Task<SongPlaylistStateDto> GetSongPlaylistStateAsync(int songId, int userId)
    {
        var defaultPlaylist = await EnsureDefaultPlaylistAsync(userId);

        var isInDefault = await _context.PlaylistSongs
            .AnyAsync(ps => ps.PlaylistId == defaultPlaylist.Id && ps.SongId == songId);

        var playlistIds = await _context.PlaylistSongs
            .Where(ps =>
                ps.SongId == songId &&
                ps.Playlist.UserId == userId &&
                !ps.Playlist.IsDefault &&
                !ps.Playlist.IsAdopted)
            .Select(ps => ps.PlaylistId)
            .ToListAsync();

        return new SongPlaylistStateDto
        {
            IsInDefault = isInDefault,
            PlaylistIds = playlistIds
        };
    }

    public async Task<bool> RemoveFromDefaultPlaylistAsync(int songId, int userId, bool removeFromPersonalPlaylists)
    {
        var defaultPlaylist = await EnsureDefaultPlaylistAsync(userId);
        var removed = await RemoveSongFromPlaylistAsync(defaultPlaylist.Id, songId, userId);

        if (!removed) return false;
        if (!removeFromPersonalPlaylists) return true;

        // טוענים את כל הרשומות לשחרור בשאילתה אחת
        var toRemove = await _context.PlaylistSongs
            .Where(ps => ps.SongId == songId &&
                         ps.Playlist.UserId == userId &&
                         !ps.Playlist.IsDefault &&
                         !ps.Playlist.IsAdopted)
            .Include(ps => ps.Playlist)
            .ToListAsync();

        if (!toRemove.Any()) return true;

        var affectedPlaylistIds = toRemove.Select(ps => ps.PlaylistId).Distinct().ToList();

        _context.PlaylistSongs.RemoveRange(toRemove);

        foreach (var ps in toRemove)
            ps.Playlist.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // סידור מחדש של הסדרים בכל רשימה שהושפעה
        foreach (var playlistId in affectedPlaylistIds)
        {
            var remaining = await _context.PlaylistSongs
                .Where(ps => ps.PlaylistId == playlistId)
                .OrderBy(ps => ps.Order)
                .ToListAsync();

            for (int i = 0; i < remaining.Count; i++)
                remaining[i].Order = i + 1;
        }

        if (affectedPlaylistIds.Any())
            await _context.SaveChangesAsync();

        return true;
    }
}
