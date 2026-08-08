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

        var conversionResult = await ConvertToHtmlAsync(dto.Mjml);
        if (!conversionResult.Success)
        {
            throw new InvalidOperationException(
                $"MJML conversion failed: {conversionResult.Error}");
        }

        campaign.HtmlBody = conversionResult.Html!;
        await _context.SaveChangesAsync();

        var designJson = BuildDesignDocument(dto.DesignJson, dto.PreviewText, dto.Mjml);
        await SaveDesignToBlobAsync(campaign.Id, designJson);

        return new EmailV2TemplateDto
        {
            CampaignId = campaign.Id,
            Subject = campaign.Subject,
            FromName = campaign.FromName,
            FromEmail = dto.FromEmail,
            DesignJson = designJson,
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

        var designJson = await LoadDesignFromBlobAsync(campaignId);

        return new EmailV2TemplateDto
        {
            CampaignId = campaign.Id,
            Subject = campaign.Subject,
            FromName = campaign.FromName,
            DesignJson = designJson ?? "{}",
            HtmlBody = campaign.HtmlBody,
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

    public async Task<EmailV2ConversionResultDto> ConvertToHtmlAsync(string mjml)
    {
        var result = new EmailV2ConversionResultDto();
        var warnings = new List<string>();

        try
        {
            var cleanMjml = SanitizeMjml(mjml);
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

            result.Success = true;
            result.Html = renderResult.Html;
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

        sanitized = Regex.Replace(
            sanitized,
            @"<mj-text\b[^>]*>(.*?)</mj-text>",
            match =>
            {
                var content = match.Groups[1].Value;
                if (content.Contains("<table"))
                {
                    content = Regex.Replace(content,
                        @"<table\b[^>]*>.*?</table>",
                        m => $"<mj-raw>{m.Value}</mj-raw>",
                        RegexOptions.Singleline | RegexOptions.IgnoreCase);
                }
                return $"<mj-text>{content}</mj-text>";
            },
            RegexOptions.Singleline | RegexOptions.IgnoreCase);

        return sanitized;
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

        var conversionResult = await ConvertToHtmlAsync(
            ExtractFromDesignJson(versionData.DesignJson, "lastGeneratedMjml") ?? string.Empty);

        if (conversionResult.Success && conversionResult.Html != null)
            campaign.HtmlBody = conversionResult.Html;

        await _context.SaveChangesAsync();

        var versionDoc = new EmailDesignVersionDto
        {
            CampaignId = campaignId,
            Version = currentVersion + 2,
            Subject = campaign.Subject,
            Preheader = ExtractFromDesignJson(versionData.DesignJson, "previewText"),
            FromName = campaign.FromName,
            DesignJson = versionData.DesignJson,
            CreatedAt = DateTime.UtcNow,
            Reason = "restored-from-v" + version
        };

        await SaveVersionToBlobAsync(versionDoc);

        var currentDoc = new
        {
            schemaVersion = 2,
            designContent = versionData.DesignJson,
            previewText = versionData.Preheader,
            lastGeneratedMjml = ExtractFromDesignJson(versionData.DesignJson, "lastGeneratedMjml"),
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
            DesignJson = versionData.DesignJson,
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

    private async Task SaveDesignToBlobAsync(int campaignId, string json)
    {
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
                Subject = ExtractFromDesignJson(json, "previewText") is { } pt
                    ? ExtractFromDesignJson(json, "designContent") ?? string.Empty
                    : string.Empty,
                Preheader = ExtractFromDesignJson(json, "previewText"),
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
            var containerUrl = GetBlobContainerBaseUrl();
            if (string.IsNullOrEmpty(containerUrl)) return null;

            var blobUrl = $"{containerUrl.TrimEnd('/')}/email-designs/{campaignId}/design-{campaignId}.json";

            var client = _httpClientFactory.CreateClient();
            var response = await client.GetAsync(blobUrl);
            if (!response.IsSuccessStatusCode) return null;

            return await response.Content.ReadAsStringAsync();
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

        private static string InjectUnsubscribeFooter(string mjml)
        {
            if (mjml.Contains("אקורדישקייט — כל הזכויות שמורות", StringComparison.Ordinal))
                return mjml;

            var footer = @"
<mj-section background-color=""#F2F2F2"" padding=""18px 32px"" text-align=""center"">
  <mj-column>
    <mj-text font-size=""12px"" color=""#404040"" align=""center"" direction=""rtl"">
      &copy; אקורדישקייט — כל הזכויות שמורות
    </mj-text>
    <mj-text font-size=""12px"" color=""#404040"" align=""center"" direction=""rtl"">
      לא רוצה לקבל מאיתנו דיוור שיווקי?
      <a href=""{{ params.unsubscribe_url }}"" style=""color:#000000;font-weight:700;text-decoration:underline;"">
        להסרה מרשימת התפוצה
      </a>
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
