using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Json;
using System.Text.Json;
using DbSubscription = AkordishKeit.Models.Entities.Subscription;

namespace AkordishKeit.Services;

/// <summary>
/// שירות תשלומים — מנהל Cardcom LowProfile ו-Webhooks
/// </summary>
public class PaymentService : IPaymentService
{
    private readonly AkordishKeitDbContext _context;
    private readonly IConfiguration       _config;
    private readonly IHttpClientFactory   _httpFactory;
    private readonly string               _frontendUrl;
    private readonly int                  _terminalNumber;
    private readonly string               _apiName;

    private const string CardcomApiBase = "https://secure.cardcom.solutions/api/v11";

    public PaymentService(
        AkordishKeitDbContext context,
        IConfiguration config,
        IHttpClientFactory httpFactory)
    {
        _context        = context;
        _config         = config;
        _httpFactory    = httpFactory;
        _frontendUrl    = config["Frontend:BaseUrl"] ?? "http://localhost:4200";
        _terminalNumber = int.Parse(config["Cardcom:TerminalNumber"] ?? "0");
        _apiName        = config["Cardcom:ApiName"] ?? string.Empty;
    }

    // ════════════════════════════════════════════════════════════
    //   יצירת דף תשלום ב-Cardcom
    // ════════════════════════════════════════════════════════════

    public async Task<CreateCheckoutResponseDto> CreateCheckoutSessionAsync(
        int userId, CreateCheckoutSessionDto dto)
    {
        var user = await _context.Users.FindAsync(userId)
            ?? throw new ArgumentException("משתמש לא נמצא");
        _ = user; // suppress unused warning

        // בדיקת מנוי קיים
        var hasActive = await _context.Subscriptions
            .AnyAsync(s => s.UserId == userId &&
                          (s.Status == SubscriptionStatus.Active ||
                           s.Status == SubscriptionStatus.Trial));
        if (hasActive)
            throw new InvalidOperationException("למשתמש כבר יש מנוי פעיל");

        var amount      = GetPlanPrice(dto.Plan, dto.BillingCycle);
        var description = GetPlanDescription(dto.Plan, dto.BillingCycle);

        // ReturnValue — מידע שנחזיר ב-webhook: userId|plan|cycle
        var returnValue = $"{userId}|{(int)dto.Plan}|{dto.BillingCycle}";

        var request = new CardcomCreateRequest
        {
            TerminalNumber     = _terminalNumber,
            ApiName            = _apiName,
            Amount             = amount,
            Description        = description,
            // Cardcom מוסיף ?LowProfileCode=xxx אוטומטית ל-URL זה
            SuccessRedirectUrl = $"{_frontendUrl}/subscription/success",
            FailedRedirectUrl  = $"{_frontendUrl}/subscription/cancel",
            WebHookUrl         = $"{_config["Backend:BaseUrl"] ?? "https://localhost:44395"}/api/payments/webhook",
            ReturnValue        = returnValue,
            CreateToken        = true
        };

        var http = _httpFactory.CreateClient();

        // חשוב: Cardcom מצפה ל-PascalCase — JsonSerializerOptions מבטיח זאת
        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = null };
        var response    = await http.PostAsJsonAsync($"{CardcomApiBase}/LowProfile/Create", request, jsonOptions);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<CardcomCreateResponse>(
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (result == null || result.ResponseCode != 0)
            throw new InvalidOperationException(
                $"שגיאת Cardcom: {result?.Description ?? "תגובה ריקה"}");

        // שמירת מנוי בסטטוס "ממתין לתשלום"
        var pendingSub = new DbSubscription
        {
            UserId            = userId,
            Plan              = dto.Plan,
            Status            = SubscriptionStatus.PendingPayment,
            BillingCycle      = dto.BillingCycle,
            Price             = amount,
            Currency          = "ILS",
            IsAutoRenew       = true,
            StartDate         = DateTime.UtcNow,
            CreatedAt         = DateTime.UtcNow,
            ExternalPaymentId = result.LowProfileCode
        };
        _context.Subscriptions.Add(pendingSub);
        await _context.SaveChangesAsync();

        return new CreateCheckoutResponseDto
        {
            CheckoutUrl = result.Url,
            SessionId   = result.LowProfileCode
        };
    }

