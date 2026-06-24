import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface SearchItem {
  id: number;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  slug?: string;
  parentSlug?: string;
  type: 'song' | 'artist' | 'article' | 'teacher' | 'professional' | 'playlist' | 'podcast' | 'podcastEpisode' | 'event' | 'agency';
}

export interface SearchResults {
  songs: SearchItem[];
  artists: SearchItem[];
  articles: SearchItem[];
  teachers: SearchItem[];
  professionals: SearchItem[];
  playlists: SearchItem[];
  podcasts: SearchItem[];
  podcastEpisodes: SearchItem[];
  events: SearchItem[];
  agencies: SearchItem[];
  totalCount: number;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private apiUrl = `${environment.apiBaseUrl}/api/Search`;

  constructor(private http: HttpClient) {}

  search(q: string, limit?: number): Observable<SearchResults> {
    let params = new HttpParams().set('q', q);
    if (limit !== undefined && limit !== null) {
      params = params.set('limit', limit.toString());
    }
    return this.http.get<SearchResults>(this.apiUrl, { params });
  }

  searchDeep(q: string): Observable<SearchResults> {
    const params = new HttpParams().set('q', q).set('deep', 'true');
    return this.http.get<SearchResults>(this.apiUrl, { params });
  }
}
