import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AdminPermission, AdminRole, SaveAdminRole } from '../models/admin-role.model';

@Injectable({
  providedIn: 'root'
})
export class AdminRoleService {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/admin/roles`;

  constructor(private http: HttpClient) {}

  getPermissions(): Observable<AdminPermission[]> {
    return this.http.get<AdminPermission[]>(`${this.apiUrl}/permissions`, { withCredentials: true });
  }

  getRoles(includeInactive = true): Observable<AdminRole[]> {
    return this.http.get<AdminRole[]>(this.apiUrl, {
      params: { includeInactive },
      withCredentials: true
    });
  }

  createRole(data: SaveAdminRole): Observable<AdminRole> {
    return this.http.post<AdminRole>(this.apiUrl, data, { withCredentials: true });
  }

  updateRole(id: number, data: SaveAdminRole): Observable<AdminRole> {
    return this.http.put<AdminRole>(`${this.apiUrl}/${id}`, data, { withCredentials: true });
  }

  deleteRole(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }
}
