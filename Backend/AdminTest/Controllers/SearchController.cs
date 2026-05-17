using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
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
    public async Task<ActionResult<SearchResultsDto>> Search(
        [FromQuery] string q = "",
        [FromQuery] bool deep = false,
        [FromQuery] int limit = 5)
    {
        if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            return Ok(new SearchResultsDto());

        var term = q.Trim();
        var resultLimit = Math.Clamp(limit, 1, 50);
        var searchTokens = term
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(token => token.Length >= 2)
            .Take(4)
            .ToArray();
        var searchedCity = FindCityByText(term);
        var searchedCityId = searchedCity?.Id;

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
                    Subtitle = s.SongArtists
                        .Where(sa => sa.Artist != null)
                        .Select(sa => sa.Artist!.Name)
                        .FirstOrDefault(),
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
            .Take(resultLimit)
            .Select(s => new SearchItemDto
            {
                Id = s.Id,
                Title = s.Title,
                Subtitle = s.SongArtists
                    .Where(sa => sa.Artist != null)
                    .Select(sa => sa.Artist!.Name)
                    .FirstOrDefault(),
                ImageUrl = s.ImageUrl,
                Type = "song"
            })
            .ToListAsync();

        var artists = await _context.Artists
            .Where(a => !a.IsDeleted && a.Status == ArtistStatus.Active && a.Name.Contains(term))
            .OrderByDescending(a => a.Tier)
            .ThenBy(a => a.Name)
            .Take(resultLimit)
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
            .Take(resultLimit)
            .Select(a => new SearchItemDto
            {
                Id = a.Id,
                Title = a.Title,
                Subtitle = a.ShortDescription,
                ImageUrl = a.FeaturedImageUrl,
                Type = "article"
            })
            .ToListAsync();

        var teachersQuery = ApplyServiceProviderSearch(
            _context.ServiceProviders.Where(p => p.Status == ProfileStatus.Active && p.IsTeacher && !p.IsDeleted),
            term,
            searchTokens,
            includeTeacherFields: true);

        var teachers = await OrderServiceProviderSearchResults(teachersQuery, term)
            .Take(resultLimit)
            .Select(p => new SearchItemDto
            {
                Id = p.Id,
                Title = p.DisplayName,
                Subtitle = p.Branches
                    .Where(b =>
                        b.Name.Contains(term) ||
                        (b.Address != null && b.Address.Contains(term)) ||
                        (searchedCityId.HasValue && b.CityId == searchedCityId.Value))
                    .Select(b => b.Address != null ? b.Name + " - " + b.Address : b.Name)
                    .FirstOrDefault() ?? p.ShortBio,
                ImageUrl = p.ProfileImageUrl,
                Type = "teacher"
            })
            .ToListAsync();

        var professionalsQuery = ApplyServiceProviderSearch(
            _context.ServiceProviders.Where(p => p.Status == ProfileStatus.Active && !p.IsTeacher && !p.IsDeleted),
            term,
            searchTokens,
            includeTeacherFields: false);

        var professionals = await OrderServiceProviderSearchResults(professionalsQuery, term)
            .Take(resultLimit)
            .Select(p => new SearchItemDto
            {
                Id = p.Id,
                Title = p.DisplayName,
                Subtitle = p.Branches
                    .Where(b =>
                        b.Name.Contains(term) ||
                        (b.Address != null && b.Address.Contains(term)) ||
                        (searchedCityId.HasValue && b.CityId == searchedCityId.Value))
                    .Select(b => b.Address != null ? b.Name + " - " + b.Address : b.Name)
                    .FirstOrDefault() ?? p.ShortBio,
                ImageUrl = p.ProfileImageUrl,
                Type = "professional"
            })
            .ToListAsync();

        var playlists = await _context.Playlists
            .Where(pl => pl.IsPublic && pl.Name.Contains(term))
            .OrderByDescending(pl => pl.CreatedAt)
            .Take(resultLimit)
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

    private IQueryable<MusicServiceProvider> ApplyServiceProviderSearch(
        IQueryable<MusicServiceProvider> query,
        string term,
        string[] searchTokens,
        bool includeTeacherFields)
    {
        var tokens = searchTokens.Length > 0 ? searchTokens : new[] { term };

        foreach (var token in tokens)
        {
            var currentToken = token;
            var tokenCity = FindCityByText(currentToken);
            var tokenCityId = tokenCity?.Id;
            var cityTerm1 = tokenCity?.Name;
            var cityTerm2 = tokenCity?.EnglishName;

            query = query.Where(p =>
                p.DisplayName.Contains(currentToken) ||
                (p.ShortBio != null && p.ShortBio.Contains(currentToken)) ||
                (p.Location != null && p.Location.Contains(currentToken)) ||
                (p.WorkingHours != null && p.WorkingHours.Contains(currentToken)) ||
                (tokenCityId.HasValue && p.CityId == tokenCityId.Value) ||
                p.Categories.Any(c =>
                    c.Category.Name.Contains(currentToken) ||
                    (c.SubCategory != null && c.SubCategory.Contains(currentToken))) ||
                _context.ServiceProviderBranches.Any(b =>
                    b.ServiceProviderId == p.Id &&
                    (
                    b.Name.Contains(currentToken) ||
                    (b.Address != null && b.Address.Contains(currentToken)) ||
                    (tokenCityId.HasValue && b.CityId == tokenCityId.Value) ||
                    (!string.IsNullOrEmpty(cityTerm1) && (b.Name.Contains(cityTerm1) || (b.Address != null && b.Address.Contains(cityTerm1)))) ||
                    (!string.IsNullOrEmpty(cityTerm2) && (b.Name.Contains(cityTerm2) || (b.Address != null && b.Address.Contains(cityTerm2)))) ||
                    (b.PhoneNumber != null && b.PhoneNumber.Contains(currentToken)) ||
                    (b.Email != null && b.Email.Contains(currentToken)) ||
                    (b.OpeningHours != null && b.OpeningHours.Contains(currentToken))
                    )) ||
                (includeTeacherFields &&
                    p.TeacherProfile != null &&
                    ((p.TeacherProfile.Specializations != null && p.TeacherProfile.Specializations.Contains(currentToken)) ||
                     (p.TeacherProfile.LessonTypes != null && p.TeacherProfile.LessonTypes.Contains(currentToken)) ||
                     (p.TeacherProfile.Availability != null && p.TeacherProfile.Availability.Contains(currentToken)) ||
                     p.TeacherProfile.Instruments.Any(i =>
                        i.Instrument.Name.Contains(currentToken) ||
                        (i.Instrument.EnglishName != null && i.Instrument.EnglishName.Contains(currentToken))))));
        }

        return query;
    }

    private static CityDto? FindCityByText(string? text)
    {
        var normalized = text?.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        return CitiesController.GetIsraeliCities().FirstOrDefault(city =>
            city.Name.Equals(normalized, StringComparison.OrdinalIgnoreCase) ||
            city.Name.Contains(normalized, StringComparison.OrdinalIgnoreCase) ||
            normalized.Contains(city.Name, StringComparison.OrdinalIgnoreCase) ||
            (!string.IsNullOrWhiteSpace(city.EnglishName) &&
                (city.EnglishName.Equals(normalized, StringComparison.OrdinalIgnoreCase) ||
                 city.EnglishName.Contains(normalized, StringComparison.OrdinalIgnoreCase) ||
                 normalized.Contains(city.EnglishName, StringComparison.OrdinalIgnoreCase))));
    }

    private static IOrderedQueryable<MusicServiceProvider> OrderServiceProviderSearchResults(
        IQueryable<MusicServiceProvider> query,
        string term)
    {
        return query
            .OrderByDescending(p => p.DisplayName.StartsWith(term))
            .ThenByDescending(p => p.DisplayName.Contains(term))
            .ThenByDescending(p => p.Location != null && p.Location.Contains(term))
            .ThenByDescending(p => p.Branches.Any(b =>
                b.Name.Contains(term) ||
                (b.Address != null && b.Address.Contains(term))))
            .ThenByDescending(p => p.Categories.Any(c =>
                c.Category.Name.Contains(term) ||
                (c.SubCategory != null && c.SubCategory.Contains(term))))
            .ThenByDescending(p => p.IsFeatured)
            .ThenByDescending(p => p.Tier)
            .ThenByDescending(p => p.CreatedAt);
    }
}
