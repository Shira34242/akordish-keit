import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SongRatingResponse {
  averageRating: number;
  ratingCount: number;
  userRating: number | null;
}

@Injectable({ providedIn: 'root' })
export class SongRatingService {
  private apiUrl = `${environment.apiBaseUrl}/api/Songs`;

  constructor(private http: HttpClient) {}

  getRating(songId: number): Observable<SongRatingResponse> {
    return this.http.get<SongRatingResponse>(`${this.apiUrl}/${songId}/rating`);
  }

  rateSong(songId: number, rating: number): Observable<SongRatingResponse> {
    return this.http.post<SongRatingResponse>(
      `${this.apiUrl}/${songId}/rate`,
      { rating },
      { withCredentials: true }
    );
  }
}
