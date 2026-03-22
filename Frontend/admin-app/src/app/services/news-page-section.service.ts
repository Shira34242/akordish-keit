import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { NewsPageSection, CreateNewsPageSectionDto, UpdateNewsPageSectionDto } from '../models/news-page-section.model';

@Injectable({
  providedIn: 'root'
})
export class NewsPageSectionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://localhost:44395/api/NewsPageSections';

  /**
   * מחזיר את הפסים הפעילים עם הכתבות — לדף חדשות המוזיקה
   */
  getActiveSections(): Observable<NewsPageSection[]> {
    return this.http.get<NewsPageSection[]>(this.apiUrl);
  }

  /**
   * מחזיר את כל הפסים (כולל לא פעילים) — לממשק ניהול
   */
  getAllSections(): Observable<NewsPageSection[]> {
    return this.http.get<NewsPageSection[]>(`${this.apiUrl}/all`);
  }

  getSection(id: number): Observable<NewsPageSection> {
    return this.http.get<NewsPageSection>(`${this.apiUrl}/${id}`);
  }

  createSection(dto: CreateNewsPageSectionDto): Observable<NewsPageSection> {
    return this.http.post<NewsPageSection>(this.apiUrl, dto);
  }

  updateSection(id: number, dto: UpdateNewsPageSectionDto): Observable<NewsPageSection> {
    return this.http.put<NewsPageSection>(`${this.apiUrl}/${id}`, dto);
  }

  deleteSection(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
