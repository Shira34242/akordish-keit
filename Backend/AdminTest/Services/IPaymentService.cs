using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IPaymentService
{
    /// <summary>
    /// יצירת דף תשלום ב-Cardcom — מחזיר URL
    /// </summary>
    Task<CreateCheckoutResponseDto> CreateCheckoutSessionAsync(int userId, CreateCheckoutSessionDto dto);

    /// <summary>
    /// טיפול ב-Webhook שמגיע מ-Cardcom לאחר תשלום
    /// </summary>
    Task HandleWebhookAsync(string payload, string signature);

    /// <summary>
    /// אימות ישיר של LowProfileCode — מפעיל מנוי אם התשלום הצליח
    /// </summary>
    Task<bool> VerifyAndActivateSessionAsync(string lowProfileCode, int authenticatedUserId);
}
