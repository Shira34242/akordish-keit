using AkordishKeit.Models.Enum;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace AkordishKeit.Models.DTOs;

/// <summary>
/// בקשה ליצירת דף תשלום ב-Cardcom
/// </summary>
public class CreateCheckoutSessionDto
{
    [Required]
    public SubscriptionPlan Plan { get; set; }

    [Required]
    public string BillingCycle { get; set; } = "Monthly"; // "Monthly" | "Yearly"
}

/// <summary>
/// תשובה עם ה-URL לדף התשלום של Cardcom
/// </summary>
public class CreateCheckoutResponseDto
{
    public string CheckoutUrl { get; set; } = string.Empty;
    public string SessionId   { get; set; } = string.Empty; // LowProfileCode
}

// ════════════════════════════════════════════════════════════
//   DTOs פנימיים לתקשורת עם Cardcom API
//   חשוב: שמות השדות חייבים להיות PascalCase בדיוק כמו ב-Cardcom
// ════════════════════════════════════════════════════════════

internal class CardcomCreateRequest
{
    [JsonPropertyName("TerminalNumber")]
    public int TerminalNumber { get; set; }

    [JsonPropertyName("ApiName")]
    public string ApiName { get; set; } = string.Empty;

    [JsonPropertyName("Amount")]
    public decimal Amount { get; set; }

    [JsonPropertyName("CoinID")]
    public int CoinID { get; set; } = 1; // 1 = ILS

    [JsonPropertyName("MaxPayments")]
    public int MaxPayments { get; set; } = 1;

    [JsonPropertyName("Description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("SuccessRedirectUrl")]
    public string SuccessRedirectUrl { get; set; } = string.Empty;

    [JsonPropertyName("FailedRedirectUrl")]
    public string FailedRedirectUrl { get; set; } = string.Empty;

    [JsonPropertyName("WebHookUrl")]
    public string WebHookUrl { get; set; } = string.Empty;

    [JsonPropertyName("Language")]
    public string Language { get; set; } = "he";

    [JsonPropertyName("ReturnValue")]
    public string ReturnValue { get; set; } = string.Empty; // userId|plan|cycle

    [JsonPropertyName("CreateToken")]
    public bool CreateToken { get; set; } = true;
}

internal class CardcomCreateResponse
{
    [JsonPropertyName("ResponseCode")]
    public int ResponseCode { get; set; }

    [JsonPropertyName("Description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("Url")]
    public string Url { get; set; } = string.Empty;

    [JsonPropertyName("LowProfileCode")]
    public string LowProfileCode { get; set; } = string.Empty;
}

internal class CardcomLPResult
{
    [JsonPropertyName("ResponseCode")]
    public int ResponseCode { get; set; }

    [JsonPropertyName("LowProfileCode")]
    public string LowProfileCode { get; set; } = string.Empty;

    [JsonPropertyName("ReturnValue")]
    public string? ReturnValue { get; set; }

    [JsonPropertyName("DealResponse")]
    public CardcomDealResponse? DealResponse { get; set; }
}

internal class CardcomDealResponse
{
    [JsonPropertyName("ResponseCode")]
    public int ResponseCode { get; set; }

    [JsonPropertyName("CardToken")]
    public string? CardToken { get; set; }

    [JsonPropertyName("CardExpiration")]
    public string? CardExpiration { get; set; }

    [JsonPropertyName("Last4Digits")]
    public string? Last4Digits { get; set; }

    [JsonPropertyName("InternalDealNumber")]
    public int InternalDealNumber { get; set; }
}

/// <summary>
/// Webhook שמגיע מ-Cardcom כ-Form POST לאחר תשלום
/// </summary>
public class CardcomWebhookDto
{
    [JsonPropertyName("ResponseCode")]
    public int ResponseCode { get; set; }

    [JsonPropertyName("LowProfileCode")]
    public string? LowProfileCode { get; set; }

    [JsonPropertyName("ReturnValue")]
    public string? ReturnValue { get; set; }

    [JsonPropertyName("Sum")]
    public decimal Sum { get; set; }

    [JsonPropertyName("CardToken")]
    public string? CardToken { get; set; }

    [JsonPropertyName("CardExpiration")]
    public string? CardExpiration { get; set; }

    [JsonPropertyName("Last4Digits")]
    public string? Last4Digits { get; set; }
}
