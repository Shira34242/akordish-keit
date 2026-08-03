import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import type { ArticleRank } from './article-feedback.service';

export interface AnalyticsDashboard {
  period: { dateFrom: string; dateTo: string; days: number; trendGranularity: 'day' | 'month' };
  dataQuality: { isHistoricalDataPartial: boolean; reliableFrom: string; note: string };
  traffic: {
    views: number;
    uniqueVisitors: number;
    previousViews: number;
    topPages: { pagePath: string; views: number; uniqueVisitors: number }[];
    devices: {
      desktop: { views: number; uniqueVisitors: number };
      tablet: { views: number; uniqueVisitors: number };
      mobile: { views: number; uniqueVisitors: number };
      unclassified: { views: number; uniqueVisitors: number };
    };
  };
  contentUniqueVisitors: number;
  trend: { date: string; articles: number; chords: number; events: number; clicks: number; podcasts: number; pages: number }[];
  comparison: {
    contentViews: { current: number; previous: number };
    clicks: { current: number; previous: number };
  };
  events: {
    listPageViews: { total: number; last30Days: number; uniqueLast30Days: number };
    topEvents: { eventId: number | null; eventName: string; totalViews: number; viewsLast30: number; uniqueVisitors: number }[];
  };
  buttons: {
    uniqueVisitors: number;
    ticketClicks: { total: number; last30Days: number };
    contactClicks: { total: number; last30Days: number };
    notificationLinkClicks: { total: number; last30Days: number };
    topTicketEvents: { itemId: number | null; itemLabel: string | null; totalClicks: number; clicksLast30: number; uniqueVisitors: number }[];
  };
  ads: {
    totalViews: number;
    totalClicks: number;
    uniqueVisitors: number;
    allTimeViews: number;
    allTimeClicks: number;
    activeCampaigns: number;
    topCampaigns: { id: number; name: string; clientName: string; viewCount: number; clickCount: number; ctr: number }[];
  };
  articles: {
    totalViews: number;
    viewsLast30Days: number;
    uniqueVisitors: number;
  };
  chords: {
    totalViews: number;
    viewsLast30Days: number;
    uniqueVisitors: number;
    topSongs: { songId: number; songTitle: string; views: number; uniqueVisitors: number; totalViews: number }[];
  };
  podcasts: {
    totalViews: number;
    viewsLast30Days: number;
    uniqueVisitors: number;
    topEpisodes: { episodeId: number; episodeTitle: string; views: number; uniqueVisitors: number; totalViews: number }[];
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
    return this.http.get<Partial<AnalyticsDashboard>>(`${this.base}/dashboard`, { params }).pipe(
      map(data => this.normalizeDashboard(data, dateFrom, dateTo))
    );
  }

  getArticleRanking(dateFrom: string, dateTo: string, sortBy: 'views' | 'likes' | 'feedback', limit = 100): Observable<ArticleRank[]> {
    return this.http.get<ArticleRank[]>(`${this.base}/articles`, {
      params: { dateFrom, dateTo, sortBy, limit: String(limit) }
    });
  }

  /** Keeps the admin usable while the live API and frontend are deployed at different times. */
  private normalizeDashboard(raw: Partial<AnalyticsDashboard>, dateFrom?: string, dateTo?: string): AnalyticsDashboard {
    const data = raw as any;
    const zeroPeriodMetric = { total: 0, last30Days: 0 };
    const zeroDevice = { views: 0, uniqueVisitors: 0 };

    return {
      period: {
        dateFrom: data.period?.dateFrom ?? dateFrom ?? '',
        dateTo: data.period?.dateTo ?? dateTo ?? '',
        days: data.period?.days ?? 0,
        trendGranularity: data.period?.trendGranularity ?? 'day'
      },
      dataQuality: {
        isHistoricalDataPartial: data.dataQuality?.isHistoricalDataPartial ?? false,
        reliableFrom: data.dataQuality?.reliableFrom ?? '',
        note: data.dataQuality?.note ?? ''
      },
      traffic: {
        views: data.traffic?.views ?? data.totalVisits ?? 0,
        uniqueVisitors: data.traffic?.uniqueVisitors ?? data.uniqueVisitors ?? 0,
        previousViews: data.traffic?.previousViews ?? 0,
        topPages: data.traffic?.topPages ?? [],
        devices: {
          desktop: { ...zeroDevice, ...data.traffic?.devices?.desktop },
          tablet: { ...zeroDevice, ...data.traffic?.devices?.tablet },
          mobile: { ...zeroDevice, ...data.traffic?.devices?.mobile },
          unclassified: { ...zeroDevice, ...data.traffic?.devices?.unclassified }
        }
      },
      contentUniqueVisitors: data.contentUniqueVisitors ?? 0,
      trend: (data.trend ?? []).map((point: any) => ({
        date: point.date ?? '', articles: point.articles ?? 0, chords: point.chords ?? 0,
        events: point.events ?? 0, clicks: point.clicks ?? 0, podcasts: point.podcasts ?? 0,
        pages: point.pages ?? 0
      })),
      comparison: {
        contentViews: { current: 0, previous: 0, ...data.comparison?.contentViews },
        clicks: { current: 0, previous: 0, ...data.comparison?.clicks }
      },
      events: {
        listPageViews: { total: 0, last30Days: 0, uniqueLast30Days: 0, ...data.events?.listPageViews },
        topEvents: data.events?.topEvents ?? []
      },
      buttons: {
        uniqueVisitors: data.buttons?.uniqueVisitors ?? 0,
        ticketClicks: { ...zeroPeriodMetric, ...data.buttons?.ticketClicks },
        contactClicks: { ...zeroPeriodMetric, ...data.buttons?.contactClicks },
        notificationLinkClicks: { ...zeroPeriodMetric, ...data.buttons?.notificationLinkClicks },
        topTicketEvents: data.buttons?.topTicketEvents ?? []
      },
      ads: {
        totalViews: data.ads?.totalViews ?? 0, totalClicks: data.ads?.totalClicks ?? 0,
        uniqueVisitors: data.ads?.uniqueVisitors ?? 0, allTimeViews: data.ads?.allTimeViews ?? data.ads?.totalViews ?? 0,
        allTimeClicks: data.ads?.allTimeClicks ?? data.ads?.totalClicks ?? 0,
        activeCampaigns: data.ads?.activeCampaigns ?? 0, topCampaigns: data.ads?.topCampaigns ?? []
      },
      articles: {
        totalViews: data.articles?.totalViews ?? 0, viewsLast30Days: data.articles?.viewsLast30Days ?? 0,
        uniqueVisitors: data.articles?.uniqueVisitors ?? 0
      },
      chords: {
        totalViews: data.chords?.totalViews ?? 0, viewsLast30Days: data.chords?.viewsLast30Days ?? 0,
        uniqueVisitors: data.chords?.uniqueVisitors ?? 0, topSongs: data.chords?.topSongs ?? []
      },
      podcasts: {
        totalViews: data.podcasts?.totalViews ?? 0, viewsLast30Days: data.podcasts?.viewsLast30Days ?? 0,
        uniqueVisitors: data.podcasts?.uniqueVisitors ?? 0, topEpisodes: data.podcasts?.topEpisodes ?? []
      },
      adBlock: {
        totalChecks: data.adBlock?.totalChecks ?? 0, detectedCount: data.adBlock?.detectedCount ?? 0,
        detectionRate: data.adBlock?.detectionRate ?? 0, daily: data.adBlock?.daily ?? [],
        topPages: data.adBlock?.topPages ?? []
      }
    };
  }
}
