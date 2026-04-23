using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;

namespace AkordishKeit.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SearchController : ControllerBase
{
    private readonly AkordishKeitDbContext _context;

    public SearchController(AkordishKeitDbContext context)
    {
        _context = context;
    }

    /// <summary>
    /// חיפוש גלובלי — מחזיר תוצאות מכל סוגי התוכן במקביל
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<SearchResultsDto>> Search([FromQuery] string q = "", [FromQuery] bool deep = false)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return Ok(new SearchResultsDto());

        var term = q.Trim();

        // שלב 2 — חיפוש עמוק לפי מילות השיר (לא כולל שירים שכבר נמצאו בשלב 1 לפי כותרת)
        if (deep)
        {
            var lyricsSongs = await _context.Songs
                .Where(s => !s.IsDeleted && s.IsApproved
                    && !s.Title.Contains(term)
                    && s.LyricsWithChords != null && s.LyricsWithChords.Contains(term))
                .OrderByDescending(s => s.ViewCount)
                .Take(5)
                .Select(s => new SearchItemDto
                {
                    Id = s.Id,
                    Title = s.Title,
                    Subtitle = s.SongArtists.Select(sa => sa.Artist.Name).FirstOrDefault(),
                    ImageUrl = s.ImageUrl,
                    Type = "song"
                })
                .ToListAsync();

            return Ok(new SearchResultsDto { Songs = lyricsSongs });
        }

        // שלב 1 — חיפוש מהיר לפי שמות
        // EF Core DbContext אינו thread-safe — הקוורי רצים בסדר רציף
        var songs = await _context.Songs
            .Where(s => !s.IsDeleted && s.IsApproved && s.Title.Contains(term))
            .OrderByDescending(s => s.ViewCount)
            .Take(5)
            .Select(s => new SearchItemDto
            {
                Id = s.Id,
                Title = s.Title,
                Subtitle = s.SongArtists.Select(sa => sa.Artist.Name).FirstOrDefault(),
                ImageUrl = s.ImageUrl,
                Type = "song"
            })
            .ToListAsync();

        var artists = await _context.Artists
            .Where(a => !a.IsDeleted && a.Status == ArtistStatus.Active && a.Name.Contains(term))
            .OrderByDescending(a => a.Tier)
            .ThenBy(a => a.Name)
            .Take(5)
            .Select(a => new SearchItemDto
            {
                Id = a.Id,
                Title = a.Name,
                Subtitle = null,
                ImageUrl = a.ImageUrl,
                Type = "artist"
            })
            .ToListAsync();

        var articles = await _context.Articles
            .Where(a => a.Status == (int)ArticleStatus.Published && a.Title.Contains(term))
            .OrderByDescending(a => a.PublishDate)
            .Take(5)
            .Select(a => new SearchItemDto
            {
                Id = a.Id,
                Title = a.Title,
                Subtitle = a.ShortDescription,
                ImageUrl = a.FeaturedImageUrl,
                Type = "article"
            })
            .ToListAsync();

        var teachers = await _context.ServiceProviders
            .Where(p => p.Status == ProfileStatus.Active && p.IsTeacher && !p.IsDeleted && p.DisplayName.Contains(term))
            .Take(5)
            .Select(p => new SearchItemDto
            {
                Id = p.Id,
                Title = p.DisplayName,
                Subtitle = p.ShortBio,
                ImageUrl = p.ProfileImageUrl,
                Type = "teacher"
            })
            .ToListAsync();

        var professionals = await _context.ServiceProviders
            .Where(p => p.Status == ProfileStatus.Active && !p.IsTeacher && !p.IsDeleted && p.DisplayName.Contains(term))
            .Take(5)
            .Select(p => new SearchItemDto
            {
                Id = p.Id,
                Title = p.DisplayName,
                Subtitle = p.ShortBio,
                ImageUrl = p.ProfileImageUrl,
                Type = "professional"
            })
            .ToListAsync();

        var playlists = await _context.Playlists
            .Where(pl => pl.IsPublic && pl.Name.Contains(term))
            .OrderByDescending(pl => pl.CreatedAt)
            .Take(5)
            .Select(pl => new SearchItemDto
            {
                Id = pl.Id,
                Title = pl.Name,
                Subtitle = pl.Description,
                ImageUrl = pl.ImageUrl,
                Type = "playlist"
            })
            .ToListAsync();

        return Ok(new SearchResultsDto
        {
            Songs = songs,
            Artists = artists,
            Articles = articles,
            Teachers = teachers,
            Professionals = professionals,
            Playlists = playlists
        });
    }
}
