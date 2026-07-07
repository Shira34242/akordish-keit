import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AdminUpdateUserDto, AdminUserDetailDto, UserListDto, UserWithProfileDto, PagedResult, SetPageVisibilityDto } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = `${environment.apiBaseUrl}/api/Users`;

  constructor(private http: HttpClient) { }

  getUsers(
    search?: string,
    role?: number,
    isActive?: boolean,
    pageNumber: number = 1,
    pageSize: number = 10,
    contentTag?: number,
    preferredInstrumentId?: number
  ): Observable<PagedResult<UserListDto>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (search) {
      params = params.set('search', search);
    }
    if (role !== undefined && role !== null) {
      params = params.set('role', role.toString());
    }
    if (isActive !== undefined && isActive !== null) {
      params = params.set('isActive', isActive.toString());
    }
    if (contentTag !== undefined && contentTag !== null) {
      params = params.set('contentTag', contentTag.toString());
    }
    if (preferredInstrumentId !== undefined && preferredInstrumentId !== null) {
      params = params.set('preferredInstrumentId', preferredInstrumentId.toString());
    }

    return this.http.get<PagedResult<UserListDto>>(this.apiUrl, { params, withCredentials: true });
  }
  searchUsersWithProfiles(q?: string, limit: number = 20, profileKind?: string, includeAgencies: boolean = false): Observable<UserWithProfileDto[]> {
    let params = new HttpParams().set('limit', limit.toString());
    if (q) params = params.set('q', q);
    if (profileKind) params = params.set('profileKind', profileKind);
    if (includeAgencies) params = params.set('includeAgencies', 'true');
    return this.http.get<UserWithProfileDto[]>(`${this.apiUrl}/with-profiles`, { params, withCredentials: true });
  }

  getUserDetail(id: number): Observable<AdminUserDetailDto> {
    return this.http.get<AdminUserDetailDto>(`${this.apiUrl}/${id}/details`, { withCredentials: true });
  }

  getMyUploaderProfile(): Observable<UserWithProfileDto | null> {
    return this.http.get<UserWithProfileDto>(`${this.apiUrl}/me/uploader-profile`, { observe: 'response' }).pipe(
      map(res => res.status === 204 ? null : res.body),
      catchError(() => of(null))
    );
  }

  getMyAllPages(): Observable<UserWithProfileDto[]> {
    return this.http.get<UserWithProfileDto[]>(`${this.apiUrl}/me/all-pages`, { withCredentials: true }).pipe(
      catchError(() => of([]))
    );
  }

  revokePage(profileType: string, profileId: number): Observable<boolean> {
    return this.http.post(`${this.apiUrl}/me/pages/revoke`, { profileType, profileId }, { withCredentials: true }).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  requestPageDeletion(profileType: string, profileId: number): Observable<boolean> {
    return this.http.post(`${this.apiUrl}/me/pages/delete-request`, { profileType, profileId }, { withCredentials: true }).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  setPageVisibility(data: SetPageVisibilityDto): Observable<UserWithProfileDto | null> {
    return this.http.post<UserWithProfileDto>(`${this.apiUrl}/me/pages/visibility`, data, { withCredentials: true }).pipe(
      catchError(() => of(null))
    );
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  updateUser(id: number, data: AdminUpdateUserDto): Observable<UserListDto> {
    return this.http.put<UserListDto>(`${this.apiUrl}/${id}`, data, { withCredentials: true });
  }

  getMyProfile(): Observable<{ phone?: string; address?: string; birthDate?: string; contentTag?: number; uploadCount?: number }> {
    return this.http.get<{ phone?: string; address?: string; birthDate?: string; contentTag?: number; uploadCount?: number }>(
      `${this.apiUrl}/me`, { withCredentials: true }
    );
  }

  updateMyProfile(data: { phone?: string; address?: string; birthDate?: string; profileImageUrl?: string }): Observable<any> {
    return this.http.put(`${this.apiUrl}/me`, data, { withCredentials: true });
  }

  uploadProfileImage(file: File): Observable<string> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ url: string }>(`${environment.apiBaseUrl}/api/Media/upload`, form, { withCredentials: true })
      .pipe(map(res => res.url));
  }
}
