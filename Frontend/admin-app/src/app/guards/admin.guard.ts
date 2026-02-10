import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * AdminGuard - שומר שמוודא שהמשתמש הוא Admin
 *
 * מה הוא עושה:
 * 1. בודק אם המשתמש מחובר
 * 2. בודק אם התפקיד שלו הוא 'Admin'
 * 3. אם כן - מאפשר גישה למערכת הניהול ✅
 * 4. אם לא - מונע גישה ומחזיר לדף הבית ❌
 *
 * איפה להשתמש בו:
 * בכל ה-routes של מערכת הניהול (/admin)
 * זה הרבה יותר בטוח מאשר רק להסתיר כפתורים בממשק!
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // בודקים אם המשתמש מחובר
  if (!authService.isLoggedIn) {
    // לא מחובר - מבקשים לוגין
    authService.requestLogin(state.url);
    return false;
  }

  // המשתמש מחובר - עכשיו בודקים אם הוא Admin
  const user = authService.currentUserValue;

  if (user && user.role === 'Admin') {
    // המשתמש הוא Admin - מאפשרים גישה ✅
    return true;
  }

  // המשתמש לא Admin - מונעים גישה ומחזירים לדף הבית
  console.warn('Access denied: User is not an Admin', user);

  // ניתוב חזרה לדף הבית
  router.navigate(['/']);

  // אפשר להוסיף כאן הודעת שגיאה למשתמש
  // לדוגמה: הצגת Toast או Alert
  alert('אין לך הרשאות לגשת לדף זה. נדרשות הרשאות מנהל.');

  return false;
};
