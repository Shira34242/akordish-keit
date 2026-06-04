using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Services;

public class SmartSongImportService : ISmartSongImportService
{
    private const int DefaultOriginalKeyId = 1;
    private readonly HttpClient _httpClient;
    private readonly AkordishKeitDbContext _context;
    private readonly ISongService _songService;
    private readonly IYouTubeService _youTubeService;

    private sealed record ImportedSongParts(
        string? Title = null,
        string? ArtistName = null,
        string? LyricsWithChords = null,
        string? YoutubeUrl = null,
        string? ImageUrl = null);

    private sealed record Tab4USearchResult(string Href, string? ImageUrl);
    private sealed record Tab4UArtistSongs(List<string> SongUrls, int PageCount);

    public SmartSongImportService(
        HttpClient httpClient,
        AkordishKeitDbContext context,
        ISongService songService,
        IYouTubeService youTubeService)
    {
        _httpClient = httpClient;
        _context = context;
        _songService = songService;
        _youTubeService = youTubeService;
    }

    public async Task<ImportSongFromUrlResponseDto> ImportFromUrlAsync(string sourceUrl, int userId)
    {
        if (!Uri.TryCreate(sourceUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return Fail(sourceUrl, "הקישור לא תקין", new[] { "url" });
        }

        var html = await FetchHtmlAsync(uri);
        if (false && string.IsNullOrWhiteSpace(html))
        {
            return Fail(sourceUrl, "לא הצלחנו לקרוא את הדף", new[] { "content" });
        }

        if (IsTab4UArtistPage(uri))
        {
            var artistSongs = await CollectTab4UArtistSongUrlsAsync(uri, html);
            var songUrls = artistSongs.SongUrls;
            return new ImportSongFromUrlResponseDto
            {
                Success = songUrls.Count > 0,
                Message = songUrls.Count > 0
                    ? $"זוהו {songUrls.Count} שירים מתוך {artistSongs.PageCount} עמודי אמן."
                    : "לא זוהו קישורי שירים בעמוד האמן.",
                SourceUrl = sourceUrl,
                IsArtistPage = true,
                SongUrls = songUrls,
                MissingFields = songUrls.Count > 0 ? new List<string>() : new List<string> { "songs" }
            };
        }

        var urlParts = ExtractUrlParts(uri);
        var siteParts = ExtractSiteSpecificParts(uri, html);
        var isNeginaImport = uri.Host.Contains("negina.co.il", StringComparison.OrdinalIgnoreCase);
        var normalizeImportedChordOnlyLines = ShouldNormalizeImportedChordOnlyLines(uri);

        var title = CleanTitle(
            siteParts.Title
            ?? urlParts.Title
            ?? ExtractOpenGraphSongTitle(html)
            ?? ExtractMeta(html, "og:title")
            ?? ExtractMeta(html, "twitter:title")
            ?? ExtractTagText(html, "h1")
            ?? ExtractTitleTag(html)
            ?? uri.Host);

        var artistName = CleanPersonName(siteParts.ArtistName ?? urlParts.ArtistName ?? ExtractArtistName(html, title) ?? string.Empty);
        var genericLyricsWithChords = string.IsNullOrWhiteSpace(siteParts.LyricsWithChords)
            ? ExtractLyricsWithChords(html)
            : null;
        var lyricsWithChords = !string.IsNullOrWhiteSpace(siteParts.LyricsWithChords)
            ? CleanLyrics(siteParts.LyricsWithChords, normalizeImportedChordOnlyLines)
            : (!string.IsNullOrWhiteSpace(genericLyricsWithChords)
                ? CleanLyrics(genericLyricsWithChords, normalizeImportedChordOnlyLines)
                : null);
        var youtubeUrl = siteParts.YoutubeUrl ?? ExtractYouTubeUrl(html);
        var imageUrl = siteParts.ImageUrl ?? ExtractMeta(html, "og:image") ?? ExtractMeta(html, "twitter:image");

        if (isNeginaImport && string.IsNullOrWhiteSpace(lyricsWithChords))
        {
            var readerText = await FetchReaderTextAsync(uri);
            if (!string.IsNullOrWhiteSpace(readerText))
            {
                var readerParts = ExtractNeginaParts(uri, readerText);
                if (!string.IsNullOrWhiteSpace(readerParts.LyricsWithChords))
                {
                    lyricsWithChords = CleanLyrics(readerParts.LyricsWithChords, normalizeImportedChordOnlyLines);
                }

                youtubeUrl ??= readerParts.YoutubeUrl;
                imageUrl ??= readerParts.ImageUrl;
            }
        }
        else if (uri.Host.Contains("nagnu.co.il", StringComparison.OrdinalIgnoreCase) &&
                 (string.IsNullOrWhiteSpace(lyricsWithChords) || IsNagnuLockedPreview(html)))
        {
            var readerText = await FetchReaderTextAsync(uri);
            if (!string.IsNullOrWhiteSpace(readerText))
            {
                var readerParts = ExtractNagnuReaderParts(uri, readerText);
                if (!string.IsNullOrWhiteSpace(readerParts.LyricsWithChords))
                {
                    lyricsWithChords = CleanLyrics(readerParts.LyricsWithChords, normalizeImportedChordOnlyLines);
                }

                youtubeUrl ??= readerParts.YoutubeUrl;
                imageUrl ??= readerParts.ImageUrl;
            }
        }

        if (string.IsNullOrWhiteSpace(youtubeUrl))
        {
            youtubeUrl = await FindYouTubeFallbackAsync(title, artistName);
        }

        var youtubeImageUrl = ExtractYouTubeThumbnailUrl(youtubeUrl);
        if (IsUsefulImportedImageUrl(youtubeImageUrl))
        {
            imageUrl = youtubeImageUrl;
        }
        else if (!IsUsefulImportedImageUrl(imageUrl))
        {
            imageUrl = null;
        }

        var detectedKey = !string.IsNullOrWhiteSpace(lyricsWithChords)
            ? KeyDetectionService.Detect(lyricsWithChords)
            : null;
        var artistInput = await BuildArtistInputAsync(artistName);

        var draft = new ImportedSongDraftDto
        {
            Title = string.IsNullOrWhiteSpace(title) ? "שיר מיובא" : title,
            Artists = new List<ArtistInputDto>
            {
                artistInput
            },
            YoutubeUrl = youtubeUrl ?? string.Empty,
            ImageUrl = imageUrl,
            LyricsWithChords = lyricsWithChords ?? string.Empty,
            OriginalKeyId = detectedKey?.OriginalKeyId ?? DefaultOriginalKeyId,
            EasyKeyId = detectedKey?.EasyKeyId,
            Tags = new List<TagInputDto>()
        };

        var missingFields = GetMissingFields(draft);
        if (missingFields.Count > 0)
        {
            return new ImportSongFromUrlResponseDto
            {
                Success = false,
                Message = "שלפנו מה שאפשר, אבל חסרים פרטים חובה לפני יצירת טיוטה.",
                SourceUrl = sourceUrl,
                Draft = draft,
                MissingFields = missingFields
            };
        }

        return new ImportSongFromUrlResponseDto
        {
            Success = true,
            Message = "התוכן חולץ בהצלחה. יש ללחוץ על עריכה ולאשר פרסום.",
            SourceUrl = sourceUrl,
            Draft = draft
        };
    }

    private async Task<ArtistInputDto> BuildArtistInputAsync(string? artistName)
    {
        var fallbackName = string.IsNullOrWhiteSpace(artistName) ? "אמן לא ידוע" : artistName.Trim();
        var normalizedName = NormalizeImportedArtistName(fallbackName);
        if (normalizedName.Length < 2)
        {
            return new ArtistInputDto { Name = fallbackName };
        }

        var candidates = await _context.Artists
            .AsNoTracking()
            .Where(artist => !artist.IsDeleted)
            .Select(artist => new { artist.Id, artist.Name, artist.EnglishName })
            .ToListAsync();

        var ranked = candidates
            .Select(artist => new
            {
                artist.Id,
                artist.Name,
                Score = Math.Max(
                    ScoreImportedArtistMatch(normalizedName, NormalizeImportedArtistName(artist.Name)),
                    ScoreImportedArtistMatch(normalizedName, NormalizeImportedArtistName(artist.EnglishName)))
            })
            .Where(artist => artist.Score >= 70)
            .OrderByDescending(artist => artist.Score)
            .ThenBy(artist => artist.Name)
            .FirstOrDefault();

        return ranked is null
            ? new ArtistInputDto { Name = fallbackName }
            : new ArtistInputDto { Id = ranked.Id, Name = ranked.Name };
    }

    private static int ScoreImportedArtistMatch(string source, string candidate)
    {
        if (string.IsNullOrWhiteSpace(source) || string.IsNullOrWhiteSpace(candidate))
        {
            return 0;
        }

        if (source == candidate)
        {
            return 100;
        }

        if (source.Contains(candidate, StringComparison.Ordinal) ||
            candidate.Contains(source, StringComparison.Ordinal))
        {
            return Math.Min(source.Length, candidate.Length) >= 3 ? 82 : 0;
        }

        var sourceParts = source.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var candidateParts = candidate.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var sharedParts = sourceParts.Count(part => candidateParts.Contains(part));
        if (sharedParts == 0)
        {
            return 0;
        }

        return (int)Math.Round(70.0 * sharedParts / Math.Max(sourceParts.Length, candidateParts.Length));
    }

    private static string NormalizeImportedArtistName(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var clean = WebUtility.HtmlDecode(value);
        clean = Regex.Replace(clean, @"\s*-\s*Topic$", string.Empty, RegexOptions.IgnoreCase);
        clean = Regex.Replace(clean, @"[^\u0590-\u05FFA-Za-z0-9]+", " ");
        return Regex.Replace(clean, @"\s+", " ").Trim().ToLowerInvariant();
    }

    private async Task<string> FetchHtmlAsync(Uri uri)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, uri);
            request.Headers.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36");
            request.Headers.Accept.ParseAdd("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            request.Headers.AcceptLanguage.ParseAdd("he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7");

            using var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return string.Empty;
            }

