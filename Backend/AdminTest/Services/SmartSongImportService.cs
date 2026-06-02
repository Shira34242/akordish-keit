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

        var urlParts = ExtractUrlParts(uri);
        var siteParts = ExtractSiteSpecificParts(uri, html);

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
        var lyricsWithChords = !string.IsNullOrWhiteSpace(siteParts.LyricsWithChords)
            ? CleanLyrics(siteParts.LyricsWithChords)
            : ExtractLyricsWithChords(html);
        var youtubeUrl = siteParts.YoutubeUrl ?? ExtractYouTubeUrl(html);
        var imageUrl = siteParts.ImageUrl ?? ExtractMeta(html, "og:image") ?? ExtractMeta(html, "twitter:image");

        if (uri.Host.Contains("negina.co.il", StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrWhiteSpace(lyricsWithChords))
        {
            var tab4UFallback = await ImportTab4UFallbackAsync(title, artistName);
            if (!string.IsNullOrWhiteSpace(tab4UFallback.LyricsWithChords))
            {
                lyricsWithChords = CleanLyrics(tab4UFallback.LyricsWithChords);
                youtubeUrl ??= tab4UFallback.YoutubeUrl;
                if (!IsUsefulImportedImageUrl(imageUrl) && IsUsefulImportedImageUrl(tab4UFallback.ImageUrl))
                {
                    imageUrl = tab4UFallback.ImageUrl;
                }
            }
        }

        if (string.IsNullOrWhiteSpace(youtubeUrl))
        {
            youtubeUrl = await FindYouTubeFallbackAsync(title, artistName);
        }

        var detectedKey = KeyDetectionService.Detect(lyricsWithChords);
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
            LyricsWithChords = lyricsWithChords,
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
            YoutubeUrl: ExtractYouTubeUrl(html) ?? ExtractYouTubeUrlFromId(ExtractJsonStringField(html, "youTubeId")),
            ImageUrl: ExtractMeta(html, "og:image") ?? ExtractMeta(html, "twitter:image"));
    }

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

        var query = string.Join(" ", new[] { title, artistName }.Where(value => !string.IsNullOrWhiteSpace(value)));
        var searchUri = new Uri($"https://www.tab4u.com/resultsSimple?tab=songs&q={Uri.EscapeDataString(query)}");
        var searchHtml = await FetchHtmlAsync(searchUri);
        if (string.IsNullOrWhiteSpace(searchHtml))
        {
            return new ImportedSongParts();
        }

        var searchResult = ExtractBestTab4USearchResult(searchHtml, title, artistName);
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

    private static string? ExtractNeginaLyricsWithChords(string html)
    {
        var candidates = Regex.Matches(
                html,
                @"<(?<tag>div|section|article|main)\b[^>]*(?:class|id)=[""'][^""']*(?:lyrics|chords|song|content)[^""']*[""'][^>]*>(?<text>.*?)</\k<tag>>",
                RegexOptions.IgnoreCase | RegexOptions.Singleline)
            .Select(match => HtmlChordBlockToText(match.Groups["text"].Value))
            .Append(HtmlChordBlockToText(html))
            .Select(ConvertNeginaLyricsText)
            .Where(text => !string.IsNullOrWhiteSpace(text))
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

        var output = new List<string>();
        var current = new StringBuilder();
        var chordProgression = new List<string>();

        void FlushCurrent()
        {
            if (current.Length == 0)
            {
                return;
            }

            output.Add(current.ToString().Trim());
            current.Clear();
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

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var next = i + 1 < lines.Count ? lines[i + 1] : null;

            if (IsNeginaSectionHeading(line))
            {
                FlushCurrent();
                FlushProgression();
                output.Add($"{line}:");
                continue;
            }

            if (line == "*")
            {
                FlushCurrent();
                FlushProgression();
                continue;
            }

            if (IsChordOnlyLine(line))
            {
                var chordLine = NormalizeChordLine(line);
                if (current.Length == 0)
                {
                    chordProgression.Add(chordLine);
                }
                else
                {
                    current.Append('[').Append(chordLine).Append(']');
                }

                continue;
            }

            FlushProgression();
            current.Append(CleanNeginaLyricsFragment(line));

            if (next is null || !IsChordOnlyLine(next))
            {
                FlushCurrent();
            }
        }

        FlushCurrent();
        FlushProgression();

        var result = string.Join(Environment.NewLine, output.Where(IsUsefulLyricsLine));
        return ScoreLyricsBlock(result) > 20 ? result : null;
    }

    private static string CleanNeginaLine(string line)
    {
        var clean = DecodeHtmlEntitiesPreservingSpaces(line);
        clean = clean.Replace('\u00A0', ' ');
        clean = Regex.Replace(clean, @"[ \t]+", " ").Trim();
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

    private static string NormalizeChordLine(string line) =>
        Regex.Replace(line.Replace("*", " "), @"\s+", " ").Trim();

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
        var pattern = $@"""{Regex.Escape(fieldName)}""\s*:\s*""(?<value>(?:\\.|[^""\\])*)""";
        var match = Regex.Match(html, pattern, RegexOptions.IgnoreCase | RegexOptions.Singleline);
        return match.Success ? DecodeJsonString(match.Groups["value"].Value) : null;
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

    private static string CleanLyrics(string value)
    {
        var lines = value.Replace("\r\n", "\n").Replace('\r', '\n')
            .Split('\n')
            .Select(line => line.TrimEnd().TrimStart('\t'))
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .Take(260)
            .ToList();

        return string.Join(Environment.NewLine, RemoveCommonLeadingIndent(lines)).Trim();
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
