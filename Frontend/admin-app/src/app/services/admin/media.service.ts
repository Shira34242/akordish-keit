import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private readonly apiUrl = 'https://localhost:44395/api/Media';

  constructor(private http: HttpClient) {}

  uploadMedia(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${this.apiUrl}/upload`, formData);
  }

  deleteMedia(url: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/delete?url=${encodeURIComponent(url)}`);
  }
}
