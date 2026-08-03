import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

@Injectable({ providedIn: 'root' })
export class PageViewAnalyticsService {
  private readonly endpoint = `${environment.apiBaseUrl}/api/analytics/page-view`;
  private lastTrackedPath = '';
  private lastTrackedAt = 0;

  constructor(private readonly http: HttpClient) {}

  track(path: string): void {
    if (typeof window === 'undefined') return;

    const pagePath = path.split(/[?#]/)[0] || '/';
    if (pagePath.startsWith('/admin')) return;

    const now = Date.now();
    if (pagePath === this.lastTrackedPath && now - this.lastTrackedAt < 1000) return;
    this.lastTrackedPath = pagePath;
    this.lastTrackedAt = now;

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'virtual_page_view',
      page_path: pagePath,
      page_location: `${window.location.origin}${pagePath}`,
      page_title: document.title
    });

    this.http.post(this.endpoint, { pagePath, deviceType: this.getDeviceType() })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private getDeviceType(): 'desktop' | 'tablet' | 'mobile' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1100) return 'tablet';
    return 'desktop';
  }
}
