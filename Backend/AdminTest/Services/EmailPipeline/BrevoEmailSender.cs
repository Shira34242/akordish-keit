using System.Text;
using System.Text.Json;
using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services.EmailPipeline;

public class BrevoEmailSender : IBrevoEmailSender
{
    private const string BrevoApiUrl = "https://api.brevo.com/v3/smtp/email";
    private const int MaxAttempts = 3;

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
            for (var attempt = 1; attempt <= MaxAttempts; attempt++)
            {
                using var req = new HttpRequestMessage(HttpMethod.Post, BrevoApiUrl);
                req.Headers.Add("api-key", request.ApiKey);
                req.Headers.Add("accept", "application/json");
                req.Content = new StringContent(json, Encoding.UTF8, "application/json");
                using var response = await client.SendAsync(req);
                var body = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    var messageId = ExtractMessageId(body);
                    _logger.LogInformation("Brevo accepted email for {Recipient}: HTTP {Status} messageId={MessageId}", request.ToEmail, (int)response.StatusCode, messageId);
                    return new BrevoSendResult
                    {
                        Success = true,
                        MessageId = messageId,
                        HttpStatus = (int)response.StatusCode
                    };
                }

                var statusCode = (int)response.StatusCode;
                var retryable = statusCode is 408 or 429 or 500 or 502 or 503 or 504;
                var rateLimitHeaders = GetRateLimitHeaders(response);
                if (!retryable || attempt == MaxAttempts)
                {
                    _logger.LogError("Brevo send failed for {Recipient}: HTTP {Status}, attempt {Attempt}/{MaxAttempts}, body={Body}, headers={RateLimitHeaders}",
                        request.ToEmail, statusCode, attempt, MaxAttempts, body, rateLimitHeaders);
                    return new BrevoSendResult
                    {
                        Success = false,
                        Error = $"Brevo returned {statusCode}",
                        HttpStatus = statusCode
                    };
                }

                var retryAfter = GetRetryDelay(response, attempt);
                _logger.LogWarning("Brevo retry for {Recipient}: HTTP {Status}, attempt {Attempt}/{MaxAttempts}, delay={Delay}, body={Body}, headers={RateLimitHeaders}",
                    request.ToEmail, statusCode, attempt, MaxAttempts, retryAfter, body, rateLimitHeaders);
                await Task.Delay(retryAfter);
            }

            return new BrevoSendResult { Success = false, Error = "Brevo retry loop ended unexpectedly." };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Brevo send error");
            return new BrevoSendResult { Success = false, Error = ex.Message };
        }
    }

    private static TimeSpan GetRetryDelay(HttpResponseMessage response, int attempt)
    {
        if (response.Headers.RetryAfter?.Delta is { } retryAfter && retryAfter > TimeSpan.Zero)
            return retryAfter;

        if (response.Headers.TryGetValues("x-sib-ratelimit-reset", out var resetValues)
            && long.TryParse(resetValues.FirstOrDefault(), out var reset))
        {
            var delay = reset > 1_000_000_000
                ? DateTimeOffset.FromUnixTimeSeconds(reset) - DateTimeOffset.UtcNow
                : TimeSpan.FromSeconds(reset);
            if (delay > TimeSpan.Zero) return delay;
        }

        var baseSeconds = Math.Pow(2, attempt - 1);
        return TimeSpan.FromSeconds(baseSeconds + Random.Shared.NextDouble());
    }

    private static string GetRateLimitHeaders(HttpResponseMessage response)
    {
        static string Read(HttpResponseMessage response, string name) => response.Headers.TryGetValues(name, out var values)
            ? values.FirstOrDefault() ?? ""
            : "";
        return $"retry-after={Read(response, "Retry-After")}; limit={Read(response, "x-sib-ratelimit-limit")}; remaining={Read(response, "x-sib-ratelimit-remaining")}; reset={Read(response, "x-sib-ratelimit-reset")}";
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

        if (!string.IsNullOrWhiteSpace(request.ReplyToEmail))
            payload["replyTo"] = new { email = request.ReplyToEmail, name = request.FromName };

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
