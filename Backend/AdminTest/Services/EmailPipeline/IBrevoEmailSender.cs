namespace AkordishKeit.Services.EmailPipeline;

public interface IBrevoEmailSender
{
    Task<BrevoSendResult> SendAsync(BrevoSendRequest request);
}

public class BrevoSendRequest
{
    public string ApiKey { get; set; } = string.Empty;
    public string FromEmail { get; set; } = string.Empty;
    public string FromName { get; set; } = string.Empty;
    public string? ReplyToEmail { get; set; }
    public string ToEmail { get; set; } = string.Empty;
    public string? ToName { get; set; }
    public string Subject { get; set; } = string.Empty;
    public string HtmlContent { get; set; } = string.Empty;
    public string? TextContent { get; set; }
    public List<string>? Tags { get; set; }
    public Dictionary<string, object>? Params { get; set; }
}

public class BrevoSendResult
{
    public bool Success { get; set; }
    public string? MessageId { get; set; }
    public string? Error { get; set; }
    public int HttpStatus { get; set; }
}
