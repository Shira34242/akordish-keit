import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  TeacherDto,
  TeacherListDto,
  CreateTeacherDto,
  UpdateTeacherDto
} from '../models/teacher.model';
import { PagedResult } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class TeacherService {
  private apiUrl = 'https://localhost:44395/api/Teachers';

  constructor(private http: HttpClient) { }

  getTeachers(
    search?: string,
    instrumentId?: number,
    status?: number,
    isFeatured?: boolean,
    pageNumber: number = 1,
    pageSize: number = 10
  ): Observable<PagedResult<TeacherListDto>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (search) {
      params = params.set('search', search);
    }
    if (instrumentId !== undefined && instrumentId !== null) {
      params = params.set('instrumentId', instrumentId.toString());
    }
    if (status !== undefined && status !== null) {
      params = params.set('status', status.toString());
    }
    if (isFeatured !== undefined && isFeatured !== null) {
      params = params.set('isFeatured', isFeatured.toString());
    }

    return this.http.get<PagedResult<TeacherListDto>>(this.apiUrl, { params });
  }

  getTeacherById(id: number): Observable<TeacherDto> {
    return this.http.get<TeacherDto>(`${this.apiUrl}/${id}`);
  }

  getTeacherByUserId(userId: number): Observable<TeacherDto> {
    return this.http.get<TeacherDto>(`${this.apiUrl}/user/${userId}`);
  }

  createTeacher(dto: CreateTeacherDto): Observable<TeacherDto> {
    console.log(dto);
    return this.http.post<TeacherDto>(this.apiUrl, dto);
  }

  createTeacherProfile(dto: CreateTeacherDto): Observable<TeacherDto> {
    // Creates a teacher profile for the logged-in user (routes through subscription)
    return this.http.post<TeacherDto>(`${this.apiUrl}/create-profile`, dto);
  }

  updateTeacher(id: number, dto: UpdateTeacherDto): Observable<TeacherDto> {
    return this.http.put<TeacherDto>(`${this.apiUrl}/${id}`, dto);
  }

  deleteTeacher(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  approveTeacher(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/approve`, {});
  }

  rejectTeacher(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/reject`, {});
  }

  linkToUser(teacherId: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${teacherId}/link-user/${userId}`, {});
  }

  unlinkFromUser(teacherId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${teacherId}/unlink-user`, {});
  }
}
