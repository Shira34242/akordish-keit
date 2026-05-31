import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/Media`;

  constructor(private http: HttpClient) {}

  uploadMedia(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${this.apiUrl}/upload`, formData, {
      withCredentials: true
    });
  }

  uploadMediaWithProgress(file: File): Observable<HttpEvent<{ url: string }>> {
    return new Observable<HttpEvent<{ url: string }>>(observer => {
      let progress = 0;

      observer.next({ type: HttpEventType.Sent });

      const progressTimer = window.setInterval(() => {
        progress = Math.min(progress + 10, 90);
        observer.next({
          type: HttpEventType.UploadProgress,
          loaded: progress,
          total: 100
        });
      }, 250);

      const uploadSub = this.uploadMedia(file).subscribe({
        next: response => {
          window.clearInterval(progressTimer);
          observer.next({
            type: HttpEventType.UploadProgress,
            loaded: 100,
            total: 100
          });
          observer.next(new HttpResponse({ status: 200, body: response }));
          observer.complete();
        },
        error: error => {
          window.clearInterval(progressTimer);
          observer.error(error);
        }
      });

      return () => {
        window.clearInterval(progressTimer);
        uploadSub.unsubscribe();
      };
    });
  }

  deleteMedia(url: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/delete?url=${encodeURIComponent(url)}`);
  }
}
