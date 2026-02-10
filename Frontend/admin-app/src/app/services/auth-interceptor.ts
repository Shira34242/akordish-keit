import { HttpInterceptorFn } from '@angular/common/http';

/**
 * 🔐 Auth Interceptor המעודכן לעבודה עם Cookies + CSRF
 *
 * מה השתנה:
 * 1. לא מוסיף יותר Authorization header (JWT נשלח אוטומטית ב-httpOnly cookie)
 * 2. מוסיף CSRF token ב-header (הגנה מפני CSRF attacks)
 * 3. מוסיף withCredentials: true (מאפשר שליחת cookies)
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    // קריאת CSRF token מ-localStorage
    const csrfToken = localStorage.getItem('csrf-token');

    // שינוי הבקשה להוסיף:
    // 1. CSRF token בheader (רק אם קיים ולא GET request)
    // 2. withCredentials: true (מאפשר cookies)
    let clonedReq = req.clone({
        withCredentials: true // 🔐 חובה! מאפשר שליחת/קבלת cookies
    });

    // הוספת CSRF token רק לבקשות שמשנות data (POST, PUT, DELETE)
    // GET requests לא צריכים CSRF protection
    if (csrfToken && req.method !== 'GET') {
        clonedReq = clonedReq.clone({
            headers: req.headers.set('X-XSRF-TOKEN', csrfToken)
        });
    }

    return next(clonedReq);
};