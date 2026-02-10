import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Event, CreateEventDto, UpdateEventDto, UpcomingEventDto } from '../../models/event.model';
import { PagedResult } from '../../models/pagination.model';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'https://localhost:44395/api/Events';

  /**
   * קבלת רשימת הופעות עם סינון וחלוקה לעמודים
   */
  getEvents(
    pageNumber: number = 1,
    pageSize: number = 10,
    search?: string,
    isActive?: boolean,
    fromDate?: string,
    toDate?: string
  ): Observable<PagedResult<Event>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (search) {
      params = params.set('search', search);
    }
    if (isActive !== undefined) {
      params = params.set('isActive', isActive.toString());
    }
    if (fromDate) {
      params = params.set('fromDate', fromDate);
    }
    if (toDate) {
      params = params.set('toDate', toDate);
    }

    return this.http.get<PagedResult<Event>>(this.apiUrl, { params });
  }

  /**
   * קבלת הופעה לפי מזהה
   */
  getEvent(id: number): Observable<Event> {
    return this.http.get<Event>(`${this.apiUrl}/${id}`);
  }

  /**
   * קבלת הופעות קרובות (לדף הראשי)
   */
  getUpcomingEvents(limit: number = 6): Observable<UpcomingEventDto[]> {
    const params = new HttpParams().set('limit', limit.toString());
    return this.http.get<UpcomingEventDto[]>(`${this.apiUrl}/upcoming`, { params });
  }

  /**
   * יצירת הופעה חדשה
   */
  createEvent(event: CreateEventDto): Observable<Event> {
    return this.http.post<Event>(this.apiUrl, event);
  }

  /**
   * עדכון הופעה
   */
  updateEvent(id: number, event: UpdateEventDto): Observable<Event> {
    return this.http.put<Event>(`${this.apiUrl}/${id}`, event);
  }

  /**
   * מחיקת הופעה
   */
  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
