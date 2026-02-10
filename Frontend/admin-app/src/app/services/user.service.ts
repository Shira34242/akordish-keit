import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserListDto, PagedResult } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'https://localhost:44395/api/Users';

  constructor(private http: HttpClient) { }

  getUsers(
    search?: string,
    role?: number,
    isActive?: boolean,
    pageNumber: number = 1,
    pageSize: number = 10
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

    return this.http.get<PagedResult<UserListDto>>(this.apiUrl, { params });
  }
  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
