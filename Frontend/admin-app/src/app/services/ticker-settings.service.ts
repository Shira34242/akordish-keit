import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { ArticleContentType } from '../models/article.model';

export type TickerContentFilter = 'contentType' | 'category';
export type TickerMoveDirection = 'rtl' | 'ltr';

export interface TickerConfig {
  enabled: boolean;

  filterType: TickerContentFilter;
  contentType: ArticleContentType;
  categoryId: number;

  positionY: number;
  positionX: number;
  widthVw: number;
  rotation: number;

  bandHeight: number;
  backgroundColor: string;
  textColor: string;
  separatorColor: string;
  fontSize: number;
  fontWeight: number;

  speed: number;
  direction: TickerMoveDirection;
}

export const TICKER_DEFAULT: TickerConfig = {
  enabled: true,
  filterType: 'contentType',
  contentType: ArticleContentType.News,
  categoryId: 2,
  positionY: 10,
  positionX: 50,
  widthVw: 145,
  rotation: -6,
  bandHeight: 30,
  backgroundColor: '#000000',
  textColor: '#ffffff',
  separatorColor: '#ddff53',
  fontSize: 12,
  fontWeight: 700,
  speed: 32,
  direction: 'rtl'
};

const DRAFT_STORAGE_KEY = 'akordish_ticker_draft_v4';
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
  private readonly isAdminTickerPage = window.location.pathname.includes('/admin/content/ticker');
  private readonly isPreviewFrame = window.location.search.includes('tickerPreview=');
  private configSubject = new BehaviorSubject<TickerConfig>(this.loadInitial());

  config$ = this.configSubject.asObservable();

  constructor(private http: HttpClient) {
    if (this.isPreviewFrame) {
      window.addEventListener('storage', this.handleStorageUpdate);
      return;
    }

    this.loadPublishedFromServer();
  }

  get config(): TickerConfig {
    return this.configSubject.value;
  }

  updateDraft(partial: Partial<TickerConfig>): void {
    this.setDraft({ ...this.config, ...partial });
  }

  resetDraft(): void {
    this.setDraft({ ...TICKER_DEFAULT });
  }

  saveGlobal(config: TickerConfig = this.config): Observable<ServerSettingDto> {
    const cleanConfig = this.normalizeConfig(config);
    return this.http.put<ServerSettingDto>(
      `${API_URL}/${SERVER_KEY}`,
      { value: JSON.stringify(cleanConfig) },
      { withCredentials: true }
    ).pipe(
      tap(() => {
        this.setDraft(cleanConfig);
      })
    );
  }

  private setDraft(config: TickerConfig): void {
    const normalized = this.normalizeConfig(config);
    try { localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(normalized)); } catch { /* silent */ }
    this.configSubject.next(normalized);
  }

  private loadInitial(): TickerConfig {
    if (!this.isAdminTickerPage && !this.isPreviewFrame) return { ...TICKER_DEFAULT };

    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return { ...TICKER_DEFAULT };
      return this.parseConfig(raw) ?? { ...TICKER_DEFAULT };
    } catch {
      return { ...TICKER_DEFAULT };
    }
  }

  private loadPublishedFromServer(): void {
    this.http.get<ServerSettingValue>(`${API_URL}/public/${SERVER_KEY}`)
      .subscribe({
        next: res => {
          if (!res.value) return;
          const serverConfig = this.parseConfig(res.value);
          if (!serverConfig) return;

          if (this.isAdminTickerPage) {
            if (localStorage.getItem(DRAFT_STORAGE_KEY)) return;
            try { localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(serverConfig)); } catch { /* silent */ }
          }

          this.configSubject.next(serverConfig);
        },
        error: () => { /* ברירת מחדל נשארת פעילה */ }
      });
  }

  private handleStorageUpdate = (event: StorageEvent): void => {
    if (event.key !== DRAFT_STORAGE_KEY || !event.newValue) return;
    const draftConfig = this.parseConfig(event.newValue);
    if (!draftConfig) return;
    this.configSubject.next(draftConfig);
  };

  private parseConfig(value: string): TickerConfig | null {
    try {
      return this.normalizeConfig(JSON.parse(value));
    } catch {
      return null;
    }
  }

  private normalizeConfig(raw: Partial<TickerConfig> & Record<string, any>): TickerConfig {
    return {
      ...TICKER_DEFAULT,
      ...raw,
      positionY: this.num(raw.positionY ?? this.legacyPositionY(raw['topOffset']), TICKER_DEFAULT.positionY),
      positionX: this.num(raw.positionX, TICKER_DEFAULT.positionX),
      widthVw: this.num(raw.widthVw ?? this.legacyWidth(raw['leftExtend']), TICKER_DEFAULT.widthVw),
      rotation: this.num(raw.rotation, TICKER_DEFAULT.rotation),
      bandHeight: this.num(raw.bandHeight, TICKER_DEFAULT.bandHeight),
      fontSize: this.num(raw.fontSize, TICKER_DEFAULT.fontSize),
      fontWeight: this.num(raw.fontWeight, TICKER_DEFAULT.fontWeight),
      speed: this.num(raw.speed, TICKER_DEFAULT.speed),
      direction: raw.direction === 'ltr' ? 'ltr' : 'rtl'
    };
  }

  private num(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  private legacyPositionY(topOffset: unknown): number {
    const px = Number(topOffset);
    if (!Number.isFinite(px)) return TICKER_DEFAULT.positionY;
    return Math.max(0, Math.min(100, Math.round((px / 720) * 100)));
  }

  private legacyWidth(leftExtend: unknown): number {
    const extend = Number(leftExtend);
    if (!Number.isFinite(extend)) return TICKER_DEFAULT.widthVw;
    return Math.max(100, Math.min(240, 100 + extend * 2));
  }
}
