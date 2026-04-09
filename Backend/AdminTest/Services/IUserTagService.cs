using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Services;

public interface IUserTagService
{
    /// <summary>
    /// מחשב מחדש את תג התרומה של המשתמש לפי כמות תכנים שהעלה.
    /// יש לקרוא לפונקציה אחרי כל העלאת שיר או כתבה.
    /// </summary>
    Task RecalculateTagAsync(int userId);

    /// <summary>מחזיר את מידע התג של המשתמש</summary>
    Task<UserTagDto?> GetUserTagAsync(int userId);

    /// <summary>מגבלת הרשימות לתג נתון (שימוש ב-PlaylistService)</summary>
    int GetPlaylistLimit(UserContentTag tag);
}
