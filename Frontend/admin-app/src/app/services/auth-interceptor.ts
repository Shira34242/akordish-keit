import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Sends authentication cookies, CSRF protection and a stable anonymous visitor id.
 * The visitor id lets analytics count a guest browser once without changing the DB schema.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const csrfToken = localStorage.getItem('csrf-token');
  const visitorId = getOrCreateAnalyticsVisitorId();

  let clonedReq = req.clone({
    withCredentials: true,
    headers: req.headers.set('X-Akordish-Visitor-Id', visitorId)
  });

  if (csrfToken && req.method !== 'GET') {
    clonedReq = clonedReq.clone({
      headers: clonedReq.headers.set('X-XSRF-TOKEN', csrfToken)
    });
  }

  return next(clonedReq);
};

function getOrCreateAnalyticsVisitorId(): string {
  const storageKey = 'ak_analytics_visitor_id';
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(storageKey, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}
