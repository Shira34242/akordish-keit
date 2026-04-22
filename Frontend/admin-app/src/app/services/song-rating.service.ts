import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SongRatingResponse {
  averageRating: number;
  ratingCount: number;
  userRating: number | null;
}

@Injectable({ providedIn: 'root' })
export class SongRatingService {
  private apiUrl = 'https://localhost:44395/api/Songs';

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
