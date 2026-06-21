import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ArtistSuggestionRequest {
  contentType?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  content?: string;
  artistName?: string;
  selectedArtistIds?: number[];
}

export interface ArtistSuggestion {
  artistId: number;
  artistName: string;
  artistImageUrl?: string;
  score: number;
  matchedFields: string[];
}

@Injectable({ providedIn: 'root' })
export class ArtistSuggestionService {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/ArtistSuggestions`;

  constructor(private http: HttpClient) {}

  suggestArtists(request: ArtistSuggestionRequest): Observable<ArtistSuggestion[]> {
    return this.http.post<ArtistSuggestion[]>(this.apiUrl, request);
  }
}
