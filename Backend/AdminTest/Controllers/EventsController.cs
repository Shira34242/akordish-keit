using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AkordishKeit.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EventsController : ControllerBase
    {
        private readonly AkordishKeitDbContext _context;
        private readonly IEventService _eventService;
        private readonly IUserTagService _userTagService;
        private readonly ILogger<EventsController> _logger;

        public EventsController(AkordishKeitDbContext context, IEventService eventService, IUserTagService userTagService, ILogger<EventsController> logger)
        {
            _context = context;
            _eventService = eventService;
            _userTagService = userTagService;
            _logger = logger;
        }

        /// <summary>
        /// קבלת רשימת הופעות עם סינון וחלוקה לעמודים
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<PagedResult<EventDto>>> GetEvents(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string? search = null,
            [FromQuery] bool? isActive = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] int? artistId = null,
            [FromQuery] string? uploaderSearch = null,
            [FromQuery] DateTime? createdFrom = null,
            [FromQuery] DateTime? createdTo = null,
            [FromQuery] string? sortBy = null)
        {
            var result = await _eventService.GetEventsAsync(
                pageNumber, pageSize, search, isActive, fromDate, toDate,
                artistId, uploaderSearch, createdFrom, createdTo, sortBy);

            return Ok(result);
        }

        /// <summary>
        /// קבלת הופעה לפי מזהה
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<EventDto>> GetEvent(int id)
        {
            var eventDto = await _eventService.GetEventByIdAsync(id);

            if (eventDto == null)
                return NotFound(new { message = "ההופעה לא נמצאה" });

            return Ok(eventDto);
        }

        /// <summary>
        /// קבלת הופעות קרובות (לדף הראשי)
        /// </summary>
        [HttpGet("upcoming")]
        public async Task<ActionResult<IEnumerable<UpcomingEventDto>>> GetUpcomingEvents(
            [FromQuery] int limit = 6)
        {
            var events = await _eventService.GetUpcomingEventsAsync(limit);
            return Ok(events);
        }

        /// <summary>
        /// יצירת הופעה חדשה (רק מנהל)
        /// </summary>
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<EventDto>> CreateEvent([FromBody] CreateEventDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var eventDto = await _eventService.CreateEventAsync(dto, GetCurrentUserId());
            _logger.LogInformation("Event created (admin): EventId={EventId} Name={Name}", eventDto.Id, eventDto.Name);
            return CreatedAtAction(nameof(GetEvent), new { id = eventDto.Id }, eventDto);
        }

        /// <summary>
        /// הגשת הופעה על-ידי משתמש רשום (ממתינה לאישור מנהל)
        /// </summary>
        [HttpPost("submit")]
        [Authorize]
        public async Task<ActionResult<EventDto>> SubmitEvent([FromBody] CreateEventDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            dto.IsActive = false;
            dto.DisplayOrder = 0;

            var eventDto = await _eventService.CreateEventAsync(dto, userId.Value);

            await _userTagService.RecalculateTagAsync(userId.Value);

            _logger.LogInformation("Event submitted by user (pending): EventId={EventId} UserId={UserId} Name={Name}",
                eventDto.Id, userId.Value, eventDto.Name);
            return CreatedAtAction(nameof(GetEvent), new { id = eventDto.Id }, eventDto);
        }

        /// <summary>
        /// קבלת ההופעות שהמשתמש המחובר הגיש
        /// </summary>
        [HttpGet("my")]
        [Authorize]
        public async Task<ActionResult<PagedResult<EventDto>>> GetMyEvents([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 8)
        {
            var userId = GetCurrentUserId();
            if (!userId.HasValue)
                return Unauthorized();

            var result = await _eventService.GetMyEventsAsync(userId.Value, pageNumber, pageSize);
            return Ok(result);
        }

        /// <summary>
        /// עדכון הופעה (רק מנהל)
        /// </summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<EventDto>> UpdateEvent(int id, [FromBody] UpdateEventDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var eventDto = await _eventService.UpdateEventAsync(id, dto);

            if (eventDto == null)
                return NotFound(new { message = "ההופעה לא נמצאה" });

            if (dto.IsActive)
            {
                var submittedByUserId = await _context.Events
                    .Where(e => e.Id == id)
                    .Select(e => e.SubmittedByUserId)
                    .FirstOrDefaultAsync();
                if (submittedByUserId.HasValue)
                {
                    await _userTagService.RecalculateTagAsync(submittedByUserId.Value);
                    _logger.LogInformation("Event activated (published): EventId={EventId} SubmittedByUserId={UserId}",
                        id, submittedByUserId.Value);
                }
            }
            else
            {
                _logger.LogInformation("Event updated: EventId={EventId}", id);
            }

            return Ok(eventDto);
        }

        /// <summary>
        /// מחיקת הופעה (רק מנהל)
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeleteEvent(int id)
        {
            var result = await _eventService.DeleteEventAsync(id);

            if (!result)
                return NotFound(new { message = "ההופעה לא נמצאה" });

            _logger.LogInformation("Event deleted: EventId={EventId}", id);
            return NoContent();
        }

        private int? GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                           ?? User.FindFirst("sub")?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : null;
        }
    }
}
