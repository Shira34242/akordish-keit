import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateReportDto, Report, UpdateReportStatusDto } from '../models/report.model';
import { PagedResult } from '../models/pagination.model';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private apiUrl = 'https://localhost:44395/api/Reports';

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

  updateReportStatus(id: number, dto: UpdateReportStatusDto): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/${id}/status`, dto);
  }

  deleteReport(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
