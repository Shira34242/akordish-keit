using System.Security.Cryptography;

namespace AkordishKeit.Services
{
    /// <summary>
    /// שירות לניהול CSRF Tokens
    /// מה זה CSRF? Cross-Site Request Forgery - התקפה שבה אתר זדוני מנסה לבצע פעולות בשמך
    ///
    /// איך זה עובד?
    /// 1. כשהמשתמש נכנס לאתר, השרת יוצר טוקן ייחודי (CSRF token)
    /// 2. הטוקן נשמר ב-Cookie (קריא על ידי JavaScript)
    /// 3. כל בקשה מהלקוח חייבת לכלול את הטוקן הזה ב-Header
    /// 4. השרת בודק שהטוקן תקין
    /// 5. אתר זדוני לא יכול לקרוא את הטוקן (Same-Origin Policy)
    /// </summary>
    public interface ICsrfTokenService
    {
        string GenerateToken();
        bool ValidateToken(string token);
    }

    public class CsrfTokenService : ICsrfTokenService
    {
        // Dictionary לשמירת טוקנים זמניים
        // בפרודקשן - כדאי להשתמש ב-Redis או Cache מבוזר
        private static readonly Dictionary<string, DateTime> _tokens = new();

        // משך חיים של טוקן - 30 דקות
        private readonly TimeSpan _tokenLifetime = TimeSpan.FromMinutes(30);

        /// <summary>
        /// יוצר טוקן CSRF חדש
        /// </summary>
        public string GenerateToken()
        {
            // יצירת טוקן אקראי באורך 32 בייט (256 ביט)
            var tokenBytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(tokenBytes);
            }

            // המרה ל-Base64 string
            var token = Convert.ToBase64String(tokenBytes);

            // שמירת הטוקן עם זמן תפוגה
            _tokens[token] = DateTime.UtcNow.Add(_tokenLifetime);

            // ניקוי טוקנים שפג תוקפם (כל 100 טוקנים חדשים)
            if (_tokens.Count % 100 == 0)
            {
                CleanupExpiredTokens();
            }

            return token;
        }

        /// <summary>
        /// בודק אם טוקן תקין
        /// </summary>
        public bool ValidateToken(string token)
        {
            if (string.IsNullOrEmpty(token))
                return false;

            // בדיקה אם הטוקן קיים
            if (!_tokens.ContainsKey(token))
                return false;

            // בדיקה אם הטוקן לא פג תוקף
            if (_tokens[token] < DateTime.UtcNow)
            {
                _tokens.Remove(token); // מחיקת טוקן שפג תוקפו
                return false;
            }

            return true;
        }

        /// <summary>
        /// מנקה טוקנים שפג תוקפם
        /// </summary>
        private void CleanupExpiredTokens()
        {
            var expiredTokens = _tokens
                .Where(t => t.Value < DateTime.UtcNow)
                .Select(t => t.Key)
                .ToList();

            foreach (var token in expiredTokens)
            {
                _tokens.Remove(token);
            }
        }
    }
}
