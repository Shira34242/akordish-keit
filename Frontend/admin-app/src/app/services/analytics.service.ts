import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

export interface AnalyticsDashboard {
  events: {
    listPageViews: { total: number; last30Days: number; uniqueLast30Days: number };
    topEvents: { eventId: number | null; eventName: string; totalViews: number; viewsLast30: number }[];
  };
  buttons: {
    ticketClicks: { total: number; last30Days: number };
    contactClicks: { total: number; last30Days: number };
    notificationLinkClicks: { total: number; last30Days: number };
    topTicketEvents: { itemId: number | null; itemLabel: string | null; totalClicks: number; clicksLast30: number }[];
  };
  ads: {
    totalViews: number;
    totalClicks: number;
    activeCampaigns: number;
    topCampaigns: { id: number; name: string; clientName: string; viewCount: number; clickCount: number; ctr: number }[];
  };
  articles: {
    totalViews: number;
    viewsLast30Days: number;
  };
  adBlock: {
    totalChecks: number;
    detectedCount: number;
    detectionRate: number;
    daily: { date: string; checks: number; detected: number; rate: number }[];
    topPages: { pagePath: string; checks: number; detected: number; rate: number }[];
  };
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/api/analytics`;

  trackEventView(eventId?: number): void {
    this.http.post(`${this.base}/event-view`, { eventId: eventId ?? null })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  trackButtonClick(buttonType: 'ticket' | 'contact' | 'notification_link', itemId?: number, itemLabel?: string): void {
    this.http.post(`${this.base}/button-click`, { buttonType, itemId: itemId ?? null, itemLabel: itemLabel ?? null })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  trackInteraction(buttonType: string, itemId?: number, itemLabel?: string): void {
    this.http.post(`${this.base}/button-click`, { buttonType, itemId: itemId ?? null, itemLabel: itemLabel ?? null })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  trackAdBlockCheck(detected: boolean, pagePath: string, deviceType: string): void {
    this.http.post(`${this.base}/browser-check`, { detected, pagePath, deviceType })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  getDashboard(dateFrom?: string, dateTo?: string): Observable<AnalyticsDashboard> {
    const params: Record<string, string> = {};
    if (dateFrom) params['dateFrom'] = dateFrom;
    if (dateTo) params['dateTo'] = dateTo;
    return this.http.get<AnalyticsDashboard>(`${this.base}/dashboard`, { params });
  }
}
