using AkordishKeit.Models.DTOs;
using AkordishKeit.Services;
using AkordishKeit.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace AkordishKeit.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PodcastsController : ControllerBase
    {
        private readonly IPodcastService _podcastService;
        private readonly ILogger<PodcastsController> _logger;
        private readonly IMemoryCache _cache;

        public PodcastsController(
            IPodcastService podcastService,
            ILogger<PodcastsController> logger,
            IMemoryCache cache)
        {
            _podcastService = podcastService;
            _logger = logger;
            _cache = cache;
        }

        [HttpGet]
        public async Task<ActionResult<PagedResult<PodcastDto>>> GetPodcasts(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? search = null,
            [FromQuery] bool? isActive = null,
            [FromQuery] DateTime? dateFrom = null,
            [FromQuery] DateTime? dateTo = null,
            [FromQuery] string? sortBy = null)
        {
            return Ok(await _podcastService.GetPodcastsAsync(pageNumber, pageSize, search, isActive, dateFrom, dateTo, sortBy));
        }

        [HttpGet("public")]
        public async Task<ActionResult<IEnumerable<PodcastDto>>> GetPublicPodcasts()
        {
            var podcasts = await _podcastService.GetPublicPodcastsAsync();
            return HttpCacheRevalidation.Revalidate(this, podcasts);
        }

        [HttpGet("home-cards")]
        public async Task<ActionResult<List<PodcastHomeCardDto>>> GetHomePodcastCards([FromQuery] int limit = 10)
        {
            var cacheKey = $"home_podcast_cards_v2_{Math.Clamp(limit, 1, 12)}";
            var cards = await _cache.GetOrCreateAsync(cacheKey, async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                return await _podcastService.GetHomePodcastCardsAsync(limit);
            });

            return HttpCacheRevalidation.Revalidate(this, cards!);
        }

        [HttpGet("home-popular-episode-banners")]
        public async Task<ActionResult<List<PodcastEpisodeBannerDto>>> GetHomePopularEpisodeBanners()
        {
            var banners = await _cache.GetOrCreateAsync("home_popular_episode_banners_v2", async entry =>
            {
                entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
                return await _podcastService.GetHomePopularEpisodeBannersAsync();
            });

            return HttpCacheRevalidation.Revalidate(this, banners!);
        }

        [HttpGet("latest-episodes")]
        public async Task<ActionResult<IEnumerable<PodcastEpisodeDto>>> GetLatestEpisodes([FromQuery] int limit = 8)
        {
            var episodes = await _podcastService.GetLatestEpisodesAsync(limit);
            return HttpCacheRevalidation.Revalidate(this, episodes);
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
            int? userId = null;
            if (User.Identity?.IsAuthenticated == true)
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier);
                if (userIdClaim != null && int.TryParse(userIdClaim.Value, out var parsedUserId))
                {
                    userId = parsedUserId;
                }
            }

            var episode = await _podcastService.GetEpisodeBySlugAsync(
                podcastSlug,
                episodeSlug,
                userId: userId,
                ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
                userAgent: AkordishKeit.Utilities.AnalyticsIdentity.GetVisitorKey(Request),
                referrer: Request.Headers["Referer"].ToString());
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
            InvalidatePublicPodcastCaches();
            _logger.LogInformation("Podcast created: PodcastId={PodcastId} Name={Name}", podcast.Id, podcast.Name);
            return CreatedAtAction(nameof(GetPodcast), new { id = podcast.Id }, podcast);
        }

        [HttpPost("submit")]
        [Authorize]
        public async Task<ActionResult<PodcastDto>> SubmitPodcast([FromBody] SubmitPodcastDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.SourceUrl))
            {
                return BadRequest(new { message = "נדרש שם פודקאסט וקישור" });
            }

            try
            {
                var podcast = await _podcastService.CreatePodcastAsync(new CreatePodcastDto
                {
                    Name = dto.Name.Trim(),
                    IsActive = false,
                    DisplayOrder = 0
                });

                await _podcastService.CreateEpisodeAsync(new CreatePodcastEpisodeDto
                {
                    PodcastId = podcast.Id,
                    Title = dto.Name.Trim(),
                    SourceUrl = dto.SourceUrl.Trim(),
                    IsActive = false,
                    DisplayOrder = 0
                });

                return Ok(podcast);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<PodcastDto>> UpdatePodcast(int id, [FromBody] UpdatePodcastDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            var podcast = await _podcastService.UpdatePodcastAsync(id, dto);
            if (podcast != null)
            {
                InvalidatePublicPodcastCaches();
                _logger.LogInformation("Podcast updated: PodcastId={PodcastId}", id);
            }
            return podcast == null ? NotFound(new { message = "הפודקאסט לא נמצא" }) : Ok(podcast);
        }

        [HttpDelete("{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeletePodcast(int id)
        {
            var deleted = await _podcastService.DeletePodcastAsync(id);
            if (deleted)
            {
                InvalidatePublicPodcastCaches();
                _logger.LogInformation("Podcast deleted: PodcastId={PodcastId}", id);
            }
            return deleted
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
            [FromQuery] bool? isActive = null,
            [FromQuery] DateTime? dateFrom = null,
            [FromQuery] DateTime? dateTo = null,
            [FromQuery] string? sortBy = null)
        {
            return Ok(await _podcastService.GetEpisodesAsync(pageNumber, pageSize, podcastId, search, isActive, dateFrom, dateTo, sortBy));
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
                InvalidatePublicPodcastCaches();
                _logger.LogInformation("Podcast episode created: EpisodeId={EpisodeId} PodcastId={PodcastId} Title={Title}",
                    episode.Id, dto.PodcastId, episode.Title);
                return CreatedAtAction(nameof(GetEpisode), new { id = episode.Id }, episode);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning("Create episode failed: PodcastId={PodcastId} Error={Error}", dto.PodcastId, ex.Message);
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("episodes/submit")]
        [Authorize]
        public async Task<ActionResult<PodcastEpisodeDto>> SubmitEpisode([FromBody] SubmitPodcastEpisodeDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);
            if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.SourceUrl))
            {
                return BadRequest(new { message = "נדרש שם פרק וקישור" });
            }

            try
            {
                var episode = await _podcastService.CreateEpisodeAsync(new CreatePodcastEpisodeDto
                {
                    PodcastId = dto.PodcastId,
                    Title = dto.Title.Trim(),
                    SourceUrl = dto.SourceUrl.Trim(),
                    IsActive = false,
                    DisplayOrder = 0
                });

                return Ok(episode);
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
                if (episode != null)
                {
                    InvalidatePublicPodcastCaches();
                    _logger.LogInformation("Podcast episode updated: EpisodeId={EpisodeId}", id);
                }
                return episode == null ? NotFound(new { message = "הפרק לא נמצא" }) : Ok(episode);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning("Update episode failed: EpisodeId={EpisodeId} Error={Error}", id, ex.Message);
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("episodes/{id:int}")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> DeleteEpisode(int id)
        {
            var deleted = await _podcastService.DeleteEpisodeAsync(id);
            if (deleted)
            {
                InvalidatePublicPodcastCaches();
                _logger.LogInformation("Podcast episode deleted: EpisodeId={EpisodeId}", id);
            }
            return deleted
                ? NoContent()
                : NotFound(new { message = "הפרק לא נמצא" });
        }

        private void InvalidatePublicPodcastCaches()
        {
            _cache.Remove("home_podcast_cards_v1");
            _cache.Remove("home_popular_episode_banners_v1");
            _cache.Remove("home_popular_episode_banners_v2");
            for (var limit = 1; limit <= 12; limit++)
            {
                _cache.Remove($"home_podcast_cards_v2_{limit}");
            }
        }
    }
}
