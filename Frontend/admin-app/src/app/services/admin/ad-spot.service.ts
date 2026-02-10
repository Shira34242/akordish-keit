import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AdSpot,
  CreateAdSpotRequest,
  UpdateAdSpotRequest
} from '../../models/admin/advertisement.model';
import { PagedResult } from '../../models/pagination.model';

@Injectable({
  providedIn: 'root'
})
export class AdSpotService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://localhost:44395/api/AdSpots';

  /**
   * Get all ad spots with pagination
   */
  getAdSpots(pageNumber: number = 1, pageSize: number = 10): Observable<PagedResult<AdSpot>> {
    const params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<PagedResult<AdSpot>>(this.apiUrl, { params });
  }

  /**
   * Get ad spot by ID
   */
  getAdSpot(id: number): Observable<AdSpot> {
    return this.http.get<AdSpot>(`${this.apiUrl}/${id}`);
  }

  /**
   * Create new ad spot
   */
  createAdSpot(adSpot: CreateAdSpotRequest): Observable<AdSpot> {
    return this.http.post<AdSpot>(this.apiUrl, adSpot);
  }

  /**
   * Update existing ad spot
   */
  updateAdSpot(id: number, adSpot: UpdateAdSpotRequest): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, adSpot);
  }

  /**
   * Delete ad spot
   */
  deleteAdSpot(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
