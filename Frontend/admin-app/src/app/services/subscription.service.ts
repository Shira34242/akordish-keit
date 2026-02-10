import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  SubscriptionDto,
  CreateSubscriptionDto,
  UpdateSubscriptionStatusDto,
  UpgradeSubscriptionDto,
  CancelSubscriptionDto,
  FeatureAccessDto
} from '../models/subscription.model';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private apiUrl = 'https://localhost:44395/api/Subscriptions';

  constructor(private http: HttpClient) { }

  /**
   * יצירת מנוי חדש
   */
  createSubscription(dto: CreateSubscriptionDto): Observable<SubscriptionDto> {
    return this.http.post<SubscriptionDto>(this.apiUrl, dto);
  }

  /**
   * קבלת מנוי לפי ID
   */
  getSubscriptionById(subscriptionId: number): Observable<SubscriptionDto> {
    return this.http.get<SubscriptionDto>(`${this.apiUrl}/${subscriptionId}`);
  }

  /**
   * קבלת מנוי פעיל של משתמש
   */
  getUserActiveSubscription(userId: number): Observable<SubscriptionDto | null> {
    return this.http.get<SubscriptionDto | null>(`${this.apiUrl}/user/${userId}/active`);
  }

  /**
   * עדכון סטטוס מנוי
   */
  updateSubscriptionStatus(
    subscriptionId: number,
    dto: UpdateSubscriptionStatusDto
  ): Observable<SubscriptionDto> {
    return this.http.put<SubscriptionDto>(
      `${this.apiUrl}/${subscriptionId}/status`,
      dto
    );
  }

  /**
   * שדרוג מנוי
   */
  upgradeSubscription(
    subscriptionId: number,
    dto: UpgradeSubscriptionDto
  ): Observable<SubscriptionDto> {
    return this.http.put<SubscriptionDto>(
      `${this.apiUrl}/${subscriptionId}/upgrade`,
      dto
    );
  }

  /**
   * ביטול מנוי
   */
  cancelSubscription(
    subscriptionId: number,
    dto: CancelSubscriptionDto
  ): Observable<SubscriptionDto> {
    return this.http.put<SubscriptionDto>(
      `${this.apiUrl}/${subscriptionId}/cancel`,
      dto
    );
  }

  /**
   * חידוש מנוי מבוטל
   */
  renewSubscription(subscriptionId: number): Observable<SubscriptionDto> {
    return this.http.put<SubscriptionDto>(
      `${this.apiUrl}/${subscriptionId}/renew`,
      {}
    );
  }

  /**
   * בדיקת גישה לפיצ'ר
   */
  checkFeatureAccess(userId: number, featureName: string): Observable<FeatureAccessDto> {
    return this.http.get<FeatureAccessDto>(
      `${this.apiUrl}/user/${userId}/feature/${featureName}`
    );
  }

  /**
   * בדיקה האם משתמש פרימיום
   */
  isPremiumUser(userId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/user/${userId}/is-premium`);
  }

  /**
   * קישור פרופיל למנוי
   */
  linkProfileToSubscription(
    subscriptionId: number,
    artistId?: number,
    serviceProviderId?: number,
    isPrimary: boolean = false
  ): Observable<void> {
    return this.http.post<void>(
      `${this.apiUrl}/${subscriptionId}/link-profile`,
      {
        artistId,
        serviceProviderId,
        isPrimary
      }
    );
  }

  /**
   * ניתוק פרופיל ממנוי
   */
  unlinkProfileFromSubscription(
    artistId?: number,
    serviceProviderId?: number
  ): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/unlink-profile`, {
      artistId,
      serviceProviderId
    });
  }
}
