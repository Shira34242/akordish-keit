import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable } from 'rxjs';
import {
  FeaturedContent,
  FeaturedContentBanner,
  CreateFeaturedContentDto,
  UpdateFeaturedContentDto,
  UpdateFeaturedContentBulkDto
} from '../../models/featured-content.model';

@Injectable({
  providedIn: 'root'
})
export class FeaturedContentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/FeaturedContent`;

  /**
   * קבלת כל התוכן המרכזי הפעיל (4 כתבות)
   */
  getActiveFeaturedContent(): Observable<FeaturedContent[]> {
    return this.http.get<FeaturedContent[]>(`${this.apiUrl}/active`);
  }

  getActiveFeaturedContentBanners(): Observable<FeaturedContentBanner[]> {
    return this.http.get<FeaturedContentBanner[]>(`${this.apiUrl}/active-banners`).pipe(
      catchError(() => this.getActiveFeaturedContent().pipe(
        map(items => items as FeaturedContentBanner[])
      ))
    );
  }

  /**
   * קבלת כל התוכן המרכזי (כולל לא פעיל - לאדמין)
   */
  getAllFeaturedContent(): Observable<FeaturedContent[]> {
    return this.http.get<FeaturedContent[]>(this.apiUrl);
  }

  /**
   * קבלת תוכן מרכזי לפי מזהה
   */
  getFeaturedContent(id: number): Observable<FeaturedContent> {
    return this.http.get<FeaturedContent>(`${this.apiUrl}/${id}`);
  }

  /**
   * יצירת תוכן מרכזי חדש
   */
  createFeaturedContent(dto: CreateFeaturedContentDto): Observable<FeaturedContent> {
    return this.http.post<FeaturedContent>(this.apiUrl, dto);
  }

  /**
   * עדכון תוכן מרכזי
   */
  updateFeaturedContent(id: number, dto: UpdateFeaturedContentDto): Observable<FeaturedContent> {
    return this.http.put<FeaturedContent>(`${this.apiUrl}/${id}`, dto);
  }

  /**
   * עדכון מהיר של כל 4 הכתבות בבת אחת
   */
  updateFeaturedContentBulk(dto: UpdateFeaturedContentBulkDto): Observable<FeaturedContent[]> {
    return this.http.put<FeaturedContent[]>(`${this.apiUrl}/bulk`, dto);
  }

  /**
   * מחיקת תוכן מרכזי
   */
  deleteFeaturedContent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
