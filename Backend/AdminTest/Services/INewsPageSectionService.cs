using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services
{
    public interface INewsPageSectionService
    {
        /// <summary>
        /// מחזיר את הפסים הפעילים בדף חדשות המוזיקה, כולל הכתבות לכל פס (לשימוש ציבורי)
        /// </summary>
        Task<List<NewsPageSectionDto>> GetActiveSectionsWithArticlesAsync();

        /// <summary>
        /// מחזיר את כל הפסים (לשימוש בממשק ניהול)
        /// </summary>
        Task<List<NewsPageSectionDto>> GetAllSectionsAsync();

        Task<NewsPageSectionDto?> GetSectionByIdAsync(int id);

        Task<NewsPageSectionDto> CreateSectionAsync(CreateNewsPageSectionDto dto);

        Task<NewsPageSectionDto?> UpdateSectionAsync(int id, UpdateNewsPageSectionDto dto);

        Task<bool> DeleteSectionAsync(int id);
    }
}
