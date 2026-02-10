using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services
{
    public interface IEventService
    {
        /// <summary>
        /// קבלת רשימת הופעות עם סינון וחלוקה לעמודים
        /// </summary>
        Task<PagedResult<EventDto>> GetEventsAsync(
            int pageNumber = 1,
            int pageSize = 10,
            string? search = null,
            bool? isActive = null,
            DateTime? fromDate = null,
            DateTime? toDate = null);

        /// <summary>
        /// קבלת הופעה לפי מזהה
        /// </summary>
        Task<EventDto?> GetEventByIdAsync(int id);

        /// <summary>
        /// קבלת הופעות קרובות (לדף הראשי)
        /// </summary>
        Task<IEnumerable<UpcomingEventDto>> GetUpcomingEventsAsync(int limit = 6);

        /// <summary>
        /// יצירת הופעה חדשה
        /// </summary>
        Task<EventDto> CreateEventAsync(CreateEventDto dto);

        /// <summary>
        /// עדכון הופעה
        /// </summary>
        Task<EventDto?> UpdateEventAsync(int id, UpdateEventDto dto);

        /// <summary>
        /// מחיקה רכה של הופעה
        /// </summary>
        Task<bool> DeleteEventAsync(int id);
    }
}
