import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MarketingCampaignSummary {
  id: number;
  name: string;
  source: string;
  code: string;
  targetPath: string;
  trackingUrl: string;
  isActive: boolean;
  createdAt: string;
  visits: number;
  uniqueVisitors: number;
  signups: number;
  conversionRate: number;
  lastVisitAt?: string | null;
}

export interface MarketingCampaignDashboard {
  dateFrom: string;
  dateTo: string;
  totalVisits: number;
  uniqueVisitors: number;
  totalSignups: number;
  conversionRate: number;
  campaigns: MarketingCampaignSummary[];
}

export interface CreateMarketingCampaignRequest {
  name: string;
  source: string;
  targetPath: string;
  code?: string;
}

export interface MarketingCampaignRedirect {
  destinationPath: string;
}

export type UpdateMarketingCampaignRequest = CreateMarketingCampaignRequest;

@Injectable({ providedIn: 'root' })
export class MarketingCampaignService {
  private readonly endpoint = `${environment.apiBaseUrl}/api/marketing-campaigns`;

  constructor(private readonly http: HttpClient) {}

  getDashboard(dateFrom?: string, dateTo?: string): Observable<MarketingCampaignDashboard> {
    const params: Record<string, string> = {};
    if (dateFrom) params['dateFrom'] = dateFrom;
    if (dateTo) params['dateTo'] = dateTo;
    return this.http.get<MarketingCampaignDashboard>(this.endpoint, { params });
  }

  create(request: CreateMarketingCampaignRequest): Observable<MarketingCampaignSummary> {
    return this.http.post<MarketingCampaignSummary>(this.endpoint, request);
  }

  update(id: number, request: UpdateMarketingCampaignRequest): Observable<MarketingCampaignSummary> {
    return this.http.put<MarketingCampaignSummary>(`${this.endpoint}/${id}`, request);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/${id}`);
  }

  setStatus(id: number, isActive: boolean): Observable<void> {
    return this.http.patch<void>(`${this.endpoint}/${id}/status`, { isActive });
  }

  resolve(code: string): Observable<MarketingCampaignRedirect> {
    return this.http.get<MarketingCampaignRedirect>(`${this.endpoint}/resolve/${encodeURIComponent(code)}`);
  }
}
