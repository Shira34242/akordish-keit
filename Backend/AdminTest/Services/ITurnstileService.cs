namespace AkordishKeit.Services;

public interface ITurnstileService
{
    Task<TurnstileValidationResult> ValidateAsync(
        string? token,
        string expectedAction,
        CancellationToken cancellationToken = default);
}

public enum TurnstileFailure
{
    None,
    MissingToken,
    InvalidToken,
    ServiceUnavailable,
    ConfigurationMissing
}

public sealed record TurnstileValidationResult(bool IsValid, TurnstileFailure Failure)
{
    public static TurnstileValidationResult Success { get; } = new(true, TurnstileFailure.None);
}
