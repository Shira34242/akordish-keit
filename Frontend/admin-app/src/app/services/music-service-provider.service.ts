import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  MusicServiceProviderDto,
  MusicServiceProviderListDto,
  CreateMusicServiceProviderDto,
  UpdateMusicServiceProviderDto
} from '../models/music-service-provider.model';
import { PagedResult } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class MusicServiceProviderService {
  private apiUrl = 'https://localhost:44395/api/MusicServiceProviders';

  constructor(private http: HttpClient) { }

  getServiceProviders(
    search?: string,
    categoryId?: number,
    cityId?: number,
    status?: number,
    isFeatured?: boolean,
    isTeacher?: boolean,
    pageNumber: number = 1,
    pageSize: number = 10
  ): Observable<PagedResult<MusicServiceProviderListDto>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (search) {
      params = params.set('search', search);
    }
    if (categoryId !== undefined && categoryId !== null) {
      params = params.set('categoryId', categoryId.toString());
    }
    if (cityId !== undefined && cityId !== null) {
      params = params.set('cityId', cityId.toString());
    }
    if (status !== undefined && status !== null) {
      params = params.set('status', status.toString());
    }
    if (isFeatured !== undefined && isFeatured !== null) {
      params = params.set('isFeatured', isFeatured.toString());
    }
    if (isTeacher !== undefined && isTeacher !== null) {
      params = params.set('isTeacher', isTeacher.toString());
    }

    return this.http.get<PagedResult<MusicServiceProviderListDto>>(this.apiUrl, { params });
  }

  getServiceProviderById(id: number): Observable<MusicServiceProviderDto> {
    return this.http.get<MusicServiceProviderDto>(`${this.apiUrl}/${id}`);
  }

  getServiceProviderByUserId(userId: number): Observable<MusicServiceProviderDto> {
    return this.http.get<MusicServiceProviderDto>(`${this.apiUrl}/user/${userId}`);
  }

  createServiceProvider(dto: CreateMusicServiceProviderDto): Observable<MusicServiceProviderDto> {
    return this.http.post<MusicServiceProviderDto>(this.apiUrl, dto);
  }

  createServiceProviderProfile(dto: CreateMusicServiceProviderDto): Observable<MusicServiceProviderDto> {
    // Creates a service provider profile for the logged-in user (routes through subscription)
    return this.http.post<MusicServiceProviderDto>(`${this.apiUrl}/create-profile`, dto);
  }

  updateServiceProvider(id: number, dto: UpdateMusicServiceProviderDto): Observable<MusicServiceProviderDto> {
    return this.http.put<MusicServiceProviderDto>(`${this.apiUrl}/${id}`, dto);
  }

  deleteServiceProvider(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  approveServiceProvider(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/approve`, {});
  }

  rejectServiceProvider(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/reject`, {});
  }

  checkUserHasProfile(userId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/check-user/${userId}`);
  }

  linkToUser(providerId: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${providerId}/link-user/${userId}`, {});
  }

  unlinkFromUser(providerId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${providerId}/unlink-user`, {});
  }
}
