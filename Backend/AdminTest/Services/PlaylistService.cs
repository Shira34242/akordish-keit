using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class PlaylistService : IPlaylistService
{
    private readonly AkordishKeitDbContext _context;

    public PlaylistService(AkordishKeitDbContext context)
    {
        _context = context;
    }

    public async Task<List<PlaylistDto>> GetUserPlaylistsAsync(int userId)
    {
        return await _context.Playlists
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PlaylistDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                ImageUrl = p.ImageUrl,
                IsPublic = p.IsPublic,
                IsAdopted = p.IsAdopted,
                SongCount = p.PlaylistSongs.Count,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt
            })
            .ToListAsync();
    }

    public async Task<PlaylistDetailDto?> GetPlaylistByIdAsync(int playlistId, int userId)
    {
        var playlist = await _context.Playlists
            .Include(p => p.PlaylistSongs)
                .ThenInclude(ps => ps.Song)
                    .ThenInclude(s => s.SongArtists)
                        .ThenInclude(sa => sa.Artist)
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
        return await _context.Playlists
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.UpdatedAt ?? p.CreatedAt)
            .Take(count)
            .Select(p => new PlaylistDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                ImageUrl = p.ImageUrl,
                IsPublic = p.IsPublic,
                IsAdopted = p.IsAdopted,
                SongCount = p.PlaylistSongs.Count,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt
            })
            .ToListAsync();
    }

    public async Task<List<PlaylistDto>> GetPublicPlaylistsAsync()
    {
        return await _context.Playlists
            .Where(p => p.IsPublic)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new PlaylistDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                ImageUrl = p.ImageUrl,
                IsPublic = p.IsPublic,
                IsAdopted = p.IsAdopted,
                SongCount = p.PlaylistSongs.Count,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt
            })
            .ToListAsync();
    }

    public async Task<PlaylistDto> CreatePlaylistAsync(CreatePlaylistDto dto, int userId)
    {
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

        // עדכון הסדר לפי המערך שהתקבל
        for (int i = 0; i < songIds.Count; i++)
        {
            var playlistSong = playlistSongs.FirstOrDefault(ps => ps.SongId == songIds[i]);
            if (playlistSong != null)
            {
                playlistSong.Order = i + 1;
            }
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
            CreatedAt = duplicatedPlaylist.CreatedAt
        };
    }
}
