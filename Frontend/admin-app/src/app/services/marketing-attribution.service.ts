import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface MarketingAttribution {
  campaignCode: string;
  visitorId: string;
  capturedAt: number;
}

@Injectable({ providedIn: 'root' })
export class MarketingAttributionService {
  private readonly attributionKey = 'akordish-marketing-attribution';
  private readonly visitorKey = 'akordish-marketing-visitor';
  private readonly maxAgeMs = 30 * 24 * 60 * 60 * 1000;
  private readonly endpoint = `${environment.apiBaseUrl}/api/marketing-campaigns/track`;

  constructor(private readonly http: HttpClient) {}

  captureFromUrl(): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const campaignCode = this.normalizeCode(params.get('ak_campaign'));
    if (!campaignCode) return;

    const visitorId = this.getOrCreateVisitorId();
    const attribution: MarketingAttribution = { campaignCode, visitorId, capturedAt: Date.now() };
    localStorage.setItem(this.attributionKey, JSON.stringify(attribution));

    this.http.post(this.endpoint, {
      campaignCode,
      visitorId,
      pagePath: `${window.location.pathname}${window.location.search}`.slice(0, 500),
      referrer: document.referrer || null
    }).pipe(catchError(() => of(null))).subscribe();
  }

  getAttribution(): MarketingAttribution | null {
    if (typeof window === 'undefined') return null;
    try {
      const parsed = JSON.parse(localStorage.getItem(this.attributionKey) || 'null') as MarketingAttribution | null;
      if (!parsed || !this.normalizeCode(parsed.campaignCode) || !parsed.visitorId || Date.now() - parsed.capturedAt > this.maxAgeMs) {
        this.clear();
        return null;
      }
      return parsed;
    } catch {
      this.clear();
      return null;
    }
  }

  clear(): void {
    if (typeof window !== 'undefined') localStorage.removeItem(this.attributionKey);
  }

  private getOrCreateVisitorId(): string {
    const existing = localStorage.getItem(this.visitorKey)?.trim();
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
    const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 18)}`;
    localStorage.setItem(this.visitorKey, generated);
    return generated;
  }

  private normalizeCode(value: string | null): string | null {
    if (!value) return null;
    const normalized = value.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 32);
    return normalized || null;
  }
}
