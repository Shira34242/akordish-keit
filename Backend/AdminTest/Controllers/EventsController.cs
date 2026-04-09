using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AkordishKeit.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EventsController : ControllerBase
    {
        private readonly IEventService _eventService;

        public EventsController(IEventService eventService)
        {
            _eventService = eventService;
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
            [FromQuery] DateTime? toDate = null)
        {
            var result = await _eventService.GetEventsAsync(
                pageNumber, pageSize, search, isActive, fromDate, toDate);

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

            var eventDto = await _eventService.CreateEventAsync(dto);
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

            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int userId))
                return Unauthorized();

            dto.IsActive = false;
            dto.DisplayOrder = 0;

            var eventDto = await _eventService.CreateEventAsync(dto, userId);
            return CreatedAtAction(nameof(GetEvent), new { id = eventDto.Id }, eventDto);
        }

        /// <summary>
        /// קבלת ההופעות שהמשתמש המחובר הגיש
        /// </summary>
        [HttpGet("my")]
        [Authorize]
        public async Task<ActionResult<List<EventDto>>> GetMyEvents()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out int userId))
                return Unauthorized();

            var events = await _eventService.GetMyEventsAsync(userId);
            return Ok(events);
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

            return NoContent();
        }
    }
}
