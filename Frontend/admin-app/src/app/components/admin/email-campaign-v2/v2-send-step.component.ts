import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import {
  EmailCampaignV2Service,
  type EmailV2TemplateDto,
} from '../../../services/email-campaign-v2.service';
import {
  EmailCampaignService,
  EmailRecipientGroup,
  type EmailGroupDto,
} from '../../../services/email-campaign.service';
import { PreflightService, type PreflightResult } from './preflight.service';
import { PreflightDialogComponent } from './preflight-dialog.component';
import { TestSendDialogComponent, type TestSendResultItem } from './test-send-dialog.component';

@Component({
  selector: 'app-v2-send-step',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PreflightDialogComponent, TestSendDialogComponent],
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
        max-width: 900px;
        margin: 0 auto;
      }

      .stepper {
        display: flex;
        align-items: center;
        gap: 0;
        margin-bottom: 32px;
        padding: 0 8px;
      }

      .stepper-back {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #555;
        text-decoration: none;
        font-size: 14px;
        margin-left: auto;
        padding: 6px 12px;
        border-radius: 6px;
        transition: background 0.15s;
      }

      .stepper-back:hover {
        background: #f0f0f0;
        color: #222;
      }

      .stepper-steps {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .stepper-step {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        color: #999;
        white-space: nowrap;
      }

      .stepper-step.active {
        color: #1a73e8;
        font-weight: 600;
      }

      .stepper-step.done {
        color: #27ae60;
      }

      .stepper-step .step-num {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        border: 2px solid #ccc;
        color: #999;
        flex-shrink: 0;
      }

      .stepper-step.active .step-num {
        border-color: #1a73e8;
        background: #1a73e8;
        color: #fff;
      }

      .stepper-step.done .step-num {
        border-color: #27ae60;
        background: #27ae60;
        color: #fff;
      }

      .stepper-connector {
        width: 32px;
        height: 2px;
        background: #e0e0e0;
        flex-shrink: 0;
        border-radius: 1px;
      }

      .card {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 20px 24px;
        margin-bottom: 16px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      }

      .card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
        font-size: 16px;
        font-weight: 600;
        color: #1a1a1a;
      }

      .card-header .icon {
        font-size: 22px;
        color: #1a73e8;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      @media (max-width: 640px) {
        .summary-grid {
          grid-template-columns: 1fr;
        }
      }

      .summary-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .summary-label {
        font-size: 12px;
        color: #888;
        font-weight: 500;
      }

      .summary-value {
        font-size: 14px;
        color: #222;
        word-break: break-word;
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
      }

      .status-badge.draft {
        background: #fef3c7;
        color: #92400e;
      }

      .status-badge.sent {
        background: #d1fae5;
        color: #065f46;
      }

      .status-badge.failed {
        background: #fee2e2;
        color: #991b1b;
      }

      .btn-edit {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border: 1px solid #1a73e8;
        border-radius: 6px;
        background: #fff;
        color: #1a73e8;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        text-decoration: none;
        transition: background 0.15s;
        margin-top: 12px;
      }

      .btn-edit:hover {
        background: #e8f0fe;
      }

      .field-row {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 14px;
      }

      .field-row:last-child {
        margin-bottom: 0;
      }

      .field-label {
        font-size: 13px;
        font-weight: 500;
        color: #444;
      }

      .field-input {
        padding: 9px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        background: #fafafa;
        transition: border-color 0.15s, box-shadow 0.15s;
        width: 100%;
        box-sizing: border-box;
      }

      .field-input:focus {
        outline: none;
        border-color: #1a73e8;
        box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.1);
        background: #fff;
      }

      .field-input[dir='ltr'] {
        font-family: 'Segoe UI', sans-serif;
      }

      .field-note {
        font-size: 12px;
        color: #999;
        margin-top: 2px;
      }

      .group-cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 10px;
      }

      .group-card {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s;
        background: #fafafa;
      }

      .group-card:hover {
        border-color: #b3d4fc;
        background: #f5f9ff;
      }

      .group-card.selected {
        border-color: #1a73e8;
        background: #e8f0fe;
      }

      .group-card-icon {
        font-size: 22px;
        color: #666;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .group-card.selected .group-card-icon {
        color: #1a73e8;
      }

      .group-card-body {
        flex: 1;
        min-width: 0;
      }

      .group-card-name {
        font-size: 14px;
        font-weight: 600;
        color: #222;
        margin-bottom: 2px;
      }

      .group-card-desc {
        font-size: 12px;
        color: #777;
        margin-bottom: 4px;
        line-height: 1.3;
      }

      .group-card-count {
        font-size: 13px;
        color: #1a73e8;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .group-card-spinner {
        width: 14px;
        height: 14px;
        border: 2px solid #e5e7eb;
        border-top-color: #1a73e8;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .custom-group-select {
        margin-top: 12px;
      }

      .custom-group-select select {
        width: 100%;
        max-width: 320px;
        padding: 9px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        background: #fafafa;
      }

      .checks-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .check-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 14px;
        color: #444;
      }

      .check-icon {
        font-size: 20px;
        flex-shrink: 0;
      }

      .check-icon.pass {
        color: #27ae60;
      }

      .check-icon.fail {
        color: #e74c3c;
      }

      .actions-bar {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
        margin-top: 8px;
        flex-wrap: wrap;
      }

      .btn-test {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 10px 20px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        background: #fff;
        color: #444;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
      }

      .btn-test:hover:not(:disabled) {
        background: #f5f5f5;
        border-color: #bbb;
      }

      .btn-send {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 10px 28px;
        border: none;
        border-radius: 8px;
        background: #1a73e8;
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s, box-shadow 0.15s;
      }

      .btn-send:hover:not(:disabled) {
        background: #1557b0;
        box-shadow: 0 2px 8px rgba(26, 115, 232, 0.3);
      }

      .btn-send:disabled,
      .btn-test:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
        display: inline-block;
      }

      .dialog-backdrop {
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
        padding: 28px 32px;
        max-width: 440px;
        width: 100%;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
      }

      .dialog h2 {
        margin: 0 0 20px 0;
        font-size: 18px;
        font-weight: 600;
        color: #1a1a1a;
      }

      .dialog-body {
        margin-bottom: 20px;
      }

      .dialog-body label {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: #555;
        margin-bottom: 6px;
      }

      .confirm-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        font-size: 14px;
        border-bottom: 1px solid #f0f0f0;
      }

      .confirm-row:last-child {
        border-bottom: none;
      }

      .confirm-row strong {
        color: #555;
      }

      .confirm-warning {
        margin-top: 12px;
        padding: 10px 14px;
        background: #fef3c7;
        border-radius: 6px;
        font-size: 13px;
        color: #92400e;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .dialog-actions {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
      }

      .btn-cancel {
        padding: 9px 18px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: #fff;
        color: #555;
        font-size: 14px;
        cursor: pointer;
      }

      .btn-cancel:hover {
        background: #f5f5f5;
      }

      .btn-confirm {
        padding: 9px 18px;
        border: none;
        border-radius: 6px;
        background: #1a73e8;
        color: #fff;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
      }

      .btn-confirm:hover:not(:disabled) {
        background: #1557b0;
      }

      .btn-confirm:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .status-banner {
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .status-banner.success {
        background: #d1fae5;
        color: #065f46;
      }

      .status-banner.error {
        background: #fee2e2;
        color: #991b1b;
      }

      .loading-page {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 80px 0;
        color: #888;
        font-size: 15px;
        gap: 10px;
      }
    `,
  ],
  template: `
    @if (pageLoading()) {
      <div class="loading-page">
        <span class="group-card-spinner" style="width:20px;height:20px;border-width:3px"></span>
        טוען את פרטי הקמפיין...
      </div>
    } @else {
      <div class="stepper">
        <div class="stepper-steps">
          <span class="stepper-step done">
            <span class="step-num">1</span>
            עיצוב המייל
          </span>
          <span class="stepper-connector"></span>
          <span class="stepper-step active">
            <span class="step-num">2</span>
            הגדרות ושליחה
          </span>
        </div>
        <a class="stepper-back" [routerLink]="['../edit']">
          <span style="font-size:18px">&#8592;</span>
          חזרה לעריכת המייל
        </a>
      </div>

      @if (statusMessage()) {
        <div class="status-banner" [class.success]="statusType() === 'success'" [class.error]="statusType() === 'error'">
          {{ statusMessage() }}
        </div>
      }

      <div class="card">
        <div class="card-header">
          <span class="icon">&#128196;</span>
          סיכום הקמפיין
        </div>
        <div class="summary-grid">
          <div class="summary-item">
            <span class="summary-label">נושא</span>
            <span class="summary-value">{{ template()?.subject || '—' }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">טקסט מקדים</span>
            <span class="summary-value">{{ template()?.previewText || '—' }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">נשמר לאחרונה</span>
            <span class="summary-value">{{ template()?.createdAt | date:'short' }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">סטטוס</span>
            <span>
              <span class="status-badge" [class.draft]="template()?.status === 'draft'" [class.sent]="template()?.status === 'sent'" [class.failed]="template()?.status === 'failed'">
                {{ template()?.status === 'draft' ? 'טיוטה' : template()?.status === 'sent' ? 'נשלח' : template()?.status === 'failed' ? 'נכשל' : (template()?.status || '—') }}
              </span>
            </span>
          </div>
        </div>
        <a class="btn-edit" [routerLink]="['../edit']">
          <span style="font-size:16px">&#9998;</span>
          עריכת המייל
        </a>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="icon">&#9993;</span>
          פרטי שולח
        </div>
        <div class="field-row">
          <label class="field-label">שם השולח</label>
          <input
            class="field-input"
            type="text"
            [ngModel]="fromName()"
            (ngModelChange)="fromName.set($event)"
            placeholder="אקורדישקייט"
          />
        </div>
        <div class="field-row">
          <label class="field-label">כתובת שולח</label>
          <input
            class="field-input"
            type="email"
            dir="ltr"
            [ngModel]="fromEmail()"
            (ngModelChange)="fromEmail.set($event)"
            placeholder="noreply@akordishkeit.com"
          />
          <span class="field-note">&#9432; ניתן להשתמש רק בכתובות שאושרו מראש ב-Brevo (Sendinblue)</span>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="icon">&#128101;</span>
          קהל יעד
        </div>
        <div class="group-cards">
          @for (group of recipientGroups; track group.value) {
            <div
              class="group-card"
              [class.selected]="recipientGroup() === group.value"
              (click)="selectGroup(group.value)"
            >
              <span class="group-card-icon">{{ group.icon }}</span>
              <div class="group-card-body">
                <div class="group-card-name">{{ group.label }}</div>
                <div class="group-card-desc">{{ group.description }}</div>
                @if (recipientGroup() === group.value) {
                  @if (loadingCount()) {
                    <div class="group-card-count">
                      <span class="group-card-spinner"></span>
                      סופר נמענים...
                    </div>
                  } @else {
                    <div class="group-card-count">
                      {{ recipientCount() | number }} נמענים
                    </div>
                  }
                }
              </div>
            </div>
          }
        </div>

        @if (recipientGroup() === RecipientGroup.CustomGroup) {
          <div class="custom-group-select">
            <select
              [ngModel]="selectedEmailGroupId()"
              (ngModelChange)="selectedEmailGroupId.set($event); onCustomGroupChange()"
            >
              <option [ngValue]="null">— בחרי קבוצה —</option>
              @for (g of emailGroups(); track g.id) {
                <option [ngValue]="g.id">{{ g.name }} ({{ g.memberCount }})</option>
              }
            </select>
          </div>
        }
      </div>

      <div class="card">
        <div class="card-header">
          <span class="icon">&#9989;</span>
          בדיקות לפני שליחה
        </div>
        <div class="checks-list">
          @if (preflightSummary(); as summary) {
            <div class="check-item">
              <span class="check-icon" [class.pass]="summary.errors === 0" [class.fail]="summary.errors > 0">
                {{ summary.errors === 0 ? '&#10004;' : '&#10060;' }}
              </span>
              שגיאות חוסמות: {{ summary.errors }}
            </div>
            <div class="check-item">
              <span class="check-icon pass">
                &#9888;
              </span>
              אזהרות: {{ summary.warnings }}
            </div>
          }
          <button class="btn-test" (click)="runPreflight()" style="margin-top:8px">
            &#128269; בדוק לפני שליחה
          </button>
        </div>
      </div>

      <div class="actions-bar">
        <button class="btn-test" (click)="openTestDialog()" [disabled]="!campaignId() || testSending()">
          &#9993; שלח בדיקה
        </button>
        <button class="btn-send" (click)="openSendConfirm()" [disabled]="!readyToSend() || sending()">
          @if (sending()) {
            <span class="spinner"></span> שולח...
          } @else {
            &#10148; שלח עכשיו
          }
        </button>
      </div>

      @if (showTestDialog()) {
        <app-test-send-dialog
          [campaignId]="campaignId() || 0"
          [subject]="template()?.subject || ''"
          [previewText]="template()?.previewText || ''"
          [sending]="testSending()"
          [results]="testResults()"
          [errorMessage]="testError()"
          [currentSendIndex]="testSendIndex()"
          (onClose)="closeTestDialog()"
          (onSend)="handleTestSend($event)"
        />
      }

      @if (showSendConfirm()) {
        <div class="dialog-backdrop" (click)="showSendConfirm.set(false)">
          <div class="dialog" (click)="$event.stopPropagation()">
            <h2>אישור שליחה</h2>
            <div class="dialog-body">
              <div class="confirm-row">
                <strong>נושא:</strong>
                <span>{{ template()?.subject }}</span>
              </div>
              <div class="confirm-row">
                <strong>שולח:</strong>
                <span>{{ fromName() }}</span>
              </div>
              <div class="confirm-row">
                <strong>קהל יעד:</strong>
                <span>{{ selectedGroupLabel }}</span>
              </div>
              <div class="confirm-row">
                <strong>מספר נמענים:</strong>
                <span>{{ recipientCount() | number }}</span>
              </div>
              <div class="confirm-warning">
                <span style="font-size:18px">&#9888;</span>
                לא ניתן לבטל את השליחה לאחר אישורה
              </div>
            </div>
            <div class="dialog-actions">
              <button class="btn-cancel" (click)="showSendConfirm.set(false)">ביטול</button>
              <button class="btn-confirm" (click)="sendCampaign()" [disabled]="sending()">
                @if (sending()) { שולח... } @else { שלח עכשיו }
              </button>
            </div>
          </div>
        </div>
      }

      @if (showPreflight()) {
        <app-preflight-dialog
          [result]="preflightResult()!"
          (onClose)="closePreflight()"
          (onConfirm)="confirmPreflight()"
          (onAction)="handlePreflightAction($event)"
        />
      }
    }
  `,
})
export class V2SendStepComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private v2Service = inject(EmailCampaignV2Service);
  private emailService = inject(EmailCampaignService);
  private preflightService = inject(PreflightService);

  campaignId = signal<number>(0);
  pageLoading = signal(true);

  template = signal<EmailV2TemplateDto | null>(null);

  fromName = signal('אקורדישקייט');
  fromEmail = signal('');

  recipientGroup = signal<EmailRecipientGroup>(EmailRecipientGroup.AllUsers);
  selectedEmailGroupId = signal<number | null>(null);
  recipientCount = signal(0);
  loadingCount = signal(false);
  emailGroups = signal<EmailGroupDto[]>([]);

  showTestDialog = signal(false);
  testEmail = signal('');
  testSending = signal(false);
  testResults = signal<TestSendResultItem[]>([]);
  testError = signal('');
  testSendIndex = signal(0);

  showSendConfirm = signal(false);
  sending = signal(false);

  statusMessage = signal('');
  statusType = signal<'success' | 'error' | ''>('');

  showPreflight = signal(false);
  preflightResult = signal<PreflightResult | null>(null);
  pendingPreflightAction: 'send' | 'test' | null = null;

  readonly RecipientGroup = EmailRecipientGroup;

  readonly recipientGroups = [
    { value: EmailRecipientGroup.AllUsers, label: 'כל המשתמשים', icon: '👥', description: 'שליחה לכל המשתמשים הרשומים במערכת' },
    { value: EmailRecipientGroup.ActiveOnly, label: 'פעילים בלבד', icon: '✅', description: 'משתמשים שהיו פעילים ב-30 הימים האחרונים' },
    { value: EmailRecipientGroup.MarketingConsentOnly, label: 'הסכמת שיווק בלבד', icon: '📢', description: 'רק משתמשים שאישרו קבלת מיילים שיווקיים' },
    { value: EmailRecipientGroup.AllTeachers, label: 'כל המורים', icon: '🏫', description: 'מורים רשומים במערכת' },
    { value: EmailRecipientGroup.AllArtists, label: 'כל האומנים', icon: '🎤', description: 'אומנים רשומים במערכת' },
    { value: EmailRecipientGroup.AllServiceProviders, label: 'כל בעלי המקצוע', icon: '💼', description: 'נותני שירות רשומים במערכת' },
    { value: EmailRecipientGroup.InterestedInSite, label: 'מתעניינים באתר', icon: '💡', description: 'משתמשים שהביעו עניין באתר' },
    { value: EmailRecipientGroup.CustomGroup, label: 'קבוצה מותאמת', icon: '➕', description: 'בחירת קבוצת מייל מותאמת אישית' },
    { value: EmailRecipientGroup.NoProfessionalProfile, label: 'ללא פרופיל מקצועי', icon: '👤', description: 'משתמשים ללא פרופיל מקצועי' },
  ];

  readonly subjectExists = computed(() => !!this.template()?.subject?.trim());
  readonly contentExists = computed(() => !!this.template()?.htmlBody);
  readonly audienceSelected = computed(() => true);
  readonly countPositive = computed(() => this.recipientCount() > 0);
  readonly senderValid = computed(() => {
    const e = this.fromEmail();
    return !!e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  });

  readonly readyToSend = computed(() =>
    this.subjectExists() &&
    this.countPositive() &&
    this.senderValid() &&
    this.campaignId() > 0
  );

  get selectedGroupLabel(): string {
    if (this.recipientGroup() === EmailRecipientGroup.CustomGroup) {
      const g = this.emailGroups().find(g => g.id === this.selectedEmailGroupId());
      return g ? `קבוצה: ${g.name}` : 'קבוצה מותאמת';
    }
    return this.recipientGroups.find(g => g.value === this.recipientGroup())?.label ?? '';
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id && !isNaN(id)) {
        this.campaignId.set(id);
        this.loadTemplate(id);
        this.loadGroups();
      } else {
        this.pageLoading.set(false);
        this.setStatus('לא נמצא מזהה קמפיין', 'error');
      }
    });
  }

  private loadTemplate(id: number): void {
    this.pageLoading.set(true);
    this.v2Service.getTemplate(id).subscribe({
      next: (tmpl) => {
        this.template.set(tmpl);
        this.fromName.set(tmpl.fromName || 'אקורדישקייט');
        this.fromEmail.set(tmpl.fromEmail || '');
        this.pageLoading.set(false);
        this.loadRecipientCount();
      },
      error: (err) => {
        this.pageLoading.set(false);
        this.setStatus(`שגיאה בטעינת התבנית: ${err?.message || err}`, 'error');
      },
    });
  }

  private loadGroups(): void {
    this.emailService.getGroups().subscribe({
      next: (groups) => this.emailGroups.set(groups),
    });
  }

  selectGroup(group: EmailRecipientGroup): void {
    this.recipientGroup.set(group);
    if (group !== EmailRecipientGroup.CustomGroup) {
      this.selectedEmailGroupId.set(null);
    }
    this.loadRecipientCount();
  }

  onCustomGroupChange(): void {
    this.loadRecipientCount();
  }

  private loadRecipientCount(): void {
    if (this.recipientGroup() === EmailRecipientGroup.CustomGroup && !this.selectedEmailGroupId()) {
      this.recipientCount.set(0);
      return;
    }
    this.loadingCount.set(true);
    const groupId = this.recipientGroup() === EmailRecipientGroup.CustomGroup
      ? this.selectedEmailGroupId() ?? undefined
      : undefined;

    this.emailService.getRecipientCount(this.recipientGroup(), groupId).subscribe({
      next: (count) => {
        this.recipientCount.set(count);
        this.loadingCount.set(false);
      },
      error: () => {
        this.recipientCount.set(0);
        this.loadingCount.set(false);
      },
    });
  }

  openTestDialog(): void {
    this.pendingPreflightAction = 'test';
    this.runPreflight();
  }

  private _openTestDialogRaw(): void {
    this.showTestDialog.set(true);
    this.testEmail.set('');
    this.testSending.set(false);
    this.testResults.set([]);
    this.testError.set('');
    this.testSendIndex.set(0);
  }

  closeTestDialog(): void {
    this.showTestDialog.set(false);
  }

  async handleTestSend(emails: string[]): Promise<void> {
    if (!this.campaignId() || emails.length === 0) return;

    this.testSending.set(true);
    this.testResults.set([]);
    this.testError.set('');

    const results: TestSendResultItem[] = [];

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      this.testSendIndex.set(i + 1);

      try {
        const result = await new Promise<any>((resolve, reject) => {
          this.v2Service.sendTest({ campaignId: this.campaignId(), recipientEmail: email }).subscribe({
            next: resolve,
            error: reject,
          });
        });
        results.push({ email, success: !!result?.success, error: result?.error });
      } catch (e: any) {
        let message = 'שליחה נכשלה';
        const status = e?.status;
        if (status === 0 || !status) {
          message = 'אין חיבור לשרת';
        } else if (status === 400) {
          message = e?.error?.message || 'נתונים לא תקינים';
        } else if (status >= 500) {
          message = 'שגיאת שרת';
        }
        results.push({ email, success: false, error: message });
      }
    }

    this.testResults.set(results);
    this.testSending.set(false);
  }

  openSendConfirm(): void {
    if (!this.campaignId()) {
      this.setStatus('לא נמצא מזהה קמפיין', 'error');
      return;
    }
    this.pendingPreflightAction = 'send';
    this.runPreflight();
  }

  runPreflight(): void {
    const t = this.template();
    const ctx = {
      subject: t?.subject || '',
      htmlBody: t?.htmlBody || '',
      designJson: t?.designJson || '',
      recipientGroup: this.recipientGroup(),
      recipientCount: this.recipientCount(),
      fromEmail: this.fromEmail(),
      status: t?.status || 'draft',
      previewText: t?.previewText || '',
    };
    const result = this.preflightService.run(ctx);
    this.preflightResult.set(result);

    if (result.errors.length > 0 || result.warnings.length > 0) {
      this.showPreflight.set(true);
    } else {
      if (this.pendingPreflightAction === 'send') {
        this._proceedToSendConfirm();
      } else if (this.pendingPreflightAction === 'test') {
        this._openTestDialogRaw();
      }
      this.pendingPreflightAction = null;
    }
  }

  closePreflight(): void {
    this.showPreflight.set(false);
    this.pendingPreflightAction = null;
  }

  confirmPreflight(): void {
    this.showPreflight.set(false);
    if (this.pendingPreflightAction === 'send') {
      this._proceedToSendConfirm();
    }
    this.pendingPreflightAction = null;
  }

  handlePreflightAction(actionId: string): void {
    this.showPreflight.set(false);
    this.pendingPreflightAction = null;

    switch (actionId) {
      case 'subject':
        break;
      case 'editor':
        this.router.navigate(['../edit'], { relativeTo: this.route });
        break;
      case 'audience':
        this.setStatus('יש לבחור קהל יעד', 'error');
        break;
      case 'save':
        this.setStatus('יש לשמור את הקמפיין קודם', 'error');
        break;
      default:
        break;
    }
  }

  preflightSummary = computed(() => {
    const r = this.preflightResult();
    if (!r) return null;
    return { errors: r.errors.length, warnings: r.warnings.length };
  });

  private _proceedToSendConfirm(): void {
    if (!this.subjectExists()) {
      this.setStatus('יש להזין נושא', 'error');
      return;
    }
    if (!this.countPositive()) {
      this.setStatus('אין נמענים', 'error');
      return;
    }
    this.showSendConfirm.set(true);
  }

  sendCampaign(): void {
    this.showSendConfirm.set(false);
    this.sending.set(true);
    this.setStatus('שולח...', '');

    this.v2Service.getTemplate(this.campaignId()).subscribe({
      next: (tmpl) => {
        this.v2Service.sendCampaign({
          campaignId: this.campaignId(),
          subject: this.template()?.subject ?? '',
          htmlBody: tmpl?.htmlBody ?? '',
          recipientGroup: this.recipientGroup(),
          emailGroupId: this.recipientGroup() === EmailRecipientGroup.CustomGroup
            ? this.selectedEmailGroupId() ?? undefined
            : undefined,
          fromName: this.fromName(),
          fromEmail: this.fromEmail() || undefined,
        }).subscribe({
          next: (result) => {
            this.sending.set(false);
            if (result?.success) {
              this.setStatus(`נשלח ל-${result.sentCount} נמענים`, 'success');
            } else {
              this.setStatus(result?.message || 'השליחה נכשלה', 'error');
            }
          },
          error: (err) => {
            this.sending.set(false);
            this.setStatus(`שגיאה בשליחה: ${err?.message || err}`, 'error');
          },
        });
      },
      error: (err) => {
        this.sending.set(false);
        this.setStatus(`שגיאה בטעינת התבנית: ${err?.message || err}`, 'error');
      },
    });
  }

  private setStatus(msg: string, type: '' | 'success' | 'error'): void {
    this.statusMessage.set(msg);
    this.statusType.set(type);
    if (type === 'success') {
      setTimeout(() => {
        if (this.statusMessage() === msg) {
          this.statusMessage.set('');
          this.statusType.set('');
        }
      }, 5000);
    }
  }
}
