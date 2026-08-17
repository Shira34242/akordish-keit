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

const DIRECT_UPLOAD_CHUNK_SIZE = 4 * 1024 * 1024;

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
      let activeRequest: XMLHttpRequest | undefined;
      let cancelled = false;
      observer.next({ type: HttpEventType.Sent });

      const send = (url: string, body: Blob | string, headers: Record<string, string>): Promise<number> =>
        new Promise((resolve, reject) => {
          activeRequest = new XMLHttpRequest();
          activeRequest.open('PUT', url);
          Object.entries(headers).forEach(([name, value]) => activeRequest!.setRequestHeader(name, value));
          activeRequest.onload = () => {
            const status = activeRequest?.status ?? 0;
            status >= 200 && status < 300
              ? resolve(status)
              : reject(new Error(`Direct upload failed with status ${status}`));
          };
          activeRequest.onerror = () => reject(new Error('Direct upload failed'));
          activeRequest.onabort = () => reject(new Error('Direct upload cancelled'));
          activeRequest.send(body);
        });

      const run = async (): Promise<void> => {
        try {
          const blockIds: string[] = [];
          const totalBlocks = Math.ceil(file.size / DIRECT_UPLOAD_CHUNK_SIZE);

          for (let index = 0; index < totalBlocks; index += 1) {
            const start = index * DIRECT_UPLOAD_CHUNK_SIZE;
            const end = Math.min(start + DIRECT_UPLOAD_CHUNK_SIZE, file.size);
            const blockId = btoa(String(index).padStart(6, '0'));
            blockIds.push(blockId);

            await send(
              `${target.uploadUrl}&comp=block&blockid=${encodeURIComponent(blockId)}`,
              file.slice(start, end),
              { 'x-ms-version': '2023-11-03' }
            );
            if (cancelled) return;

            // A block only counts after Azure has accepted it, so the percentage is factual.
            observer.next({ type: HttpEventType.UploadProgress, loaded: end, total: file.size });
          }

          const blockList = `<?xml version="1.0" encoding="utf-8"?><BlockList>${blockIds
            .map(blockId => `<Latest>${blockId}</Latest>`)
            .join('')}</BlockList>`;
          const status = await send(
            `${target.uploadUrl}&comp=blocklist`,
            blockList,
            {
              'Content-Type': 'application/xml',
              'x-ms-blob-content-type': target.contentType!,
              'x-ms-version': '2023-11-03'
            }
          );
          if (cancelled) return;

          observer.next(new HttpResponse({ body: { url: target.url! }, status, url: target.url! }));
          observer.complete();
        } catch (error) {
          if (!cancelled) observer.error(error);
        }
      };

      void run();
      return () => {
        cancelled = true;
        activeRequest?.abort();
      };
    });
  }

  deleteMedia(url: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/delete?url=${encodeURIComponent(url)}`);
  }
}
