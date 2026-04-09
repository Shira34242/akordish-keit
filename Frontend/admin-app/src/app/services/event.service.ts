import { Injectable } from '@angular/core';
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
  private apiUrl = 'https://localhost:44395/api/Events';

  constructor(private http: HttpClient) {}

  getMyEvents(): Observable<EventDto[]> {
    return this.http.get<EventDto[]>(`${this.apiUrl}/my`, { withCredentials: true });
  }
}