    // ════════════════════════════════════════════════════════════
    //   Webhook — Cardcom שולח POST לאחר תשלום
    // ════════════════════════════════════════════════════════════

    public async Task HandleWebhookAsync(string payload, string signature)
    {
        // Cardcom שולח Webhook כ-Form POST (application/x-www-form-urlencoded)
        // נפרסר ידנית מה-payload
        string? lowProfileCode = null;

        try
        {
            // ניסיון לפרסר כ-Form data
            var formPairs = payload.Split('&');
            var formData  = formPairs
                .Select(p => p.Split('=', 2))
                .Where(p => p.Length == 2)
                .ToDictionary(
                    p => Uri.UnescapeDataString(p[0]),
                    p => Uri.UnescapeDataString(p[1]),
                    StringComparer.OrdinalIgnoreCase);

            formData.TryGetValue("LowProfileCode", out lowProfileCode);

            // אם לא נמצא כ-Form, ננסה כ-JSON
            if (string.IsNullOrEmpty(lowProfileCode) && payload.TrimStart().StartsWith("{"))
            {
                var webhook = JsonSerializer.Deserialize<CardcomWebhookDto>(payload,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                lowProfileCode = webhook?.LowProfileCode;
            }
        }
        catch
        {
            throw new ArgumentException("Payload לא תקין");
        }

        if (string.IsNullOrEmpty(lowProfileCode))
            return;

        // אמת ישירות מול Cardcom API — לא סומכים על ה-webhook לבד
        var verified = await GetLPResultAsync(lowProfileCode);
        if (verified == null || verified.ResponseCode != 0)
            return;

        if (verified.DealResponse?.ResponseCode != 0)
            return; // עסקה נכשלה

        await ActivateSubscriptionAsync(
            lowProfileCode,
            verified.ReturnValue,
            verified.DealResponse.CardToken,
            verified.DealResponse.CardExpiration,
            verified.DealResponse.Last4Digits);
    }

    // ════════════════════════════════════════════════════════════
    //   אימות ישיר (fallback כשה-webhook לא הגיע)
    // ════════════════════════════════════════════════════════════

    public async Task<bool> VerifyAndActivateSessionAsync(string lowProfileCode, int authenticatedUserId)
    {
        var result = await GetLPResultAsync(lowProfileCode);

        if (result == null || result.ResponseCode != 0)
            return false;

        if (result.DealResponse?.ResponseCode != 0)
            return false;

        // אמת בעלות — userId ב-ReturnValue חייב להתאים
        if (!ParseReturnValue(result.ReturnValue, out int sessionUserId, out _, out _))
            return false;

        if (sessionUserId != authenticatedUserId)
            throw new UnauthorizedAccessException("הסשן לא שייך למשתמש הנוכחי");

        // בדוק אם כבר הופעל
        var existingSub = await _context.Subscriptions
            .FirstOrDefaultAsync(s => s.ExternalPaymentId == lowProfileCode &&
                                      s.Status == SubscriptionStatus.Active);
        if (existingSub != null)
            return true;

        await ActivateSubscriptionAsync(
            lowProfileCode,
            result.ReturnValue,
            result.DealResponse.CardToken,
            result.DealResponse.CardExpiration,
            result.DealResponse.Last4Digits);

        return true;
    }

    // ════════════════════════════════════════════════════════════
    //   הפעלת מנוי (משותף ל-webhook ול-verify)
    // ════════════════════════════════════════════════════════════

    private async Task ActivateSubscriptionAsync(
        string  lowProfileCode,
        string? returnValue,
        string? cardToken,
        string? cardTokenExpiry,
        string? cardLastFour)
    {
        if (!ParseReturnValue(returnValue, out int userId, out _, out _))
            return;

        var sub = await _context.Subscriptions
            .Where(s => s.UserId == userId &&
                        s.Status == SubscriptionStatus.PendingPayment &&
                        s.ExternalPaymentId == lowProfileCode)
            .OrderByDescending(s => s.CreatedAt)
            .FirstOrDefaultAsync();

        if (sub == null) return;

        // תאריך חידוש לפי מחזור
        var renewalDate = sub.BillingCycle == "Yearly"
            ? DateTime.UtcNow.AddYears(1)
            : DateTime.UtcNow.AddMonths(1);

        sub.Status          = SubscriptionStatus.Active;
        sub.RenewalDate     = renewalDate;
        sub.EndDate         = renewalDate;
        sub.UpdatedAt       = DateTime.UtcNow;
        sub.CardToken       = cardToken;
        sub.CardTokenExpiry = cardTokenExpiry;
        sub.CardLastFour    = cardLastFour;

        await _context.SaveChangesAsync();

        // שדרג את כל הפרופילים של המשתמש ל-Subscribed
        await UpgradeUserProfilesAsync(userId, sub.Id);
    }

    // ════════════════════════════════════════════════════════════
    //   שדרוג פרופילים
    // ════════════════════════════════════════════════════════════

    private async Task UpgradeUserProfilesAsync(int userId, int subscriptionId)
    {
        var artists = await _context.Artists
            .Where(a => a.UserId == userId)
            .ToListAsync();

        foreach (var artist in artists)
        {
            artist.Tier           = ProfileTier.Subscribed;
            artist.SubscriptionId = subscriptionId;
        }

        var providers = await _context.ServiceProviders
            .Where(sp => sp.UserId == userId)
            .ToListAsync();

        bool firstProvider = true;
        foreach (var provider in providers)
        {
            provider.Tier             = ProfileTier.Subscribed;
            provider.SubscriptionId   = subscriptionId;
            provider.IsPrimaryProfile = firstProvider;
            firstProvider = false;
        }

        if (artists.Any() || providers.Any())
            await _context.SaveChangesAsync();
    }

    // ════════════════════════════════════════════════════════════
    //   Cardcom API — GetLPResult (אימות עצמאי)
    // ════════════════════════════════════════════════════════════

    private async Task<CardcomLPResult?> GetLPResultAsync(string lowProfileCode)
    {
        var http = _httpFactory.CreateClient();
        var url  = $"{CardcomApiBase}/LowProfile/GetLPResult" +
                   $"?LowProfileCode={lowProfileCode}" +
                   $"&TerminalNumber={_terminalNumber}" +
                   $"&ApiName={Uri.EscapeDataString(_apiName)}";

        var response = await http.GetAsync(url);
        if (!response.IsSuccessStatusCode) return null;

        return await response.Content.ReadFromJsonAsync<CardcomLPResult>(
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
    }

    // ════════════════════════════════════════════════════════════
    //   עזרים פנימיים
    // ════════════════════════════════════════════════════════════

    private static bool ParseReturnValue(
        string? returnValue,
        out int userId,
        out int plan,
        out string billingCycle)
    {
        userId       = 0;
        plan         = 0;
        billingCycle = "Monthly";

        if (string.IsNullOrEmpty(returnValue)) return false;

        var parts = returnValue.Split('|');
        if (parts.Length < 3) return false;

        return int.TryParse(parts[0], out userId) &&
               int.TryParse(parts[1], out plan) &&
               (billingCycle = parts[2]) != null;
    }

    private static decimal GetPlanPrice(SubscriptionPlan plan, string billingCycle)
    {
        decimal monthly = plan switch
        {
            SubscriptionPlan.Regular => 49m,
            SubscriptionPlan.Premium => 99m,
            _ => 0m
        };
        return billingCycle == "Yearly" ? monthly * 10m : monthly;
    }

    private static string GetPlanDescription(SubscriptionPlan plan, string billingCycle)
    {
        var planName = plan switch
        {
            SubscriptionPlan.Regular => "PLUS+",
            SubscriptionPlan.Premium => "PRO",
            _ => "BASIC"
        };
        var cycleHe = billingCycle == "Yearly" ? "שנתי" : "חודשי";
        return $"מנוי {planName} — {cycleHe}";
    }
}
