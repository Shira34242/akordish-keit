using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FeaturedContentController : ControllerBase
    {
        private readonly IFeaturedContentService _featuredContentService;

        public FeaturedContentController(IFeaturedContentService featuredContentService)
        {
            _featuredContentService = featuredContentService;
        }

        /// <summary>
        /// קבלת כל התוכן המרכזי הפעיל (4 כתבות לדף הראשי)
        /// </summary>
        [HttpGet("active")]
        public async Task<ActionResult<IEnumerable<FeaturedContentDto>>> GetActiveFeaturedContent()
        {
            var featuredContent = await _featuredContentService.GetActiveFeaturedContentAsync();
            return Ok(featuredContent);
        }

        /// <summary>
        /// קבלת כל התוכן המרכזי (כולל לא פעיל - לאדמין)
        /// </summary>
        [HttpGet]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<FeaturedContentDto>>> GetAllFeaturedContent()
        {
            var featuredContent = await _featuredContentService.GetAllFeaturedContentAsync();
            return Ok(featuredContent);
        }

        /// <summary>
        /// קבלת תוכן מרכזי לפי מזהה
        /// </summary>
        [HttpGet("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<FeaturedContentDto>> GetFeaturedContent(int id)
        {
            var featuredContent = await _featuredContentService.GetFeaturedContentByIdAsync(id);

            if (featuredContent == null)
                return NotFound(new { message = "התוכן המרכזי לא נמצא" });

            return Ok(featuredContent);
        }

        /// <summary>
        /// יצירת תוכן מרכזי חדש (רק מנהל)
        /// </summary>
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<FeaturedContentDto>> CreateFeaturedContent([FromBody] CreateFeaturedContentDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var featuredContent = await _featuredContentService.CreateFeaturedContentAsync(dto);
                return CreatedAtAction(nameof(GetFeaturedContent), new { id = featuredContent.Id }, featuredContent);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// עדכון תוכן מרכזי (רק מנהל)
        /// </summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<FeaturedContentDto>> UpdateFeaturedContent(int id, [FromBody] UpdateFeaturedContentDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var featuredContent = await _featuredContentService.UpdateFeaturedContentAsync(id, dto);

                if (featuredContent == null)
                    return NotFound(new { message = "התוכן המרכזי לא נמצא" });

                return Ok(featuredContent);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// עדכון מהיר של כל 4 הכתבות בבת אחת (רק מנהל)
        /// </summary>
        [HttpPut("bulk")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<IEnumerable<FeaturedContentDto>>> UpdateFeaturedContentBulk([FromBody] UpdateFeaturedContentBulkDto dto)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var featuredContent = await _featuredContentService.UpdateFeaturedContentBulkAsync(dto);
                return Ok(featuredContent);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>
        /// מחיקת תוכן מרכזי (רק מנהל)
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeleteFeaturedContent(int id)
        {
            var result = await _featuredContentService.DeleteFeaturedContentAsync(id);

            if (!result)
                return NotFound(new { message = "התוכן המרכזי לא נמצא" });

            return NoContent();
        }
    }
}
