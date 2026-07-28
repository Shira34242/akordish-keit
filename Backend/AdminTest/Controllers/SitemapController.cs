using AkordishKeit.Data;
using AkordishKeit.Models.Enum;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using System.Text;
using System.Text.RegularExpressions;
using System.Linq;

namespace AkordishKeit.Controllers;

[ApiController]
[AllowAnonymous]
public class SitemapController : ControllerBase
{
    private readonly AkordishKeitDbContext _db;
    private readonly IMemoryCache _cache;
    private const string BaseUrl = "https://akordishkayt.com";
    private const string CacheKey = "sitemap_dynamic_xml";

    public SitemapController(AkordishKeitDbContext db, IMemoryCache cache)
    {
        _db = db;
        _cache = cache;
    }

    [HttpGet("/sitemap-dynamic.xml")]
    public async Task<ContentResult> GetDynamicSitemap()
    {
        if (_cache.TryGetValue(CacheKey, out string? cached) && cached != null)
            return Content(cached, "application/xml", Encoding.UTF8);

        var xml = await BuildSitemapAsync();

        _cache.Set(CacheKey, xml, TimeSpan.FromHours(6));

        return Content(xml, "application/xml", Encoding.UTF8);
    }

    private async Task<string> BuildSitemapAsync()
    {
        var sb = new StringBuilder();
        sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
        sb.AppendLine("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");

        // שירים
        var songs = await _db.Songs
            .Where(s => s.IsApproved && !s.IsDeleted)
            .Select(s => new
            {
                s.Id,
                s.Title,
                ArtistName = s.SongArtists
                    .OrderBy(sa => sa.Order)
                    .Select(sa => sa.Artist != null ? sa.Artist.Name : sa.TempArtistName)
                    .FirstOrDefault()
            })
            .ToListAsync();

        foreach (var song in songs)
        {
            // Keep the sitemap URL identical to the public Angular song route:
            // title + first artist name when an artist exists.
            var slugSource = string.IsNullOrWhiteSpace(song.ArtistName)
                ? song.Title
                : $"{song.Title}-{song.ArtistName}";
            var slug = ToSlug(slugSource);
            var loc = slug.Length > 0
                ? $"{BaseUrl}/song/{song.Id}/{slug}"
                : $"{BaseUrl}/song/{song.Id}";
            sb.AppendLine($"  <url><loc>{loc}</loc><priority>0.8</priority></url>");
        }

        // אמנים
        var artists = await _db.Artists
            .Where(a => a.Status == ArtistStatus.Active)
            .Select(a => new { a.Id, a.Name })
            .ToListAsync();

        foreach (var artist in artists)
        {
            var slug = ToSlug(artist.Name);
            var loc = slug.Length > 0
                ? $"{BaseUrl}/artist/{artist.Id}/{slug}"
                : $"{BaseUrl}/artist/{artist.Id}";
            sb.AppendLine($"  <url><loc>{loc}</loc><priority>0.7</priority></url>");
        }

        // כתבות וחדשות
        var articles = await _db.Articles
            .Where(a => a.Status == (int)ArticleStatus.Published && !a.IsDeleted)
            .Select(a => new { a.Id, a.Title, a.Slug, a.ContentType })
            .ToListAsync();

        foreach (var article in articles)
        {
            var slug = ToSlug(article.Title ?? article.Slug ?? "");
            var prefix = article.ContentType == (int)ArticleContentType.News ? "news" : "blog";
            var loc = slug.Length > 0
                ? $"{BaseUrl}/{prefix}/{article.Id}/{slug}"
                : $"{BaseUrl}/{prefix}/id/{article.Id}";
            sb.AppendLine($"  <url><loc>{loc}</loc><priority>0.7</priority></url>");
        }

        // סוכנויות
        var agencies = await _db.Agencies
            .Where(a => a.IsActive && !a.IsDeleted)
            .Select(a => new { a.Slug })
            .ToListAsync();

        foreach (var agency in agencies)
        {
            sb.AppendLine($"  <url><loc>{BaseUrl}/agency/{agency.Slug}</loc><priority>0.6</priority></url>");
        }

        // פודקאסטים
        var podcasts = await _db.Podcasts
            .Where(p => p.IsActive && !p.IsDeleted)
            .Select(p => new { p.Slug })
            .ToListAsync();

        foreach (var podcast in podcasts)
        {
            sb.AppendLine($"  <url><loc>{BaseUrl}/podcasts/{podcast.Slug}</loc><priority>0.6</priority></url>");
        }

        // פרקי פודקאסט
        var episodes = await _db.PodcastEpisodes
            .Where(e => e.IsActive && !e.Podcast!.IsDeleted)
            .Select(e => new { e.Slug, PodcastSlug = e.Podcast!.Slug })
            .ToListAsync();

        foreach (var ep in episodes)
        {
            sb.AppendLine($"  <url><loc>{BaseUrl}/podcasts/{ep.PodcastSlug}/{ep.Slug}</loc><priority>0.5</priority></url>");
        }

        sb.AppendLine("</urlset>");
        return sb.ToString();
    }

    private static string ToSlug(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "";
        var result = text.Trim().ToLower();
        result = Regex.Replace(result, @"\s+", "-");
        result = new string(result.Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_').ToArray());
        result = Regex.Replace(result, @"-+", "-");
        return result.Trim('-');
    }
}
