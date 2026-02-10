using System;

namespace AkordishKeit.Helpers
{
    /// <summary>
    /// עזר להצפנת סיסמאות - להרצה חד פעמית כדי ליצור hash
    /// </summary>
    public class PasswordHasher
    {
        public static void Main(string[] args)
        {
            // שנה את הסיסמא כאן למה שאת רוצה
            string password = "YourPassword123!";

            // יצירת Hash עם BCrypt
            string hashedPassword = BCrypt.Net.BCrypt.HashPassword(password);

            Console.WriteLine("סיסמא מקורית: " + password);
            Console.WriteLine("הצפנת BCrypt:");
            Console.WriteLine(hashedPassword);
            Console.WriteLine();
            Console.WriteLine("העתיקי את ההצפנה למעלה והדביקי אותה בשדה PasswordHash ב-database");

            // בדיקה שההצפנה עובדת
            bool isValid = BCrypt.Net.BCrypt.Verify(password, hashedPassword);
            Console.WriteLine();
            Console.WriteLine("בדיקה: " + (isValid ? "✓ עובד!" : "✗ שגיאה"));
        }
    }
}
