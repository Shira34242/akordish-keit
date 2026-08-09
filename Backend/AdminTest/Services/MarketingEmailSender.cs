namespace AkordishKeit.Services;

/// <summary>
/// The verified identity used exclusively for marketing campaigns and their test sends.
/// Transactional messages (for example password reset) deliberately keep their own
/// configured sender.
/// </summary>
public static class MarketingEmailSender
{
    public const string FromEmail = "newsletter@akordishkayt.com";
    public const string FromName = "AKORDISHKAYT";
    public const string ReplyToEmail = "akordishkayt@gmail.com";
}
