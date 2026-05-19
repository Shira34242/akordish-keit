import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ImportContentFromUrlResponse, SmartContentType, StoredSmartDraft } from '../../models/smart-content.model';

@Injectable({
  providedIn: 'root'
})
export class SmartContentService {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/SmartContent`;
  private readonly storagePrefix = 'smart-add-draft:';

  constructor(private readonly http: HttpClient) {}

  importFromUrl(url: string, contentType: Exclude<SmartContentType, 'song'>): Observable<ImportContentFromUrlResponse> {
    return this.http.post<ImportContentFromUrlResponse>(`${this.apiUrl}/import-from-url`, { url, contentType });
  }

  storeDraft(draft: StoredSmartDraft): string {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(this.storagePrefix + key, JSON.stringify(draft));
    return key;
  }

  consumeDraft(key: string | null): StoredSmartDraft | null {
    if (!key) return null;

    const storageKey = this.storagePrefix + key;
    const raw = sessionStorage.getItem(storageKey);
    sessionStorage.removeItem(storageKey);

    if (!raw) return null;

    try {
      return JSON.parse(raw) as StoredSmartDraft;
    } catch {
      return null;
    }
  }
}
