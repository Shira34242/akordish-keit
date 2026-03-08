using AkordishKeit.Models.Entities;
using System.ComponentModel.DataAnnotations;

namespace AkordishKeit.Models.DTOs
{
    // ═══════════════════════════════════════════════════════════
    //                    Login / Register Requests
    // ═══════════════════════════════════════════════════════════

    public class GoogleLoginRequest
    {
        public string IdToken { get; set; }
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
    }

    public class LoginRequest
    {
        [Required(ErrorMessage = "שם משתמש או אימייל הוא שדה חובה")]
        public string UsernameOrEmail { get; set; } = string.Empty;

        [Required(ErrorMessage = "סיסמא היא שדה חובה")]
        public string Password { get; set; } = string.Empty;
    }

    // ═══════════════════════════════════════════════════════════
    //                    Profile Completion
    // ═══════════════════════════════════════════════════════════

    public class CompleteProfileRequest
    {
        public int? PreferredInstrumentId { get; set; }

        [Phone(ErrorMessage = "מספר טלפון לא תקין")]
        [StringLength(20, ErrorMessage = "מספר טלפון ארוך מדי")]
        public string? Phone { get; set; }
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
        public string CsrfToken { get; set; }
        public UserDto User { get; set; }
        public bool RequiresProfileCompletion { get; set; }
    }

    public class UserDto
    {
        [System.Text.Json.Serialization.JsonPropertyName("id")]
        public int Id { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("username")]
        public string Username { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("email")]
        public string Email { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("profileImageUrl")]
        public string? ProfileImageUrl { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("role")]
        public string Role { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("level")]
        public int Level { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("points")]
        public int Points { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("preferredInstrumentId")]
        public int? PreferredInstrumentId { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("hasProfessionalProfile")]
        public bool HasProfessionalProfile { get; set; }
    }
}
