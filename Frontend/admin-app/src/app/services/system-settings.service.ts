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

export type PublicBannerImages = Record<string, string>;

@Injectable({ providedIn: 'root' })
export class SystemSettingsService {
  private readonly base = `${environment.apiBaseUrl}/api/SystemSettings`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<SystemSettingDto[]> {
    return this.http.get<SystemSettingDto[]>(this.base, { withCredentials: true });
  }

  update(key: string, value: string): Observable<SystemSettingDto> {
    const body: UpdateSystemSettingDto = { value };
    return this.http.put<SystemSettingDto>(`${this.base}/${key}`, body, { withCredentials: true });
  }

  getPublicBannerImages(): Observable<PublicBannerImages> {
    return this.http.get<PublicBannerImages>(`${this.base}/public/banner-images`);
  }
}
