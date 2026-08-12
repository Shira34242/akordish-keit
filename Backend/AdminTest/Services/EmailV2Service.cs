using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Mjml.Net;

namespace AkordishKeit.Services;

public class EmailV2Service : IEmailV2Service
{
    private const string BrevoApiUrl = "https://api.brevo.com/v3/smtp/email";

    private readonly AkordishKeitDbContext _context;
    private readonly IAzureBlobService _blobService;
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<EmailV2Service> _logger;

    public EmailV2Service(
        AkordishKeitDbContext context,
        IAzureBlobService blobService,
        IConfiguration configuration,
        IHttpClientFactory httpClientFactory,
        ILogger<EmailV2Service> logger)
    {
        _context = context;
        _blobService = blobService;
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<EmailV2TemplateDto> SaveTemplateAsync(SaveEmailV2TemplateDto dto)
    {
        var conversionResult = await ConvertToHtmlAsync(dto.Mjml, dto.PreviewText);
        if (!conversionResult.Success)
        {
            throw new InvalidOperationException(
                $"MJML conversion failed: {conversionResult.Error}");
        }

        EmailCampaign campaign;
        if (dto.CampaignId.HasValue)
        {
            campaign = await _context.EmailCampaigns.FindAsync(dto.CampaignId.Value)
                ?? throw new InvalidOperationException("Campaign not found");
            campaign.Subject = dto.Subject.Trim();
            campaign.FromName = dto.FromName.Trim();
            campaign.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            campaign = new EmailCampaign
            {
                Subject = dto.Subject.Trim(),
                FromName = dto.FromName.Trim(),
                Status = "draft",
                RecipientGroup = 0, // temporary, will be set when sending
                CreatedAt = DateTime.UtcNow
            };
            _context.EmailCampaigns.Add(campaign);
            await _context.SaveChangesAsync();
        }

        campaign.HtmlBody = conversionResult.Html!;
        await _context.SaveChangesAsync();

        var designJson = BuildDesignDocument(dto.DesignJson, dto.PreviewText, dto.Mjml);
        await SaveDesignToBlobAsync(campaign, designJson);

        return new EmailV2TemplateDto
        {
            CampaignId = campaign.Id,
            Subject = campaign.Subject,
            FromName = campaign.FromName,
            FromEmail = dto.FromEmail,
            DesignJson = designJson,
            Mjml = dto.Mjml,
            HtmlBody = campaign.HtmlBody,
            PreviewText = dto.PreviewText,
            Status = campaign.Status,
            CreatedAt = campaign.CreatedAt
        };
    }

    public async Task<EmailV2TemplateDto?> GetTemplateAsync(int campaignId)
    {
        var campaign = await _context.EmailCampaigns.FindAsync(campaignId);
        if (campaign == null) return null;

        var storedDesignJson = await LoadDesignFromBlobAsync(campaignId);
        var designJson = ExtractFromDesignJson(storedDesignJson, "designContent")
            ?? storedDesignJson
            ?? "{}";

        return new EmailV2TemplateDto
        {
            CampaignId = campaign.Id,
            Subject = campaign.Subject,
            FromName = campaign.FromName,
            DesignJson = designJson,
            Mjml = ExtractFromDesignJson(storedDesignJson, "lastGeneratedMjml"),
            HtmlBody = campaign.HtmlBody,
            PreviewText = ExtractFromDesignJson(storedDesignJson, "previewText"),
            Status = campaign.Status,
            CreatedAt = campaign.CreatedAt
        };
    }

    public async Task<List<EmailV2TemplateDto>> GetTemplatesAsync()
    {
        return await _context.EmailCampaigns
            .Where(c => c.Status == "draft")
            .OrderByDescending(c => c.UpdatedAt ?? c.CreatedAt)
            .Select(c => new EmailV2TemplateDto
            {
                CampaignId = c.Id,
                Subject = c.Subject,
                FromName = c.FromName,
                DesignJson = c.HtmlBody, // placeholder, design loaded separately
                Status = c.Status,
                CreatedAt = c.CreatedAt
            })
            .ToListAsync();
    }

    public async Task<bool> DeleteTemplateAsync(int campaignId)
    {
        var campaign = await _context.EmailCampaigns.FindAsync(campaignId);
        if (campaign == null) return false;

        _context.EmailCampaigns.Remove(campaign);
        await _context.SaveChangesAsync();

        try { await DeleteDesignFromBlobAsync(campaignId); }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to delete design blob for campaign {CampaignId}", campaignId); }

        return true;
    }

    public async Task<EmailV2ConversionResultDto> ConvertToHtmlAsync(string mjml, string? previewText = null)
    {
        var result = new EmailV2ConversionResultDto();
        var warnings = new List<string>();

        try
        {
            var cleanMjml = SanitizeMjml(mjml);
            var validationError = ValidateMjml(cleanMjml);
            if (validationError != null)
            {
                result.Success = false;
                result.Error = validationError;
                result.Warnings = warnings;
                return result;
            }
            var mjmlWithRtl = InjectRtlDirection(cleanMjml);
            var mjmlWithFooter = InjectUnsubscribeFooter(mjmlWithRtl);

            var renderer = new MjmlRenderer();
            var renderResult = renderer.Render(mjmlWithFooter, new MjmlOptions { Beautify = false });

            if (renderResult.Errors.Count > 0)
            {
                result.Success = false;
                result.Error = string.Join("; ", renderResult.Errors.Select(e => e.ToString()));
                result.Warnings = warnings;
                return result;
            }

            var renderedBytes = Encoding.UTF8.GetByteCount(renderResult.Html);
            result.Success = true;
            result.Html = FinalizeEmailHtml(renderResult.Html, previewText);
            var finalizedBytes = Encoding.UTF8.GetByteCount(result.Html);
            _logger.LogInformation(
                "Email V2 HTML size after MJML render: {RenderedBytes} bytes ({RenderedKb:F1} KB); after compaction: {FinalizedBytes} bytes ({FinalizedKb:F1} KB); saved {SavedBytes} bytes",
                renderedBytes, renderedBytes / 1024d, finalizedBytes, finalizedBytes / 1024d, renderedBytes - finalizedBytes);
            if (finalizedBytes > 90_000)
                warnings.Add("The email is large and may be clipped by Gmail. Reduce the number of content cards or large HTML blocks.");
            result.Warnings = warnings;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MJML conversion failed");
            result.Success = false;
            result.Error = ex.Message;
            result.Warnings = warnings;
        }

        return result;
    }

    private static string SanitizeMjml(string mjml)
    {
        if (string.IsNullOrWhiteSpace(mjml)) return mjml;
        var sanitized = mjml
            .Replace("\0", "")
            .Replace("\u0000", "");

        // Templatical custom blocks may contain downlevel-revealed Outlook comments.
        // They are not valid XML for Mjml.Net. Keep the normal branch for the
        // editor/Gmail preview and discard only the Outlook-only duplicate.
        sanitized = Regex.Replace(
            sanitized,
            @"<!--\[if\s*!mso\]><!-->|<!--<!\[endif\]-->",
            string.Empty,
            RegexOptions.IgnoreCase);
        // Standard Outlook conditional comments are valid XML comments, so they
        // can remain in the rendered output as an Outlook fallback.

        // Remove all remaining C0 control characters. A copied text value or a
        // third-party block can contain more than just NUL, and XML rejects them.
        sanitized = Regex.Replace(sanitized, "[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]", "");

        // The content blocks are fed from CMS data. Older saved designs may still
        // contain a literal ampersand in a title or URL; XML requires it to be an
        // entity before Mjml.Net can parse the document.
        sanitized = Regex.Replace(
            sanitized,
            @"&(?!#(?:\d+|x[0-9a-fA-F]+);|[a-zA-Z][a-zA-Z0-9]+;)",
            "&amp;");

        sanitized = LiftCustomBlockSections(sanitized);
        sanitized = UnwrapCustomBlockTables(sanitized);

        return sanitized;
    }

    private static string LiftCustomBlockSections(string mjml)
    {
        const string sectionOpening = "<mj-section>";
        const string columnOpening = "<mj-column>";
        const string columnClosing = "</mj-column>";
        const string sectionClosing = "</mj-section>";
        var result = mjml;
        var searchStart = 0;

        // Templatical wraps every custom block in a default section/column/mj-text.
        // Some of our reusable blocks render complete mj-section markup themselves;
        // lifting that content prevents invalid mj-section -> mj-column nesting.
        while (searchStart < result.Length)
        {
            var sectionStart = result.IndexOf(sectionOpening, searchStart, StringComparison.OrdinalIgnoreCase);
            if (sectionStart < 0) break;

            var columnStart = SkipWhitespace(result, sectionStart + sectionOpening.Length);
            if (!StartsWithAt(result, columnStart, columnOpening))
            {
                searchStart = sectionStart + sectionOpening.Length;
                continue;
            }

            var textStart = SkipWhitespace(result, columnStart + columnOpening.Length);
            if (!StartsWithAt(result, textStart, "<mj-text"))
            {
                searchStart = sectionStart + sectionOpening.Length;
                continue;
            }

            var textOpeningEnd = result.IndexOf('>', textStart);
            var textClosingStart = textOpeningEnd < 0
                ? -1
                : FindMatchingClosingTag(result, textStart, "mj-text");
            if (textOpeningEnd < 0 || textClosingStart < 0)
            {
                searchStart = sectionStart + sectionOpening.Length;
                continue;
            }

            var afterText = SkipWhitespace(result, textClosingStart + "</mj-text>".Length);
            if (!StartsWithAt(result, afterText, columnClosing))
            {
                searchStart = sectionStart + sectionOpening.Length;
                continue;
            }

            var afterColumn = SkipWhitespace(result, afterText + columnClosing.Length);
            if (!StartsWithAt(result, afterColumn, sectionClosing))
            {
                searchStart = sectionStart + sectionOpening.Length;
                continue;
            }

            var content = result[(textOpeningEnd + 1)..textClosingStart];
            var trimmedContent = content.TrimStart();
            if (!trimmedContent.StartsWith("<mj-section", StringComparison.OrdinalIgnoreCase)
                && !trimmedContent.StartsWith("<mj-wrapper", StringComparison.OrdinalIgnoreCase))
            {
                searchStart = sectionStart + sectionOpening.Length;
                continue;
            }

            var sectionEnd = afterColumn + sectionClosing.Length;
            result = result[..sectionStart] + content + result[sectionEnd..];
            searchStart = sectionStart + content.Length;
        }

        return result;
    }

    private static int FindMatchingClosingTag(string value, int openingStart, string tagName)
    {
        var openingEnd = value.IndexOf('>', openingStart);
        if (openingEnd < 0) return -1;

        var position = openingEnd + 1;
        var depth = 1;
        while (position < value.Length)
        {
            var tagStart = value.IndexOf('<', position);
            if (tagStart < 0) return -1;

            if (StartsWithAt(value, tagStart, $"</{tagName}"))
            {
                var tagEnd = value.IndexOf('>', tagStart);
                if (tagEnd < 0) return -1;
                if (--depth == 0) return tagStart;
                position = tagEnd + 1;
                continue;
            }

            if (StartsWithAt(value, tagStart, $"<{tagName}"))
            {
                var tagEnd = value.IndexOf('>', tagStart);
                if (tagEnd < 0) return -1;
                if (tagEnd == tagStart || value[tagEnd - 1] != '/') depth++;
                position = tagEnd + 1;
                continue;
            }

            position = tagStart + 1;
        }

        return -1;
    }

    private static int SkipWhitespace(string value, int start)
    {
        var position = start;
        while (position < value.Length && char.IsWhiteSpace(value[position])) position++;
        return position;
    }

    private static bool StartsWithAt(string value, int start, string expected) =>
        start >= 0
        && start + expected.Length <= value.Length
        && value.AsSpan(start, expected.Length).Equals(expected, StringComparison.OrdinalIgnoreCase);

    private static string UnwrapCustomBlockTables(string mjml)
    {
        const string opening = "<mj-text";
        const string closing = "</mj-text>";
        var result = mjml;
        var searchStart = 0;

        while (searchStart < result.Length)
        {
            var start = result.IndexOf(opening, searchStart, StringComparison.OrdinalIgnoreCase);
            if (start < 0) break;

            var openingEnd = result.IndexOf('>', start + opening.Length);
            if (openingEnd < 0) break;
            var end = result.IndexOf(closing, openingEnd + 1, StringComparison.OrdinalIgnoreCase);
            if (end < 0) break;

            var contentStart = openingEnd + 1;
            var content = result[contentStart..end];
            if (TryConvertRootTableToMjTable(content, out var mjTable))
            {
                // Mjml.Net accepts mj-table as a direct child of mj-column, but
                // rejects both a raw HTML table and mj-raw inside mj-text.
                result = result[..start] + mjTable + result[(end + closing.Length)..];
                searchStart = start + "<mj-table".Length;
            }
            else
            {
                searchStart = end + closing.Length;
            }
        }

        return result;
    }

    private static bool TryConvertRootTableToMjTable(string content, out string mjTable)
    {
        mjTable = string.Empty;
        var tableStart = SkipWhitespace(content, 0);
        if (!StartsWithAt(content, tableStart, "<table")) return false;

        var tableOpeningEnd = content.IndexOf('>', tableStart);
        var tableClosingStart = tableOpeningEnd < 0
            ? -1
            : FindMatchingClosingTag(content, tableStart, "table");
        if (tableOpeningEnd < 0 || tableClosingStart < 0) return false;

        var afterTable = SkipWhitespace(content, tableClosingStart + "</table>".Length);
        if (afterTable != content.Length) return false;

        mjTable = content[..tableStart]
            + "<mj-table"
            + content[(tableStart + "<table".Length)..(tableOpeningEnd + 1)]
            + content[(tableOpeningEnd + 1)..tableClosingStart]
            + "</mj-table>"
            + content[(tableClosingStart + "</table>".Length)..];
        return true;
    }

    private static string? ValidateMjml(string mjml)
    {
        if (Regex.IsMatch(mjml, @"<\s*(script|iframe|object|embed)\b", RegexOptions.IgnoreCase))
            return "The email contains an unsupported active HTML element.";

        if (Regex.IsMatch(mjml, @"\son\w+\s*=", RegexOptions.IgnoreCase))
            return "The email contains unsupported inline event handlers.";

        if (Regex.IsMatch(mjml, @"\b(?:href|src)\s*=\s*(['""])\s*(?:javascript|data)\s*:", RegexOptions.IgnoreCase))
            return "The email contains an unsafe link or image URL.";

        return null;
    }

    public async Task<EmailV2ConversionResultDto> SendTestEmailAsync(EmailV2SendTestDto dto)
    {
        var campaign = await _context.EmailCampaigns.FindAsync(dto.CampaignId);
        if (campaign == null)
        {
            return new EmailV2ConversionResultDto
            {
                Success = false,
                Error = "Campaign not found"
            };
        }

        var apiKey = _configuration["Brevo:ApiKey"];
        if (string.IsNullOrEmpty(apiKey) || apiKey.StartsWith("REPLACE"))
        {
            return new EmailV2ConversionResultDto
            {
                Success = false,
                Error = "Brevo API key not configured"
            };
        }

        var fromEmail = _configuration["Brevo:FromEmail"] ?? "noreply@akordishkeit.com";
        var fromName = campaign.FromName;
        var unsubscribeUrl = BuildUnsubscribeUrl(dto.RecipientEmail);

        try
        {
            var payload = new
            {
                sender = new { email = fromEmail, name = fromName },
                to = new[] { new { email = dto.RecipientEmail, name = dto.RecipientEmail } },
                subject = $"[TEST] {campaign.Subject}",
                htmlContent = campaign.HtmlBody,
                @params = new
                {
                    unsubscribe_url = unsubscribeUrl
                }
            };

            var client = _httpClientFactory.CreateClient();
            using var req = new HttpRequestMessage(HttpMethod.Post, BrevoApiUrl);
            req.Headers.Add("api-key", apiKey);
            req.Headers.Add("accept", "application/json");
            req.Content = new StringContent(
                JsonSerializer.Serialize(payload, new JsonSerializerOptions
                {
                    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
                }),
                Encoding.UTF8,
                "application/json");

            var response = await client.SendAsync(req);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync();
                _logger.LogError("Brevo test email failed {Status}: {Body}", response.StatusCode, body);
                return new EmailV2ConversionResultDto
                {
                    Success = false,
                    Error = $"Brevo returned {response.StatusCode}"
                };
            }

            return new EmailV2ConversionResultDto { Success = true };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Brevo test email error");
            return new EmailV2ConversionResultDto
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    public async Task<List<EmailDesignVersionDto>> GetDesignVersionsAsync(int campaignId)
    {
        var versions = new List<EmailDesignVersionDto>();
        var path = $"email-designs/{campaignId}/versions";

        for (int v = 1; v <= 100; v++)
        {
            var json = await _blobService.DownloadStringAsync($"{path}/v{v:D4}.json");
            if (json == null) continue;

            try
            {
                var dto = JsonSerializer.Deserialize<EmailDesignVersionDto>(json);
                if (dto != null) versions.Add(dto);
            }
            catch { }
        }

        return versions.OrderByDescending(v => v.Version).ToList();
    }

    public async Task<EmailDesignVersionDto?> GetDesignVersionAsync(int campaignId, int version)
    {
        var json = await _blobService.DownloadStringAsync(
            $"email-designs/{campaignId}/versions/v{version:D4}.json");
        if (json == null) return null;

        return JsonSerializer.Deserialize<EmailDesignVersionDto>(json);
    }

    public async Task<EmailV2TemplateDto> RestoreDesignVersionAsync(int campaignId, int version)
    {
        var versionData = await GetDesignVersionAsync(campaignId, version)
            ?? throw new InvalidOperationException($"Version {version} not found for campaign {campaignId}");

        var campaign = await _context.EmailCampaigns.FindAsync(campaignId)
            ?? throw new InvalidOperationException("Campaign not found");

        var currentJson = await LoadDesignFromBlobAsync(campaignId);

        var currentVersion = (await GetDesignVersionsAsync(campaignId))
            .Select(v => v.Version).DefaultIfEmpty(0).Max();

        var snapshot = new EmailDesignVersionDto
        {
            CampaignId = campaignId,
            Version = currentVersion + 1,
            Subject = campaign.Subject,
            Preheader = ExtractFromDesignJson(currentJson, "previewText"),
            FromName = campaign.FromName,
            DesignJson = currentJson ?? "{}",
            CreatedAt = DateTime.UtcNow,
            Reason = "snapshot-before-restore"
        };

        await SaveVersionToBlobAsync(snapshot);

        campaign.Subject = versionData.Subject;
        campaign.FromName = versionData.FromName ?? campaign.FromName;
        campaign.UpdatedAt = DateTime.UtcNow;

        var restoredDesignContent = ExtractFromDesignJson(versionData.DesignJson, "designContent")
            ?? versionData.DesignJson;
        var restoredMjml = ExtractFromDesignJson(versionData.DesignJson, "lastGeneratedMjml") ?? string.Empty;
        var restoredPreheader = ExtractFromDesignJson(versionData.DesignJson, "previewText")
            ?? versionData.Preheader;

        var conversionResult = await ConvertToHtmlAsync(restoredMjml, restoredPreheader);

        if (conversionResult.Success && conversionResult.Html != null)
            campaign.HtmlBody = conversionResult.Html;

        await _context.SaveChangesAsync();

        var versionDoc = new EmailDesignVersionDto
        {
            CampaignId = campaignId,
            Version = currentVersion + 2,
            Subject = campaign.Subject,
            Preheader = restoredPreheader,
            FromName = campaign.FromName,
            DesignJson = versionData.DesignJson,
            CreatedAt = DateTime.UtcNow,
            Reason = "restored-from-v" + version
        };

        await SaveVersionToBlobAsync(versionDoc);

        var currentDoc = new
        {
            schemaVersion = 2,
            designContent = restoredDesignContent,
            previewText = restoredPreheader,
            lastGeneratedMjml = restoredMjml,
            updatedAt = DateTime.UtcNow.ToString("O"),
            restoredFromVersion = version
        };

        await _blobService.UploadStringAsync(
            JsonSerializer.Serialize(currentDoc, new JsonSerializerOptions { WriteIndented = true }),
            $"design-{campaignId}.json",
            $"email-designs/{campaignId}");

        return new EmailV2TemplateDto
        {
            CampaignId = campaign.Id,
            Subject = campaign.Subject,
            FromName = campaign.FromName,
            DesignJson = restoredDesignContent,
            HtmlBody = campaign.HtmlBody,
            Status = campaign.Status,
            CreatedAt = campaign.CreatedAt
        };
    }

    private static string? ExtractFromDesignJson(string? json, string key)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty(key, out var value))
                return value.GetString();
        }
        catch { }
        return null;
    }

    private async Task SaveVersionToBlobAsync(EmailDesignVersionDto version)
    {
        var json = JsonSerializer.Serialize(version, new JsonSerializerOptions { WriteIndented = true });
        await _blobService.UploadStringAsync(
            json,
            $"v{version.Version:D4}.json",
            $"email-designs/{version.CampaignId}/versions");
    }

    private async Task SaveDesignToBlobAsync(EmailCampaign campaign, string json)
    {
        var campaignId = campaign.Id;
        try
        {
            var bytes = Encoding.UTF8.GetBytes(json);
            using var stream = new MemoryStream(bytes);
            var blobUrl = await _blobService.UploadAsync(
                stream,
                $"design-{campaignId}.json",
                "application/json",
                $"email-designs/{campaignId}");

            _logger.LogInformation("Design JSON saved for campaign {CampaignId}: {BlobUrl}",
                campaignId, blobUrl);

            var existingVersions = await GetDesignVersionsAsync(campaignId);
            var nextVersion = existingVersions.Select(v => v.Version).DefaultIfEmpty(0).Max() + 1;

            var versionDoc = new EmailDesignVersionDto
            {
                CampaignId = campaignId,
                Version = nextVersion,
                Subject = campaign.Subject,
                Preheader = ExtractFromDesignJson(json, "previewText"),
                FromName = campaign.FromName,
                DesignJson = json,
                CreatedAt = DateTime.UtcNow,
                Reason = "save"
            };

            await SaveVersionToBlobAsync(versionDoc);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save design JSON to blob for campaign {CampaignId}",
                campaignId);
            throw;
        }
    }

    private async Task<string?> LoadDesignFromBlobAsync(int campaignId)
    {
        try
        {
            return await _blobService.DownloadStringAsync(
                $"email-designs/{campaignId}/design-{campaignId}.json");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load design JSON from blob for campaign {CampaignId}",
                campaignId);
            return null;
        }
    }

    private string? GetBlobContainerBaseUrl()
    {
        var connectionString = _configuration["BlobConnectionString"]
            ?? _configuration.GetConnectionString("BlobConnectionString")
            ?? _configuration.GetConnectionString("AzureBlobStorage:ConnectionString")
            ?? _configuration.GetConnectionString("AzureBlobStorage__ConnectionString")
            ?? _configuration["AzureBlobStorage:ConnectionString"];

        if (string.IsNullOrWhiteSpace(connectionString) ||
            connectionString.StartsWith("REPLACE_WITH_", StringComparison.OrdinalIgnoreCase))
            return null;

        try
        {
            var parts = connectionString.Split(';');
            foreach (var part in parts)
            {
                var trimmed = part.Trim();
                if (trimmed.StartsWith("BlobEndpoint=", StringComparison.OrdinalIgnoreCase) ||
                    trimmed.StartsWith("AccountName=", StringComparison.OrdinalIgnoreCase))
                {
                    if (trimmed.StartsWith("BlobEndpoint=", StringComparison.OrdinalIgnoreCase))
                    {
                        return trimmed["BlobEndpoint=".Length..];
                    }
                }
            }

            var accountName = parts
                .Select(p => p.Trim())
                .FirstOrDefault(p => p.StartsWith("AccountName=", StringComparison.OrdinalIgnoreCase))
                ?["AccountName=".Length..];
            var containerName = _configuration["AzureBlobStorage:ContainerName"] ?? "media";

            return accountName != null
                ? $"https://{accountName}.blob.core.windows.net/{containerName}"
                : null;
        }
        catch
        {
            return null;
        }
    }

    private async Task DeleteDesignFromBlobAsync(int campaignId)
    {
        try
        {
            var containerUrl = GetBlobContainerBaseUrl();
            if (string.IsNullOrEmpty(containerUrl)) return;

            var blobUrl = $"{containerUrl.TrimEnd('/')}/email-designs/{campaignId}/design-{campaignId}.json";
            await _blobService.DeleteAsync(blobUrl);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete design blob for campaign {CampaignId}", campaignId);
        }
    }

    private static string BuildDesignDocument(string designContent, string? previewText, string mjml)
    {
        var doc = new
        {
            schemaVersion = 1,
            designContent = designContent,
            previewText = previewText ?? string.Empty,
            lastGeneratedMjml = mjml,
            updatedAt = DateTime.UtcNow.ToString("O")
        };
        return JsonSerializer.Serialize(doc, new JsonSerializerOptions { WriteIndented = true });
    }

    private static string InjectRtlDirection(string mjml)
    {
        if (mjml.Contains("direction=\"rtl\"", StringComparison.OrdinalIgnoreCase))
            return mjml;

        var openingTag = "<mjml";
        var idx = mjml.IndexOf(openingTag, StringComparison.OrdinalIgnoreCase);
        if (idx < 0) return mjml;

        return mjml[..(idx + openingTag.Length)] + " direction=\"rtl\"" + mjml[(idx + openingTag.Length)..];
    }

    private static string FinalizeEmailHtml(string html, string? previewText)
    {
        // Gmail clips messages over roughly 102 KB. Mjml.Net already avoids
        // pretty-printing, but comments and whitespace between tags can still
        // materially inflate newsletters with many content cards.
        var compact = Regex.Replace(
            html,
            @"<!--(?!\[if\s|<!\[endif\])[\s\S]*?-->",
            string.Empty,
            RegexOptions.IgnoreCase);
        compact = Regex.Replace(compact, @">\s+<", "><");
        compact = MinifyCssBlocks(compact);
        compact = MinifyInlineStyles(compact);
        compact = Regex.Replace(compact, "\\s+(?:class|id|style)=\\\"\\\"", string.Empty);

        // `direction` on <mjml> is not inherited consistently by email
        // clients. Put the direction on the generated document as well.
        compact = AddRtlAttribute(compact, "html");
        compact = AddRtlAttribute(compact, "body");
        compact = AddRtlAttributesToTextContainers(compact);
        compact = InjectRtlTextRules(compact);
        compact = StabilizeHebrewTerminalPunctuation(compact);
        compact = InjectPreheader(compact, previewText);
        return compact;
    }

    private static string MinifyCssBlocks(string html) =>
        Regex.Replace(
            html,
            @"(<style\b[^>]*>)(?<css>[\s\S]*?)(</style>)",
            match => match.Groups[1].Value + MinifyCss(match.Groups["css"].Value) + match.Groups[3].Value,
            RegexOptions.IgnoreCase,
            TimeSpan.FromSeconds(1));

    private static string MinifyInlineStyles(string html) =>
        Regex.Replace(
            html,
            "\\sstyle=\\\"(?<css>[^\\\"]*)\\\"",
            match => $" style=\"{MinifyCss(match.Groups["css"].Value)}\"",
            RegexOptions.IgnoreCase,
            TimeSpan.FromSeconds(1));

    private static string MinifyCss(string css)
    {
        var compact = Regex.Replace(css, @"/\*[\s\S]*?\*/", string.Empty);
        compact = Regex.Replace(compact, @"\s+", " ");
        compact = Regex.Replace(compact, @"\s*([:;,{}])\s*", "$1");
        return Regex.Replace(compact, @"(?<=[:\s])0px\b", "0", RegexOptions.IgnoreCase);
    }

    private static string InjectRtlTextRules(string html)
    {
        const string rules = "<style type=\"text/css\">body,table,tbody,tr,td,th,div,p,h1,h2,h3,h4,h5,h6,span,a{direction:rtl!important;unicode-bidi:plaintext!important;}td,th,div,p,h1,h2,h3,h4,h5,h6{text-align:right;}[dir=\"rtl\"]{unicode-bidi:plaintext!important;}</style>";
        var headEnd = html.IndexOf("</head>", StringComparison.OrdinalIgnoreCase);
        return headEnd >= 0
            ? html.Insert(headEnd, rules)
            : rules + html;
    }

    private static string AddRtlAttributesToTextContainers(string html) =>
        // Gmail can discard or lower the priority of rules from <head>. Put the
        // direction inline on every MJML text wrapper, which also overrides any
        // incidental LTR value carried over from a custom block.
        Regex.Replace(
            html,
            @"<(?<tag>td|th|div|p|h1|h2|h3|h4|h5|h6|span|a)\b(?<attributes>[^>]*)>",
            match =>
            {
                var attributes = match.Groups["attributes"].Value;
                if (!Regex.IsMatch(attributes, @"\bdir\s*=", RegexOptions.IgnoreCase))
                    attributes += " dir=\"rtl\"";

                const string bidiStyle = "direction:rtl!important;unicode-bidi:plaintext!important;";
                if (Regex.IsMatch(attributes, @"\bstyle\s*=", RegexOptions.IgnoreCase))
                {
                    attributes = Regex.Replace(
                        attributes,
                        "\\bstyle\\s*=\\s*(?<quote>[\\\"'])(?<style>.*?)\\k<quote>",
                        styleMatch => $"style=\"{styleMatch.Groups["style"].Value.TrimEnd(';')};{bidiStyle}\"",
                        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
                        TimeSpan.FromSeconds(1));
                }
                else
                {
                    attributes += $" style=\"{bidiStyle}\"";
                }

                return $"<{match.Groups["tag"].Value}{attributes}>";
            },
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
            TimeSpan.FromSeconds(1));

    private static string StabilizeHebrewTerminalPunctuation(string html) =>
        // Some email clients ignore CSS bidi rules inside MJML's table wrappers.
        // An RLM before trailing neutral punctuation keeps it attached to a Hebrew run.
        Regex.Replace(
            html,
            @"([\u0590-\u05FF])([!?.:;]+)(?=(?:\s|<|$))",
            "$1&#8207;$2",
            RegexOptions.CultureInvariant,
            TimeSpan.FromSeconds(1));

    private static string InjectPreheader(string html, string? previewText)
    {
        var text = previewText?.Trim();
        if (string.IsNullOrEmpty(text))
            return html;

        var encoded = System.Net.WebUtility.HtmlEncode(text);
        const string style = "display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;";
        var preheader = $"<div dir=\"rtl\" style=\"{style}\">&#8207;{encoded}&#8207;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>";
        var bodyOpeningEnd = html.IndexOf('>');
        if (bodyOpeningEnd >= 0 && html[..(bodyOpeningEnd + 1)].Contains("<body", StringComparison.OrdinalIgnoreCase))
            return html.Insert(bodyOpeningEnd + 1, preheader);

        var bodyStart = html.IndexOf("<body", StringComparison.OrdinalIgnoreCase);
        if (bodyStart < 0) return preheader + html;
        bodyOpeningEnd = html.IndexOf('>', bodyStart);
        return bodyOpeningEnd >= 0 ? html.Insert(bodyOpeningEnd + 1, preheader) : preheader + html;
    }

    private static string AddRtlAttribute(string html, string tagName) =>
        Regex.Replace(
            html,
            $@"<{tagName}\b(?<attributes>(?![^>]*\bdir\s*=)[^>]*)>",
            match => $"<{tagName}{match.Groups["attributes"].Value} dir=\"rtl\">",
            RegexOptions.IgnoreCase,
            TimeSpan.FromSeconds(1));

        private static string InjectUnsubscribeFooter(string mjml)
        {
            if (mjml.Contains("אקורדישקייט — כל הזכויות שמורות", StringComparison.Ordinal))
                return mjml;

            var footer = @"
<mj-section background-color=""#F2F2F2"" padding=""18px 32px"" text-align=""center"">
  <mj-column>
    <mj-text font-size=""12px"" color=""#404040"" align=""center"" direction=""rtl"">
      <span dir=""rtl"" style=""direction:rtl;unicode-bidi:plaintext;"">&rlm;&copy; אקורדישקייט — כל הזכויות שמורות</span>
    </mj-text>
    <mj-text font-size=""12px"" color=""#404040"" align=""center"" direction=""rtl"">
      <span dir=""rtl"" style=""direction:rtl;unicode-bidi:plaintext;"">לא רוצה לקבל מאיתנו דיוור שיווקי?</span><br />
      <a dir=""rtl"" href=""{{ params.unsubscribe_url }}"" style=""direction:rtl;unicode-bidi:plaintext;color:#000000;font-weight:700;text-decoration:underline;"">להסרה מרשימת התפוצה</a>
    </mj-text>
  </mj-column>
</mj-section>";

        var bodyClosingTag = "</mj-body>";
        var bodyIdx = mjml.LastIndexOf(bodyClosingTag, StringComparison.OrdinalIgnoreCase);
        if (bodyIdx >= 0)
        {
            return mjml[..bodyIdx] + footer + "\n" + mjml[bodyIdx..];
        }

        var closingTag = "</mjml>";
        var lastIndex = mjml.LastIndexOf(closingTag, StringComparison.OrdinalIgnoreCase);
        if (lastIndex >= 0)
        {
            return mjml[..lastIndex] + footer + "\n" + mjml[lastIndex..];
        }
        return mjml;
    }

    private string BuildUnsubscribeUrl(string email)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var payload = Base64UrlEncode(Encoding.UTF8.GetBytes(normalizedEmail));
        var secret = _configuration["EmailUnsubscribe:Secret"]
            ?? _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("Email unsubscribe signing secret is not configured.");
        using var hmac = new System.Security.Cryptography.HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var signature = hmac.ComputeHash(Encoding.UTF8.GetBytes(payload));
        var token = $"{payload}.{Base64UrlEncode(signature)}";
        var baseUrl = (_configuration["Backend:BaseUrl"] ?? "https://api.akordishkayt.com").TrimEnd('/');
        return $"{baseUrl}/api/Email/unsubscribe-page?token={Uri.EscapeDataString(token)}";
    }

    private static string Base64UrlEncode(byte[] value) =>
        Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
