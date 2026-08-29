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
    public bool AutoDiscover { get; set; } = true;
}

public interface IEmailArticleIngestionService
{
    bool IsEnabled { get; }
    IReadOnlyList<string> ApprovedSenderEmails { get; }
    Task<bool> IsAuthorizedAsync(string? authorizationHeader, CancellationToken cancellationToken);
    Task<EmailArticleIngestionResponseDto> IngestAsync(EmailArticleIngestionRequestDto request);
}

public sealed class EmailArticleIngestionService : IEmailArticleIngestionService
{
    private const long MaxAudioFileSizeBytes = 30 * 1024 * 1024;
    private static readonly TimeSpan YouTubeDuplicateWindow = TimeSpan.FromDays(7);
    private static readonly HashSet<string> AllowedAudioExtensions =
        new(StringComparer.OrdinalIgnoreCase) { ".mp3", ".wav", ".m4a", ".aac", ".ogg" };

    private static readonly Regex YouTubeUrlRegex = new(
        @"https?://(?:www\.)?(?:youtube\.com/(?:watch\?[^\s<>]*v=|embed/|shorts/)|youtu\.be/)[A-Za-z0-9_-]{11}[^\s<>]*",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex YouTubeShortsVideoIdRegex = new(
        @"youtube\.com/shorts/(?<id>[A-Za-z0-9_-]{11})",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex GoogleDriveUrlRegex = new(
        @"https?://(?:drive|docs)\.google\.com/[^\s<>]*",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex GoogleDriveFolderUrlRegex = new(
        @"https?://drive\.google\.com/drive/folders/[A-Za-z0-9_-]+[^\s<>]*",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex AnyUrlRegex = new(
        @"https?://[^\s<>]+",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly AkordishKeitDbContext _context;
    private readonly IArticleService _articleService;
    private readonly IAzureBlobService _blobService;
    private readonly IYouTubeService _youTubeService;
    private readonly INotificationService _notificationService;
    private readonly HttpClient _httpClient;
    private readonly EmailArticleIngestionOptions _options;
    private readonly ILogger<EmailArticleIngestionService> _logger;

    public EmailArticleIngestionService(
        AkordishKeitDbContext context,
        IArticleService articleService,
        IAzureBlobService blobService,
        IYouTubeService youTubeService,
        INotificationService notificationService,
        HttpClient httpClient,
        IOptions<EmailArticleIngestionOptions> options,
        ILogger<EmailArticleIngestionService> logger)
    {
        _context = context;
        _articleService = articleService;
        _blobService = blobService;
        _youTubeService = youTubeService;
        _notificationService = notificationService;
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public bool IsEnabled => _options.Enabled;

    public IReadOnlyList<string> ApprovedSenderEmails => _options.Producers
        .Where(producer => producer.AutoDiscover)
        .Select(producer => producer.SenderEmail.Trim().ToLowerInvariant())
        .Where(email => !string.IsNullOrWhiteSpace(email))
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToList();

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
            "mendy-kornet-v1" => ParseMendyKornetMessage(
                request.Subject,
                request.PlainBody,
                request.DocumentText),
            "kobis-attachments-v1" => ParseKobisAttachmentsMessage(request.DocumentText),
            _ => throw new InvalidOperationException($"Unsupported producer template: {producer.Template}")
        };
        var warnings = BuildStructureWarnings(parsed, request, producer.Template);
        var slug = BuildDeterministicSlug(parsed.Title, request.MessageId);

        var existing = await _context.Articles
            .IgnoreQueryFilters()
            .Where(a => a.Slug == slug)
            .FirstOrDefaultAsync();

        if (existing != null)
        {
            if (existing.IsDeleted)
            {
                existing.IsDeleted = false;
                existing.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                _logger.LogInformation(
                    "Soft-deleted email article restored: ArticleId={ArticleId} MessageId={MessageId}",
                    existing.Id,
                    request.MessageId);
            }

            await _notificationService.NotifyEmailArticleDraftCreatedAsync(
                existing.Id,
                existing.Title,
                senderEmail,
                warnings);

            return new EmailArticleIngestionResponseDto
            {
                Success = true,
                Duplicate = true,
                ArticleId = existing.Id,
                Title = existing.Title,
                RequiresReview = warnings.Count > 0,
                Warnings = warnings
            };
        }

        var youtubeVideoId = ExtractYouTubeVideoId(parsed.YouTubeUrl);
        if (!string.IsNullOrWhiteSpace(youtubeVideoId))
        {
            var duplicateCutoff = DateTime.UtcNow.Subtract(YouTubeDuplicateWindow);
            var recentYouTubeArticles = await _context.Articles
                .AsNoTracking()
                .Where(article =>
                    !article.IsDeleted
                    && article.CreatedAt >= duplicateCutoff
                    && article.VideoEmbedUrl != null
                    && article.VideoEmbedUrl != string.Empty)
                .Select(article => new
                {
                    article.Id,
                    article.Title,
                    article.VideoEmbedUrl
                })
                .ToListAsync();

            var youtubeDuplicate = recentYouTubeArticles.FirstOrDefault(article =>
                string.Equals(
                    ExtractYouTubeVideoId(article.VideoEmbedUrl),
                    youtubeVideoId,
                    StringComparison.Ordinal));

            if (youtubeDuplicate != null)
            {
                var duplicateWarning =
                    $"לא נוצרה טיוטה חדשה: סרטון ה-YouTube כבר קיים בכתבה #{youtubeDuplicate.Id}";

                _logger.LogInformation(
                    "Email article skipped because YouTube video already exists: ExistingArticleId={ArticleId} VideoId={VideoId} Sender={Sender} MessageId={MessageId}",
                    youtubeDuplicate.Id,
                    youtubeVideoId,
                    senderEmail,
                    request.MessageId);

                return new EmailArticleIngestionResponseDto
                {
                    Success = true,
                    Duplicate = true,
                    ArticleId = youtubeDuplicate.Id,
                    Title = youtubeDuplicate.Title,
                    RequiresReview = false,
                    Warnings = new List<string> { duplicateWarning }
                };
            }
        }

        string? audioUrl = null;
        if (request.AudioFile == null || request.AudioFile.Length == 0)
        {
            AddWarning(warnings, "לא נמצא קובץ שמע");
        }
        else if (request.AudioFile.Length > MaxAudioFileSizeBytes)
        {
            AddWarning(warnings, "קובץ השמע גדול מ-30MB");
        }
        else
        {
            var extension = Path.GetExtension(request.AudioFile.FileName);
            if (!AllowedAudioExtensions.Contains(extension))
            {
                AddWarning(warnings, "סוג קובץ השמע אינו נתמך");
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
                    AddWarning(warnings, "העלאת קובץ השמע נכשלה");
            }
        }

        string? thumbnailUrl = null;
        if (!string.IsNullOrWhiteSpace(parsed.YouTubeUrl))
        {
            var metadata = await _youTubeService.GetVideoMetadataAsync(parsed.YouTubeUrl);
            thumbnailUrl = metadata.ThumbnailUrl;
            if (string.IsNullOrWhiteSpace(thumbnailUrl))
                AddWarning(warnings, "לא ניתן היה לשמור את תמונת YouTube");
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

        await _notificationService.NotifyEmailArticleDraftCreatedAsync(
            article.Id,
            article.Title,
            senderEmail,
            warnings);

        return new EmailArticleIngestionResponseDto
        {
            Success = true,
            ArticleId = article.Id,
            Title = article.Title,
            RequiresReview = requiresReview,
            Warnings = warnings
        };
    }

    private static List<string> BuildStructureWarnings(
        ParsedEmailArticle parsed,
        EmailArticleIngestionRequestDto request,
        string template)
    {
        var warnings = new List<string>();
        var templateName = template.Trim().ToLowerInvariant();
        var plainBody = request.PlainBody ?? string.Empty;
        var structureText = templateName == "kobis-attachments-v1"
            ? request.DocumentText ?? string.Empty
            : plainBody;

        if (parsed.UsedFallbackContent)
            AddWarning(warnings, "תוכן הכתבה לא זוהה במלואו");
        if (string.IsNullOrWhiteSpace(parsed.YouTubeUrl))
            AddWarning(warnings, "לא נמצא קישור YouTube");
        if (string.IsNullOrWhiteSpace(parsed.Credits))
            AddWarning(warnings, "לא זוהתה שורת קרדיטים");
        if (parsed.Title == "כתבה ללא כותרת")
            AddWarning(warnings, "לא זוהתה כותרת");

        if (request.AudioFile == null || request.AudioFile.Length == 0)
        {
            AddWarning(warnings, "לא נמצא קובץ שמע");
        }
        else if (request.AudioFile.Length > MaxAudioFileSizeBytes)
        {
            AddWarning(warnings, "קובץ השמע גדול מ-30MB");
        }
        else if (!AllowedAudioExtensions.Contains(Path.GetExtension(request.AudioFile.FileName)))
        {
            AddWarning(warnings, "סוג קובץ השמע אינו נתמך");
        }

        var contentText = CleanText(Regex.Replace(parsed.ContentHtml, "<[^>]+>", " "));
        var contentWordCount = contentText
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            .Length;
        if (!parsed.UsedFallbackContent && contentWordCount < 20)
            AddWarning(warnings, "תוכן הכתבה קצר מהמבנה הרגיל וייתכן שחסר בו חלק");

        var youtubeUrls = YouTubeUrlRegex.Matches(structureText)
            .Select(match => NormalizeDetectedUrl(match.Value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (youtubeUrls.Count > 1)
            AddWarning(warnings, $"נמצאו {youtubeUrls.Count} קישורי YouTube במקום קישור אחד");

        var driveUrls = GoogleDriveUrlRegex.Matches(structureText)
            .Select(match => NormalizeDetectedUrl(match.Value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var folderUrls = GoogleDriveFolderUrlRegex.Matches(structureText)
            .Select(match => NormalizeDetectedUrl(match.Value))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var knownUrls = youtubeUrls
            .Concat(driveUrls)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var otherUrls = AnyUrlRegex.Matches(structureText)
            .Select(match => NormalizeDetectedUrl(match.Value))
            .Where(url => !knownUrls.Contains(url))
            .Where(url => templateName != "mendy-kornet-v1" || !IsMendyKornetAllowedExtraUrl(url))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (otherUrls.Count > 0)
            AddWarning(warnings, $"נמצאו {otherUrls.Count} קישורים נוספים שלא הוגדרו בתבנית");

        switch (templateName)
        {
            case "irpr-v1":
                if (driveUrls.Count > 0 && !HasExpectedIrprDriveLinks(plainBody, driveUrls.Count))
                    AddWarning(warnings, "נמצא קישור Drive שלא הוגדר בתבנית המפיק");
                if (HasShortUnexpectedOpening(plainBody, parsed.Title))
                    AddWarning(warnings, "נמצא טקסט קצר ולא צפוי בתחילת המייל");
                break;

            case "tomer-cohen-v1":
                if (string.IsNullOrWhiteSpace(request.DocumentText))
                    AddWarning(warnings, "קובץ ה-Word חסר או שלא ניתן היה לקרוא אותו");
                if (driveUrls.Count > 0)
                    AddWarning(warnings, "נמצא קישור Drive שלא הוגדר בתבנית המפיק");
                AddUnexpectedBodyWarning(warnings, plainBody);
                break;

            case "control-drive-v1":
                if (string.IsNullOrWhiteSpace(request.DocumentText))
                    AddWarning(warnings, "מסמך הקומוניקט בתיקיית Drive חסר או שלא ניתן היה לקרוא אותו");
                if (folderUrls.Count == 0)
                    AddWarning(warnings, "לא נמצא קישור לתיקיית Drive");
                else if (folderUrls.Count > 1)
                    AddWarning(warnings, $"נמצאו {folderUrls.Count} קישורים לתיקיות Drive במקום קישור אחד");
                if (driveUrls.Count > folderUrls.Count)
                    AddWarning(warnings, "נמצא קישור Drive נוסף שאינו קישור התיקייה שהוגדר");
                AddUnexpectedBodyWarning(warnings, plainBody);
                break;

            case "mendy-kornet-v1":
                if (driveUrls.Count == 0)
                    AddWarning(warnings, "לא נמצא קישור Google Drive שמופיע בדרך כלל בתבנית המפיק");
                else if (driveUrls.Count > 2)
                    AddWarning(warnings, $"נמצאו {driveUrls.Count} קישורי Drive, יותר מהמבנה הרגיל");
                break;

            case "kobis-attachments-v1":
                if (string.IsNullOrWhiteSpace(request.DocumentText))
                    AddWarning(warnings, "קובץ ה-Word חסר או שלא ניתן היה לקרוא אותו");
                break;
        }

        return warnings;
    }

    private static void AddUnexpectedBodyWarning(List<string> warnings, string plainBody)
    {
        var remainingLines = (plainBody ?? string.Empty)
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .TakeWhile(line =>
            {
                var cleaned = CleanText(line);
                return cleaned != "--" && !cleaned.StartsWith("-- ", StringComparison.Ordinal);
            })
            .Select(line => AnyUrlRegex.Replace(line, string.Empty))
            .Select(CleanText)
            .Where(line => !string.IsNullOrWhiteSpace(line))
            .Where(line => !IsExpectedLinkLabel(line))
            .Where(line => !IsExpectedAttachmentIntroduction(line))
            .ToList();

        if (remainingLines.Count == 0)
            return;

        var preview = string.Join(" ", remainingLines);
        if (preview.Length > 90)
            preview = preview[..87].TrimEnd() + "...";
        AddWarning(warnings, $"נמצא טקסט נוסף בגוף המייל שלא הוגדר בתבנית: \"{preview}\"");
    }

    private static bool IsExpectedLinkLabel(string line)
    {
        var normalized = ComparableTitle(line);
        return normalized is "קישורליוטיוב" or "קישורלדרייב" or "יוטיוב" or "דרייב"
            || (line.EndsWith(':')
                && (line.Contains("YouTube", StringComparison.OrdinalIgnoreCase)
                    || line.Contains("יוטיוב", StringComparison.OrdinalIgnoreCase)
                    || line.Contains("דרייב", StringComparison.OrdinalIgnoreCase)));
    }

    private static bool IsExpectedAttachmentIntroduction(string line)
    {
        var normalized = ComparableTitle(line);
        return (normalized.StartsWith("מצב", StringComparison.Ordinal)
                || normalized.StartsWith("מצורף", StringComparison.Ordinal))
            && (normalized.Contains("קישור", StringComparison.Ordinal)
                || normalized.Contains("חומר", StringComparison.Ordinal));
    }

    private static bool HasExpectedIrprDriveLinks(string plainBody, int driveUrlCount)
    {
        return driveUrlCount == 2
            && plainBody.Contains("אודיו בדרייב", StringComparison.OrdinalIgnoreCase)
            && plainBody.Contains("וידאו בדרייב", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsMendyKornetAllowedExtraUrl(string url)
    {
        return Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && uri.Host.EndsWith("youtube.com", StringComparison.OrdinalIgnoreCase)
            && uri.AbsolutePath.Equals("/playlist", StringComparison.OrdinalIgnoreCase);
    }

    private static bool HasShortUnexpectedOpening(string plainBody, string title)
    {
        var blocks = Regex.Split(plainBody ?? string.Empty, @"\n\s*\n")
            .Select(block => CleanText(Regex.Replace(block, @"\s*\n\s*", " ")))
            .Where(block => !string.IsNullOrWhiteSpace(block))
            .Where(block => !IsDuplicateTitle(block, title))
            .Where(block => !YouTubeUrlRegex.IsMatch(block) && !GoogleDriveUrlRegex.IsMatch(block))
            .Where(block => !LooksLikeCredits(block))
            .ToList();

        if (blocks.Count < 2)
            return false;

        var firstBlockWordCount = blocks[0]
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            .Length;
        var secondBlockWordCount = blocks[1]
            .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            .Length;
        return firstBlockWordCount <= 8 && secondBlockWordCount >= 15;
    }

    private static void AddWarning(List<string> warnings, string warning)
    {
        if (!warnings.Contains(warning, StringComparer.Ordinal))
            warnings.Add(warning);
    }

    private static string NormalizeDetectedUrl(string url) =>
        url.Trim().TrimEnd('*', ')', '>', '.', ',', ';');

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
        foreach (var originalBlock in blocks)
        {
            var block = originalBlock;
            if (block == "--" || block.StartsWith("-- ", StringComparison.Ordinal))
                break;

            if (IsDuplicateTitle(block, title))
                continue;

            if (YouTubeUrlRegex.IsMatch(block) || GoogleDriveUrlRegex.IsMatch(block))
            {
                block = RemoveMediaLinkText(block);
                if (string.IsNullOrWhiteSpace(block))
                    continue;
            }

            if (block.StartsWith("יוטיוב", StringComparison.OrdinalIgnoreCase)
                || block.StartsWith("וידאו בדרייב", StringComparison.OrdinalIgnoreCase)
                || block.StartsWith("אודיו בדרייב", StringComparison.OrdinalIgnoreCase))
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

    private static string RemoveMediaLinkText(string block)
    {
        var cleaned = AnyUrlRegex.Replace(block, " ");
        cleaned = Regex.Replace(cleaned, @"[<>*]+", " ");
        cleaned = Regex.Replace(
            cleaned,
            @"(?i)(?:\|\s*)?(?:אודיו|וידאו)\s+בדרייב\s*:?",
            " ");
        cleaned = Regex.Replace(
            cleaned,
            @"(?i)(?:קישור\s+ל)?(?:יוטיוב|youtube)\s*:?",
            " ");
        return CleanText(cleaned).Trim('|', ' ');
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

    private static ParsedEmailArticle ParseKobisAttachmentsMessage(string? documentText)
    {
        var normalizedDocument = (documentText ?? string.Empty)
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Trim();
        var paragraphs = normalizedDocument
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(CleanText)
            .Where(paragraph => !string.IsNullOrWhiteSpace(paragraph))
            .ToList();

        var youtubeMatch = YouTubeUrlRegex.Match(normalizedDocument);
        var youtubeUrl = youtubeMatch.Success
            ? NormalizeDetectedUrl(youtubeMatch.Value)
            : null;

        var titleStartIndex = paragraphs.FindIndex(paragraph => !IsKobisDocumentHeader(paragraph));
        var contentStartIndex = titleStartIndex >= 0
            ? paragraphs.FindIndex(titleStartIndex + 1, paragraph =>
                !IsKobisCreditsLine(paragraph)
                && !IsKobisPublicRelationsLine(paragraph)
                && !YouTubeUrlRegex.IsMatch(paragraph)
                && paragraph.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Length >= 12)
            : -1;

        if (titleStartIndex >= 0 && contentStartIndex < 0 && titleStartIndex + 1 < paragraphs.Count)
            contentStartIndex = titleStartIndex + 1;

        var titleLines = titleStartIndex >= 0
            ? paragraphs
                .Skip(titleStartIndex)
                .Take(Math.Max(1, contentStartIndex - titleStartIndex))
                .ToList()
            : new List<string>();
        var title = CleanText(string.Join(" ", titleLines));
        if (string.IsNullOrWhiteSpace(title))
            title = "כתבה ללא כותרת";

        var contentEndIndex = contentStartIndex >= 0
            ? paragraphs.FindIndex(contentStartIndex, paragraph =>
                IsKobisCreditsLine(paragraph)
                || IsKobisPublicRelationsLine(paragraph)
                || YouTubeUrlRegex.IsMatch(paragraph))
            : -1;
        if (contentEndIndex < 0)
            contentEndIndex = paragraphs.Count;

        var contentParagraphs = contentStartIndex >= 0
            ? paragraphs
                .Skip(contentStartIndex)
                .Take(Math.Max(0, contentEndIndex - contentStartIndex))
                .ToList()
            : new List<string>();
        var creditParagraphs = paragraphs
            .Skip(Math.Max(0, contentStartIndex))
            .Where(IsKobisCreditsLine)
            .ToList();

        var usedFallbackContent = string.IsNullOrWhiteSpace(normalizedDocument)
            || titleStartIndex < 0
            || contentParagraphs.Count == 0;
        if (contentParagraphs.Count == 0)
        {
            contentParagraphs.Add(
                "תוכן קובץ ה-Word לא זוהה. יש להשלים את הכתבה לפני הפרסום.");
        }

        var contentHtml = string.Join("\n", contentParagraphs.Select(paragraph =>
            $"<p>{WebUtility.HtmlEncode(paragraph)}</p>"));
        var credits = string.Join(" | ", creditParagraphs).Trim();
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

    private static bool IsKobisDocumentHeader(string paragraph)
    {
        var comparable = ComparableTitle(paragraph);
        return comparable.StartsWith("בסד", StringComparison.Ordinal)
            || comparable.StartsWith("בעזהשי", StringComparison.Ordinal);
    }

    private static bool IsKobisCreditsLine(string paragraph)
    {
        if (YouTubeUrlRegex.IsMatch(paragraph) || IsKobisPublicRelationsLine(paragraph))
            return false;

        return LooksLikeCredits(paragraph)
            || paragraph.StartsWith("מילים:", StringComparison.Ordinal)
            || paragraph.StartsWith("מילים ולחן:", StringComparison.Ordinal)
            || paragraph.StartsWith("לחן:", StringComparison.Ordinal)
            || paragraph.StartsWith("עיבוד:", StringComparison.Ordinal)
            || paragraph.StartsWith("הפקה מוזיקלית:", StringComparison.Ordinal);
    }

    private static bool IsKobisPublicRelationsLine(string paragraph) =>
        paragraph.StartsWith("לפרטים", StringComparison.Ordinal)
        || paragraph.StartsWith("ניהול יחסי ציבור", StringComparison.Ordinal)
        || paragraph.Contains("קובי סלע", StringComparison.Ordinal);

    private static ParsedEmailArticle ParseMendyKornetMessage(
        string subject,
        string plainBody,
        string? documentText)
    {
        var youtubeMatch = YouTubeUrlRegex.Match(plainBody ?? string.Empty);
        var youtubeUrl = youtubeMatch.Success
            ? NormalizeDetectedUrl(youtubeMatch.Value)
            : null;

        var hasDocument = !string.IsNullOrWhiteSpace(documentText);
        var sourceText = hasDocument ? documentText! : plainBody ?? string.Empty;
        var normalizedSource = sourceText
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Trim();

        var hasBlankParagraphSeparators = Regex.IsMatch(normalizedSource, @"\n\s*\n");
        var rawParagraphs = hasBlankParagraphSeparators
            ? Regex.Split(normalizedSource, @"\n\s*\n")
            : normalizedSource.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        var paragraphs = rawParagraphs
            .Select(paragraph => CleanText(Regex.Replace(paragraph, @"\s*\n\s*", " ")))
            .Where(paragraph => !string.IsNullOrWhiteSpace(paragraph))
            .ToList();

        var title = CleanText(subject);
        if (string.IsNullOrWhiteSpace(title))
            title = paragraphs.FirstOrDefault() ?? "כתבה ללא כותרת";

        var titleIndex = paragraphs.FindIndex(paragraph => IsTitleOrFragment(paragraph, title));
        var contentStartIndex = titleIndex >= 0 ? titleIndex : 0;
        while (contentStartIndex < paragraphs.Count
            && IsTitleOrFragment(paragraphs[contentStartIndex], title))
        {
            contentStartIndex++;
        }

        var creditsIndex = paragraphs.FindIndex(contentStartIndex, paragraph =>
            IsCreditsHeading(paragraph)
            || paragraph.StartsWith("קרדיט", StringComparison.OrdinalIgnoreCase));
        var mediaIndex = paragraphs.FindIndex(contentStartIndex, paragraph =>
            YouTubeUrlRegex.IsMatch(paragraph)
            || GoogleDriveUrlRegex.IsMatch(paragraph)
            || paragraph.Trim('_', ' ') == string.Empty);

        var contentEndIndex = new[] { creditsIndex, mediaIndex }
            .Where(index => index >= 0)
            .DefaultIfEmpty(paragraphs.Count)
            .Min();
        var contentParagraphs = paragraphs
            .Skip(contentStartIndex)
            .Take(Math.Max(0, contentEndIndex - contentStartIndex))
            .Where(paragraph => paragraph != "--" && !paragraph.StartsWith("-- ", StringComparison.Ordinal))
            .ToList();

        var creditParagraphs = creditsIndex >= 0
            ? paragraphs
                .Skip(creditsIndex)
                .TakeWhile(paragraph => paragraph != "--" && !paragraph.StartsWith("-- ", StringComparison.Ordinal))
                .Where(paragraph => !YouTubeUrlRegex.IsMatch(paragraph)
                    && !GoogleDriveUrlRegex.IsMatch(paragraph))
                .ToList()
            : new List<string>();

        var usedFallbackContent = titleIndex < 0 || contentParagraphs.Count == 0;
        if (contentParagraphs.Count == 0)
        {
            contentParagraphs.Add(
                "תוכן הקומוניקט לא זוהה אוטומטית. יש להשלים את הכתבה לפני הפרסום.");
        }

        var contentHtml = string.Join("\n", contentParagraphs.Select(paragraph =>
            $"<p>{WebUtility.HtmlEncode(paragraph)}</p>"));
        var credits = string.Join(" | ", creditParagraphs).Trim();
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

    private static bool IsTitleOrFragment(string paragraph, string title)
    {
        var comparableParagraph = ComparableTitle(paragraph);
        var comparableTitle = ComparableTitle(title);
        return comparableParagraph.Length >= 4
            && (comparableParagraph == comparableTitle
                || comparableTitle.Contains(comparableParagraph, StringComparison.Ordinal)
                || comparableParagraph.Contains(comparableTitle, StringComparison.Ordinal));
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

    private string? ExtractYouTubeVideoId(string? youtubeUrl)
    {
        if (string.IsNullOrWhiteSpace(youtubeUrl))
            return null;

        var videoId = _youTubeService.ExtractVideoId(youtubeUrl);
        if (!string.IsNullOrWhiteSpace(videoId))
            return videoId;

        var shortsMatch = YouTubeShortsVideoIdRegex.Match(youtubeUrl);
        return shortsMatch.Success ? shortsMatch.Groups["id"].Value : null;
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
