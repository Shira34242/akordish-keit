import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BoostDto, BoostType } from '../models/subscription.model';

@Injectable({
  providedIn: 'root'
})
export class BoostService {
  private apiUrl = 'https://localhost:44395/api/Boosts';

  constructor(private http: HttpClient) { }

  /**
   * רכישת בוסט
   */
  purchaseBoost(
    serviceProviderId: number,
    type: BoostType,
    price: number,
    externalPaymentId?: string
  ): Observable<BoostDto> {
    return this.http.post<BoostDto>(`${this.apiUrl}/purchase`, {
      serviceProviderId,
      type,
      price,
      externalPaymentId
    });
  }

  /**
   * קבלת בוסט פעיל לפי סוג
   */
  getActiveBoostByType(type: BoostType): Observable<BoostDto | null> {
    return this.http.get<BoostDto | null>(`${this.apiUrl}/active/${type}`);
  }

  /**
   * קבלת כל הבוסטים של פרופיל
   */
  getProfileBoosts(serviceProviderId: number): Observable<BoostDto[]> {
    return this.http.get<BoostDto[]>(`${this.apiUrl}/profile/${serviceProviderId}`);
  }

  /**
   * השבתת בוסט
   */
  deactivateBoost(boostId: number): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${boostId}/deactivate`, {});
  }
}
