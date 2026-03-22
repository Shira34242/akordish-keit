import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SearchItem {
  id: number;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  type: 'song' | 'artist' | 'article' | 'teacher' | 'professional' | 'playlist';
}

export interface SearchResults {
  songs: SearchItem[];
  artists: SearchItem[];
  articles: SearchItem[];
  teachers: SearchItem[];
  professionals: SearchItem[];
  playlists: SearchItem[];
  totalCount: number;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private apiUrl = 'https://localhost:44395/api/Search';

  constructor(private http: HttpClient) {}

  search(q: string): Observable<SearchResults> {
    const params = new HttpParams().set('q', q);
    return this.http.get<SearchResults>(this.apiUrl, { params });
  }
}
