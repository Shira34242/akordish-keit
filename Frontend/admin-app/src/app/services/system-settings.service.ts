import { Injectable } from '@angular/core';
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

@Injectable({ providedIn: 'root' })
export class SystemSettingsService {
  private readonly base = 'https://localhost:44395/api/SystemSettings';

  constructor(private http: HttpClient) {}

  getAll(): Observable<SystemSettingDto[]> {
    return this.http.get<SystemSettingDto[]>(this.base, { withCredentials: true });
  }

  update(key: string, value: string): Observable<SystemSettingDto> {
    const body: UpdateSystemSettingDto = { value };
    return this.http.put<SystemSettingDto>(`${this.base}/${key}`, body, { withCredentials: true });
  }
}
