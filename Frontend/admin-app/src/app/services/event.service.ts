import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PagedResult } from '../models/pagination.model';
import { Event as EventModel } from '../models/event.model';

export interface EventDto {
  id: number;
  name: string;
  eventDate: string;
  location?: string;
  artistName?: string;
  imageUrl?: string;
  ticketUrl?: string;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private apiUrl = `${environment.apiBaseUrl}/api/Events`;

  constructor(private http: HttpClient) {}

  getMyEvents(pageNumber: number = 1, pageSize: number = 8): Observable<PagedResult<EventDto>> {
    const params = new HttpParams().set('pageNumber', pageNumber).set('pageSize', pageSize);
    return this.http.get<PagedResult<EventDto>>(`${this.apiUrl}/my`, { params, withCredentials: true });
  }

  getEventById(id: number): Observable<EventModel> {
    return this.http.get<EventModel>(`${this.apiUrl}/${id}`, { withCredentials: true });
  }
}
