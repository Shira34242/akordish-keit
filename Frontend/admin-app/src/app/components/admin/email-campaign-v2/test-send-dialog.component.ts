import { Component, input, output, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface TestSendResultItem {
  email: string;
  success: boolean;
  error?: string;
}

const STORAGE_KEY = 'ak_email_test_addresses';
const MAX_RECENT = 10;

@Component({
  selector: 'app-test-send-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .dialog {
      background: #fff;
      border-radius: 12px;
      padding: 24px 28px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .dialog h2 {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
      flex-shrink: 0;
    }

    .test-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #fef3c7;
      color: #92400e;
      font-size: 11px;
      font-weight: 600;
      border-radius: 4px;
      margin-bottom: 4px;
    }

    .meta-info {
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 16px;
      flex-shrink: 0;
    }

    .meta-row {
      display: flex; gap: 8px; align-items: baseline;
    }
    .meta-row .label { color: #9ca3af; font-size: 12px; }
    .meta-row .value { color: #374151; }

    .dialog-body {
      flex: 1;
      overflow-y: auto;
      min-height: 0;
    }

    .field-group {
      margin-bottom: 14px;
    }

    .field-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #555;
      margin-bottom: 6px;
    }

    .email-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #fff;
      color: #1a1a1a;
      font-size: 14px;
      margin-bottom: 4px;
      direction: ltr;
      box-sizing: border-box;
    }

    .email-input:focus {
      outline: none;
      border-color: #1a73e8;
      box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.1);
    }

    .field-hint {
      font-size: 12px;
      color: #999;
      margin-bottom: 4px;
    }

    .email-error {
      font-size: 12px;
      color: #dc2626;
      margin-bottom: 2px;
    }

    .recent-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }

    .recent-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      font-size: 12px;
      color: #374151;
      cursor: pointer;
      background: #f9fafb;
      transition: background 0.1s;
    }

    .recent-chip:hover { background: #e8f0fe; border-color: #1a73e8; }

    .recent-remove {
      font-size: 14px;
      color: #9ca3af;
      cursor: pointer;
      line-height: 1;
      margin-left: 2px;
    }

    .recent-remove:hover { color: #dc2626; }

    .results-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 12px;
      padding: 12px;
      background: #f9fafb;
      border-radius: 8px;
      max-height: 150px;
      overflow-y: auto;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .result-item.success { color: #059669; }
    .result-item.error { color: #dc2626; }

    .result-icon { font-size: 16px; }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 16px;
      flex-shrink: 0;
    }

    .btn-cancel {
      padding: 8px 18px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #fff;
      color: #555;
      font-size: 14px;
      cursor: pointer;
    }
    .btn-cancel:hover { background: #f5f5f5; }

    .btn-send {
      padding: 8px 18px;
      border: none;
      border-radius: 6px;
      background: #1a73e8;
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-send:hover:not(:disabled) { background: #1557b0; }
    .btn-send:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-retry {
      padding: 8px 18px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #fff;
      color: #374151;
      font-size: 14px;
      cursor: pointer;
    }
    .btn-retry:hover { background: #f3f4f6; }

    .error-message {
      padding: 8px 12px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      color: #991b1b;
      font-size: 13px;
      margin-bottom: 12px;
    }

    .spinner {
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      display: inline-block;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .progress-text {
      font-size: 13px;
      color: #6b7280;
      text-align: center;
      margin: 8px 0;
    }
  `],
  template: `
    <div class="dialog" role="dialog" aria-labelledby="test-send-title" aria-describedby="test-send-desc">
      <h2 id="test-send-title">שליחת מייל בדיקה</h2>

      <span class="test-badge">&#9993; מייל בדיקה</span>

      <div class="meta-info" id="test-send-desc">
        @if (subject()) {
          <div class="meta-row"><span class="label">נושא:</span><span class="value">{{ subject() }}</span></div>
        }
        @if (previewText()) {
          <div class="meta-row"><span class="label">Preheader:</span><span class="value">{{ previewText() }}</span></div>
        }
      </div>

      <div class="dialog-body">
        <div class="field-group">
          <label class="field-label" for="test-emails">כתובות לבדיקה:</label>
          <input
            id="test-emails"
            class="email-input"
            type="text"
            [ngModel]="emailInput()"
            (ngModelChange)="onEmailInputChange($event)"
            placeholder="email1@test.com, email2@test.com"
            [disabled]="sending()"
          />
          @if (invalidEmails().length > 0) {
            <div class="email-error">כתובות לא תקינות: {{ invalidEmails().join(', ') }}</div>
          }
          <div class="field-hint">ניתן להזין מספר כתובות מופרדות בפסיקים</div>
        </div>

        @if (recentAddresses().length > 0 && !sending()) {
          <div class="field-group">
            <div class="field-label">נשלח לאחרונה:</div>
            <div class="recent-list">
              @for (addr of recentAddresses(); track addr) {
                <span class="recent-chip" (click)="addRecentToInput(addr)">
                  {{ addr }}
                  <span class="recent-remove" (click)="removeRecent(addr, $event)" title="הסר" aria-label="הסר {{ addr }}">&#10005;</span>
                </span>
              }
            </div>
          </div>
        }

        @if (errorMessage()) {
          <div class="error-message" role="alert">{{ errorMessage() }}</div>
        }

        @if (sending()) {
          <div class="progress-text">
            <span class="spinner" style="border-color:rgba(0,0,0,0.2);border-top-color:#1a73e8;margin-left:8px"></span>
            שולח {{ currentSendIndex() }}/{{ validEmails().length }}...
          </div>
        }

        @if (results().length > 0) {
          <div class="results-list" role="status" aria-live="polite">
            @for (r of results(); track r.email) {
              <div class="result-item" [class.success]="r.success" [class.error]="!r.success">
                <span class="result-icon">{{ r.success ? '&#10004;' : '&#10060;' }}</span>
                <span>{{ r.email }}</span>
                @if (!r.success && r.error) {
                  <span style="font-size:12px;opacity:0.8">{{ r.error }}</span>
                }
              </div>
            }
          </div>
        }
      </div>

      <div class="dialog-footer">
        <button class="btn-cancel" (click)="onClose.emit()" [disabled]="sending()">ביטול</button>
        @if (results().length > 0 && !sending()) {
          <button class="btn-retry" (click)="onSend.emit(validEmails())">נסה שוב</button>
        }
        <button
          class="btn-send"
          (click)="onSend.emit(validEmails())"
          [disabled]="validEmails().length === 0 || sending()"
        >
          {{ sending() ? 'שולח...' : 'שלח בדיקה' }}
        </button>
      </div>
    </div>
  `,
})
export class TestSendDialogComponent {
  readonly campaignId = input.required<number>();
  readonly subject = input<string>('');
  readonly previewText = input<string>('');
  readonly sending = input<boolean>(false);
  readonly results = input<TestSendResultItem[]>([]);
  readonly errorMessage = input<string>('');
  readonly currentSendIndex = input<number>(0);

  readonly onClose = output<void>();
  readonly onSend = output<string[]>();
  readonly onRemoveRecent = output<string>();

  emailInput = signal('');

  recentAddresses = signal<string[]>(this._loadRecent());

  validEmails = signal<string[]>([]);
  invalidEmails = signal<string[]>([]);

  onEmailInputChange(value: string): void {
    this.emailInput.set(value);
    const emails = this._parseEmails(value);
    const valid: string[] = [];
    const invalid: string[] = [];

    const unique = [...new Set(emails.map(e => e.trim().toLowerCase()))];
    for (const email of unique) {
      if (!email) continue;
      if (this._isValidEmail(email)) {
        valid.push(email);
      } else {
        invalid.push(email);
      }
    }

    this.validEmails.set(valid);
    this.invalidEmails.set(invalid);
  }

  addRecentToInput(addr: string): void {
    const current = this.emailInput();
    const currentEmails = this._parseEmails(current);
    if (!currentEmails.some(e => e.trim().toLowerCase() === addr.toLowerCase())) {
      const newVal = current.trim() ? `${current.trim()}, ${addr}` : addr;
      this.emailInput.set(newVal);
      this.onEmailInputChange(newVal);
    }
  }

  removeRecent(addr: string, event: Event): void {
    event.stopPropagation();
    const recent = this._loadRecent().filter(a => a !== addr);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
    this.recentAddresses.set(recent);
    this.onRemoveRecent.emit(addr);
  }

  addToRecent(email: string): void {
    const recent = this._loadRecent().filter(a => a !== email);
    recent.unshift(email);
    if (recent.length > MAX_RECENT) recent.pop();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
    this.recentAddresses.set(recent);
  }

  private _parseEmails(input: string): string[] {
    return input
      .split(/[,;\n]+/)
      .map(e => e.trim())
      .filter(Boolean);
  }

  private _isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private _loadRecent(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
