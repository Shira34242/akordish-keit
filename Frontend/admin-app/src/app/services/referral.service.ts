import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReferralSummary {
  code: string;
  referralUrl: string;
  joinedCount: number;
  googleJoinedCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class ReferralService {
  private apiUrl = `${environment.apiBaseUrl}/api/referrals`;

  constructor(private http: HttpClient) {}

  getSummary(): Observable<ReferralSummary> {
    return this.http.get<ReferralSummary>(`${this.apiUrl}/summary`, { withCredentials: true });
  }
}
