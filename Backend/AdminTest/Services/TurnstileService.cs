using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace AkordishKeit.Services;

public sealed class TurnstileService : ITurnstileService
{
    private const int MaxTokenLength = 2048;
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<TurnstileService> _logger;

    public TurnstileService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<TurnstileService> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<TurnstileValidationResult> ValidateAsync(
        string? token,
        string expectedAction,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
            return new(false, TurnstileFailure.MissingToken);

        if (token.Length > MaxTokenLength)
            return new(false, TurnstileFailure.InvalidToken);

        var secret = _configuration["TURNSTILE_SECRET_KEY"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            _logger.LogError("Turnstile validation is unavailable because the secret is not configured");
            return new(false, TurnstileFailure.ConfigurationMissing);
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "turnstile/v0/siteverify")
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["secret"] = secret,
                    ["response"] = token
                })
            };

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Turnstile Siteverify returned HTTP {StatusCode}", (int)response.StatusCode);
                return new(false, TurnstileFailure.ServiceUnavailable);
            }

            var verification = await response.Content.ReadFromJsonAsync<TurnstileSiteverifyResponse>(
                cancellationToken: cancellationToken);

            if (verification is null || !verification.Success)
                return new(false, TurnstileFailure.InvalidToken);

            if (!string.Equals(verification.Action, expectedAction, StringComparison.Ordinal))
            {
                _logger.LogWarning("Turnstile validation rejected an unexpected action");
                return new(false, TurnstileFailure.InvalidToken);
            }

            var allowedHostnames = GetAllowedHostnames();
            if (string.IsNullOrWhiteSpace(verification.Hostname)
                || allowedHostnames.Count == 0
                || !allowedHostnames.Contains(verification.Hostname))
            {
                _logger.LogWarning("Turnstile validation rejected an unexpected hostname");
                return new(false, TurnstileFailure.InvalidToken);
            }

            return TurnstileValidationResult.Success;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Turnstile Siteverify timed out");
            return new(false, TurnstileFailure.ServiceUnavailable);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Turnstile Siteverify request failed");
            return new(false, TurnstileFailure.ServiceUnavailable);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Turnstile validation failed unexpectedly");
            return new(false, TurnstileFailure.ServiceUnavailable);
        }
    }

    private HashSet<string> GetAllowedHostnames()
    {
        var environmentValue = _configuration["TURNSTILE_ALLOWED_HOSTNAMES"];
        var configured = string.IsNullOrWhiteSpace(environmentValue)
            ? _configuration.GetSection("Turnstile:AllowedHostnames").Get<string[]>() ?? []
            : environmentValue.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return configured
            .Where(hostname => !string.IsNullOrWhiteSpace(hostname))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
    }

    private sealed class TurnstileSiteverifyResponse
    {
        [JsonPropertyName("success")]
        public bool Success { get; init; }

        [JsonPropertyName("hostname")]
        public string? Hostname { get; init; }

        [JsonPropertyName("action")]
        public string? Action { get; init; }
    }
}
