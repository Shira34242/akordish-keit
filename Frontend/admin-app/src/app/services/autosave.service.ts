import { Injectable, inject, signal } from '@angular/core';
import { EmailCampaignV2Service, type SaveEmailV2TemplateDto, type EmailV2TemplateDto } from './email-campaign-v2.service';
import { firstValueFrom, timer } from 'rxjs';

export interface SaveSnapshot {
  subject: string;
  designJson: string;
  mjml: string;
  previewText: string;
  fromName: string;
  campaignId: number | null;
}

export interface SaveResult {
  template: EmailV2TemplateDto;
  snapshot: SaveSnapshot;
}

export type AutosaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'failed' | 'offline';

@Injectable({ providedIn: 'root' })
export class AutosaveService {
  private readonly _v2Service = inject(EmailCampaignV2Service);

  readonly saveState = signal<AutosaveState>('idle');
  readonly lastSavedAt = signal<Date | null>(null);
  readonly saveError = signal<string | null>(null);

  private _lastSavedHash: string | null = null;
  private _saveInProgress = false;
  private _pendingSnapshot: SaveSnapshot | null = null;
  private _retryCount = 0;
  private readonly _maxRetries = 3;

  setBaseline(snapshot: SaveSnapshot): void {
    if (this._lastSavedHash === null) {
      this._lastSavedHash = this._computeHash(snapshot);
    }
  }

  isChanged(snapshot: SaveSnapshot): boolean {
    const hash = this._computeHash(snapshot);
    return hash !== this._lastSavedHash;
  }

  scheduleSave(snapshot: SaveSnapshot): void {
    if (!this.isChanged(snapshot)) {
      return;
    }

    if (this._saveInProgress) {
      this._pendingSnapshot = snapshot;
      return;
    }

    this._saveInProgress = true;
    this._pendingSnapshot = null;
    this._retryCount = 0;
    this.saveState.set('saving');
    this.saveError.set(null);
    this._executeSave(snapshot);
  }

  async flush(snapshot: SaveSnapshot): Promise<boolean> {
    if (!this.isChanged(snapshot)) {
      return true;
    }

    this._pendingSnapshot = null;

    if (this._saveInProgress) {
      this._pendingSnapshot = snapshot;
      this._retryCount = 0;
      this.saveError.set(null);
      return new Promise<boolean>((resolve) => {
        const check = setInterval(() => {
          if (!this._saveInProgress && this._pendingSnapshot === null) {
            clearInterval(check);
            resolve(this.saveState() === 'saved');
          }
        }, 100);
        setTimeout(() => {
          clearInterval(check);
          resolve(false);
        }, 30000);
      });
    }

    this._saveInProgress = true;
    this._retryCount = 0;
    this.saveState.set('saving');
    this.saveError.set(null);
    const success = await this._executeSaveAsync(snapshot);
    return success;
  }

  reset(): void {
    this._lastSavedHash = null;
    this._saveInProgress = false;
    this._pendingSnapshot = null;
    this._retryCount = 0;
    this.saveState.set('idle');
    this.lastSavedAt.set(null);
    this.saveError.set(null);
  }

  clearDirty(): void {
    if (this.saveState() === 'dirty') {
      this.saveState.set('idle');
    }
  }

  private _executeSave(snapshot: SaveSnapshot): void {
    this._executeSaveAsync(snapshot).then((success) => {
      if (!success) {
        this._handleSaveFailure();
      }
    });
  }

  private async _executeSaveAsync(snapshot: SaveSnapshot): Promise<boolean> {
    const hash = this._computeHash(snapshot);

    for (let attempt = 0; attempt <= this._maxRetries; attempt++) {
      try {
        const dto: SaveEmailV2TemplateDto = {
          subject: snapshot.subject,
          fromName: snapshot.fromName,
          designJson: snapshot.designJson,
          mjml: snapshot.mjml,
          previewText: snapshot.previewText || undefined,
          campaignId: snapshot.campaignId ?? undefined,
        };

        const result = await firstValueFrom(this._v2Service.saveTemplate(dto));

        if (result?.campaignId) {
          snapshot.campaignId = result.campaignId;
        }

        this._lastSavedHash = hash;
        this.lastSavedAt.set(new Date());
        this.saveError.set(null);

        this._continueSaveQueue();

        this.saveState.set('saved');
        setTimeout(() => {
          if (this.saveState() === 'saved') {
            this.saveState.set('idle');
          }
        }, 3000);

        return true;
      } catch (error: any) {
        const status = error?.status;
        const isClientError = status >= 400 && status < 500;

        if (isClientError || attempt === this._maxRetries) {
          this._lastSavedHash = null;
          this.saveState.set('failed');

          let message = 'השמירה נכשלה';
          if (error?.error?.message) {
            message = error.error.message;
          } else if (status === 0 || !status) {
            message = 'אין חיבור לשרת. בדוק את החיבור ונסה שוב.';
          } else if (status === 401 || status === 403) {
            message = 'אין הרשאה לשמור. ייתכן שפג תוקף ההתחברות.';
          } else if (status === 404) {
            message = 'הקמפיין לא נמצא בשרת.';
          } else if (status >= 500) {
            message = 'שגיאת שרת. נסה שוב מאוחר יותר.';
          }

          this.saveError.set(message);
          console.error('[Autosave] Save failed:', error);

          this._continueSaveQueue();
          return false;
        }

        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[Autosave] Retry ${attempt + 1}/${this._maxRetries} after ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    return false;
  }

  private _continueSaveQueue(): void {
    this._saveInProgress = false;

    if (this._pendingSnapshot) {
      const next = this._pendingSnapshot;
      this._pendingSnapshot = null;
      if (this.isChanged(next)) {
        this._saveInProgress = true;
        this._retryCount = 0;
        this.saveState.set('saving');
        this._executeSave(next);
      }
    }
  }

  private _handleSaveFailure(): void {
    this._saveInProgress = false;
    if (this._pendingSnapshot) {
      this._pendingSnapshot = null;
    }
  }

  private _computeHash(snapshot: SaveSnapshot): string {
    return [
      snapshot.subject,
      snapshot.designJson,
      snapshot.mjml,
      snapshot.previewText || '',
      snapshot.fromName,
    ].join('\u0000');
  }
}
