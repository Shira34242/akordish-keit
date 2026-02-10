import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * AuthGuard - שומר שמוודא שהמשתמש מחובר
 *
 * מה הוא עושה:
 * 1. בודק אם יש משתמש מחובר במערכת
 * 2. אם כן - מאפשר גישה לדף ✅
 * 3. אם לא - מציג את מודל הלוגין ומונע גישה ❌
 *
 * איפה להשתמש בו:
 * בכל route שדורש שהמשתמש יהיה מחובר (למשל פרופיל אישי, הגדרות)
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // בודקים אם המשתמש מחובר
  if (authService.isLoggedIn) {
    // משתמש מחובר - מאפשרים גישה
    return true;
  }

  // משתמש לא מחובר - צריך להציג לוגין
  // כאן נשמור את ה-URL שהמשתמש ניסה להגיע אליו
  // כדי שנוכל להחזיר אותו אחרי הלוגין
  const returnUrl = state.url;

  // נציג את מודל הלוגין
  // (זה ייעשה דרך ה-LayoutComponent שמקשיב ל-navigation events)
  authService.requestLogin(returnUrl);

  // מונעים גישה לדף
  return false;
};
