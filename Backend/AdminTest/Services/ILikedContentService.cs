using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface ILikedContentService
{
    /// <summary>
    /// קבלת כל התכנים האהובים של משתמש
    /// </summary>
    Task<List<LikedContentDto>> GetUserLikedContentAsync(int userId);

    /// <summary>
    /// הוספת תוכן למועדפים
    /// </summary>
    Task<LikedContentDto?> AddLikedContentAsync(AddLikedContentDto dto, int userId);

    /// <summary>
    /// הסרת תוכן מהמועדפים
    /// </summary>
    Task<bool> RemoveLikedContentAsync(string contentType, int contentId, int userId);

    /// <summary>
    /// בדיקה האם תוכן מסוים במועדפים
    /// </summary>
    Task<bool> IsContentLikedAsync(string contentType, int contentId, int userId);
}
