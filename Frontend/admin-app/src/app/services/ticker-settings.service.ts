import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import { ArticleContentType } from '../models/article.model';

export interface TickerConfig {
  // הפעלה
  enabled: boolean;

  // תוכן
  filterType: 'contentType' | 'category';
  contentType: ArticleContentType;
  categoryId: number;

  // מיקום
  topOffset: number;     // px ממרכז hero-bg
  rotation: number;      // מעלות (שלילי = שמאל יורד)
  leftExtend: number;    // % הרחבה משמאל מעבר לשוליים

  // עיצוב
  bandHeight: number;    // px
  backgroundColor: string;
  textColor: string;
  separatorColor: string;
  fontSize: number;      // px
  fontWeight: number;    // 300 / 400 / 600 / 700 / 800
}

export const TICKER_DEFAULT: TickerConfig = {
  enabled: true,
  filterType: 'contentType',
  contentType: ArticleContentType.News,
  categoryId: 2,
  topOffset: 56,
  rotation: -6,
  leftExtend: 36,
  bandHeight: 30,
  backgroundColor: '#000000',
  textColor: '#ffffff',
  separatorColor: '#ddff53',
  fontSize: 12,
  fontWeight: 300
};

const STORAGE_KEY = 'akordish_ticker_config_v3';
const SERVER_KEY = 'hero_news_ticker_config';
const API_URL = 'https://localhost:44395/api/SystemSettings';

interface ServerSettingValue {
  key: string;
  value: string | null;
}

interface ServerSettingDto {
  id: number;
  key: string;
  value: string;
  description: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class TickerSettingsService {

  private readonly isPreviewFrame = window.location.search.includes('tickerPreview=');
  private configSubject = new BehaviorSubject<TickerConfig>(this.load());

  config$ = this.configSubject.asObservable();

  get config(): TickerConfig {
    return this.configSubject.value;
  }

  get enabled(): boolean { return this.config.enabled; }
  get contentType(): ArticleContentType { return this.config.contentType; }

  constructor(private http: HttpClient) {
    if (!this.isPreviewFrame) {
      this.loadFromServer();
    }
  }

  update(partial: Partial<TickerConfig>): void {
    const next = { ...this.config, ...partial };
    this.save(next);
  }

  reset(): void {
    this.save({ ...TICKER_DEFAULT });
  }

  saveGlobal(config: TickerConfig = this.config): Observable<ServerSettingDto> {
    return this.http.put<ServerSettingDto>(
      `${API_URL}/${SERVER_KEY}`,
      { value: JSON.stringify(config) },
      { withCredentials: true }
    ).pipe(
      tap(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* silent */ }
        this.configSubject.next(config);
      })
    );
  }

  private save(config: TickerConfig): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* silent */ }
    this.configSubject.next(config);
  }

  private load(): TickerConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...TICKER_DEFAULT };
      const p = JSON.parse(raw);
      // merge with defaults so new keys always have a value
      return { ...TICKER_DEFAULT, ...p };
    } catch {
      return { ...TICKER_DEFAULT };
    }
  }

  private loadFromServer(): void {
    this.http.get<ServerSettingValue>(`${API_URL}/public/${SERVER_KEY}`)
      .subscribe({
        next: res => {
          if (!res.value) return;
          const serverConfig = this.parseConfig(res.value);
          if (!serverConfig) return;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serverConfig)); } catch { /* silent */ }
          this.configSubject.next(serverConfig);
        },
        error: () => { /* משתמשים בברירת מחדל / שמירה מקומית */ }
      });
  }

  private parseConfig(value: string): TickerConfig | null {
    try {
      const parsed = JSON.parse(value);
      return { ...TICKER_DEFAULT, ...parsed };
    } catch {
      return null;
    }
  }
}
