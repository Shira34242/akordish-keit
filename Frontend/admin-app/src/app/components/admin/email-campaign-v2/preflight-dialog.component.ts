import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { PreflightResult, PreflightIssue } from './preflight.service';

@Component({
  selector: 'app-preflight-dialog',
  standalone: true,
  imports: [CommonModule],
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
      padding: 0;
      max-width: 560px;
      width: 100%;
      max-height: 80vh;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .dialog-header {
      padding: 20px 24px 16px;
      border-bottom: 1px solid #f0f0f0;
      flex-shrink: 0;
    }

    .dialog-header h2 {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
    }

    .summary {
      display: flex;
      gap: 16px;
      font-size: 14px;
    }

    .summary-errors {
      color: #dc2626;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .summary-warnings {
      color: #d97706;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .summary-ok {
      color: #059669;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .dialog-body {
      overflow-y: auto;
      padding: 16px 24px;
      flex: 1;
    }

    .issue-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .issue-card {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.4;
    }

    .issue-card.error {
      background: #fef2f2;
      border: 1px solid #fecaca;
    }

    .issue-card.warning {
      background: #fffbeb;
      border: 1px solid #fde68a;
    }

    .issue-icon {
      font-size: 18px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .issue-icon.error { color: #dc2626; }
    .issue-icon.warning { color: #d97706; }

    .issue-content {
      flex: 1;
      min-width: 0;
    }

    .issue-message {
      color: #1a1a1a;
      margin-bottom: 2px;
    }

    .issue-location {
      font-size: 12px;
      color: #888;
    }

    .issue-action {
      display: inline-block;
      margin-top: 4px;
      padding: 3px 10px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      background: #fff;
      color: #374151;
      font-size: 12px;
      cursor: pointer;
      flex-shrink: 0;
      white-space: nowrap;
    }

    .issue-action:hover {
      background: #f3f4f6;
      border-color: #9ca3af;
    }

    .dialog-footer {
      padding: 16px 24px;
      border-top: 1px solid #f0f0f0;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
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

    .section-label {
      font-size: 13px;
      font-weight: 600;
      color: #6b7280;
      margin: 12px 0 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .section-label:first-child {
      margin-top: 0;
    }
  `],
  template: `
    <div class="dialog" role="dialog" aria-labelledby="preflight-title" aria-describedby="preflight-desc">
      <div class="dialog-header">
        <h2 id="preflight-title">בדיקות לפני שליחה</h2>
        <div class="summary" id="preflight-desc">
          @if (result().errors.length > 0) {
            <span class="summary-errors">&#10060; {{ result().errors.length }} שגיאות חוסמות</span>
          }
          @if (result().warnings.length > 0) {
            <span class="summary-warnings">&#9888; {{ result().warnings.length }} אזהרות</span>
          }
          @if (result().errors.length === 0 && result().warnings.length === 0) {
            <span class="summary-ok">&#10004; הכול תקין</span>
          }
        </div>
      </div>

      <div class="dialog-body">
        <div class="issue-list">
          @if (result().errors.length > 0) {
            <div class="section-label">
              <span class="issue-icon error">&#10060;</span> שגיאות חוסמות
            </div>
            @for (issue of result().errors; track issue.code) {
              <div class="issue-card error">
                <span class="issue-icon error">&#10060;</span>
                <div class="issue-content">
                  <div class="issue-message">{{ issue.message }}</div>
                  @if (issue.location) {
                    <div class="issue-location">{{ issue.location }}</div>
                  }
                </div>
                @if (issue.actionLabel && issue.actionId) {
                  <button class="issue-action" (click)="onAction.emit(issue.actionId)">
                    {{ issue.actionLabel }}
                  </button>
                }
              </div>
            }
          }

          @if (result().warnings.length > 0) {
            <div class="section-label">
              <span class="issue-icon warning">&#9888;</span> אזהרות
            </div>
            @for (issue of result().warnings; track issue.code) {
              <div class="issue-card warning">
                <span class="issue-icon warning">&#9888;</span>
                <div class="issue-content">
                  <div class="issue-message">{{ issue.message }}</div>
                  @if (issue.location) {
                    <div class="issue-location">{{ issue.location }}</div>
                  }
                </div>
                @if (issue.actionLabel && issue.actionId) {
                  <button class="issue-action" (click)="onAction.emit(issue.actionId)">
                    {{ issue.actionLabel }}
                  </button>
                }
              </div>
            }
          }
        </div>
      </div>

      <div class="dialog-footer">
        <button class="btn-cancel" (click)="onClose.emit()">ביטול</button>
        <button
          class="btn-send"
          [disabled]="result().errors.length > 0"
          (click)="onConfirm.emit()"
        >
          {{ result().errors.length > 0 ? 'יש לתקן שגיאות חוסמות' : 'שלח למרות האזהרות' }}
        </button>
      </div>
    </div>
  `,
})
export class PreflightDialogComponent {
  readonly result = input.required<PreflightResult>();
  readonly onClose = output<void>();
  readonly onConfirm = output<void>();
  readonly onAction = output<string>();
}
