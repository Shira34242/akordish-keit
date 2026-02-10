import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AdCampaign,
  CreateAdCampaignRequest,
  UpdateAdCampaignRequest,
  AdCampaignStats,
  AdCampaignStatus
} from '../../models/admin/advertisement.model';
import { PagedResult } from '../../models/pagination.model';

@Injectable({
  providedIn: 'root'
})
export class AdCampaignService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://localhost:44395/api/AdCampaigns';

  /**
   * Get all campaigns with optional status filter and pagination
   */
  getCampaigns(pageNumber: number = 1, pageSize: number = 10, status?: AdCampaignStatus): Observable<PagedResult<AdCampaign>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<PagedResult<AdCampaign>>(this.apiUrl, { params });
  }

  /**
   * Get only active campaigns
   */
  getActiveCampaigns(): Observable<AdCampaign[]> {
    return this.http.get<AdCampaign[]>(`${this.apiUrl}/active`);
  }

  /**
   * Get campaign by ID
   */
  getCampaign(id: number): Observable<AdCampaign> {
    return this.http.get<AdCampaign>(`${this.apiUrl}/${id}`);
  }

  /**
   * Get campaigns by spot
   */
  getCampaignsBySpot(spotId: number): Observable<AdCampaign[]> {
    return this.http.get<AdCampaign[]>(`${this.apiUrl}/spot/${spotId}`);
  }

  /**
   * Get campaigns by client
   */
  getCampaignsByClient(clientId: number): Observable<AdCampaign[]> {
    return this.http.get<AdCampaign[]>(`${this.apiUrl}/client/${clientId}`);
  }

  /**
   * Get campaign statistics
   */
  getStats(): Observable<AdCampaignStats> {
    return this.http.get<AdCampaignStats>(`${this.apiUrl}/stats`);
  }

  /**
   * Create new campaign
   */
  createCampaign(campaign: CreateAdCampaignRequest): Observable<AdCampaign> {
    alert('Creating campaign');
    return this.http.post<AdCampaign>(this.apiUrl, campaign);
  }

  /**
   * Update existing campaign
   */
  updateCampaign(id: number, campaign: UpdateAdCampaignRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, campaign);
  }

  /**
   * Delete campaign
   */
  deleteCampaign(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  /**
   * Track view for campaign
   */
  trackView(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/track-view`, {});
  }

  /**
   * Track click for campaign
   */
  trackClick(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/track-click`, {});
  }

  /**
   * Check if ad spot is available for given date range with specific priority
   */
  checkAvailability(
    adSpotId: number,
    startDate: Date,
    endDate: Date,
    priority: number,
    excludeCampaignId?: number
  ): Observable<{
    isAvailable: boolean;
    priorityTaken: boolean;
    maxCampaignsReached: boolean;
    totalCampaignsInRange: number;
    takenPriorities: number[];
    availablePriorities: number[];
    overlappingCampaigns: Array<{
      id: number;
      name: string;
      clientName: string;
      startDate: Date;
      endDate: Date;
      priority: number;
    }>;
  }> {
    let params = new HttpParams()
      .set('adSpotId', adSpotId.toString())
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString())
      .set('priority', priority.toString());

    if (excludeCampaignId) {
      params = params.set('excludeCampaignId', excludeCampaignId.toString());
    }

    return this.http.get<any>(`${this.apiUrl}/CheckAvailability`, { params });
  }
}
