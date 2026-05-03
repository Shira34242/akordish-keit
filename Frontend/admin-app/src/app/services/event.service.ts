import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

  getMyEvents(): Observable<EventDto[]> {
    return this.http.get<EventDto[]>(`${this.apiUrl}/my`, { withCredentials: true });
  }
}
