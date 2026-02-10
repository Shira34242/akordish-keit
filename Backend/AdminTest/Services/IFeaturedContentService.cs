using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services
{
    public interface IFeaturedContentService
    {
        /// <summary>
        /// קבלת כל התוכן המרכזי הפעיל (4 כתבות)
        /// </summary>
        Task<IEnumerable<FeaturedContentDto>> GetActiveFeaturedContentAsync();

        /// <summary>
        /// קבלת כל התוכן המרכזי (כולל לא פעיל)
        /// </summary>
        Task<IEnumerable<FeaturedContentDto>> GetAllFeaturedContentAsync();

        /// <summary>
        /// קבלת תוכן מרכזי לפי מזהה
        /// </summary>
        Task<FeaturedContentDto?> GetFeaturedContentByIdAsync(int id);

        /// <summary>
        /// יצירת תוכן מרכזי חדש
        /// </summary>
        Task<FeaturedContentDto> CreateFeaturedContentAsync(CreateFeaturedContentDto dto);

        /// <summary>
        /// עדכון תוכן מרכזי
        /// </summary>
        Task<FeaturedContentDto?> UpdateFeaturedContentAsync(int id, UpdateFeaturedContentDto dto);

        /// <summary>
        /// עדכון מהיר של כל 4 הכתבות בבת אחת
        /// </summary>
        Task<IEnumerable<FeaturedContentDto>> UpdateFeaturedContentBulkAsync(UpdateFeaturedContentBulkDto dto);

        /// <summary>
        /// מחיקת תוכן מרכזי
        /// </summary>
        Task<bool> DeleteFeaturedContentAsync(int id);

        /// <summary>
        /// בדיקה האם כתבה כבר נמצאת בתוכן מרכזי
        /// </summary>
        Task<bool> IsArticleAlreadyFeaturedAsync(int articleId, int? excludeId = null);
    }
}
