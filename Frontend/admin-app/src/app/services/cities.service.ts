import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

export interface City {
  id: number;
  name: string;
  englishName?: string;
  district?: string;
  population?: number;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CitiesService {
  private apiUrl = 'https://localhost:44395/api/Cities';
  private citiesCache$?: Observable<City[]>;

  constructor(private http: HttpClient) {}

  /**
   * מחזיר את רשימת כל הערים מה-API
   * משתמש ב-cache כדי לא לקרוא כל פעם מהשרת
   */
  getCities(): Observable<City[]> {
    if (!this.citiesCache$) {
      this.citiesCache$ = this.http.get<City[]>(this.apiUrl).pipe(
        shareReplay(1) // Cache the result
      );
    }
    return this.citiesCache$;
  }

  /**
   * חיפוש ערים לפי טקסט
   */
  searchCities(searchTerm: string): Observable<City[]> {
    if (!searchTerm || !searchTerm.trim()) {
      return this.getCities();
    }

    const params = new HttpParams().set('search', searchTerm.trim());
    return this.http.get<City[]>(this.apiUrl, { params });
  }

  /**
   * מחזיר עיר לפי ID
   */
  getCityById(id: number): Observable<City> {
    return this.http.get<City>(`${this.apiUrl}/${id}`);
  }

  /**
   * מחזיר שם עיר לפי ID (מהcache)
   */
  getCityNameById(id: number): Observable<string | null> {
    return this.getCities().pipe(
      map(cities => {
        const city = cities.find(c => c.id === id);
        return city ? city.name : null;
      })
    );
  }
}
