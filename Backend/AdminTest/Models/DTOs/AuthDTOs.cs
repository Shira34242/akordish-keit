using AkordishKeit.Models.Entities;
using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs
{
    // ═══════════════════════════════════════════════════════════
    //                    Login / Register Requests
    // ═══════════════════════════════════════════════════════════

    public class GoogleLoginRequest
    {
        public string IdToken { get; set; } = string.Empty;
        public bool TermsApproved { get; set; }
        public bool MarketingConsent { get; set; }
        public string? ReferralCode { get; set; }
    }

    public class RegisterRequest
    {
        [Required(ErrorMessage = "שם משתמש הוא שדה חובה")]
        [StringLength(50, MinimumLength = 3, ErrorMessage = "שם משתמש חייב להיות בין 3 ל-50 תווים")]
        public string Username { get; set; } = string.Empty;

        [Required(ErrorMessage = "אימייל הוא שדה חובה")]
        [EmailAddress(ErrorMessage = "כתובת אימייל לא תקינה")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "סיסמא היא שדה חובה")]
        [StringLength(100, MinimumLength = 8, ErrorMessage = "סיסמא חייבת להיות לפחות 8 תווים")]
        [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$",
            ErrorMessage = "סיסמא חייבת לכלול לפחות: אות גדולה, אות קטנה, מספר ותו מיוחד (@$!%*?&#)")]
        public string Password { get; set; } = string.Empty;

        public bool TermsApproved { get; set; }
        public bool MarketingConsent { get; set; }
    }

    public class LoginRequest
    {
        [Required(ErrorMessage = "שם משתמש או אימייל הוא שדה חובה")]
        public string UsernameOrEmail { get; set; } = string.Empty;

        [Required(ErrorMessage = "סיסמא היא שדה חובה")]
        public string Password { get; set; } = string.Empty;
    }

    public class MarketingConsentRequest
    {
        public bool MarketingConsent { get; set; }
    }

    // ═══════════════════════════════════════════════════════════
    //                    Profile Completion
    // ═══════════════════════════════════════════════════════════

    public class CompleteProfileRequest
    {
        [StringLength(100, MinimumLength = 2, ErrorMessage = "שם ארוך או קצר מדי")]
        public string? Username { get; set; }

        /// <summary>מערך מזהי כלי הנגינה שבחר המשתמש</summary>
        public List<int>? InstrumentIds { get; set; }

        /// <summary>טקסט חופשי כשהמשתמש בחר "אחר"</summary>
        [StringLength(50, ErrorMessage = "שם הכלי ארוך מדי")]
        public string? OtherInstrumentName { get; set; }

        /// <summary>רמת ניגון כללית (1=Beginner, 2=Intermediate, 3=Professional)</summary>
        public int? InstrumentLevel { get; set; }

        /// <summary>סוג משתמש שנבחר (לתצוגה במודל; השמירה בפועל ב-AuthController)</summary>
        public string? UserType { get; set; }

        // שדות ישנים (תאימות לאחור — אופציונליים)
        public int? PreferredInstrumentId { get; set; }

        [Phone(ErrorMessage = "מספר טלפון לא תקין")]
        [StringLength(20, ErrorMessage = "מספר טלפון ארוך מדי")]
        public string? Phone { get; set; }
    }

    /// <summary>
    /// בקשה לעדכון פרטי פרופיל "רכים" (תזכורת לאחר זמן)
    /// כל השדות אופציונליים — נשמרים רק אלה שנשלחו
    /// </summary>
    public class UpdateSoftProfileRequest
    {
        [Phone(ErrorMessage = "מספר טלפון לא תקין")]
        [StringLength(20, ErrorMessage = "מספר טלפון ארוך מדי")]
        public string? Phone { get; set; }

        public int? CityId { get; set; }

        [StringLength(255, ErrorMessage = "כתובת ארוכה מדי")]
        public string? Address { get; set; }

        /// <summary>חודש לידה (1-12) — אופציונלי</summary>
        [Range(1, 12, ErrorMessage = "חודש לידה לא תקין")]
        public int? BirthMonth { get; set; }

        /// <summary>שנת לידה (4 ספרות) — אופציונלי</summary>
        [Range(1900, 2100, ErrorMessage = "שנת לידה לא תקינה")]
        public int? BirthYear { get; set; }
    }

    // ═══════════════════════════════════════════════════════════
    //                    Password Reset
    // ═══════════════════════════════════════════════════════════

    public class RequestPasswordResetRequest
    {
        [Required(ErrorMessage = "שם משתמש או אימייל הוא שדה חובה")]
        public string UsernameOrEmail { get; set; } = string.Empty;

        [Required(ErrorMessage = "שיטת שחזור היא שדה חובה")]
        public string Method { get; set; } = "email"; // "email" or "sms"
    }

    public class ResetPasswordRequest
    {
        [Required(ErrorMessage = "שם משתמש או אימייל הוא שדה חובה")]
        public string UsernameOrEmail { get; set; } = string.Empty;

        [Required(ErrorMessage = "קוד אימות הוא שדה חובה")]
        [StringLength(6, MinimumLength = 6, ErrorMessage = "קוד אימות חייב להיות בן 6 ספרות")]
        public string VerificationCode { get; set; } = string.Empty;

        [Required(ErrorMessage = "סיסמא חדשה היא שדה חובה")]
        [StringLength(100, MinimumLength = 8, ErrorMessage = "סיסמא חייבת להיות לפחות 8 תווים")]
        [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$",
            ErrorMessage = "סיסמא חייבת לכלול לפחות: אות גדולה, אות קטנה, מספר ותו מיוחד (@$!%*?&#)")]
        public string NewPassword { get; set; } = string.Empty;
    }

    // ═══════════════════════════════════════════════════════════
    //                    Responses
    // ═══════════════════════════════════════════════════════════

    public class AuthResponse
    {
        // 🔐 שינוי חשוב!
        // לא מחזירים יותר JWT Token בגוף התגובה
        // JWT נשלח ב-httpOnly cookie (מאובטח יותר)
        // במקום זה מחזירים CSRF Token (לשליחה ב-headers)
        public string CsrfToken { get; set; } = string.Empty;
        public UserDto User { get; set; } = null!;
        public bool RequiresProfileCompletion { get; set; }
    }

    public class UserDto
    {
        [System.Text.Json.Serialization.JsonPropertyName("id")]
        public int Id { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("username")]
        public string Username { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("email")]
        public string Email { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("profileImageUrl")]
        public string? ProfileImageUrl { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("role")]
        public string Role { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("level")]
        public int Level { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("points")]
        public int Points { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("preferredInstrumentId")]
        public int? PreferredInstrumentId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("instruments")]
        public List<InstrumentDto> Instruments { get; set; } = new();

        [System.Text.Json.Serialization.JsonPropertyName("otherInstrumentName")]
        public string? OtherInstrumentName { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("instrumentLevel")]
        public int? InstrumentLevel { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("phone")]
        public string? Phone { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("address")]
        public string? Address { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("cityId")]
        public int? CityId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("birthDate")]
        public DateTime? BirthDate { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("hasProfessionalProfile")]
        public bool HasProfessionalProfile { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("contentTag")]
        public int ContentTag { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("uploadCount")]
        public int UploadCount { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("rankingScore")]
        public int RankingScore { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("chordBookExportCount")]
        public int ChordBookExportCount { get; set; }

        /// <summary>תאריך הרשמה — לקביעת מתי להציג תזכורות</summary>
        [System.Text.Json.Serialization.JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("lastProfileReminderAt")]
        public DateTime? LastProfileReminderAt { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("profileReminderDismissCount")]
        public int ProfileReminderDismissCount { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("visitCount")]
        public int VisitCount { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("marketingConsent")]
        public bool MarketingConsent { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("marketingConsentAt")]
        public DateTime? MarketingConsentAt { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("marketingConsentRevokedAt")]
        public DateTime? MarketingConsentRevokedAt { get; set; }
    }
}
