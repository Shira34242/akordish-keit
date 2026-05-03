import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay, catchError } from 'rxjs/operators';

export interface Instrument {
  id: number;
  name: string;
  englishName?: string | null;
}

interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class InstrumentService {
  private apiUrl = `${environment.apiBaseUrl}/api/instruments`;
  private cache$?: Observable<Instrument[]>;

  constructor(private http: HttpClient) {}

  /** מחזיר את כל הכלים (עד 200), עם cache בתהליך הריצה */
  getAll(): Observable<Instrument[]> {
    if (!this.cache$) {
      const params = new HttpParams().set('pageNumber', '1').set('pageSize', '200');
      this.cache$ = this.http.get<PagedResponse<Instrument>>(this.apiUrl, { params }).pipe(
        map(res => res.items ?? []),
        catchError(() => of([])),
        shareReplay(1)
      );
    }
    return this.cache$;
  }
}
