using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IPlaylistService
{
    /// <summary>
    /// קבלת כל הרשימות של משתמש
    /// </summary>
    Task<List<PlaylistDto>> GetUserPlaylistsAsync(int userId);

    /// <summary>
    /// קבלת רשימה ספציפית עם כל השירים
    /// </summary>
    Task<PlaylistDetailDto?> GetPlaylistByIdAsync(int playlistId, int userId);

    /// <summary>
    /// קבלת 2 הרשימות האחרונות של המשתמש (לפופאפ)
    /// </summary>
    Task<List<PlaylistDto>> GetRecentPlaylistsAsync(int userId, int count = 2);

    /// <summary>
    /// קבלת כל הרשימות הציבוריות של כל המשתמשים (למאגר הקהילתי)
    /// </summary>
    Task<List<PlaylistDto>> GetPublicPlaylistsAsync();

    /// <summary>
    /// יצירת רשימת השמעה חדשה
    /// </summary>
    Task<PlaylistDto> CreatePlaylistAsync(CreatePlaylistDto dto, int userId);

    /// <summary>
    /// עדכון פרטי רשימת השמעה
    /// </summary>
    Task<PlaylistDto?> UpdatePlaylistAsync(int playlistId, UpdatePlaylistDto dto, int userId);

    /// <summary>
    /// מחיקת רשימת השמעה (מחיקה אמיתית)
    /// </summary>
    Task<bool> DeletePlaylistAsync(int playlistId, int userId);

    /// <summary>
    /// הוספת שיר לרשימת השמעה
    /// </summary>
    Task<bool> AddSongToPlaylistAsync(int playlistId, int songId, int userId);

    /// <summary>
    /// הסרת שיר מרשימת השמעה (מחיקה אמיתית)
    /// </summary>
    Task<bool> RemoveSongFromPlaylistAsync(int playlistId, int songId, int userId);

    /// <summary>
    /// שינוי סדר שירים ברשימת השמעה
    /// </summary>
    Task<bool> ReorderPlaylistAsync(int playlistId, List<int> songIds, int userId);

    /// <summary>
    /// אימוץ רשימה מהמאגר הקהילתי - יצירת עותק של רשימה ציבורית
    /// </summary>
    Task<PlaylistDto?> AdoptPlaylistAsync(int playlistId, int userId);

    /// <summary>
    /// שכפול רשימה קיימת של המשתמש - יצירת עותק זהה
    /// </summary>
    Task<PlaylistDto?> DuplicatePlaylistAsync(int playlistId, int userId);
}
