using AkordishKeit.Data;
using AkordishKeit.Extensions;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services
{
    public class EventService : IEventService
    {
        private readonly AkordishKeitDbContext _context;

        public EventService(AkordishKeitDbContext context)
        {
            _context = context;
        }

        public async Task<PagedResult<EventDto>> GetEventsAsync(
            int pageNumber = 1,
            int pageSize = 10,
            string? search = null,
            bool? isActive = null,
            DateTime? fromDate = null,
            DateTime? toDate = null)
        {
            var query = _context.Events.AsQueryable();

            // Apply filters
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(e =>
                    e.Name.Contains(search) ||
                    (e.ArtistName != null && e.ArtistName.Contains(search)) ||
                    (e.Location != null && e.Location.Contains(search)));
            }

            if (isActive.HasValue)
            {
                query = query.Where(e => e.IsActive == isActive.Value);
            }

            if (fromDate.HasValue)
            {
                query = query.Where(e => e.EventDate >= fromDate.Value);
            }

            if (toDate.HasValue)
            {
                query = query.Where(e => e.EventDate <= toDate.Value);
            }

            // Order by event date
            query = query.OrderBy(e => e.EventDate).ThenBy(e => e.DisplayOrder);

            // Apply pagination
            var pagedResult = await query.ToPagedResultAsync(pageNumber, pageSize);

            // Map to DTOs
            var dtos = pagedResult.Items.Select(MapToDto).ToList();

            return new PagedResult<EventDto>
            {
                Items = dtos,
                TotalCount = pagedResult.TotalCount,
                PageNumber = pagedResult.PageNumber,
                PageSize = pagedResult.PageSize
            };
        }

        public async Task<EventDto?> GetEventByIdAsync(int id)
        {
            var eventEntity = await _context.Events
                .Include(e => e.EventArtists)
                    .ThenInclude(ea => ea.Artist)
                .FirstOrDefaultAsync(e => e.Id == id);

            return eventEntity == null ? null : MapToDto(eventEntity);
        }

        public async Task<IEnumerable<UpcomingEventDto>> GetUpcomingEventsAsync(int limit = 6)
        {
            var today = DateTime.UtcNow.Date;
            var oneMonthAgo = today.AddMonths(-1);

            var events = await _context.Events
                .Include(e => e.EventArtists)
                    .ThenInclude(ea => ea.Artist)
                .Where(e => e.IsActive && e.EventDate >= oneMonthAgo)
                .OrderBy(e => e.EventDate)
                .ThenBy(e => e.DisplayOrder)
                .Take(limit)
                .ToListAsync();

            return events.Select(e => new UpcomingEventDto
            {
                Id = e.Id,
                Name = e.Name,
                ImageUrl = e.ImageUrl,
                TicketUrl = e.TicketUrl,
                EventDate = e.EventDate,
                Location = e.Location,
                ArtistName = e.ArtistName,
                TaggedArtistNames = e.EventArtists.Select(ea => ea.Artist.Name).ToList(),
                DaysUntilEvent = CalculateDaysUntilEvent(e.EventDate),
                EventStatus = GetEventStatus(e.EventDate)
            });
        }

        public async Task<EventDto> CreateEventAsync(CreateEventDto dto)
        {
            var eventEntity = new Event
            {
                Name = dto.Name,
                Description = dto.Description,
                ImageUrl = dto.ImageUrl,
                TicketUrl = dto.TicketUrl,
                EventDate = dto.EventDate,
                Location = dto.Location,
                ArtistName = dto.ArtistName,
                Price = dto.Price,
                DisplayOrder = dto.DisplayOrder,
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow
            };

            _context.Events.Add(eventEntity);
            await _context.SaveChangesAsync();

            // תיוג אומנים (אם יש)
            if (dto.ArtistIds != null && dto.ArtistIds.Any())
            {
                foreach (var artistId in dto.ArtistIds)
                {
                    var eventArtist = new EventArtist
                    {
                        EventId = eventEntity.Id,
                        ArtistId = artistId,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.EventArtists.Add(eventArtist);
                }
                await _context.SaveChangesAsync();

                // טעינה מחדש עם האומנים
                await _context.Entry(eventEntity)
                    .Collection(e => e.EventArtists)
                    .Query()
                    .Include(ea => ea.Artist)
                    .LoadAsync();
            }

            return MapToDto(eventEntity);
        }

        public async Task<EventDto?> UpdateEventAsync(int id, UpdateEventDto dto)
        {
            var eventEntity = await _context.Events
                .Include(e => e.EventArtists)
                .FirstOrDefaultAsync(e => e.Id == id);

            if (eventEntity == null)
                return null;

            eventEntity.Name = dto.Name;
            eventEntity.Description = dto.Description;
            eventEntity.ImageUrl = dto.ImageUrl;
            eventEntity.TicketUrl = dto.TicketUrl;
            eventEntity.EventDate = dto.EventDate;
            eventEntity.Location = dto.Location;
            eventEntity.ArtistName = dto.ArtistName;
            eventEntity.Price = dto.Price;
            eventEntity.DisplayOrder = dto.DisplayOrder;
            eventEntity.IsActive = dto.IsActive;
            eventEntity.UpdatedAt = DateTime.UtcNow;

            // עדכון תיוג אומנים (אם מסופק)
            if (dto.ArtistIds != null)
            {
                // מחיקת תיוגים קיימים
                var existingArtists = await _context.EventArtists
                    .Where(ea => ea.EventId == id)
                    .ToListAsync();
                _context.EventArtists.RemoveRange(existingArtists);

                // הוספת תיוגים חדשים
                foreach (var artistId in dto.ArtistIds)
                {
                    var eventArtist = new EventArtist
                    {
                        EventId = id,
                        ArtistId = artistId,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.EventArtists.Add(eventArtist);
                }
            }

            await _context.SaveChangesAsync();

            // טעינה מחדש עם האומנים
            await _context.Entry(eventEntity)
                .Collection(e => e.EventArtists)
                .Query()
                .Include(ea => ea.Artist)
                .LoadAsync();

            return MapToDto(eventEntity);
        }

        public async Task<bool> DeleteEventAsync(int id)
        {
            var eventEntity = await _context.Events.FindAsync(id);
            if (eventEntity == null)
                return false;

            // Soft delete
            eventEntity.IsDeleted = true;
            eventEntity.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return true;
        }

        // Helper methods
        private EventDto MapToDto(Event eventEntity)
        {
            var daysUntil = CalculateDaysUntilEvent(eventEntity.EventDate);
            var status = GetEventStatus(eventEntity.EventDate);

            return new EventDto
            {
                Id = eventEntity.Id,
                Name = eventEntity.Name,
                Description = eventEntity.Description,
                ImageUrl = eventEntity.ImageUrl,
                TicketUrl = eventEntity.TicketUrl,
                EventDate = eventEntity.EventDate,
                Location = eventEntity.Location,
                ArtistName = eventEntity.ArtistName,
                TaggedArtists = eventEntity.EventArtists?.Select(ea => new EventArtistDto
                {
                    ArtistId = ea.ArtistId,
                    ArtistName = ea.Artist.Name,
                    ArtistImageUrl = ea.Artist.ImageUrl
                }).ToList() ?? new List<EventArtistDto>(),
                Price = eventEntity.Price,
                DisplayOrder = eventEntity.DisplayOrder,
                IsActive = eventEntity.IsActive,
                CreatedAt = eventEntity.CreatedAt,
                UpdatedAt = eventEntity.UpdatedAt,
                CreatedBy = eventEntity.CreatedBy,
                UpdatedBy = eventEntity.UpdatedBy,
                DaysUntilEvent = daysUntil,
                IsToday = daysUntil == 0 && !IsPastEvent(eventEntity.EventDate),
                IsPast = IsPastEvent(eventEntity.EventDate),
                EventStatus = status
            };
        }

        private int CalculateDaysUntilEvent(DateTime eventDate)
        {
            var today = DateTime.UtcNow.Date;
            var eventDay = eventDate.Date;
            return (eventDay - today).Days;
        }

        private bool IsPastEvent(DateTime eventDate)
        {
            return eventDate.Date < DateTime.UtcNow.Date;
        }

        private string GetEventStatus(DateTime eventDate)
        {
            var daysUntil = CalculateDaysUntilEvent(eventDate);

            if (IsPastEvent(eventDate))
                return "אירוע שחלף";

            if (daysUntil == 0)
                return "היום";

            return $"עוד {daysUntil} ימים";
        }
    }
}
