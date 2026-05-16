using System.Text;
using System.Text.RegularExpressions;
using AkordishKeit.Data;
using AkordishKeit.Extensions;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services
{
    public class PodcastService : IPodcastService
    {
        private readonly AkordishKeitDbContext _context;

        public PodcastService(AkordishKeitDbContext context)
        {
            _context = context;
        }

        public async Task<PagedResult<PodcastDto>> GetPodcastsAsync(int pageNumber, int pageSize, string? search, bool? isActive)
        {
            var query = _context.Podcasts
                .Include(p => p.Episodes.Where(e => !e.IsDeleted))
                .Where(p => !p.IsDeleted)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(p => p.Name.Contains(search) || (p.Description != null && p.Description.Contains(search)));
            }

            if (isActive.HasValue)
            {
                query = query.Where(p => p.IsActive == isActive.Value);
            }

            query = query.OrderBy(p => p.DisplayOrder).ThenBy(p => p.Name);
            var result = await query.ToPagedResultAsync(pageNumber, pageSize);

            return new PagedResult<PodcastDto>
            {
                Items = result.Items.Select(MapPodcast).ToList(),
                TotalCount = result.TotalCount,
                PageNumber = result.PageNumber,
                PageSize = result.PageSize
            };
        }

        public async Task<IEnumerable<PodcastDto>> GetPublicPodcastsAsync()
        {
            return await _context.Podcasts
                .Where(p => !p.IsDeleted && p.IsActive)
                .OrderBy(p => p.DisplayOrder)
                .ThenBy(p => p.Name)
                .Select(p => new PodcastDto
                {
                    Id = p.Id,
                    Name = p.Name,
                    Slug = p.Slug,
                    Description = p.Description,
                    ImageUrl = p.ImageUrl,
                    DisplayOrder = p.DisplayOrder,
                    IsActive = p.IsActive,
                    CreatedAt = p.CreatedAt,
                    UpdatedAt = p.UpdatedAt,
                    EpisodeCount = p.Episodes.Count(e => !e.IsDeleted && e.IsActive),
                    LatestEpisode = p.Episodes
                        .Where(e => !e.IsDeleted && e.IsActive)
                        .OrderByDescending(e => e.PublishedAt)
                        .Select(e => new PodcastEpisodeDto
                        {
                            Id = e.Id,
                            PodcastId = p.Id,
                            PodcastName = p.Name,
                            PodcastSlug = p.Slug,
                            Title = e.Title,
                            Slug = e.Slug,
                            Description = e.Description,
                            EpisodeNumber = e.EpisodeNumber,
                            SourceUrl = e.SourceUrl,
                            EmbedUrl = e.EmbedUrl,
                            ThumbnailUrl = e.ThumbnailUrl,
                            Platform = e.Platform,
                            ViewCount = e.ViewCount,
                            PublishedAt = e.PublishedAt,
                            DisplayOrder = e.DisplayOrder,
                            IsActive = e.IsActive,
                            CreatedAt = e.CreatedAt,
                            UpdatedAt = e.UpdatedAt
                        })
                        .FirstOrDefault()
                })
                .ToListAsync();
        }

        public async Task<PodcastDetailDto?> GetPodcastBySlugAsync(string slug, bool includeInactive = false)
        {
            var podcast = await _context.Podcasts
                .Include(p => p.Episodes.Where(e => !e.IsDeleted))
                .FirstOrDefaultAsync(p => p.Slug == slug && !p.IsDeleted && (includeInactive || p.IsActive));

            if (podcast == null) return null;

            var episodes = podcast.Episodes
                .Where(e => !e.IsDeleted && (includeInactive || e.IsActive))
                .OrderBy(e => e.EpisodeNumber == 0 ? int.MaxValue : e.EpisodeNumber)
                .ThenBy(e => e.DisplayOrder)
                .ThenBy(e => e.PublishedAt)
                .Select(e => MapEpisode(e, podcast))
                .ToList();

            return new PodcastDetailDto
            {
                Id = podcast.Id,
                Name = podcast.Name,
                Slug = podcast.Slug,
                Description = podcast.Description,
                ImageUrl = podcast.ImageUrl,
                DisplayOrder = podcast.DisplayOrder,
                IsActive = podcast.IsActive,
                CreatedAt = podcast.CreatedAt,
                UpdatedAt = podcast.UpdatedAt,
                EpisodeCount = episodes.Count,
                LatestEpisode = episodes.OrderByDescending(e => e.PublishedAt).FirstOrDefault(),
                AgencyBanner = await GetAgencyBannerForPodcastAsync(podcast.Id),
                Episodes = episodes
            };
        }

        public async Task<PodcastDto?> GetPodcastByIdAsync(int id)
        {
            var podcast = await _context.Podcasts
                .Include(p => p.Episodes.Where(e => !e.IsDeleted))
                .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

            if (podcast == null) return null;

            var dto = MapPodcast(podcast);
            dto.AgencyBanner = await GetAgencyBannerForPodcastAsync(podcast.Id);
            return dto;
        }

        public async Task<PodcastDto> CreatePodcastAsync(CreatePodcastDto dto)
        {
            var podcast = new Podcast
            {
                Name = dto.Name.Trim(),
                Slug = await EnsureUniquePodcastSlugAsync(dto.Slug, dto.Name),
                Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
                ImageUrl = string.IsNullOrWhiteSpace(dto.ImageUrl) ? null : dto.ImageUrl.Trim(),
                DisplayOrder = dto.DisplayOrder,
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow
            };

            _context.Podcasts.Add(podcast);
            await _context.SaveChangesAsync();

            return MapPodcast(podcast);
        }

        public async Task<PodcastDto?> UpdatePodcastAsync(int id, UpdatePodcastDto dto)
        {
            var podcast = await _context.Podcasts
                .Include(p => p.Episodes.Where(e => !e.IsDeleted))
                .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

            if (podcast == null) return null;

            podcast.Name = dto.Name.Trim();
            podcast.Slug = await EnsureUniquePodcastSlugAsync(dto.Slug, dto.Name, id);
            podcast.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
            podcast.ImageUrl = string.IsNullOrWhiteSpace(dto.ImageUrl) ? null : dto.ImageUrl.Trim();
            podcast.DisplayOrder = dto.DisplayOrder;
            podcast.IsActive = dto.IsActive;
            podcast.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return MapPodcast(podcast);
        }

        public async Task<bool> DeletePodcastAsync(int id)
        {
            var podcast = await _context.Podcasts
                .Include(p => p.Episodes)
                .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

            if (podcast == null) return false;

            podcast.IsDeleted = true;
            podcast.UpdatedAt = DateTime.UtcNow;
            foreach (var episode in podcast.Episodes)
            {
                episode.IsDeleted = true;
                episode.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<PagedResult<PodcastEpisodeDto>> GetEpisodesAsync(int pageNumber, int pageSize, int? podcastId, string? search, bool? isActive)
        {
            var query = _context.PodcastEpisodes
                .Include(e => e.Podcast)
                .Where(e => !e.IsDeleted && !e.Podcast.IsDeleted)
                .AsQueryable();

            if (podcastId.HasValue) query = query.Where(e => e.PodcastId == podcastId.Value);
            if (isActive.HasValue) query = query.Where(e => e.IsActive == isActive.Value);
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(e => e.Title.Contains(search) || e.Podcast.Name.Contains(search));
            }

            query = query.OrderByDescending(e => e.PublishedAt).ThenBy(e => e.DisplayOrder);
            var result = await query.ToPagedResultAsync(pageNumber, pageSize);

            return new PagedResult<PodcastEpisodeDto>
            {
                Items = result.Items.Select(e => MapEpisode(e, e.Podcast)).ToList(),
                TotalCount = result.TotalCount,
                PageNumber = result.PageNumber,
                PageSize = result.PageSize
            };
        }

        public async Task<PagedResult<PodcastEpisodeDto>> GetPublicEpisodesAsync(int pageNumber, int pageSize, int? podcastId, string? search)
        {
            pageSize = Math.Clamp(pageSize, 1, 48);

            var query = _context.PodcastEpisodes
                .Include(e => e.Podcast)
                .Where(e => !e.IsDeleted && e.IsActive && !e.Podcast.IsDeleted && e.Podcast.IsActive)
                .AsQueryable();

            if (podcastId.HasValue) query = query.Where(e => e.PodcastId == podcastId.Value);
            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(e =>
                    e.Title.Contains(search) ||
                    (e.Description != null && e.Description.Contains(search)) ||
                    e.Podcast.Name.Contains(search));
            }

            query = query.OrderByDescending(e => e.PublishedAt).ThenByDescending(e => e.Id);
            var result = await query.ToPagedResultAsync(pageNumber, pageSize);

            return new PagedResult<PodcastEpisodeDto>
            {
                Items = result.Items.Select(e => MapEpisode(e, e.Podcast)).ToList(),
                TotalCount = result.TotalCount,
                PageNumber = result.PageNumber,
                PageSize = result.PageSize
            };
        }

        public async Task<IEnumerable<PodcastEpisodeDto>> GetLatestEpisodesAsync(int limit)
        {
            var episodes = await _context.PodcastEpisodes
                .Include(e => e.Podcast)
                .Where(e => !e.IsDeleted && e.IsActive && !e.Podcast.IsDeleted && e.Podcast.IsActive)
                .OrderByDescending(e => e.PublishedAt)
                .ThenByDescending(e => e.Id)
                .Take(limit)
                .ToListAsync();

            return episodes.Select(e => MapEpisode(e, e.Podcast));
        }

        public async Task<IEnumerable<PodcastEpisodeDto>> GetPopularEpisodesAsync(int limit, int? podcastId = null)
        {
            limit = Math.Clamp(limit, 1, 24);

            var query = _context.PodcastEpisodes
                .Include(e => e.Podcast)
                .Where(e => !e.IsDeleted && e.IsActive && !e.Podcast.IsDeleted && e.Podcast.IsActive)
                .AsQueryable();

            if (podcastId.HasValue) query = query.Where(e => e.PodcastId == podcastId.Value);

            var episodes = await query
                .OrderByDescending(e => e.ViewCount)
                .ThenByDescending(e => e.PublishedAt)
                .ThenByDescending(e => e.Id)
                .Take(limit)
                .ToListAsync();

            return episodes.Select(e => MapEpisode(e, e.Podcast));
        }

        public async Task<PodcastEpisodeDetailDto?> GetEpisodeBySlugAsync(string podcastSlug, string episodeSlug, bool includeInactive = false)
        {
            var podcast = await _context.Podcasts
                .Include(p => p.Episodes.Where(e => !e.IsDeleted))
                .FirstOrDefaultAsync(p => p.Slug == podcastSlug && !p.IsDeleted && (includeInactive || p.IsActive));

            if (podcast == null) return null;

            var orderedEpisodes = podcast.Episodes
                .Where(e => !e.IsDeleted && (includeInactive || e.IsActive))
                .OrderBy(e => e.EpisodeNumber == 0 ? int.MaxValue : e.EpisodeNumber)
                .ThenBy(e => e.DisplayOrder)
                .ThenBy(e => e.PublishedAt)
                .ToList();

            var episode = orderedEpisodes.FirstOrDefault(e => e.Slug == episodeSlug);
            if (episode == null) return null;

            if (!includeInactive)
            {
                episode.ViewCount += 1;
                episode.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            var index = orderedEpisodes.FindIndex(e => e.Id == episode.Id);
            var dto = new PodcastEpisodeDetailDto
            {
                Id = episode.Id,
                PodcastId = podcast.Id,
                PodcastName = podcast.Name,
                PodcastSlug = podcast.Slug,
                Title = episode.Title,
                Slug = episode.Slug,
                Description = episode.Description,
                EpisodeNumber = episode.EpisodeNumber,
                SourceUrl = episode.SourceUrl,
                EmbedUrl = episode.EmbedUrl,
                ThumbnailUrl = episode.ThumbnailUrl,
                Platform = episode.Platform,
                ViewCount = episode.ViewCount,
                PublishedAt = episode.PublishedAt,
                DisplayOrder = episode.DisplayOrder,
                IsActive = episode.IsActive,
                CreatedAt = episode.CreatedAt,
                UpdatedAt = episode.UpdatedAt,
                PreviousEpisode = index > 0 ? MapEpisode(orderedEpisodes[index - 1], podcast) : null,
                NextEpisode = index >= 0 && index < orderedEpisodes.Count - 1 ? MapEpisode(orderedEpisodes[index + 1], podcast) : null,
                SeriesEpisodes = orderedEpisodes.Select(e => MapEpisode(e, podcast)).ToList()
            };

            return dto;
        }

        public async Task<PodcastEpisodeDto?> GetEpisodeByIdAsync(int id)
        {
            var episode = await _context.PodcastEpisodes
                .Include(e => e.Podcast)
                .FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted && !e.Podcast.IsDeleted);

            return episode == null ? null : MapEpisode(episode, episode.Podcast);
        }

        public async Task<PodcastEpisodeDto> CreateEpisodeAsync(CreatePodcastEpisodeDto dto)
        {
            var podcast = await _context.Podcasts.FirstOrDefaultAsync(p => p.Id == dto.PodcastId && !p.IsDeleted);
            if (podcast == null)
            {
                throw new InvalidOperationException("הפודקאסט לא נמצא");
            }
            var sourceUrl = dto.SourceUrl.Trim();
            var episode = new PodcastEpisode
            {
                PodcastId = dto.PodcastId,
                Title = dto.Title.Trim(),
                Slug = await EnsureUniqueEpisodeSlugAsync(dto.PodcastId, dto.Slug, dto.Title),
                Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
                EpisodeNumber = dto.EpisodeNumber,
                SourceUrl = sourceUrl,
                EmbedUrl = string.IsNullOrWhiteSpace(dto.EmbedUrl) ? BuildEmbedUrl(sourceUrl) : dto.EmbedUrl.Trim(),
                ThumbnailUrl = string.IsNullOrWhiteSpace(dto.ThumbnailUrl) ? BuildThumbnailUrl(sourceUrl) : dto.ThumbnailUrl.Trim(),
                Platform = string.IsNullOrWhiteSpace(dto.Platform) ? DetectPlatform(sourceUrl) : dto.Platform.Trim(),
                PublishedAt = dto.PublishedAt ?? DateTime.UtcNow,
                DisplayOrder = dto.DisplayOrder,
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow
            };

            _context.PodcastEpisodes.Add(episode);
            await _context.SaveChangesAsync();

            return MapEpisode(episode, podcast);
        }

        public async Task<PodcastEpisodeDto?> UpdateEpisodeAsync(int id, UpdatePodcastEpisodeDto dto)
        {
            var episode = await _context.PodcastEpisodes
                .Include(e => e.Podcast)
                .FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted);

            if (episode == null) return null;

            var podcast = await _context.Podcasts.FirstOrDefaultAsync(p => p.Id == dto.PodcastId && !p.IsDeleted);
            if (podcast == null)
            {
                throw new InvalidOperationException("הפודקאסט לא נמצא");
            }

            var sourceUrl = dto.SourceUrl.Trim();
            episode.PodcastId = dto.PodcastId;
            episode.Title = dto.Title.Trim();
            episode.Slug = await EnsureUniqueEpisodeSlugAsync(dto.PodcastId, dto.Slug, dto.Title, id);
            episode.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
            episode.EpisodeNumber = dto.EpisodeNumber;
            episode.SourceUrl = sourceUrl;
            episode.EmbedUrl = string.IsNullOrWhiteSpace(dto.EmbedUrl) ? BuildEmbedUrl(sourceUrl) : dto.EmbedUrl.Trim();
            episode.ThumbnailUrl = string.IsNullOrWhiteSpace(dto.ThumbnailUrl) ? BuildThumbnailUrl(sourceUrl) : dto.ThumbnailUrl.Trim();
            episode.Platform = string.IsNullOrWhiteSpace(dto.Platform) ? DetectPlatform(sourceUrl) : dto.Platform.Trim();
            episode.PublishedAt = dto.PublishedAt ?? episode.PublishedAt;
            episode.DisplayOrder = dto.DisplayOrder;
            episode.IsActive = dto.IsActive;
            episode.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            await _context.Entry(episode).Reference(e => e.Podcast).LoadAsync();

            return MapEpisode(episode, episode.Podcast);
        }

        public async Task<bool> DeleteEpisodeAsync(int id)
        {
            var episode = await _context.PodcastEpisodes.FirstOrDefaultAsync(e => e.Id == id && !e.IsDeleted);
            if (episode == null) return false;

            episode.IsDeleted = true;
            episode.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        private PodcastDto MapPodcast(Podcast podcast)
        {
            var activeEpisodes = podcast.Episodes?.Where(e => !e.IsDeleted).ToList() ?? new List<PodcastEpisode>();
            var latest = activeEpisodes.OrderByDescending(e => e.PublishedAt).FirstOrDefault();
            return new PodcastDto
            {
                Id = podcast.Id,
                Name = podcast.Name,
                Slug = podcast.Slug,
                Description = podcast.Description,
                ImageUrl = podcast.ImageUrl,
                DisplayOrder = podcast.DisplayOrder,
                IsActive = podcast.IsActive,
                CreatedAt = podcast.CreatedAt,
                UpdatedAt = podcast.UpdatedAt,
                EpisodeCount = activeEpisodes.Count,
                LatestEpisode = latest == null ? null : MapEpisode(latest, podcast)
            };
        }

        private PodcastEpisodeDto MapEpisode(PodcastEpisode episode, Podcast podcast) => new()
        {
            Id = episode.Id,
            PodcastId = episode.PodcastId,
            PodcastName = podcast.Name,
            PodcastSlug = podcast.Slug,
            Title = episode.Title,
            Slug = episode.Slug,
            Description = episode.Description,
            EpisodeNumber = episode.EpisodeNumber,
            SourceUrl = episode.SourceUrl,
            EmbedUrl = episode.EmbedUrl,
            ThumbnailUrl = episode.ThumbnailUrl,
            Platform = episode.Platform,
            ViewCount = episode.ViewCount,
            PublishedAt = episode.PublishedAt,
            DisplayOrder = episode.DisplayOrder,
            IsActive = episode.IsActive,
            CreatedAt = episode.CreatedAt,
            UpdatedAt = episode.UpdatedAt
        };

        private async Task<AgencyContentBannerDto?> GetAgencyBannerForPodcastAsync(int podcastId)
        {
            return await _context.AgencyContents
                .AsNoTracking()
                .Include(c => c.Agency)
                .Where(c => c.ContentType == "podcast" && c.ContentId == podcastId)
                .Where(c => !c.Agency.IsDeleted && c.Agency.IsActive)
                .OrderBy(c => c.DisplayOrder)
                .ThenBy(c => c.Agency.DisplayOrder)
                .ThenBy(c => c.Agency.Name)
                .Select(c => new AgencyContentBannerDto
                {
                    Id = c.Agency.Id,
                    Name = c.Agency.Name,
                    Slug = c.Agency.Slug,
                    LogoUrl = c.Agency.LogoUrl,
                    BannerImageUrl = c.Agency.BannerImageUrl,
                    ShortDescription = c.Agency.ShortDescription,
                    BrandPrimaryColor = c.Agency.BrandPrimaryColor,
                    BrandSecondaryColor = c.Agency.BrandSecondaryColor,
                    BrandTextColor = c.Agency.BrandTextColor
                })
                .FirstOrDefaultAsync();
        }

        private async Task<string> EnsureUniquePodcastSlugAsync(string? requestedSlug, string fallback, int? currentId = null)
        {
            var baseSlug = Slugify(string.IsNullOrWhiteSpace(requestedSlug) ? fallback : requestedSlug);
            var slug = baseSlug;
            var counter = 2;

            while (await _context.Podcasts.AnyAsync(p => p.Slug == slug && !p.IsDeleted && (!currentId.HasValue || p.Id != currentId.Value)))
            {
                slug = $"{baseSlug}-{counter++}";
            }

            return slug;
        }

        private async Task<string> EnsureUniqueEpisodeSlugAsync(int podcastId, string? requestedSlug, string fallback, int? currentId = null)
        {
            var baseSlug = Slugify(string.IsNullOrWhiteSpace(requestedSlug) ? fallback : requestedSlug);
            var slug = baseSlug;
            var counter = 2;

            while (await _context.PodcastEpisodes.AnyAsync(e => e.PodcastId == podcastId && e.Slug == slug && !e.IsDeleted && (!currentId.HasValue || e.Id != currentId.Value)))
            {
                slug = $"{baseSlug}-{counter++}";
            }

            return slug;
        }

        private static string Slugify(string text)
        {
            var normalized = text.Trim().ToLowerInvariant();
            var sb = new StringBuilder();
            foreach (var c in normalized)
            {
                if (char.IsLetterOrDigit(c)) sb.Append(c);
                else if (char.IsWhiteSpace(c) || c == '-' || c == '_') sb.Append('-');
            }

            var slug = Regex.Replace(sb.ToString(), "-{2,}", "-").Trim('-');
            return string.IsNullOrWhiteSpace(slug) ? Guid.NewGuid().ToString("N")[..10] : slug;
        }

        private static string DetectPlatform(string url)
        {
            if (IsYouTubeUrl(url)) return "YouTube";
            if (IsSpotifyUrl(url)) return "Spotify";
            if (url.Contains("podcasts.apple.com", StringComparison.OrdinalIgnoreCase)) return "Apple Podcasts";
            return "קישור חיצוני";
        }

        private static string BuildEmbedUrl(string url)
        {
            var youtubeId = ExtractYouTubeId(url);
            if (!string.IsNullOrWhiteSpace(youtubeId)) return $"https://www.youtube.com/embed/{youtubeId}";
            var spotifyEmbedUrl = BuildSpotifyEmbedUrl(url);
            if (!string.IsNullOrWhiteSpace(spotifyEmbedUrl)) return spotifyEmbedUrl;
            return url;
        }

        private static string? BuildThumbnailUrl(string url)
        {
            var youtubeId = ExtractYouTubeId(url);
            return string.IsNullOrWhiteSpace(youtubeId) ? null : $"https://img.youtube.com/vi/{youtubeId}/hqdefault.jpg";
        }

        private static bool IsYouTubeUrl(string url) =>
            url.Contains("youtube.com", StringComparison.OrdinalIgnoreCase) ||
            url.Contains("youtu.be", StringComparison.OrdinalIgnoreCase);

        private static bool IsSpotifyUrl(string url) =>
            url.Contains("open.spotify.com", StringComparison.OrdinalIgnoreCase);

        private static string? ExtractYouTubeId(string url)
        {
            if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                if (uri.Host.Contains("youtu.be", StringComparison.OrdinalIgnoreCase))
                {
                    var id = uri.AbsolutePath.Trim('/');
                    if (!string.IsNullOrWhiteSpace(id)) return id.Split('/')[0];
                }

                if (uri.Host.Contains("youtube.com", StringComparison.OrdinalIgnoreCase))
                {
                    var v = GetQueryValue(uri.Query, "v");
                    if (!string.IsNullOrWhiteSpace(v)) return v;

                    var parts = uri.AbsolutePath.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 2 && (parts[0].Equals("embed", StringComparison.OrdinalIgnoreCase) || parts[0].Equals("shorts", StringComparison.OrdinalIgnoreCase)))
                    {
                        return parts[1];
                    }
                }
            }

            var patterns = new[]
            {
                @"youtu\.be\/([A-Za-z0-9_-]{6,})",
                @"youtube\.com\/watch\?.*v=([A-Za-z0-9_-]{6,})",
                @"youtube\.com\/embed\/([A-Za-z0-9_-]{6,})",
                @"youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})"
            };

            foreach (var pattern in patterns)
            {
                var match = Regex.Match(url, pattern, RegexOptions.IgnoreCase);
                if (match.Success) return match.Groups[1].Value;
            }

            return null;
        }

        private static string? BuildSpotifyEmbedUrl(string url)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return null;
            if (!IsSpotifyUrl(url)) return null;

            var path = uri.AbsolutePath.Trim('/');
            if (string.IsNullOrWhiteSpace(path)) return null;
            if (path.StartsWith("embed/", StringComparison.OrdinalIgnoreCase)) return url;

            return $"https://open.spotify.com/embed/{path}";
        }

        private static string? GetQueryValue(string query, string key)
        {
            var cleanQuery = query.TrimStart('?');
            if (string.IsNullOrWhiteSpace(cleanQuery)) return null;

            foreach (var part in cleanQuery.Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var pair = part.Split('=', 2);
                if (pair.Length == 2 && pair[0].Equals(key, StringComparison.OrdinalIgnoreCase))
                {
                    return Uri.UnescapeDataString(pair[1]);
                }
            }

            return null;
        }
    }
}
