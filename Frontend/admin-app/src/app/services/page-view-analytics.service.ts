import { Injectable } from '@angular/core';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

@Injectable({ providedIn: 'root' })
export class PageViewAnalyticsService {
  track(path: string): void {
    if (typeof window === 'undefined') return;

    const pagePath = path.split('#')[0] || '/';
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'virtual_page_view',
      page_path: pagePath,
      page_location: `${window.location.origin}${pagePath}`,
      page_title: document.title
    });
  }
}
