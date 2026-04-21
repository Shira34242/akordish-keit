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

      if (error.error instanceof ErrorEvent) {
        console.error('Client-side error:', error.error.message);
        errorMessage = 'שגיאת חיבור. אנא בדוק את החיבור לאינטרנט ונסה שנית.';
      } else {
        console.error(`Server returned code ${error.status}:`, error.message);

        switch (error.status) {
          case 401: {
            console.warn('401 Unauthorized - logging out user');
            errorMessage = 'תוקף החיבור פג. אנא התחבר שנית.';

            authService.logout();

            const currentUrl = router.url;
            authService.requestLogin(currentUrl);
            break;
          }

          case 403:
            errorMessage = 'אין לך הרשאות לבצע פעולה זו.';

            if (req.url.includes('/admin')) {
              router.navigate(['/']);
            }
            break;

          case 500:
            errorMessage = error.error?.message || 'שגיאה בשרת. אנא נסה שנית מאוחר יותר.';
            break;

          case 503:
            errorMessage = 'השרת אינו זמין כרגע. אנא נסה שנית מאוחר יותר.';
            break;

          case 0:
            errorMessage = 'לא ניתן להתחבר לשרת. אנא בדוק את החיבור לאינטרנט.';
            break;

          default:
            if (error.error?.message) {
              errorMessage = error.error.message;
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
