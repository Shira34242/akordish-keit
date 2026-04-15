import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

/**
 * Error Interceptor - מטפל בשגיאות HTTP בצורה חכמה
 *
 * מה הוא עושה:
 * - תופס כל שגיאה שחוזרת מהשרת
 * - מטפל בה לפי הסטטוס קוד
 * - מציג הודעות ברורות למשתמש
 * - מנתב למקומות הנכונים (לוגין, דף הבית וכו')
 *
 * שגיאות שהוא מטפל בהן:
 * - 401 Unauthorized: המשתמש לא מחובר או הטוקן פג תוקף
 * - 403 Forbidden: המשתמש לא מורשה לבצע את הפעולה
 * - 404 Not Found: המשאב לא נמצא
 * - 500 Server Error: שגיאה בשרת
 * - Network errors: בעיות חיבור
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'אירעה שגיאה';

      if (error.error instanceof ErrorEvent) {
        // ❌ שגיאת לקוח (Client-side error) - בעיות רשת, JavaScript errors
        console.error('Client-side error:', error.error.message);
        errorMessage = 'שגיאת חיבור. אנא בדוק את החיבור לאינטרנט ונסה שנית.';
      } else {
        // ❌ שגיאת שרת (Server-side error) - הטיפול לפי סטטוס קוד
        console.error(`Server returned code ${error.status}:`, error.message);

        switch (error.status) {
          case 401:
            // 🔒 Unauthorized - הטוקן פג תוקף או המשתמש לא מחובר
            console.warn('401 Unauthorized - logging out user');
            errorMessage = 'תוקף החיבור פג. אנא התחבר שנית.';

            // מנתקים את המשתמש
            authService.logout();

            // שומרים את הדף הנוכחי כדי לחזור אליו אחרי לוגין
            const currentUrl = router.url;
            authService.requestLogin(currentUrl);
            break;

          case 403:
            // 🚫 Forbidden - אין הרשאות לפעולה זו
            errorMessage = 'אין לך הרשאות לבצע פעולה זו.';

            // אם המשתמש ניסה לגשת לעמוד admin, מחזירים לדף הבית
            if (req.url.includes('/admin')) {
              router.navigate(['/']);
            }
            break;

          // case 404:
          //   // 📭 Not Found - המשאב לא נמצא
          //   errorMessage = 'המידע המבוקש לא נמצא.';
          //   break;

          case 500:
            // 💥 Internal Server Error - שגיאה בשרת
            errorMessage = 'שגיאה בשרת. אנא נסה שנית מאוחר יותר.';
            break;

          case 503:
            // 🔧 Service Unavailable - השרת לא זמין
            errorMessage = 'השרת אינו זמין כרגע. אנא נסה שנית מאוחר יותר.';
            break;

          case 0:
            // 🌐 Network error - אין חיבור לשרת
            errorMessage = 'לא ניתן להתחבר לשרת. אנא בדוק את החיבור לאינטרנט.';
            break;

          default:
            // שגיאות אחרות
            // נסה לקבל הודעה מהשרת אם קיימת
            if (error.error?.message) {
              errorMessage = error.error.message;
            } else if (error.message) {
              errorMessage = error.message;
            } else {
              errorMessage = `שגיאה: ${error.status}`;
            }
        }
      }

      // לא מציגים alert כאן — כל קומפוננטה מטפלת בהצגת שגיאה בעצמה
      // מחזירים את השגיאה הלאה כדי שקומפוננטות יוכלו לטפל בה
      return throwError(() => ({
        status: error.status,
        message: errorMessage,
        originalError: error
      }));
    })
  );
};
