import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { catchError, concatMap, Observable } from 'rxjs';

interface DirectMediaUpload {
  directUpload: boolean;
  uploadUrl?: string;
  url?: string;
  contentType?: string;
}

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
    return this.http.post<DirectMediaUpload>(`${this.apiUrl}/upload-url`, {
      fileName: file.name,
      fileSize: file.size
    }, { withCredentials: true }).pipe(
      concatMap(target => {
        if (target.directUpload && target.uploadUrl && target.url && target.contentType) {
          return this.uploadDirectly(file, target).pipe(
            // Azure CORS is configured outside the app. Until then, retain the current path.
            catchError(() => this.uploadViaApi(file))
          );
        }

        return this.uploadViaApi(file);
      })
    );
  }

  private uploadViaApi(file: File): Observable<HttpEvent<{ url: string }>> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post<{ url: string }>(`${this.apiUrl}/upload`, formData, {
      withCredentials: true,
      reportProgress: true,
      observe: 'events'
    });
  }

  private uploadDirectly(file: File, target: DirectMediaUpload): Observable<HttpEvent<{ url: string }>> {
    return new Observable(observer => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', target.uploadUrl!);
      xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
      xhr.setRequestHeader('x-ms-blob-content-type', target.contentType!);
      xhr.setRequestHeader('x-ms-version', '2023-11-03');

      xhr.upload.onprogress = event => {
        observer.next({
          type: HttpEventType.UploadProgress,
          loaded: event.loaded,
          total: event.lengthComputable ? event.total : file.size
        });
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          observer.next(new HttpResponse({ body: { url: target.url! }, status: xhr.status, url: target.url! }));
          observer.complete();
          return;
        }
        observer.error(new Error(`Direct upload failed with status ${xhr.status}`));
      };
      xhr.onerror = () => observer.error(new Error('Direct upload failed'));
      xhr.onabort = () => observer.error(new Error('Direct upload cancelled'));

      observer.next({ type: HttpEventType.Sent });
      xhr.send(file);
      return () => xhr.abort();
    });
  }

  deleteMedia(url: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/delete?url=${encodeURIComponent(url)}`);
  }
}
