using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AkordishKeit.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PodcastsController : ControllerBase
    {
        private readonly IPodcastService _podcastService;

        public PodcastsController(IPodcastService podcastService)
        {
            _podcastService = podcastService;
        }

        [HttpGet]
        public async Task<ActionResult<PagedResult<PodcastDto>>> GetPodcasts(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? search = null,
            [FromQuery] bool? isActive = null)
        {
            return Ok(await _podcastService.GetPodcastsAsync(pageNumber, pageSize, search, isActive));
        }

        [HttpGet("public")]
        public async Task<ActionResult<IEnumerable<PodcastDto>>> GetPublicPodcasts()
        {
            return Ok(await _podcastService.GetPublicPodcastsAsync());
        }

        [HttpGet("latest-episodes")]
        public async Task<ActionResult<IEnumerable<PodcastEpisodeDto>>> GetLatestEpisodes([FromQuery] int limit = 8)
        {
            return Ok(await _podcastService.GetLatestEpisodesAsync(limit));
        }

        [HttpGet("popular-episodes")]
        public async Task<ActionResult<IEnumerable<PodcastEpisodeDto>>> GetPopularEpisodes(
            [FromQuery] int limit = 8,
            [FromQuery] int? podcastId = null)
        {
            return Ok(await _podcastService.GetPopularEpisodesAsync(limit, podcastId));
        }

        [HttpGet("public/episodes")]
        public async Task<ActionResult<PagedResult<PodcastEpisodeDto>>> GetPublicEpisodes(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 12,
            [FromQuery] int? podcastId = null,
            [FromQuery] string? search = null)
        {
            return Ok(await _podcastService.GetPublicEpisodesAsync(pageNumber, pageSize, podcastId, search));
        }

        [HttpGet("by-slug/{slug}")]
        public async Task<ActionResult<PodcastDetailDto>> GetPodcastBySlug(string slug)
        {
            var podcast = await _podcastService.GetPodcastBySlugAsync(slug);
            return podcast == null ? NotFound(new { message = "הפודקאסט לא נמצא" }) : Ok(podcast);
        }

        [HttpGet("episode/{podcastSlug}/{episodeSlug}")]
        public async Task<ActionResult<PodcastEpisodeDetailDto>> GetEpisodeBySlug(string podcastSlug, string episodeSlug)
        {
            var episode = await _podcastService.GetEpisodeBySlugAsync(podcastSlug, episodeSlug);
            return episode == null ? NotFound(new { message = "הפרק לא נמצא" }) : Ok(episode);
        }

        [HttpGet("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<PodcastDto>> GetPodcast(int id)
        {
            var podcast = await _podcastService.GetPodcastByIdAsync(id);
            return podcast == null ? NotFound(new { message = "הפודקאסט לא נמצא" }) : Ok(podcast);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<PodcastDto>> CreatePodcast([FromBody] CreatePodcastDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var podcast = await _podcastService.CreatePodcastAsync(dto);
            return CreatedAtAction(nameof(GetPodcast), new { id = podcast.Id }, podcast);
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<PodcastDto>> UpdatePodcast(int id, [FromBody] UpdatePodcastDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var podcast = await _podcastService.UpdatePodcastAsync(id, dto);
            return podcast == null ? NotFound(new { message = "הפודקאסט לא נמצא" }) : Ok(podcast);
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeletePodcast(int id)
        {
            return await _podcastService.DeletePodcastAsync(id)
                ? NoContent()
                : NotFound(new { message = "הפודקאסט לא נמצא" });
        }

        [HttpGet("episodes")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<PagedResult<PodcastEpisodeDto>>> GetEpisodes(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] int? podcastId = null,
            [FromQuery] string? search = null,
            [FromQuery] bool? isActive = null)
        {
            return Ok(await _podcastService.GetEpisodesAsync(pageNumber, pageSize, podcastId, search, isActive));
        }

        [HttpGet("episodes/{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<PodcastEpisodeDto>> GetEpisode(int id)
        {
            var episode = await _podcastService.GetEpisodeByIdAsync(id);
            return episode == null ? NotFound(new { message = "הפרק לא נמצא" }) : Ok(episode);
        }

        [HttpPost("episodes")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<PodcastEpisodeDto>> CreateEpisode([FromBody] CreatePodcastEpisodeDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var episode = await _podcastService.CreateEpisodeAsync(dto);
                return CreatedAtAction(nameof(GetEpisode), new { id = episode.Id }, episode);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("episodes/{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<PodcastEpisodeDto>> UpdateEpisode(int id, [FromBody] UpdatePodcastEpisodeDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            try
            {
                var episode = await _podcastService.UpdateEpisodeAsync(id, dto);
                return episode == null ? NotFound(new { message = "הפרק לא נמצא" }) : Ok(episode);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("episodes/{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeleteEpisode(int id)
        {
            return await _podcastService.DeleteEpisodeAsync(id)
                ? NoContent()
                : NotFound(new { message = "הפרק לא נמצא" });
        }
    }
}