            var contentType = response.Content.Headers.ContentType?.MediaType;
            if (!string.IsNullOrWhiteSpace(contentType) &&
                !contentType.Contains("html", StringComparison.OrdinalIgnoreCase))
            {
                return string.Empty;
            }

            var bytes = await response.Content.ReadAsByteArrayAsync();
            var charset = response.Content.Headers.ContentType?.CharSet;
            var html = DecodeHtml(bytes, charset);
            return html.Length > 2_000_000 ? html[..2_000_000] : html;
        }
        catch
        {
            return string.Empty;
        }
    }

    private async Task<string> FetchReaderTextAsync(Uri uri)
    {
        try
        {
            var readerUri = new Uri($"https://r.jina.ai/{uri}");
            using var request = new HttpRequestMessage(HttpMethod.Get, readerUri);
            request.Headers.UserAgent.ParseAdd("Mozilla/5.0");

            using var response = await _httpClient.SendAsync(request);
            if (!response.IsSuccessStatusCode)
            {
                return string.Empty;
            }

            var text = await response.Content.ReadAsStringAsync();
            return text.Length > 2_000_000 ? text[..2_000_000] : text;
        }
        catch
        {
            return string.Empty;
        }
    }

    private async Task<string?> FindYouTubeFallbackAsync(string title, string? artistName)
    {
        var query = string.Join(" ", new[] { artistName, title }.Where(value => !string.IsNullOrWhiteSpace(value)));
        if (string.IsNullOrWhiteSpace(query) || query.Length < 3)
        {
            return null;
        }

        try
        {
            var results = await _youTubeService.SearchVideosAsync(query, 1);
            return results.FirstOrDefault()?.YoutubeUrl;
        }
        catch
        {
            return null;
        }
    }

    private static string DecodeHtml(byte[] bytes, string? headerCharset)
    {
        var headerDecoded = DecodeByCharset(bytes, headerCharset);
        var charset = ExtractCharsetFromHtml(headerDecoded);
        var decoded = DecodeByCharset(bytes, charset ?? headerCharset);

        if (CountReplacementCharacters(decoded) > 5 && !LooksLikeHebrew(decoded))
        {
            decoded = DecodeWindowsHebrew(bytes);
        }

        return decoded;
    }

    private static string DecodeByCharset(byte[] bytes, string? charset)
    {
        if (!string.IsNullOrWhiteSpace(charset) &&
            (charset.Contains("1255", StringComparison.OrdinalIgnoreCase) ||
             charset.Contains("8859-8", StringComparison.OrdinalIgnoreCase) ||
             charset.Contains("hebrew", StringComparison.OrdinalIgnoreCase)))
        {
            return DecodeWindowsHebrew(bytes);
        }

        return Encoding.UTF8.GetString(bytes);
    }

    private static string DecodeWindowsHebrew(byte[] bytes)
    {
        var chars = new char[bytes.Length];
        for (var i = 0; i < bytes.Length; i++)
        {
            var b = bytes[i];
            chars[i] = b switch
            {
                >= 0xE0 and <= 0xFA => (char)('\u05D0' + (b - 0xE0)),
                0xAA => '\u00D7',
                0xBA => '\u00F7',
                0xDF => '\u2017',
                0xFD => '\u200E',
                0xFE => '\u200F',
                _ => (char)b
            };
        }

        return new string(chars);
    }

    private static string? ExtractCharsetFromHtml(string html)
    {
        var match = Regex.Match(html, @"charset\s*=\s*[""']?(?<charset>[a-zA-Z0-9_\-]+)", RegexOptions.IgnoreCase);
        return match.Success ? match.Groups["charset"].Value : null;
    }

    private static int CountReplacementCharacters(string value) =>
        value.Count(c => c == '\uFFFD');

    private static bool LooksLikeHebrew(string value) =>
        Regex.IsMatch(value, @"[\u0590-\u05FF]");

    private static List<string> GetMissingFields(ImportedSongDraftDto draft)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(draft.Title)) missing.Add("שם שיר");
        if (draft.Artists.Count == 0 || draft.Artists.All(a => string.IsNullOrWhiteSpace(a.Name))) missing.Add("אמן");
        if (string.IsNullOrWhiteSpace(draft.YoutubeUrl)) missing.Add("קישור YouTube");
        if (string.IsNullOrWhiteSpace(draft.LyricsWithChords) || draft.LyricsWithChords.Length < 10) missing.Add("מילים ואקורדים");
        return missing;
    }

    private static ImportedSongParts ExtractUrlParts(Uri uri)
    {
        var host = uri.Host.ToLowerInvariant();

        if (host.Contains("tab4u.com"))
        {
            return ExtractTab4UUrlParts(uri);
        }

        if (host.Contains("nagnu.co.il"))
        {
            var parts = ExtractNagnuUrlParts(uri);
            return new ImportedSongParts(Title: parts.Title, ArtistName: parts.ArtistName);
        }

        if (host.Contains("negina.co.il"))
        {
            var parts = ExtractNeginaUrlParts(uri);
            return new ImportedSongParts(Title: parts.Title, ArtistName: parts.ArtistName);
        }

        return ExtractGenericUrlParts(uri);
    }

    private static ImportedSongParts ExtractTab4UUrlParts(Uri uri)
    {
        var fileName = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries).LastOrDefault();
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return new ImportedSongParts();
        }

        var decoded = WebUtility.UrlDecode(fileName);
        decoded = Regex.Replace(decoded, @"\.html?$", string.Empty, RegexOptions.IgnoreCase);
        decoded = Regex.Replace(decoded, @"^\d+_", string.Empty);
        decoded = decoded.Replace("_-_", " - ");
        decoded = decoded.Replace('_', ' ');

        var parsed = ParseArtistAndSong(decoded);
        return new ImportedSongParts(Title: parsed.Title, ArtistName: parsed.ArtistName);
    }

    private static bool IsTab4UArtistPage(Uri uri) =>
        uri.Host.Contains("tab4u.com", StringComparison.OrdinalIgnoreCase) &&
        Regex.IsMatch(uri.AbsolutePath, @"^/tabs/artists/[^/]+\.html?$", RegexOptions.IgnoreCase);

    private async Task<Tab4UArtistSongs> CollectTab4UArtistSongUrlsAsync(Uri sourceUri, string sourceHtml)
    {
        const int maxPages = 100;
        var songUrls = new List<string>();
        var seenSongs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var seenPages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var currentUri = BuildFirstTab4UArtistPageUri(sourceUri);
        var currentHtml = SamePageUri(currentUri, sourceUri) ? sourceHtml : await FetchHtmlAsync(currentUri);
        var pageCount = 0;

        while (!string.IsNullOrWhiteSpace(currentHtml) &&
               pageCount < maxPages &&
               seenPages.Add(currentUri.AbsoluteUri))
        {
            pageCount++;
            foreach (var songUrl in ExtractTab4UArtistSongUrls(currentUri, currentHtml))
            {
                if (seenSongs.Add(songUrl))
                {
                    songUrls.Add(songUrl);
                }
            }

            var nextPageUri = ExtractTab4UArtistNextPageUri(currentUri, currentHtml);
            if (nextPageUri is null || !SameArtistPage(sourceUri, nextPageUri))
            {
                break;
            }

            currentUri = nextPageUri;
            currentHtml = await FetchHtmlAsync(currentUri);
        }

        return new Tab4UArtistSongs(songUrls, pageCount);
    }

    private static Uri BuildFirstTab4UArtistPageUri(Uri sourceUri)
    {
        var queryParts = sourceUri.Query
            .TrimStart('?')
            .Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Where(part => !part.StartsWith("s=", StringComparison.OrdinalIgnoreCase))
            .ToList();
        queryParts.Insert(0, "s=0");

        var builder = new UriBuilder(sourceUri)
        {
            Query = string.Join("&", queryParts),
            Fragment = string.Empty
        };
        return builder.Uri;
    }

    private static Uri? ExtractTab4UArtistNextPageUri(Uri currentUri, string html)
    {
        var match = Regex.Match(
            html,
            @"<a\b(?=[^>]*\bclass\s*=\s*[""'][^""']*\bnextPre\b[^""']*[""'])[^>]*\bhref\s*=\s*[""'](?<href>[^""']+)[""']",
            RegexOptions.IgnoreCase);

        if (!match.Success)
        {
            return null;
        }

        var href = WebUtility.HtmlDecode(match.Groups["href"].Value.Trim());
        return Uri.TryCreate(currentUri, href, out var nextUri) ? nextUri : null;
    }

    private static bool SameArtistPage(Uri first, Uri candidate) =>
        first.Host.Equals(candidate.Host, StringComparison.OrdinalIgnoreCase) &&
        first.AbsolutePath.Equals(candidate.AbsolutePath, StringComparison.OrdinalIgnoreCase);

    private static bool SamePageUri(Uri first, Uri second) =>
        first.GetLeftPart(UriPartial.Path).Equals(second.GetLeftPart(UriPartial.Path), StringComparison.OrdinalIgnoreCase) &&
        first.Query.Equals(second.Query, StringComparison.OrdinalIgnoreCase);

    private static List<string> ExtractTab4UArtistSongUrls(Uri artistUri, string html)
    {
        var urls = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var matches = Regex.Matches(
            html,
            @"<a\b[^>]*\bhref\s*=\s*[""'](?<href>[^""'#?]*songs/[^""'#?]+\.html(?:\?[^""'#]*)?)[""']",
            RegexOptions.IgnoreCase);

        foreach (Match match in matches)
        {
            var href = WebUtility.HtmlDecode(match.Groups["href"].Value.Trim());
            if (!Uri.TryCreate(artistUri, href, out var songUri) ||
                !songUri.Host.Contains("tab4u.com", StringComparison.OrdinalIgnoreCase) ||
                !Regex.IsMatch(songUri.AbsolutePath, @"^/tabs/songs/[^/]+\.html?$", RegexOptions.IgnoreCase))
            {
                continue;
            }

            var normalized = songUri.GetLeftPart(UriPartial.Path);
            if (seen.Add(normalized))
            {
                urls.Add(normalized);
            }
        }

        return urls;
    }

    private static ImportedSongParts ExtractGenericUrlParts(Uri uri)
    {
        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Select(DecodeUrlSegment)
            .Where(segment =>
                segment.Length > 1 &&
                !segment.Equals("tabs", StringComparison.OrdinalIgnoreCase) &&
                !segment.Equals("songs", StringComparison.OrdinalIgnoreCase) &&
                !segment.Equals("song", StringComparison.OrdinalIgnoreCase) &&
                !segment.Equals("chords", StringComparison.OrdinalIgnoreCase) &&
                !segment.Equals("lyrics", StringComparison.OrdinalIgnoreCase))
            .ToArray();

        if (segments.Length >= 2)
        {
            return new ImportedSongParts(Title: segments[^1], ArtistName: segments[^2]);
        }

        if (segments.Length == 1)
        {
            return new ImportedSongParts(Title: segments[0]);
        }

        return new ImportedSongParts();
    }

    private static ImportedSongParts ExtractSiteSpecificParts(Uri uri, string html)
    {
        var host = uri.Host.ToLowerInvariant();

        if (host.Contains("tab4u.com"))
        {
            return ExtractTab4UParts(html);
        }

        if (host.Contains("nagnu.co.il"))
        {
            return ExtractNagnuParts(uri, html);
        }

        if (host.Contains("negina.co.il"))
        {
            return ExtractNeginaParts(uri, html);
        }

        return new ImportedSongParts();
    }

    private static ImportedSongParts ExtractTab4UParts(string html)
    {
        var scriptTitle = ParseArtistAndSong(ExtractJsString(html, "aaa"));
        var jsonLdTitle = ExtractJsonLdSongTitle(html);
        var jsonLdArtist = ExtractJsonLdArtist(html);
        var pageTitle = ExtractSongNameFromPageTitle(
            ExtractMeta(html, "title")
            ?? ExtractMeta(html, "og:title")
            ?? ExtractTitleTag(html));

        var lyrics = ExtractPreservedElementById(html, "songContentTPL")
            ?? ExtractPreservedElementById(html, "songContent")
            ?? ExtractPreservedElementById(html, "songContentDiv");

        return new ImportedSongParts(
            Title: FirstNotEmpty(scriptTitle.Title, jsonLdTitle, pageTitle),
            ArtistName: FirstNotEmpty(scriptTitle.ArtistName, jsonLdArtist),
            LyricsWithChords: lyrics,
            YoutubeUrl: ExtractYouTubeUrl(html),
            ImageUrl: ExtractTab4UImageUrl(html));
    }

    private static Tab4USearchResult? ExtractBestTab4USearchResult(string html, string title, string? artistName)
    {
        var targetTitle = NormalizeSearchText(title);
        var targetArtist = NormalizeSearchText(artistName ?? string.Empty);

        var matches = Regex.Matches(
                html,
                @"<a\b(?<attrs>[^>]*\bhref=[""'](?<href>[^""']*tabs/songs/[^""']+\.html)[""'][^>]*)>(?<inner>.*?)</a>",
                RegexOptions.IgnoreCase | RegexOptions.Singleline)
            .Cast<Match>()
            .Select(match =>
            {
                var inner = match.Groups["inner"].Value;
                var songName = ExtractClassText(inner, "sNameI19");
                var artist = ExtractClassText(inner, "aNameI19");
                var score = ScoreTab4USearchResult(songName, artist, targetTitle, targetArtist);

                return new
                {
                    Href = WebUtility.HtmlDecode(match.Groups["href"].Value),
                    ImageUrl = ExtractCssBackgroundImage(inner),
                    Score = score
                };
            })
            .Where(result => result.Score > 0)
            .OrderByDescending(result => result.Score)
            .ToList();

        var best = matches.FirstOrDefault();
        return best is null
            ? null
            : new Tab4USearchResult(best.Href, NormalizeExternalUrl(best.ImageUrl, "https://www.tab4u.com/"));
    }

    private static int ScoreTab4USearchResult(string? songName, string? artistName, string targetTitle, string targetArtist)
    {
        var candidateTitle = NormalizeSearchText(songName ?? string.Empty);
        var candidateArtist = NormalizeSearchText(artistName ?? string.Empty);
        var score = 0;

        if (!string.IsNullOrWhiteSpace(targetTitle) && candidateTitle == targetTitle)
        {
            score += 60;
        }
        else if (!string.IsNullOrWhiteSpace(targetTitle) &&
                 (candidateTitle.Contains(targetTitle, StringComparison.Ordinal) ||
                  targetTitle.Contains(candidateTitle, StringComparison.Ordinal)))
        {
            score += 30;
        }

        if (!string.IsNullOrWhiteSpace(targetArtist) && candidateArtist == targetArtist)
        {
            score += 40;
        }
        else if (!string.IsNullOrWhiteSpace(targetArtist) &&
                 (candidateArtist.Contains(targetArtist, StringComparison.Ordinal) ||
                  targetArtist.Contains(candidateArtist, StringComparison.Ordinal)))
        {
            score += 20;
        }

        return score;
    }

    private static string? ExtractClassText(string html, string className)
    {
        var pattern = $@"<[^>]*\bclass=[""'][^""']*\b{Regex.Escape(className)}\b[^""']*[""'][^>]*>(?<text>.*?)</[^>]+>";
        var match = Regex.Match(html, pattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);
        return match.Success ? CleanSearchResultText(HtmlToText(match.Groups["text"].Value)) : null;
    }

    private static string CleanSearchResultText(string value) =>
        Regex.Replace(WebUtility.HtmlDecode(value), @"\s*/\s*$", string.Empty).Trim();

    private static string NormalizeSearchText(string value)
    {
        var clean = CleanSearchResultText(value);
        clean = Regex.Replace(clean, @"[^\u0590-\u05FFA-Za-z0-9]+", " ");
        return Regex.Replace(clean, @"\s+", " ").Trim().ToLowerInvariant();
    }

    private static ImportedSongParts ExtractNagnuParts(Uri uri, string html)
    {
        var urlParts = ExtractNagnuUrlParts(uri);
        var pageTitle = ExtractSongNameFromPageTitle(ExtractMeta(html, "og:title") ?? ExtractTitleTag(html));
        var artistFromTitle = ExtractArtistFromPageTitle(ExtractMeta(html, "og:title") ?? ExtractTitleTag(html));
        var serializedContent = ExtractJsonStringField(html, "content");
        var serializedLyrics = !string.IsNullOrWhiteSpace(serializedContent)
            ? HtmlChordBlockToText(serializedContent)
            : null;
        var lyrics = !string.IsNullOrWhiteSpace(serializedLyrics) && ScoreLyricsBlock(serializedLyrics) > 10
            ? serializedLyrics
            : ExtractNagnuLyricsFromPageText(html);

        return new ImportedSongParts(
            Title: FirstNotEmpty(urlParts.Title, pageTitle),
            ArtistName: FirstNotEmpty(urlParts.ArtistName, artistFromTitle),
            LyricsWithChords: lyrics,
            YoutubeUrl: ExtractNagnuYouTubeUrl(html),
            ImageUrl: ExtractMeta(html, "og:image") ?? ExtractMeta(html, "twitter:image"));
    }

    private static ImportedSongParts ExtractNagnuReaderParts(Uri uri, string text)
    {
        var urlParts = ExtractNagnuUrlParts(uri);
        var pageTitle = ExtractSongNameFromPageTitle(ExtractTitleFromReaderText(text));
        var lyrics = ExtractNagnuLyricsFromReaderText(text);

        return new ImportedSongParts(
            Title: FirstNotEmpty(urlParts.Title, pageTitle),
            ArtistName: urlParts.ArtistName,
            LyricsWithChords: lyrics,
            YoutubeUrl: ExtractYouTubeUrl(text),
            ImageUrl: ExtractMeta(text, "og:image") ?? ExtractMeta(text, "twitter:image"));
    }

    private static bool IsNagnuLockedPreview(string html) =>
        html.Contains("רוצים לראות את השאר", StringComparison.OrdinalIgnoreCase) ||
        html.Contains("הצטרפו לקהילה", StringComparison.OrdinalIgnoreCase) ||
        html.Contains("קבלו גישה לכל הגרסאות", StringComparison.OrdinalIgnoreCase);

    private static ImportedSongParts ExtractNeginaParts(Uri uri, string html)
    {
        var urlParts = ExtractNeginaUrlParts(uri);
        var lyrics = IsBlockedByProtection(html)
            ? null
            : ExtractNeginaLyricsWithChords(html) ?? ExtractLyricsWithChords(html);

        return new ImportedSongParts(
            Title: urlParts.Title,
            ArtistName: urlParts.ArtistName,
            LyricsWithChords: lyrics,
            YoutubeUrl: ExtractYouTubeUrl(html),
            ImageUrl: ExtractMeta(html, "og:image") ?? ExtractMeta(html, "twitter:image"));
    }

    private static string? ExtractOpenGraphSongTitle(string html) =>
        ExtractSongNameFromPageTitle(
            ExtractMeta(html, "og:title")
            ?? ExtractMeta(html, "twitter:title")
            ?? ExtractTitleTag(html));

    private static string? ExtractTitleFromReaderText(string text)
    {
        var match = Regex.Match(text, @"^Title:\s*(?<title>.+)$", RegexOptions.IgnoreCase | RegexOptions.Multiline);
        return match.Success ? WebUtility.HtmlDecode(match.Groups["title"].Value).Trim() : null;
    }

    private static (string? ArtistName, string? Title) ExtractNagnuUrlParts(Uri uri)
    {
        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Select(DecodeUrlSegment)
            .ToArray();

        var artistIndex = Array.FindIndex(segments, segment => segment == "אומנים");
        if (artistIndex >= 0 && segments.Length > artistIndex + 2)
        {
            return (segments[artistIndex + 1], segments[artistIndex + 2]);
        }

        if (segments.Length >= 3)
        {
            return (segments[^3], segments[^2]);
        }

        return (null, null);
    }

    private static (string? ArtistName, string? Title) ExtractNeginaUrlParts(Uri uri)
    {
        var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries)
            .Select(DecodeUrlSegment)
            .ToArray();

        var chordIndex = Array.FindIndex(segments, segment => segment.Equals("chords", StringComparison.OrdinalIgnoreCase));
        if (chordIndex >= 0 && segments.Length > chordIndex + 2)
        {
            return (segments[chordIndex + 1], segments[chordIndex + 2]);
        }

        return (null, null);
    }

    private async Task<ImportedSongParts> ImportTab4UFallbackAsync(string title, string? artistName)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return new ImportedSongParts();
        }

        var searchResult = await FindTab4USearchResultAsync(title, artistName);
        if (searchResult is null || string.IsNullOrWhiteSpace(searchResult.Href))
        {
            return new ImportedSongParts();
        }

        var songUri = new Uri(new Uri("https://www.tab4u.com/"), searchResult.Href);
        var songHtml = await FetchHtmlAsync(songUri);
        if (string.IsNullOrWhiteSpace(songHtml))
        {
            return new ImportedSongParts(ImageUrl: searchResult.ImageUrl);
        }

        var songParts = ExtractTab4UParts(songHtml);
        return songParts with { ImageUrl = FirstUsefulImageUrl(songParts.ImageUrl, searchResult.ImageUrl) };
    }

    private async Task<Tab4USearchResult?> FindTab4USearchResultAsync(string title, string? artistName)
    {
        var queries = new[]
            {
                string.Join(" ", new[] { title, artistName }.Where(value => !string.IsNullOrWhiteSpace(value))),
                title
            }
            .Where(query => !string.IsNullOrWhiteSpace(query))
            .Distinct(StringComparer.OrdinalIgnoreCase);

        foreach (var query in queries)
        {
            var searchUri = new Uri($"https://www.tab4u.com/resultsSimple?tab=songs&q={Uri.EscapeDataString(query)}");
            var searchHtml = await FetchHtmlAsync(searchUri);
            if (string.IsNullOrWhiteSpace(searchHtml))
            {
                continue;
            }

            var searchResult = ExtractBestTab4USearchResult(searchHtml, title, artistName);
            if (searchResult is not null)
            {
                return searchResult;
            }
        }

        return null;
    }

    private static string? ExtractNeginaLyricsWithChords(string html)
    {
        var fields = new[]
        {
            "content",
            "lyrics",
            "lyricsWithChords",
            "lyricsAndChords",
            "songText",
            "songContent",
            "chords",
            "body",
            "bodyHtml",
            "text"
        };

        var jsonCandidates = fields.SelectMany(field => ExtractJsonStringFields(html, field));

        var htmlCandidates = Regex.Matches(
                html,
                @"<(?<tag>div|section|article|main|pre)\b[^>]*(?:class|id)=[""'][^""']*(?:lyrics|chords|song|content|post|entry)[^""']*[""'][^>]*>(?<text>.*?)</\k<tag>>",
                RegexOptions.IgnoreCase | RegexOptions.Singleline)
            .Select(match => match.Groups["text"].Value);

        var candidates = htmlCandidates
            .Concat(jsonCandidates)
            .Append(html)
            .Select(value => value.Contains('<') ? HtmlChordBlockToText(value) : DecodeHtmlEntitiesPreservingSpaces(value))
            .Select(ConvertNeginaLyricsText)
            .Where(text => !string.IsNullOrWhiteSpace(text) && ScoreLyricsBlock(text!) > 20)
            .OrderByDescending(text => ScoreLyricsBlock(text!))
            .ToList();

        return candidates.Count == 0 ? null : CleanLyrics(candidates[0]!);
    }

    private static string? ConvertNeginaLyricsText(string text)
    {
        text = Regex.Replace(text, @"[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]", "");

        var marker = text.IndexOf("מילים ואקורדים", StringComparison.Ordinal);
        if (marker >= 0)
        {
            text = text[(marker + "מילים ואקורדים".Length)..];
        }

        var stopMarkers = new[]
        {
            "קאפו ",
            "מילים:",
            "לחן:",
            "כל הזכויות",
            "הדרכה בסרטון",
            "האקורדים שמופיעים",
            "פריטות וליווים",
            "תגובות"
        };

        foreach (var stopMarker in stopMarkers)
        {
            var stop = text.IndexOf(stopMarker, StringComparison.Ordinal);
            if (stop > 20)
            {
                text = text[..stop];
            }
        }

        var lines = text.Replace("\r\n", "\n").Replace('\r', '\n')
            .Split('\n')
            .Select(CleanNeginaLine)
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .Where(line => !IsNeginaUiLine(line))
            .Take(420)
            .ToList();

        if (lines.Count == 0)
        {
            return null;
        }

        var preservedLinePairs = TryPreserveNeginaLinePairs(lines);
        if (!string.IsNullOrWhiteSpace(preservedLinePairs) && ScoreLyricsBlock(preservedLinePairs) > 20)
        {
            return preservedLinePairs;
        }

        var output = new List<string>();
        var lyricLine = new StringBuilder();
        var chordPlacements = new List<(int Index, string Chord)>();
        var chordProgression = new List<string>();
        var pendingChords = new List<string>();

        void FlushLyricLine()
        {
            if (lyricLine.Length == 0)
            {
                return;
            }

            var lyric = lyricLine.ToString().TrimEnd();
            var chordLine = BuildAlignedChordLine(chordPlacements, lyric.Length);
            if (!string.IsNullOrWhiteSpace(chordLine))
            {
                output.Add(chordLine);
            }

            output.Add(lyric.TrimStart());
            lyricLine.Clear();
            chordPlacements.Clear();
        }

        void FlushProgression()
        {
            if (chordProgression.Count == 0)
            {
                return;
            }

            output.Add(string.Join(" ", chordProgression));
            chordProgression.Clear();
        }

        void FlushPendingChordsAsProgression()
        {
            if (pendingChords.Count == 0)
            {
                return;
            }

            chordProgression.AddRange(pendingChords);
            pendingChords.Clear();
        }

        void AppendLyricsFragment(string fragment)
        {
            if (pendingChords.Count > 0)
            {
                if (lyricLine.Length > 0 && ShouldSeparateNeginaFragments(lyricLine, fragment))
                {
                    lyricLine.Append(' ');
                }

                foreach (var chord in pendingChords)
                {
                    chordPlacements.Add((lyricLine.Length, chord));
                }

                pendingChords.Clear();
            }
            else if (lyricLine.Length > 0 && ShouldSeparateNeginaFragments(lyricLine, fragment))
            {
                lyricLine.Append(' ');
            }

            lyricLine.Append(fragment);
        }

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var next = i + 1 < lines.Count ? lines[i + 1] : null;

            if (IsNeginaSectionHeading(line))
            {
                FlushLyricLine();
                FlushPendingChordsAsProgression();
                FlushProgression();
                output.Add($"{line}:");
                continue;
            }

            if (line == "*")
            {
                FlushLyricLine();
                FlushPendingChordsAsProgression();
                FlushProgression();
                continue;
            }

            if (IsNeginaProgressionToken(line))
            {
                var chordLine = NormalizeChordLine(line);
                var nextIsLyrics = next is not null &&
                    !IsNeginaProgressionToken(next) &&
                    next != "*" &&
                    !IsNeginaSectionHeading(next) &&
                    ContainsHebrew(next);

                if (IsChordOnlyLine(line) && nextIsLyrics)
                {
                    pendingChords.Add(chordLine);
                }
                else
                {
                    FlushPendingChordsAsProgression();
                    chordProgression.Add(chordLine);
                }

                continue;
            }

            FlushProgression();
            AppendLyricsFragment(CleanNeginaLyricsFragment(line));

            if (next is null || !IsNeginaProgressionToken(next))
            {
                FlushLyricLine();
            }
        }

        FlushLyricLine();
        FlushPendingChordsAsProgression();
        FlushProgression();

        var result = string.Join(Environment.NewLine, output.Where(IsUsefulLyricsLine));
        return ScoreLyricsBlock(result) > 20 ? result : null;
    }

    private static string? TryPreserveNeginaLinePairs(IReadOnlyList<string> lines)
    {
        var output = new List<string>();
        var progressionChords = new List<string>();
        var pairs = new List<(string? Chord, string Lyric)>();
        var pairedLyricsCount = 0;

        void FlushBlock()
        {
            if (pairs.Count == 0)
            {
                if (progressionChords.Count > 0)
                {
                    output.Add(string.Join(" ", progressionChords));
                    progressionChords.Clear();
                }

                return;
            }

            if (progressionChords.Count > 0)
            {
                output.Add(string.Join(" ", progressionChords));
                progressionChords.Clear();
            }

            var current = new List<(string? Chord, string Lyric)>();
            var chordedCount = 0;

            void FlushCurrent()
            {
                if (current.Count == 0)
                {
                    return;
                }

                var chordLine = string.Join(" ", current
                    .Select(item => item.Chord)
                    .Where(chord => !string.IsNullOrWhiteSpace(chord)));
                var lyricLine = JoinNeginaLyricsFragments(current.Select(item => item.Lyric));

                if (!string.IsNullOrWhiteSpace(chordLine))
                {
                    output.Add(chordLine);
                }

                if (!string.IsNullOrWhiteSpace(lyricLine))
                {
                    output.Add(lyricLine);
                }

                current.Clear();
                chordedCount = 0;
            }

            foreach (var pair in pairs)
            {
                var hasChord = !string.IsNullOrWhiteSpace(pair.Chord);
                if (hasChord && chordedCount >= 2)
                {
                    FlushCurrent();
                }

                current.Add(pair);
                if (hasChord)
                {
                    chordedCount++;
                }
            }

            FlushCurrent();
            pairs.Clear();
        }

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var next = i + 1 < lines.Count ? lines[i + 1] : null;

            if (line == "*")
            {
                FlushBlock();
                continue;
            }

            if (IsNeginaSectionHeading(line))
            {
                FlushBlock();
                output.Add($"{line}:");
                continue;
            }

            if (IsNeginaProgressionToken(line))
            {
                var chordLine = NormalizeChordLine(line);
                var nextIsLyrics = next is not null &&
                    next != "*" &&
                    !IsNeginaProgressionToken(next) &&
                    !IsNeginaSectionHeading(next) &&
                    ContainsHebrew(next);

                if (nextIsLyrics)
                {
                    pairs.Add((chordLine, CleanNeginaLyricsFragment(next!)));
                    pairedLyricsCount++;
                    i++;
                }
                else
                {
                    progressionChords.Add(chordLine);
                }

                continue;
            }

            if (ContainsHebrew(line))
            {
                pairs.Add((null, CleanNeginaLyricsFragment(line)));
            }
        }

        FlushBlock();

        return pairedLyricsCount >= 2
            ? string.Join(Environment.NewLine, output.Where(IsUsefulLyricsLine))
            : null;
    }

    private static string JoinNeginaLyricsFragments(IEnumerable<string> fragments)
    {
        var result = new StringBuilder();
        foreach (var raw in fragments)
        {
            var fragment = raw.Trim();
            if (fragment.Length == 0)
            {
                continue;
            }

            if (result.Length > 0 && ShouldSeparateNeginaFragments(result, fragment))
            {
                result.Append(' ');
            }

            result.Append(fragment);
        }

        return result.ToString();
    }

    private static string CleanNeginaLine(string line)
    {
        var clean = DecodeHtmlEntitiesPreservingSpaces(line);
        clean = clean.Replace('\u00A0', ' ');
        clean = Regex.Replace(clean, @"^\s*#{1,6}\s*", "");
        clean = Regex.Replace(clean, @"!\[[^\]]*\]\([^)]+\)", "");
        clean = Regex.Replace(clean, @"\[(?<text>[^\]]+)\]\([^)]+\)", "${text}");
        clean = Regex.Replace(clean, @"[ \t]+", " ").Trim();
        clean = clean.Trim('`', '*', '_');
        return clean;
    }

    private static string CleanNeginaLyricsFragment(string line) =>
        Regex.Replace(line.Replace("*", ""), @"[ \t]+", " ").Trim();

    private static bool IsNeginaUiLine(string line) =>
        Regex.IsMatch(line, @"^(הדפסה|הוספה למועדפים|מצב לילה|שינוי טון|גודל פונט|גירסה קלה|הסתר|הגדרות|לחצ/י|הצג עוד|Image:|Button:)", RegexOptions.IgnoreCase);

    private static bool IsNeginaSectionHeading(string line)
    {
        if (line.Length > 24 || ContainsChord(line))
        {
            return false;
        }

        return line is "פתיחה" or "בית" or "פזמון" or "מעבר" or "סיום" or "גשר" or "עלייה" or "סולו";
    }

    private static bool IsChordOnlyLine(string line)
    {
        var normalized = NormalizeChordLine(line);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return false;
        }

        var tokens = normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return tokens.Length > 0 && tokens.All(token => Regex.IsMatch(token, @"^[A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:/[A-G](?:#|b)?)?$", RegexOptions.IgnoreCase));
    }

    private static bool IsNeginaProgressionToken(string line) =>
        IsChordOnlyLine(line) || NormalizeChordLine(line) == "→";

    private static string NormalizeChordLine(string line) =>
        Regex.Replace(line.Replace("*", " "), @"\s+", " ").Trim();

    private static string BuildAlignedChordLine(IReadOnlyCollection<(int Index, string Chord)> placements, int lyricLength)
    {
        if (placements.Count == 0)
        {
            return string.Empty;
        }

        var ordered = placements
            .Where(placement => !string.IsNullOrWhiteSpace(placement.Chord))
            .OrderBy(placement => placement.Index)
            .ToList();

        if (ordered.Count == 0)
        {
            return string.Empty;
        }

        var line = new StringBuilder(new string(' ', Math.Max(lyricLength, ordered.Max(p => p.Index) + 1)));

        foreach (var placement in ordered)
        {
            var index = Math.Max(0, placement.Index);
            while (line.Length < index + placement.Chord.Length)
            {
                line.Append(' ');
            }

            while (index < line.Length && line[index] != ' ')
            {
                index++;
            }

            while (line.Length < index + placement.Chord.Length)
            {
                line.Append(' ');
            }

            for (var i = 0; i < placement.Chord.Length; i++)
            {
                line[index + i] = placement.Chord[i];
            }
        }

        return line.ToString().TrimEnd();
    }

    private static bool ShouldSeparateNeginaFragments(StringBuilder current, string fragment)
    {
        if (current.Length == 0 || string.IsNullOrWhiteSpace(fragment))
        {
            return false;
        }

        var last = current[current.Length - 1];
        var first = fragment[0];
        if (IsLikelyHebrewWordContinuation(current, fragment))
        {
            return false;
        }

        return !char.IsWhiteSpace(last) &&
            last != '-' &&
            last != '־' &&
            !char.IsPunctuation(first);
    }

    private static bool IsLikelyHebrewWordContinuation(StringBuilder current, string fragment)
    {
        var previous = GetTrailingHebrewLetters(current.ToString());
        var next = GetLeadingHebrewLetters(fragment);
        if (previous.Length == 0 || next.Length == 0)
        {
            return false;
        }

        return previous.Length <= 2 || next.Length <= 2;
    }

    private static string GetTrailingHebrewLetters(string value)
    {
        var match = Regex.Match(value, @"[\u0590-\u05FF]+$");
        return match.Success ? match.Value : string.Empty;
    }

    private static string GetLeadingHebrewLetters(string value)
    {
        var match = Regex.Match(value, @"^[\u0590-\u05FF]+");
        return match.Success ? match.Value : string.Empty;
    }

    private static string? ExtractNagnuLyricsFromPageText(string html)
    {
        var text = HtmlChordBlockToText(html);
        var marker = "האקורדים הודפסו";
        var start = text.IndexOf(marker, StringComparison.Ordinal);
        if (start >= 0)
        {
            text = text[(start + marker.Length)..];
        }

        var stopMarkers = new[]
        {
            "איך השיר לדעתך",
            "דיווח",
            "אולי תאהבו",
            "האקורדים לשיר",
            "תגובות לשיר"
        };

        foreach (var stopMarker in stopMarkers)
        {
            var stop = text.IndexOf(stopMarker, StringComparison.Ordinal);
            if (stop > 0)
            {
                text = text[..stop];
            }
        }

        var skipWords = new[]
        {
            "נגן האקורדים",
            "גודל גופן",
            "שינוי טון",
            "הצג אקורדים",
            "השאר מסך דולק",
            "www.Nagnu.co.il"
        };

        var lines = text.Split('\n')
            .Select(line => line.Trim())
            .Where(line => line.Length > 0)
            .Where(line => !skipWords.Any(skip => line.Contains(skip, StringComparison.OrdinalIgnoreCase)))
            .Where(IsUsefulLyricsLine)
            .Take(260)
            .ToList();

        return lines.Count == 0 ? null : string.Join(Environment.NewLine, lines);
    }

    private static string? ExtractNagnuLyricsFromReaderText(string text)
    {
        text = DecodeHtmlEntitiesPreservingSpaces(text);
        var marker = "האקורדים הודפסו";
        var start = text.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (start >= 0)
        {
            text = text[(start + marker.Length)..];
        }

        var stopMarkers = new[]
        {
            "רוצים לראות את השאר",
            "איך השיר לדעתך",
            "אולי תאהבו גם",
            "0 תגובות לשיר"
        };

        foreach (var stopMarker in stopMarkers)
        {
            var stop = text.IndexOf(stopMarker, StringComparison.OrdinalIgnoreCase);
            if (stop > 0)
            {
                text = text[..stop];
            }
        }

        var output = new List<string>();
        foreach (var rawLine in text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n'))
        {
            var line = CleanNagnuReaderLine(rawLine);
            if (string.IsNullOrWhiteSpace(line) || IsNagnuReaderUiLine(line))
            {
                continue;
            }

            var converted = ConvertNagnuReaderChordLine(line);
            if (!string.IsNullOrWhiteSpace(converted))
            {
                output.Add(converted);
            }
            else if (IsUsefulLyricsLine(line))
            {
                output.Add(line);
            }
        }

        var result = string.Join(Environment.NewLine, output).Trim();
        return ScoreLyricsBlock(result) > 10 ? result : null;
    }

    private static string CleanNagnuReaderLine(string line)
    {
        var clean = Regex.Replace(line, @"!\[[^\]]*\]\([^)]+\)", "");
        clean = Regex.Replace(clean, @"\[(?<text>[^\]]*)\]\([^)]+\)", "${text}");
        clean = Regex.Replace(clean, @"^\s*#{1,6}\s*", "");
        clean = Regex.Replace(clean, @"[ \t]+", " ").Trim();
        return clean.Trim('`', '*', '_');
    }

    private static bool IsNagnuReaderUiLine(string line) =>
        line.Contains("www.Nagnu.co.il", StringComparison.OrdinalIgnoreCase) ||
        line.Contains("הסר פרסומות", StringComparison.OrdinalIgnoreCase) ||
        line.Contains("הצג אקורדים", StringComparison.OrdinalIgnoreCase) ||
        line.Contains("השאר מסך דולק", StringComparison.OrdinalIgnoreCase) ||
        line.Contains("שינוי טון", StringComparison.OrdinalIgnoreCase) ||
        line.Contains("גודל גופן", StringComparison.OrdinalIgnoreCase) ||
        line.Contains("שינויים שבוצעו", StringComparison.OrdinalIgnoreCase) ||
        line.Contains("מציאת גרסה קלה", StringComparison.OrdinalIgnoreCase) ||
        Regex.IsMatch(line, @"^-?\d+(?:\.\d+)?\s+[A-G](?:#|b)?$");

    private static string? ConvertNagnuReaderChordLine(string line)
    {
        var tokens = line.Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();
        if (tokens.Count < 2)
        {
            return null;
        }

        var chords = new List<string>();
        var lyrics = new List<string>();
        var lyricsStarted = false;

        foreach (var rawToken in tokens)
        {
            var token = rawToken.Trim('|', ',', ';');
            if (!lyricsStarted && IsChordOnlyLine(token))
            {
                chords.Add(token);
                continue;
            }

            if (ContainsHebrew(token))
            {
                lyricsStarted = true;
            }

            if (lyricsStarted)
            {
                lyrics.Add(rawToken.Trim('|'));
            }
        }

        if (chords.Count == 0 || lyrics.Count == 0)
        {
            return null;
        }

        return string.Join(Environment.NewLine, new[]
        {
            string.Join(" ", chords),
            string.Join(" ", lyrics).Trim()
        });
    }

    private static string? ExtractJsonLdSongTitle(string html)
    {
        foreach (Match match in Regex.Matches(html, @"""name""\s*:\s*""(?<value>[^""]+)""", RegexOptions.IgnoreCase))
        {
            var title = ExtractSongNameFromPageTitle(DecodeJsonString(match.Groups["value"].Value));
            if (!string.IsNullOrWhiteSpace(title))
            {
                return title;
            }
        }

        return null;
    }

    private static string? ExtractJsonLdArtist(string html)
    {
        var block = Regex.Match(html, @"""byArtist""\s*:\s*\{(?<block>.*?)\}", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        if (!block.Success)
        {
            return null;
        }

        var name = Regex.Match(block.Groups["block"].Value, @"""name""\s*:\s*""(?<value>[^""]+)""", RegexOptions.IgnoreCase);
        return name.Success ? CleanPersonName(DecodeJsonString(name.Groups["value"].Value)) : null;
    }

    private static string? ExtractJsonStringField(string html, string fieldName)
    {
        return ExtractJsonStringFields(html, fieldName).FirstOrDefault();
    }

    private static IEnumerable<string> ExtractJsonStringFields(string html, string fieldName)
    {
        var pattern = $@"""{Regex.Escape(fieldName)}""\s*:\s*""(?<value>(?:\\.|[^""\\])*)""";
        return Regex.Matches(html, pattern, RegexOptions.IgnoreCase | RegexOptions.Singleline)
            .Cast<Match>()
            .Select(match => DecodeJsonString(match.Groups["value"].Value))
            .Where(value => !string.IsNullOrWhiteSpace(value));
    }

    private static string? ExtractJsString(string html, string variableName)
    {
        var pattern = $@"\bvar\s+{Regex.Escape(variableName)}\s*=\s*[""'](?<value>.*?)[""']\s*;";
        var match = Regex.Match(html, pattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);
        return match.Success ? WebUtility.HtmlDecode(match.Groups["value"].Value).Trim() : null;
    }

    private static string? ExtractElementById(string html, string id)
    {
        var pattern = $@"<(?<tag>[a-z0-9]+)\b[^>]*\bid=[""']{Regex.Escape(id)}[""'][^>]*>(?<text>.*?)</\k<tag>>";
        var match = Regex.Match(html, pattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);
        if (!match.Success)
        {
            return null;
        }

        var text = HtmlToText(match.Groups["text"].Value);
        return ScoreLyricsBlock(text) > 10 ? text : null;
    }

    private static string? ExtractPreservedElementById(string html, string id)
    {
        var pattern = $@"<(?<tag>[a-z0-9]+)\b[^>]*\bid=[""']{Regex.Escape(id)}[""'][^>]*>(?<text>.*?)</\k<tag>>";
        var match = Regex.Match(html, pattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);
        if (!match.Success)
        {
            return null;
        }

        var text = HtmlChordBlockToText(match.Groups["text"].Value);
        return ScoreLyricsBlock(text) > 10 ? text : null;
    }

    private static string? ExtractSongNameFromPageTitle(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var clean = WebUtility.HtmlDecode(value);
        clean = clean.Split('|', StringSplitOptions.RemoveEmptyEntries)[0].Trim();

        var match = Regex.Match(clean, @"(?:אקורדים|מילים)\s+לשיר\s+(?<title>.*?)(?:\s+-\s+.+)?$", RegexOptions.IgnoreCase);
        if (match.Success)
        {
            return CleanTitle(match.Groups["title"].Value);
        }

        var parts = clean.Split(" - ", StringSplitOptions.RemoveEmptyEntries);
        return parts.Length > 0 ? CleanTitle(parts[0]) : CleanTitle(clean);
    }

    private static string? ExtractArtistFromPageTitle(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var clean = WebUtility.HtmlDecode(value).Split('|', StringSplitOptions.RemoveEmptyEntries)[0].Trim();
        var parts = clean.Split(" - ", StringSplitOptions.RemoveEmptyEntries);
        return parts.Length >= 2 ? CleanPersonName(parts[^1]) : null;
    }

    private static (string? ArtistName, string? Title) ParseArtistAndSong(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return (null, null);
        }

        var parts = WebUtility.HtmlDecode(value).Split(" - ", StringSplitOptions.RemoveEmptyEntries);
        return parts.Length >= 2
            ? (CleanPersonName(parts[0]), CleanTitle(parts[1]))
            : (null, CleanTitle(value));
    }

    private static string? ExtractYouTubeUrlFromId(string? youtubeId)
    {
        if (string.IsNullOrWhiteSpace(youtubeId))
        {
            return null;
        }

        var match = Regex.Match(youtubeId, @"[a-zA-Z0-9_-]{11}");
        return match.Success ? $"https://www.youtube.com/watch?v={match.Value}" : null;
    }

    private static string? FirstNotEmpty(params string?[] values) =>
        values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

    private static string DecodeJsonString(string value)
    {
        try
        {
            return JsonSerializer.Deserialize<string>($"\"{value}\"") ?? value;
        }
        catch (JsonException)
        {
            return WebUtility.HtmlDecode(Regex.Unescape(value));
        }
    }

    private static string DecodeUrlSegment(string value)
    {
        var decoded = WebUtility.UrlDecode(value);
        return Regex.Replace(decoded.Replace('_', ' ').Replace('-', ' '), @"\s+", " ").Trim();
    }

    private static bool IsBlockedByProtection(string html) =>
        html.Contains("Just a moment", StringComparison.OrdinalIgnoreCase) ||
        html.Contains("One moment", StringComparison.OrdinalIgnoreCase) ||
        html.Contains("cf_chl", StringComparison.OrdinalIgnoreCase) ||
        html.Contains("request is being verified", StringComparison.OrdinalIgnoreCase) ||
        html.Contains("Enable JavaScript and cookies", StringComparison.OrdinalIgnoreCase);

    private static string? ExtractTitleTag(string html) =>
        ExtractTagText(html, "title");

    private static string? ExtractTagText(string html, string tag)
    {
        var match = Regex.Match(html, $@"<{tag}\b[^>]*>(?<text>.*?)</{tag}>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        return match.Success ? HtmlToText(match.Groups["text"].Value) : null;
    }

    private static string? ExtractMeta(string html, string name)
    {
        var escaped = Regex.Escape(name);
        var patterns = new[]
        {
            $@"<meta\b[^>]*(?:property|name)=[""']{escaped}[""'][^>]*content=[""'](?<content>.*?)[""'][^>]*>",
            $@"<meta\b[^>]*content=[""'](?<content>.*?)[""'][^>]*(?:property|name)=[""']{escaped}[""'][^>]*>"
        };

        foreach (var pattern in patterns)
        {
            var match = Regex.Match(html, pattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);
            if (match.Success)
            {
                return WebUtility.HtmlDecode(match.Groups["content"].Value).Trim();
            }
        }

        return null;
    }

    private static string? ExtractTab4UImageUrl(string html)
    {
        var metaImage = FirstUsefulImageUrl(
            ExtractMeta(html, "og:image"),
            ExtractMeta(html, "twitter:image"));

        if (IsUsefulImportedImageUrl(metaImage))
        {
            return NormalizeExternalUrl(metaImage, "https://www.tab4u.com/");
        }

        var backgroundImage = Regex.Matches(
                html,
                @"background-image\s*:\s*url\((?<quote>[""']?)(?<url>.*?)(\k<quote>)\)",
                RegexOptions.IgnoreCase | RegexOptions.Singleline)
            .Cast<Match>()
            .Select(match => NormalizeExternalUrl(WebUtility.HtmlDecode(match.Groups["url"].Value.Trim()), "https://www.tab4u.com/"))
            .FirstOrDefault(IsUsefulImportedImageUrl);

        if (IsUsefulImportedImageUrl(backgroundImage))
        {
            return backgroundImage;
        }

        var photoInput = Regex.Match(
            html,
            @"<input\b[^>]*(?:name|id)=[""']ph[""'][^>]*(?:id|value)=[""'](?<file>[^""']+\.(?:jpg|jpeg|png|webp))[""'][^>]*>",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        if (photoInput.Success)
        {
            var candidate = NormalizeExternalUrl($"/additions/artists_imgs/{photoInput.Groups["file"].Value}", "https://www.tab4u.com/");
            if (IsUsefulImportedImageUrl(candidate))
            {
                return candidate;
            }
        }

        return null;
    }

    private static string? ExtractCssBackgroundImage(string html)
    {
        var match = Regex.Match(
            html,
            @"background-image\s*:\s*url\((?<quote>[""']?)(?<url>.*?)(\k<quote>)\)",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        return match.Success
            ? WebUtility.HtmlDecode(match.Groups["url"].Value.Trim())
            : null;
    }

    private static string? FirstUsefulImageUrl(params string?[] values) =>
        values
            .Select(value => NormalizeExternalUrl(value, "https://www.tab4u.com/"))
            .FirstOrDefault(IsUsefulImportedImageUrl);

    private static bool IsUsefulImportedImageUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.StartsWith("data:", StringComparison.Ordinal) ||
            normalized.Contains("noartpic", StringComparison.Ordinal) ||
            normalized.Contains("no-art", StringComparison.Ordinal) ||
            normalized.Contains("placeholder", StringComparison.Ordinal) ||
            normalized.Contains("favicon", StringComparison.Ordinal) ||
            normalized.Contains("logo", StringComparison.Ordinal) ||
            normalized.Contains("cloudflare", StringComparison.Ordinal))
        {
            return false;
        }

        return Regex.IsMatch(normalized, @"\.(jpg|jpeg|png|webp)(?:[?#].*)?$", RegexOptions.IgnoreCase);
    }

    private static string? NormalizeExternalUrl(string? value, string baseUrl)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var clean = WebUtility.HtmlDecode(value).Trim().Trim('"', '\'');
        if (clean.StartsWith("//", StringComparison.Ordinal))
        {
            return "https:" + clean;
        }

        if (Uri.TryCreate(clean, UriKind.Absolute, out var absolute))
        {
            return absolute.ToString();
        }

        return Uri.TryCreate(new Uri(baseUrl), clean, out var relative)
            ? relative.ToString()
            : clean;
    }

    private static string ExtractLyricsWithChords(string html)
    {
        var preBlocks = Regex.Matches(html, @"<pre\b[^>]*>(?<text>.*?)</pre>", RegexOptions.IgnoreCase | RegexOptions.Singleline)
            .Select(match => HtmlChordBlockToText(match.Groups["text"].Value))
            .Where(text => text.Length >= 10)
            .OrderByDescending(ScoreLyricsBlock)
            .ToList();

        if (preBlocks.Count > 0)
        {
            return CleanLyrics(preBlocks[0]);
        }

        var candidateBlocks = Regex.Matches(
                html,
                @"<(?<tag>div|section|article|main)\b[^>]*(?:class|id)=[""'][^""']*(?:lyric|lyrics|chord|chords|song|song-content|words)[^""']*[""'][^>]*>(?<text>.*?)</\k<tag>>",
                RegexOptions.IgnoreCase | RegexOptions.Singleline)
            .Select(match => HtmlChordBlockToText(match.Groups["text"].Value))
            .Where(text => text.Length >= 10)
            .OrderByDescending(ScoreLyricsBlock)
            .ToList();

        if (candidateBlocks.Count > 0)
        {
            return CleanLyrics(candidateBlocks[0]);
        }

        var body = Regex.Match(html, @"<body\b[^>]*>(?<text>.*?)</body>", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        var text = HtmlToText(body.Success ? body.Groups["text"].Value : html);
        var lines = text.Split('\n')
            .Select(line => line.Trim())
            .Where(IsUsefulLyricsLine)
            .Take(220);

        return CleanLyrics(string.Join(Environment.NewLine, lines));
    }

    private static string? ExtractYouTubeUrl(string html)
    {
        var match = Regex.Match(
            html,
            @"(?:https?:)?//(?:www\.)?(?:youtube\.com/(?:watch\?[^""'\s<>]*v=|embed/|v/)|youtu\.be/)(?<id>[a-zA-Z0-9_-]{11})",
            RegexOptions.IgnoreCase);

        return match.Success
            ? $"https://www.youtube.com/watch?v={match.Groups["id"].Value}"
            : null;
    }

    private static string? ExtractNagnuYouTubeUrl(string html) =>
        ExtractYouTubeUrl(html)
        ?? ExtractYouTubeUrlFromId(ExtractJsonStringField(html, "youTubeId"))
        ?? ExtractYouTubeUrlFromId(ExtractAttributeValue(html, "videoid"));

    private static string? ExtractAttributeValue(string html, string attributeName)
    {
        var match = Regex.Match(
            html,
            $@"\b{Regex.Escape(attributeName)}=[""'](?<value>[^""']+)[""']",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        return match.Success ? WebUtility.HtmlDecode(match.Groups["value"].Value).Trim() : null;
    }

    private static string? ExtractYouTubeThumbnailUrl(string? youtubeUrl)
    {
        if (string.IsNullOrWhiteSpace(youtubeUrl))
        {
            return null;
        }

        var match = Regex.Match(
            youtubeUrl,
            @"(?:youtube\.com/(?:watch\?[^#]*?v=|embed/|shorts/)|youtu\.be/)(?<id>[a-zA-Z0-9_-]{11})",
            RegexOptions.IgnoreCase);

        return match.Success
            ? $"https://img.youtube.com/vi/{match.Groups["id"].Value}/hqdefault.jpg"
            : null;
    }

    private static string? ExtractArtistName(string html, string title)
    {
        var artistMeta = ExtractMeta(html, "music:musician")
            ?? ExtractMeta(html, "article:author")
            ?? ExtractMeta(html, "author");

        if (!string.IsNullOrWhiteSpace(artistMeta))
        {
            return CleanPersonName(artistMeta);
        }

        var parts = title.Split(new[] { " - ", " – ", " — ", " | " }, StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length >= 2)
        {
            var first = CleanTitle(parts[0]);
            var second = CleanTitle(parts[1]);
            return first.Length <= second.Length ? first : second;
        }

        return null;
    }

    private static string CleanTitle(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return string.Empty;

        var clean = WebUtility.HtmlDecode(value);
        clean = Regex.Replace(clean, @"\s+", " ").Trim();
        clean = Regex.Replace(clean, @"\s*(אקורדים|מילים|lyrics|chords|official|video)\s*", " ", RegexOptions.IgnoreCase).Trim();
        clean = Regex.Replace(clean, @"\s+", " ").Trim(' ', '-', '|', '–', '—');
        return clean;
    }

    private static string CleanPersonName(string value)
    {
        var clean = CleanTitle(value);
        clean = Regex.Replace(clean, @"\s*-\s*Topic$", string.Empty, RegexOptions.IgnoreCase).Trim();
        return clean;
    }

    private static string HtmlToText(string html)
    {
        var text = Regex.Replace(html, @"<script\b[^>]*>.*?</script>", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        text = Regex.Replace(text, @"<style\b[^>]*>.*?</style>", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        text = Regex.Replace(text, @"<(br|p|div|li|tr|h[1-6])\b[^>]*>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"<[^>]+>", " ");
        text = WebUtility.HtmlDecode(text);
        text = Regex.Replace(text, @"[ \t]+", " ");
        text = Regex.Replace(text, @"\n\s+", "\n");
        text = Regex.Replace(text, @"\n{3,}", "\n\n");
        return text.Trim();
    }

    private static string HtmlChordBlockToText(string html)
    {
        var text = Regex.Replace(html, @"<script\b[^>]*>.*?</script>", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        text = Regex.Replace(text, @"<style\b[^>]*>.*?</style>", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        text = Regex.Replace(text, @"<span\b[^>]*class=[""'][^""']*(?:skeleton|animate-pulse)[^""']*[""'][^>]*>.*?</span>", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        text = Regex.Replace(text, @"<div\b[^>]*class=[""'][^""']*(?:skeleton|animate-pulse)[^""']*[""'][^>]*>.*?</div>", "", RegexOptions.IgnoreCase | RegexOptions.Singleline);
        text = Regex.Replace(text, @"</(?:td|tr|p|div|li|pre|section|article|table)>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"<(?:br|br/|br\s*/)>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, @"<[^>]+>", "");
        text = DecodeHtmlEntitiesPreservingSpaces(text);
        text = Regex.Replace(text, @"[ \t]+\n", "\n");
        text = Regex.Replace(text, @"\n{4,}", "\n\n");
        return text.Trim('\r', '\n', ' ', '\t');
    }

    private static string DecodeHtmlEntitiesPreservingSpaces(string value)
    {
        const string nbspToken = "\uE000";
        var text = value
            .Replace("&nbsp;", nbspToken, StringComparison.OrdinalIgnoreCase)
            .Replace("&#160;", nbspToken, StringComparison.OrdinalIgnoreCase)
            .Replace("&#xa0;", nbspToken, StringComparison.OrdinalIgnoreCase);

        text = WebUtility.HtmlDecode(text);
        text = text.Replace('\u00A0', ' ');
        text = text.Replace(nbspToken, " ");
        text = text.Replace("\r\n", "\n").Replace('\r', '\n');
        text = Regex.Replace(text, @"[\u200E\u200F]", "");
        return text;
    }

    private static string CleanLyrics(string value, bool normalizeImportedChordOnlyLines = false)
    {
        var lines = value.Replace("\r\n", "\n").Replace('\r', '\n')
            .Split('\n')
            .Select(line => line.TrimEnd().TrimStart('\t'))
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .Take(260)
            .ToList();

        var cleanedLines = RemoveCommonLeadingIndent(lines);
        if (normalizeImportedChordOnlyLines)
        {
            cleanedLines = cleanedLines.Select(NormalizeImportedChordOnlyLineOrder);
        }

        return string.Join(Environment.NewLine, cleanedLines).Trim('\r', '\n');
    }

    private static bool ShouldNormalizeImportedChordOnlyLines(Uri sourceUri)
    {
        var host = sourceUri.Host.ToLowerInvariant();
        return !host.Contains("tab4u.com", StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizeImportedChordOnlyLineOrder(string line)
    {
        if (!IsChordOnlyLine(line))
        {
            return line;
        }

        var parts = Regex.Matches(line, @"\s+|\S+")
            .Cast<Match>()
            .Select(match => match.Value)
            .ToList();
        var chords = new Queue<string>(parts
            .Where(part => !string.IsNullOrWhiteSpace(part))
            .Reverse());

        return string.Concat(parts.Select(part => string.IsNullOrWhiteSpace(part) ? part : chords.Dequeue())).TrimEnd();
    }

    private static IEnumerable<string> RemoveCommonLeadingIndent(IReadOnlyCollection<string> lines)
    {
        if (lines.Count == 0)
        {
            return lines;
        }

        var commonIndent = lines
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .Select(LeadingWhitespaceLength)
            .DefaultIfEmpty(0)
            .Min();

        return commonIndent <= 0
            ? lines
            : lines.Select(line => line.Length >= commonIndent ? line[commonIndent..] : line.TrimStart());
    }

    private static int LeadingWhitespaceLength(string value)
    {
        var index = 0;
        while (index < value.Length && char.IsWhiteSpace(value[index]) && value[index] != '\r' && value[index] != '\n')
        {
            index++;
        }

        return index;
    }

    private static bool IsUsefulLyricsLine(string line)
    {
        if (line.Length < 2 || line.Length > 140) return false;
        if (Regex.IsMatch(line, @"(cookie|login|menu|facebook|instagram|newsletter|privacy|terms|הרשמה|כניסה|תפריט)", RegexOptions.IgnoreCase)) return false;
        return ContainsHebrew(line) || ContainsChord(line);
    }

    private static int ScoreLyricsBlock(string text)
    {
        var lines = text.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        var chordLines = lines.Count(ContainsChord);
        var hebrewLines = lines.Count(ContainsHebrew);
        return chordLines * 8 + hebrewLines * 2 + Math.Min(lines.Length, 120);
    }

    private static bool ContainsHebrew(string value) =>
        Regex.IsMatch(value, @"[\u0590-\u05FF]");

    private static bool ContainsChord(string value) =>
        Regex.IsMatch(value, @"(^|\s|\[)([A-G](?:#|b)?(?:m|maj|min|dim|aug|sus|add)?\d*(?:/[A-G](?:#|b)?)?)(\]|\s|$)");

    private static ImportSongFromUrlResponseDto Fail(string sourceUrl, string message, IEnumerable<string> missingFields) =>
        new()
        {
            Success = false,
            Message = message,
            SourceUrl = sourceUrl,
            MissingFields = missingFields.ToList()
        };
}
