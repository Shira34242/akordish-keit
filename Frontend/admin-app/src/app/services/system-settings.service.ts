import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SystemSettingDto {
  id: number;
  key: string;
  value: string;
  description: string;
  updatedAt: string;
}

export interface UpdateSystemSettingDto {
  value: string;
}

export interface SiteAccessGateStatusDto {
  enabled: boolean;
  passwordConfigured: boolean;
  hasAccess: boolean;
  accessVersion: string;
}

export interface UpdateSiteAccessGateDto {
  enabled: boolean;
  password?: string;
}

export interface ComingSoonSubscriptionDto {
  id: number;
  email: string;
  createdAt: string;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class SystemSettingsService {
  private readonly base = `${environment.apiBaseUrl}/api/SystemSettings`;
  private readonly comingSoonBase = `${environment.apiBaseUrl}/api/ComingSoonSubscriptions`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<SystemSettingDto[]> {
    return this.http.get<SystemSettingDto[]>(this.base, { withCredentials: true });
  }

  update(key: string, value: string): Observable<SystemSettingDto> {
    const body: UpdateSystemSettingDto = { value };
    return this.http.put<SystemSettingDto>(`${this.base}/${key}`, body, { withCredentials: true });
  }

  getAccessGate(): Observable<SiteAccessGateStatusDto> {
    return this.http.get<SiteAccessGateStatusDto>(`${this.base}/access-gate`, { withCredentials: true });
  }

  verifyAccessGate(password: string): Observable<SiteAccessGateStatusDto> {
    return this.http.post<SiteAccessGateStatusDto>(
      `${this.base}/access-gate/verify`,
      { password },
      { withCredentials: true }
    );
  }

  updateAccessGate(body: UpdateSiteAccessGateDto): Observable<SiteAccessGateStatusDto> {
    return this.http.put<SiteAccessGateStatusDto>(`${this.base}/access-gate`, body, { withCredentials: true });
  }

  subscribeComingSoon(email: string): Observable<ComingSoonSubscriptionDto> {
    return this.http.post<ComingSoonSubscriptionDto>(this.comingSoonBase, { email });
  }
}
