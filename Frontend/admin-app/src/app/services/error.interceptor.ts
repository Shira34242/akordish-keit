import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'אירעה שגיאה';

      const isPublicAdRequest = req.url.includes('/api/AdCampaigns/Public/');
      const isOptionalAuthStatusRequest =
        req.url.includes('/api/notifications/unread-count') ||
        req.url.includes('/api/LikedContent/check/');

      if (error.error instanceof ErrorEvent) {
        console.error('Client-side error:', error.error.message);
        errorMessage = 'שגיאת חיבור. אנא בדוק את החיבור לאינטרנט ונסה שנית.';
      } else {
        if (!isPublicAdRequest) {
          console.error(`Server returned code ${error.status}:`, error.message, error.error);
        }

        switch (error.status) {
          case 401: {
            if (req.url.includes('/api/auth/me')) {
              authService.clearLocalAuth();
              break;
            }

            if (authService.isLoggedIn && !isOptionalAuthStatusRequest) {
              console.warn('401 Unauthorized - logging out user');
              errorMessage = 'תוקף החיבור פג. אנא התחבר שנית.';
              authService.logout();
              const currentUrl = router.url;
              authService.requestLogin(currentUrl);
            }
            break;
          }

          case 403:
            errorMessage = 'אין לך הרשאות לבצע פעולה זו.';

            break;

          case 500:
            if (typeof error.error === 'string') {
              errorMessage = error.error.substring(0, 200);
            } else {
              errorMessage = error.error?.message
                || (error.error?.errors ? Object.values(error.error.errors as Record<string, string[]>).flat().join(', ') : null)
                || error.error?.title
                || error.error?.detail
                || 'שגיאה בשרת. אנא נסה שנית מאוחר יותר.';
            }
            break;

          case 503:
            errorMessage = 'השרת אינו זמין כרגע. אנא נסה שנית מאוחר יותר.';
            break;

          case 0:
            errorMessage = 'לא ניתן להתחבר לשרת. אנא בדוק את החיבור לאינטרנט.';
            break;

          default:
            if (typeof error.error === 'string') {
              errorMessage = error.error.substring(0, 200);
            } else if (error.error?.message) {
              errorMessage = error.error.message;
            } else if (error.error?.errors) {
              const messages = Object.values(error.error.errors as Record<string, string[]>).flat();
              errorMessage = messages.length > 0 ? messages.join(', ') : error.error.title || `שגיאה: ${error.status}`;
            } else if (error.error?.title) {
              errorMessage = error.error.title;
            } else if (error.message) {
              errorMessage = error.message;
            } else {
              errorMessage = `שגיאה: ${error.status}`;
            }
            break;
        }
      }

      return throwError(() => ({
        status: error.status,
        message: errorMessage,
        error: error.error,
        originalError: error
      }));
    })
  );
};
