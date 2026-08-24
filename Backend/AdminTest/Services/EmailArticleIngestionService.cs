using System.Net;
using System.Net.Mail;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AkordishKeit.Services;

public sealed class EmailArticleIngestionOptions
{
    public const string SectionName = "EmailArticleIngestion";

    public bool Enabled { get; set; }
    public string AllowedGoogleAccountEmail { get; set; } = string.Empty;
    public List<EmailArticleProducerOptions> Producers { get; set; } = new();
}

public sealed class EmailArticleProducerOptions
{
    public string SenderEmail { get; set; } = string.Empty;
    public string CategoryName { get; set; } = "חדשות";
    public string Template { get; set; } = "irpr-v1";
    public string? AuthorName { get; set; }
}

public interface IEmailArticleIngestionService
{
    bool IsEnabled { get; }
    Task<bool> IsAuthorizedAsync(string? authorizationHeader, CancellationToken cancellationToken);
    Task<EmailArticleIngestionResponseDto> IngestAsync(EmailArticleIngestionRequestDto request);
}

public sealed class EmailArticleIngestionService : IEmailArticleIngestionService
{
    private const long MaxAudioFileSizeBytes = 30 * 1024 * 1024;
    private static readonly HashSet<string> AllowedAudioExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".mp3", ".wav", ".m4a", ".aac", ".ogg" };

    private static readonly Regex YouTubeUrlRegex = new(
        @"https?://(?:www\.)?(?:youtube\.com/(?:watch\?[^\s<>]*v=|embed/|shorts/)|youtu\.be/)[A-Za-z0-9_-]{11}[^\s<>]*",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex GoogleDriveUrlRegex = new(
        @"https?://(?:drive|docs)\.google\.com/[^\s<>]*",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly AkordishKeitDbContext _context;
    private readonly IArticleService _articleService;
    private readonly IAzureBlobService _blobService;
    private readonly IYouTubeService _youTubeService;
    private readonly HttpClient _httpClient;
    private readonly EmailArticleIngestionOptions _options;
    private readonly ILogger<EmailArticleIngestionService> _logger;

    public EmailArticleIngestionService(
        AkordishKeitDbContext context,
        IArticleService articleService,
        IAzureBlobService blobService,
        IYouTubeService youTubeService,
        HttpClient httpClient,
        IOptions<EmailArticleIngestionOptions> options,
        ILogger<EmailArticleIngestionService> logger)
    {
        _context = context;
        _articleService = articleService;
        _blobService = blobService;
        _youTubeService = youTubeService;
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public bool IsEnabled => _options.Enabled;

    public async Task<bool> IsAuthorizedAsync(
        string? authorizationHeader,
        CancellationToken cancellationToken)
    {
        if (!_options.Enabled || string.IsNullOrWhiteSpace(_options.AllowedGoogleAccountEmail))
            return false;

        if (!AuthenticationHeaderValue.TryParse(authorizationHeader, out var authorization)
            || !string.Equals(authorization.Scheme, "Bearer", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(authorization.Parameter))
        {
            return false;
        }

        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                "https://openidconnect.googleapis.com/v1/userinfo");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", authorization.Parameter);

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
                return false;

            await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var profile = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            var root = profile.RootElement;
            var email = root.TryGetProperty("email", out var emailProperty)
                ? emailProperty.GetString()
                : null;
            var emailVerified = root.TryGetProperty("email_verified", out var verifiedProperty)
                && verifiedProperty.ValueKind == JsonValueKind.True;

            return emailVerified
                && string.Equals(
                    email,
                    _options.AllowedGoogleAccountEmail.Trim(),
                    StringComparison.OrdinalIgnoreCase);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            _logger.LogWarning(ex, "Could not validate Google identity for email article ingestion");
            return false;
        }
    }

    public async Task<EmailArticleIngestionResponseDto> IngestAsync(EmailArticleIngestionRequestDto request)
    {
        var senderEmail = ExtractEmailAddress(request.Sender);
        var producer = _options.Producers.FirstOrDefault(p =>
            string.Equals(p.SenderEmail.Trim(), senderEmail, StringComparison.OrdinalIgnoreCase));

        if (producer == null)
        {
            _logger.LogWarning("Email article rejected from unapproved sender: {Sender}", senderEmail);
            throw new UnauthorizedAccessException("Sender is not approved for article ingestion");
        }

        var categoryName = producer.CategoryName.Trim();
        var category = await _context.ArticleCategories
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Name == categoryName || c.DisplayName == categoryName);

        if (category == null)
            throw new InvalidOperationException($"Article category '{categoryName}' was not found");

        var parsed = producer.Template.Trim().ToLowerInvariant() switch
        {
            "irpr-v1" => ParseIrprMessage(request.Subject, request.PlainBody),
            "tomer-cohen-v1" => ParseTomerCohenMessage(
                request.Subject,
                request.PlainBody,
                request.DocumentText),
            "control-drive-v1" => ParseControlDriveMessage(
                request.Subject,
                request.PlainBody,
                request.DocumentText),
            _ => throw new InvalidOperationException($"Unsupported producer template: {producer.Template}")
        };
        var slug = BuildDeterministicSlug(parsed.Title, request.MessageId);

        var existing = await _context.Articles
            .AsNoTracking()
            .Where(a => a.Slug == slug)
            .Select(a => new { a.Id, a.Title })
            .FirstOrDefaultAsync();

        if (existing != null)
        {
            return new EmailArticleIngestionResponseDto
            {
                Success = true,
                Duplicate = true,
                ArticleId = existing.Id,
                Title = existing.Title
            };
        }

        var warnings = new List<string>();
        if (parsed.UsedFallbackContent)
            warnings.Add("תוכן הכתבה לא זוהה במלואו");
        if (string.IsNullOrWhiteSpace(parsed.YouTubeUrl))
            warnings.Add("לא נמצא קישור YouTube");

        string? audioUrl = null;
        if (request.AudioFile == null || request.AudioFile.Length == 0)
        {
            warnings.Add("לא נמצא קובץ שמע");
        }
        else if (request.AudioFile.Length > MaxAudioFileSizeBytes)
        {
            warnings.Add("קובץ השמע גדול מ-30MB");
        }
        else
        {
            var extension = Path.GetExtension(request.AudioFile.FileName);
            if (!AllowedAudioExtensions.Contains(extension))
            {
                warnings.Add("סוג קובץ השמע אינו נתמך");
            }
            else
            {
                await using var audioStream = request.AudioFile.OpenReadStream();
                audioUrl = await _blobService.UploadAsync(
                    audioStream,
                    request.AudioFile.FileName,
                    GetAudioContentType(extension),
                    "uploads/email-articles/audio");

                if (string.IsNullOrWhiteSpace(audioUrl))
                    warnings.Add("העלאת קובץ השמע נכשלה");
            }
        }

        string? thumbnailUrl = null;
        if (!string.IsNullOrWhiteSpace(parsed.YouTubeUrl))
        {
            var metadata = await _youTubeService.GetVideoMetadataAsync(parsed.YouTubeUrl);
            thumbnailUrl = metadata.ThumbnailUrl;
            if (string.IsNullOrWhiteSpace(thumbnailUrl))
                warnings.Add("לא ניתן היה לשמור את תמונת YouTube");
        }

        var requiresReview = warnings.Count > 0;
        var finalTitle = requiresReview ? $"[דורש בדיקה] {parsed.Title}" : parsed.Title;

        var article = await _articleService.CreateArticleAsync(new CreateArticleDto
        {
            Title = finalTitle,
            Content = parsed.ContentHtml,
            FeaturedImageUrl = thumbnailUrl,
            AuthorName = producer.AuthorName,
            CategoryIds = new List<int> { category.Id },
            ContentType = (int)ArticleContentType.News,
            Slug = slug,
            VideoEmbedUrl = parsed.YouTubeUrl,
            AudioEmbedUrl = audioUrl,
            ImageCredit = parsed.Credits,
            ShortDescription = parsed.ShortDescription,
            IsFeatured = false,
            DisplayOrder = 0,
            Status = (int)ArticleStatus.Draft,
            ScheduledDate = null,
            IsPremium = false,
            MetaTitle = parsed.Title,
            MetaDescription = parsed.ShortDescription,
            OpenGraphImageUrl = thumbnailUrl,
            ReadTimeMinutes = parsed.ReadTimeMinutes
        });

        _logger.LogInformation(
            "Email article ingested as draft: ArticleId={ArticleId} Sender={Sender} MessageId={MessageId} RequiresReview={RequiresReview}",
            article.Id,
            senderEmail,
            request.MessageId,
            requiresReview);

        return new EmailArticleIngestionResponseDto
        {
            Success = true,
            ArticleId = article.Id,
            Title = article.Title,
            RequiresReview = requiresReview,
            Warnings = warnings
        };
    }

    private static ParsedEmailArticle ParseIrprMessage(string subject, string plainBody)
    {
        var title = CleanText(subject);
        if (string.IsNullOrWhiteSpace(title))
            title = "כתבה ללא כותרת";

        var normalizedBody = (plainBody ?? string.Empty)
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n');

        var youtubeMatch = YouTubeUrlRegex.Match(normalizedBody);
        var youtubeUrl = youtubeMatch.Success
            ? youtubeMatch.Value.TrimEnd('*', ')', '>', '.', ',')
            : null;

        var blocks = Regex.Split(normalizedBody, @"\n\s*\n")
            .Select(block => Regex.Replace(block, @"\s*\n\s*", " "))
            .Select(CleanText)
            .Where(block => !string.IsNullOrWhiteSpace(block))
            .ToList();

        var contentParagraphs = new List<string>();
        var creditParagraphs = new List<string>();
        foreach (var block in blocks)
        {
            if (block == "--" || block.StartsWith("-- ", StringComparison.Ordinal))
                break;

            if (IsDuplicateTitle(block, title))
                continue;

            if (YouTubeUrlRegex.IsMatch(block)
                || GoogleDriveUrlRegex.IsMatch(block)
                || block.StartsWith("יוטיוב", StringComparison.OrdinalIgnoreCase)
                || block.StartsWith("וידאו בדרייב", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (LooksLikeCredits(block))
            {
                creditParagraphs.Add(block);
                continue;
            }

            contentParagraphs.Add(block);
        }

        var usedFallbackContent = contentParagraphs.Count == 0;
        if (usedFallbackContent)
            contentParagraphs.Add("תוכן המייל לא זוהה אוטומטית. יש להשלים את הכתבה לפני הפרסום.");

        var contentHtml = string.Join("\n", contentParagraphs.Select(paragraph =>
            $"<p>{WebUtility.HtmlEncode(paragraph)}</p>"));

        var credits = string.Join(" | ", creditParagraphs);
        if (credits.Length > 2000)
            credits = credits[..2000].TrimEnd();

        var description = contentParagraphs.FirstOrDefault() ?? string.Empty;
        if (description.Length > 500)
            description = description[..497] + "...";

        var wordCount = contentParagraphs.Sum(p =>
            p.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Length);

        return new ParsedEmailArticle(
            title,
            contentHtml,
            description,
            youtubeUrl,
            string.IsNullOrWhiteSpace(credits) ? null : credits,
            Math.Max(1, (int)Math.Ceiling(wordCount / 200d)),
            usedFallbackContent);
    }

    private static ParsedEmailArticle ParseTomerCohenMessage(
        string subject,
        string plainBody,
        string? documentText)
    {
        var youtubeMatch = YouTubeUrlRegex.Match(plainBody ?? string.Empty);
        var youtubeUrl = youtubeMatch.Success
            ? youtubeMatch.Value.TrimEnd('*', ')', '>', '.', ',')
            : null;

        var normalizedDocument = (documentText ?? string.Empty)
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Trim();

        var blocks = Regex.Split(normalizedDocument, @"\n\s*\n")
            .Select(block => block
                .Split('\n', StringSplitOptions.RemoveEmptyEntries)
                .Select(CleanText)
                .Where(line => !string.IsNullOrWhiteSpace(line))
                .ToList())
            .Where(lines => lines.Count > 0)
            .ToList();

        var titleBlockIndex = blocks.FindIndex(lines => !IsDocumentHeaderMarker(lines));
        var title = titleBlockIndex >= 0
            ? BuildTomerCohenTitle(blocks[titleBlockIndex])
            : CleanText(subject);
        if (string.IsNullOrWhiteSpace(title))
            title = "כתבה ללא כותרת";

        var contentParagraphs = blocks
            .Skip(titleBlockIndex >= 0 ? titleBlockIndex + 1 : blocks.Count)
            .Select(lines => string.Join(" ", lines))
            .Where(paragraph => !string.IsNullOrWhiteSpace(paragraph))
            .ToList();

        var creditParagraphs = contentParagraphs
            .Where(LooksLikeCredits)
            .ToList();
        contentParagraphs.RemoveAll(LooksLikeCredits);

        var usedFallbackContent = contentParagraphs.Count == 0;
        if (usedFallbackContent)
            contentParagraphs.Add("תוכן קובץ ה-Word לא זוהה. יש להשלים את הכתבה לפני הפרסום.");

        var contentHtml = string.Join("\n", contentParagraphs.Select(paragraph =>
            $"<p>{WebUtility.HtmlEncode(paragraph)}</p>"));

        var credits = string.Join(" | ", creditParagraphs);
        if (credits.Length > 2000)
            credits = credits[..2000].TrimEnd();

        var description = contentParagraphs.FirstOrDefault() ?? string.Empty;
        if (description.Length > 500)
            description = description[..497] + "...";

        var wordCount = contentParagraphs.Sum(paragraph =>
            paragraph.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Length);

        return new ParsedEmailArticle(
            title,
            contentHtml,
            description,
            youtubeUrl,
            string.IsNullOrWhiteSpace(credits) ? null : credits,
            Math.Max(1, (int)Math.Ceiling(wordCount / 200d)),
            usedFallbackContent);
    }

    private static string BuildTomerCohenTitle(IReadOnlyList<string> titleLines)
    {
        if (titleLines.Count == 0)
            return string.Empty;
        if (titleLines.Count == 1)
            return titleLines[0];

        var firstLine = titleLines[0].TrimEnd().TrimEnd(':', '-', '–');
        return $"{firstLine}: {string.Join(" ", titleLines.Skip(1))}";
    }

    private static ParsedEmailArticle ParseControlDriveMessage(
        string subject,
        string plainBody,
        string? documentText)
    {
        var youtubeMatch = YouTubeUrlRegex.Match(plainBody ?? string.Empty);
        var youtubeUrl = youtubeMatch.Success
            ? youtubeMatch.Value.TrimEnd('*', ')', '>', '.', ',')
            : null;

        var normalizedDocument = (documentText ?? string.Empty)
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Trim();

        var hasBlankParagraphSeparators = Regex.IsMatch(normalizedDocument, @"\n\s*\n");
        var rawParagraphs = hasBlankParagraphSeparators
            ? Regex.Split(normalizedDocument, @"\n\s*\n")
            : normalizedDocument.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        var paragraphs = rawParagraphs
            .Select(paragraph => CleanText(Regex.Replace(paragraph, @"\s*\n\s*", " ")))
            .Where(paragraph => !string.IsNullOrWhiteSpace(paragraph))
            .ToList();

        var titleIndex = paragraphs.FindIndex(paragraph =>
            !IsDocumentHeaderMarker(new[] { paragraph }));
        var title = titleIndex >= 0 ? paragraphs[titleIndex] : CleanText(subject);
        if (string.IsNullOrWhiteSpace(title))
            title = "כתבה ללא כותרת";

        var articleParagraphs = paragraphs
            .Skip(titleIndex >= 0 ? titleIndex + 1 : paragraphs.Count)
            .ToList();
        var creditsIndex = articleParagraphs.FindIndex(IsCreditsHeading);

        List<string> creditParagraphs;
        if (creditsIndex >= 0)
        {
            creditParagraphs = articleParagraphs.Skip(creditsIndex).ToList();
            articleParagraphs = articleParagraphs.Take(creditsIndex).ToList();
        }
        else
        {
            creditParagraphs = articleParagraphs.Where(LooksLikeCredits).ToList();
            articleParagraphs.RemoveAll(LooksLikeCredits);
        }

        var usedFallbackContent = articleParagraphs.Count == 0;
        if (usedFallbackContent)
            articleParagraphs.Add("תוכן מסמך הקומוניקט לא זוהה. יש להשלים את הכתבה לפני הפרסום.");

        var contentHtml = string.Join("\n", articleParagraphs.Select(paragraph =>
            $"<p>{WebUtility.HtmlEncode(paragraph)}</p>"));

        var credits = string.Join(" | ", creditParagraphs)
            .Trim();
        if (credits.Length > 2000)
            credits = credits[..2000].TrimEnd();

        var description = articleParagraphs.FirstOrDefault() ?? string.Empty;
        if (description.Length > 500)
            description = description[..497] + "...";

        var wordCount = articleParagraphs.Sum(paragraph =>
            paragraph.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Length);

        return new ParsedEmailArticle(
            title,
            contentHtml,
            description,
            youtubeUrl,
            string.IsNullOrWhiteSpace(credits) ? null : credits,
            Math.Max(1, (int)Math.Ceiling(wordCount / 200d)),
            usedFallbackContent);
    }

    private static bool IsCreditsHeading(string paragraph)
    {
        var normalized = CleanText(paragraph).TrimStart();
        return normalized.StartsWith("קרדיטים", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsDocumentHeaderMarker(IReadOnlyList<string> lines)
    {
        var marker = ComparableTitle(string.Join(" ", lines));
        return marker is "בסד" or "בה" or "בעזהשית" or "בעזרתהשם";
    }

    private static bool LooksLikeCredits(string block) =>
        block.Contains('|') && block.Contains(':');

    private static bool IsDuplicateTitle(string block, string title)
    {
        var normalizedBlock = ComparableTitle(block);
        var normalizedTitle = ComparableTitle(title);

        if (string.IsNullOrWhiteSpace(normalizedBlock) || string.IsNullOrWhiteSpace(normalizedTitle))
            return false;

        if (normalizedBlock == normalizedTitle)
            return true;

        var shorterLength = Math.Min(normalizedBlock.Length, normalizedTitle.Length);
        var longerLength = Math.Max(normalizedBlock.Length, normalizedTitle.Length);
        return shorterLength >= 12
            && shorterLength >= longerLength * 0.8
            && (normalizedBlock.Contains(normalizedTitle, StringComparison.Ordinal)
                || normalizedTitle.Contains(normalizedBlock, StringComparison.Ordinal));
    }

    private static string ExtractEmailAddress(string sender)
    {
        try
        {
            return new MailAddress(sender).Address.Trim().ToLowerInvariant();
        }
        catch (FormatException)
        {
            var match = Regex.Match(sender ?? string.Empty, @"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", RegexOptions.IgnoreCase);
            return match.Success ? match.Value.ToLowerInvariant() : string.Empty;
        }
    }

    private static string BuildDeterministicSlug(string title, string messageId)
    {
        var normalizedTitle = title.Normalize(NormalizationForm.FormKC).ToLowerInvariant();
        var slugBase = Regex.Replace(normalizedTitle, @"[^\p{L}\p{N}]+", "-").Trim('-');
        if (slugBase.Length > 230)
            slugBase = slugBase[..230].TrimEnd('-');
        if (string.IsNullOrWhiteSpace(slugBase))
            slugBase = "email-article";

        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(messageId.Trim())))
            .ToLowerInvariant()[..12];
        return $"{slugBase}-{hash}";
    }

    private static string CleanText(string value)
    {
        var cleaned = (value ?? string.Empty).Trim();
        cleaned = cleaned.Trim('*', '_', ' ', '\t', '\n', '\r');
        return Regex.Replace(cleaned, @"\s+", " ").Trim();
    }

    private static string ComparableTitle(string value) =>
        Regex.Replace(CleanText(value), @"[^\p{L}\p{N}]+", string.Empty).ToLowerInvariant();

    private static string GetAudioContentType(string extension) => extension.ToLowerInvariant() switch
    {
        ".mp3" => "audio/mpeg",
        ".wav" => "audio/wav",
        ".m4a" => "audio/mp4",
        ".aac" => "audio/aac",
        ".ogg" => "audio/ogg",
        _ => "application/octet-stream"
    };

    private sealed record ParsedEmailArticle(
        string Title,
        string ContentHtml,
        string ShortDescription,
        string? YouTubeUrl,
        string? Credits,
        int ReadTimeMinutes,
        bool UsedFallbackContent);
}
