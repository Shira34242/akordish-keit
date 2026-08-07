using System.Text;
using System.Text.Json;
using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services.EmailPipeline;

public class BrevoEmailSender : IBrevoEmailSender
{
    private const string BrevoApiUrl = "https://api.brevo.com/v3/smtp/email";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<BrevoEmailSender> _logger;

    public BrevoEmailSender(IHttpClientFactory httpClientFactory, ILogger<BrevoEmailSender> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<BrevoSendResult> SendAsync(BrevoSendRequest request)
    {
        try
        {
            var payload = BuildPayload(request);
            var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            });

            var client = _httpClientFactory.CreateClient();
            using var req = new HttpRequestMessage(HttpMethod.Post, BrevoApiUrl);
            req.Headers.Add("api-key", request.ApiKey);
            req.Headers.Add("accept", "application/json");
            req.Content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.SendAsync(req);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Brevo send failed {Status}: {Body}", response.StatusCode, body);
                return new BrevoSendResult
                {
                    Success = false,
                    Error = $"Brevo returned {response.StatusCode}",
                    HttpStatus = (int)response.StatusCode
                };
            }

            var messageId = ExtractMessageId(body);

            return new BrevoSendResult
            {
                Success = true,
                MessageId = messageId,
                HttpStatus = (int)response.StatusCode
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Brevo send error");
            return new BrevoSendResult { Success = false, Error = ex.Message };
        }
    }

    private static object BuildPayload(BrevoSendRequest request)
    {
        var payload = new Dictionary<string, object?>
        {
            ["sender"] = new { email = request.FromEmail, name = request.FromName },
            ["to"] = new[] { new { email = request.ToEmail, name = request.ToName ?? request.ToEmail } },
            ["subject"] = request.Subject,
            ["htmlContent"] = request.HtmlContent
        };

        if (!string.IsNullOrWhiteSpace(request.TextContent))
            payload["textContent"] = request.TextContent;

        if (request.Tags is { Count: > 0 })
            payload["tags"] = request.Tags;

        if (request.Params is { Count: > 0 })
            payload["params"] = request.Params;

        return payload;
    }

    private static string? ExtractMessageId(string responseBody)
    {
        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            if (doc.RootElement.TryGetProperty("messageId", out var messageId))
                return messageId.GetString();

            if (doc.RootElement.TryGetProperty("messageIds", out var messageIds)
                && messageIds.ValueKind == JsonValueKind.Array
                && messageIds.GetArrayLength() > 0)
                return messageIds[0].GetString();

            return null;
        }
        catch
        {
            return null;
        }
    }
}
