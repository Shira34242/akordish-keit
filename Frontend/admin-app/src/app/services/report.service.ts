import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChordRequest, ChordRequestMatch, CreateReportDto, Report, UpdateChordRequestGroupDto, UpdateReportStatusDto } from '../models/report.model';
import { PagedResult } from '../models/pagination.model';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private apiUrl = `${environment.apiBaseUrl}/api/Reports`;

  constructor(private http: HttpClient) { }

  createReport(dto: CreateReportDto): Observable<{ id: number; message: string }> {
    return this.http.post<{ id: number; message: string }>(this.apiUrl, dto);
  }

  getReports(
    pageNumber: number = 1,
    pageSize: number = 20,
    status?: string,
    contentType?: string,
    reportType?: string
  ): Observable<PagedResult<Report>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (status) params = params.set('status', status);
    if (contentType) params = params.set('contentType', contentType);
    if (reportType) params = params.set('reportType', reportType);

    return this.http.get<PagedResult<Report>>(this.apiUrl, { params });
  }

  getReportById(id: number): Observable<Report> {
    return this.http.get<Report>(`${this.apiUrl}/${id}`);
  }

  getChordRequests(pageNumber: number = 1, pageSize: number = 20): Observable<PagedResult<ChordRequest>> {
    const params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<PagedResult<ChordRequest>>(`${this.apiUrl}/chord-requests`, { params });
  }

  findChordRequestMatches(songName: string, artistName?: string): Observable<ChordRequestMatch> {
    let params = new HttpParams().set('songName', songName);
    if (artistName) params = params.set('artistName', artistName);

    return this.http.get<ChordRequestMatch>(`${this.apiUrl}/chord-requests/matches`, { params });
  }

  updateChordRequestGroup(dto: UpdateChordRequestGroupDto): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/chord-requests/group`, dto);
  }

  updateReportStatus(id: number, dto: UpdateReportStatusDto): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/${id}/status`, dto);
  }

  deleteReport(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }

  approveArtist(reportId: number): Observable<{ message: string; artistId: number }> {
    return this.http.post<{ message: string; artistId: number }>(`${this.apiUrl}/${reportId}/approve-artist`, {});
  }

  cleanupArtistDuplicates(): Observable<{ message: string; closedCount: number }> {
    return this.http.post<{ message: string; closedCount: number }>(`${this.apiUrl}/cleanup-artist-duplicates`, {});
  }
}
