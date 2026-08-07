import { Component, signal, inject, viewChild, type OnInit, type OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { V2EditorComponent } from './v2-editor.component';
import { EmailCampaignV2Service } from '../../../services/email-campaign-v2.service';
import { AutosaveService, type SaveSnapshot, type AutosaveState } from '../../../services/autosave.service';
import { EmailPreviewDialogComponent } from './email-preview-dialog.component';
import { TestSendDialogComponent, type TestSendResultItem } from './test-send-dialog.component';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-v2-design-step',
  standalone: true,
  imports: [CommonModule, FormsModule, V2EditorComponent, RouterModule, EmailPreviewDialogComponent, TestSendDialogComponent],
  styles: [`
    :host {
      position: fixed;
      inset: 52px 0 0 0;
      z-index: 1;
      display: flex;
      flex-direction: column;
      background: #ffffff;
    }

    .workspace-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      background: #ffffff;
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
      height: 48px;
    }

    .back-btn {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: 6px;
      color: #6b7280; text-decoration: none; flex-shrink: 0;
    }
    .back-btn:hover { background: #f3f4f6; color: #1a1a1a; }

    .stepper { display: flex; align-items: center; gap: 0; flex-shrink: 0; direction: rtl; }
    .step-divider { color: #d1d5db; margin: 0 2px; font-size: 12px; }
    .step { display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 6px; font-size: 13px; color: #9ca3af; }
    .step.active { background: #1a1a1a; color: #ddff53; font-weight: 600; }
    .step-num { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; background: #f3f4f6; color: #9ca3af; }
    .step.active .step-num { background: #ddff53; color: #000; }

    .subject-input {
      flex: 1; min-width: 120px;
      background: transparent; border: 1px solid transparent; color: #1a1a1a;
      font-size: 14px; padding: 4px 8px; border-radius: 4px; direction: rtl;
    }
    .subject-input:focus { outline: none; border-color: #d1d5db; background: #f9fafb; }
    .subject-input::placeholder { color: #9ca3af; }

    .header-actions { display: flex; gap: 6px; flex-shrink: 0; align-items: center; }

    .save-status { display: flex; align-items: center; gap: 6px; font-size: 13px; white-space: nowrap; }
    .save-status-saving { color: #6b7280; }
    .save-status-saved { color: #059669; }
    .save-status-dirty { color: #d97706; }
    .save-status-failed { color: #dc2626; }
    .save-status-offline { color: #92400e; }

    .save-retry-btn {
      font-size: 12px; padding: 2px 8px; border: 1px solid #dc2626; border-radius: 4px;
      background: transparent; color: #dc2626; cursor: pointer; margin-right: 4px;
    }
    .save-retry-btn:hover { background: #fef2f2; }

    .btn { display: flex; align-items: center; gap: 4px; padding: 5px 12px; border: 1px solid #d1d5db; border-radius: 6px; background: #ffffff; color: #374151; font-size: 13px; cursor: pointer; white-space: nowrap; }
    .btn:hover:not(:disabled) { background: #f3f4f6; border-color: #9ca3af; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-primary { background: #1a1a1a; color: #ddff53; border: none; font-weight: 600; }
    .btn-primary:hover:not(:disabled) { background: #333; }

    .editor-area { flex: 1; min-height: 0; display: flex; flex-direction: column; }

    .unsaved-dialog-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 300; }
    .unsaved-dialog { background: #fff; border-radius: 12px; padding: 24px 28px; max-width: 400px; width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.18); }
    .unsaved-dialog h2 { margin: 0 0 8px; font-size: 18px; font-weight: 600; color: #1a1a1a; }
    .unsaved-dialog p { margin: 0 0 20px; font-size: 14px; color: #555; line-height: 1.5; }
    .unsaved-dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .btn-save-exit { padding: 8px 16px; border: none; border-radius: 6px; background: #1a73e8; color: #fff; font-size: 14px; font-weight: 500; cursor: pointer; }
    .btn-save-exit:hover:not(:disabled) { background: #1557b0; }
    .btn-save-exit:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-exit-unsaved { padding: 8px 16px; border: 1px solid #dc2626; border-radius: 6px; background: #fff; color: #dc2626; font-size: 14px; cursor: pointer; }
    .btn-exit-unsaved:hover { background: #fef2f2; }
    .btn-exit-cancel { padding: 8px 16px; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; color: #555; font-size: 14px; cursor: pointer; }
    .btn-exit-cancel:hover { background: #f5f5f5; }
  `],
  template: `
    <div class="workspace-header">
      <a class="back-btn" routerLink="../" title="חזרה">
        <span class="material-symbols-outlined">arrow_back</span>
      </a>

      <div class="stepper">
        <div class="step active">
          <span class="step-num">1</span>
          <span>עיצוב</span>
        </div>
        <span class="step-divider">→</span>
        <div class="step">
          <span class="step-num">2</span>
          <span>בחירת נמענים</span>
        </div>
      </div>

      <input
        class="subject-input"
        type="text"
        [ngModel]="subject()"
        (ngModelChange)="onSubjectChange($event)"
        placeholder="נושא המייל..."
        maxlength="150"
      />

      <div class="header-actions">
        <div class="save-status">
          @if (saveState() === 'offline') {
            <span class="save-status-offline">ללא חיבור</span>
          } @else if (saveState() === 'saving') {
            <span class="save-status-saving">שומר...</span>
          } @else if (saveState() === 'saved') {
            <span class="save-status-saved">&#10003; נשמר</span>
          } @else if (saveState() === 'failed') {
            <span class="save-status-failed">השמירה נכשלה</span>
            <button class="save-retry-btn" (click)="manualSave()">נסה שוב</button>
          } @else if (saveState() === 'dirty') {
            <span class="save-status-dirty">לא נשמר</span>
          }
        </div>

        <button class="btn" (click)="manualSave()" [disabled]="saveState() === 'saving'" title="שמור שינויים">
          <span class="material-symbols-outlined" style="font-size:16px">save</span> שמור
        </button>
        <button class="btn" (click)="preview()" [disabled]="!editorComponent()?.editor">תצוגה מקדימה</button>
        <button class="btn" (click)="openTestDialog()" [disabled]="!campaignId()">שלח בדיקה</button>
        <button class="btn btn-primary" (click)="goToSend()" [disabled]="!campaignId() || saveState() === 'saving'">
          המשך לבחירת נמענים
        </button>
      </div>
    </div>

    <div class="editor-area">
      <app-v2-editor
        [savedDesignJson]="designJson()"
        [savedCampaignId]="campaignId()"
        (contentChange)="onEditorContentChange()"
        (mjmlChange)="currentMjml.set($event)"
        (dirtyChange)="onDirtyChange($event)"
        (editorReady)="onEditorReady()"
      />
    </div>

    @if (showTestDialog()) {
      <app-test-send-dialog
        [campaignId]="campaignId() || 0"
        [subject]="subject()"
        [previewText]="''"
        [sending]="testSending()"
        [results]="testResults()"
        [errorMessage]="testError()"
        [currentSendIndex]="testSendIndex()"
        (onClose)="closeTestDialog()"
        (onSend)="handleTestSend($event)"
      />
    }

    @if (showUnsavedDialog()) {
      <div class="unsaved-dialog-backdrop" role="dialog" aria-labelledby="unsaved-title">
        <div class="unsaved-dialog">
          <h2 id="unsaved-title">השינויים עדיין לא נשמרו</h2>
          <p>ביצעת שינויים בקמפיין. אם תצא עכשיו, השינויים יאבדו.</p>
          <div class="unsaved-dialog-actions">
            <button class="btn-exit-cancel" (click)="cancelExit()">הישאר בעמוד</button>
            <button class="btn-exit-unsaved" (click)="exitWithoutSaving()">צא ללא שמירה</button>
            <button
              class="btn-save-exit"
              (click)="saveAndExit()"
              [disabled]="unsavedSaving()"
            >{{ unsavedSaving() ? 'שומר...' : 'שמור וצא' }}</button>
          </div>
        </div>
      </div>
    }

    @if (showPreview()) {
      <app-email-preview-dialog
        [htmlBody]="previewHtml()"
        [subject]="subject()"
        [previewText]="''"
        [fromName]="'אקורדישקייט'"
        (onClose)="closePreview()"
      />
    }
  `,
})
export class V2DesignStepComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(EmailCampaignV2Service);
  private autosave = inject(AutosaveService);

  readonly editorComponent = viewChild(V2EditorComponent);

  subject = signal('שליחה משודרגת');
  campaignId = signal<number | null>(null);
  designJson = signal<string | null>(null);
  currentMjml = signal('');
  dirty = signal(false);
  showTestDialog = signal(false);
  testSending = signal(false);
  testResults = signal<TestSendResultItem[]>([]);
  testError = signal('');
  testSendIndex = signal(0);

  showUnsavedDialog = signal(false);
  unsavedSaving = signal(false);

  showPreview = signal(false);
  previewHtml = signal('');
  previewLoading = signal(false);

  private _unsavedResolve: ((value: boolean) => void) | null = null;
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _editorReady = false;
  private _editorContentDirty = false;
  private _templateStatus = 'draft';
  private _offline = false;

  readonly saveState = this.autosave.saveState;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const num = parseInt(id, 10);
      if (!isNaN(num)) {
        this.campaignId.set(num);
        this.service.getTemplate(num).subscribe(t => {
          if (t) {
            this.subject.set(t.subject);
            this.designJson.set(t.designJson);
            this._templateStatus = t.status || 'draft';
          }
        });
      }
    }
    window.addEventListener('online', this._onOnline);
    window.addEventListener('offline', this._onOffline);
    this._offline = !navigator.onLine;
    if (this._offline) {
      this.autosave.saveState.set('offline');
    }
  }

  ngOnDestroy(): void {
    this._clearDebounce();
    window.removeEventListener('online', this._onOnline);
    window.removeEventListener('offline', this._onOffline);
    this.autosave.reset();
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this._hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (!this._hasUnsavedChanges()) {
      return true;
    }
    return new Promise<boolean>((resolve) => {
      this._unsavedResolve = resolve;
      this.showUnsavedDialog.set(true);
    });
  }

  onEditorReady(): void {
    this._editorReady = true;
    setTimeout(() => {
      const snapshot = this._buildSnapshot();
      if (snapshot) {
        this.autosave.setBaseline(snapshot);
      }
    }, 1500);
  }

  onDirtyChange(dirty: boolean): void {
    if (!this._editorReady) return;
    if (dirty) {
      this._editorContentDirty = true;
      this._scheduleAutosave();
    }
  }

  onEditorContentChange(): void {
    if (!this._editorReady) return;
    this._editorContentDirty = true;
    this._scheduleAutosave();
  }

  onSubjectChange(value: string): void {
    this.subject.set(value);
    this._scheduleAutosave();
  }

  manualSave(): void {
    this._clearDebounce();
    const snapshot = this._buildSnapshot();
    if (!snapshot) return;

    this.autosave.flush(snapshot).then(success => {
      if (success) {
        this.dirty.set(false);
        this._editorContentDirty = false;
        const editor = this.editorComponent();
        editor?.markSaved();
      }
    });
  }

  async preview(): Promise<void> {
    this.previewLoading.set(true);
    this.showPreview.set(true);
    this.previewHtml.set('');

    const mjml = this.currentMjml();
    if (!mjml) {
      this.previewLoading.set(false);
      return;
    }

    try {
      const result = await firstValueFrom(this.service.convertToHtml({
        subject: this.subject(),
        fromName: 'אקורדישקייט',
        designJson: '',
        mjml,
        campaignId: this.campaignId() ?? undefined,
      }));
      if (result?.success && result?.html) {
        this.previewHtml.set(result.html);
      }
    } catch (e) {
      console.error('[Preview] Conversion failed:', e);
    } finally {
      this.previewLoading.set(false);
    }
  }

  closePreview(): void {
    this.showPreview.set(false);
    this.previewHtml.set('');
  }

  openTestDialog(): void {
    this.showTestDialog.set(true);
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
        const result = await firstValueFrom(
          this.service.sendTest({ campaignId: this.campaignId()!, recipientEmail: email }),
        );
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

    const successCount = results.filter(r => r.success).length;
    if (successCount === results.length && results.length > 0) {
      const allEmails = results.map(r => r.email);
      this.testError.set('');
    }
  }

  async goToSend(): Promise<void> {
    if (!this.campaignId()) return;

    if (this._hasUnsavedChanges()) {
      const snapshot = this._buildSnapshot();
      if (snapshot) {
        this.autosave.saveState.set('saving');
        const success = await this.autosave.flush(snapshot);
        if (!success) {
          return;
        }
        this.dirty.set(false);
        this._editorContentDirty = false;
        const editor = this.editorComponent();
        editor?.markSaved();
      }
    }

    this.router.navigate(['../', this.campaignId()!.toString(), 'send'], { relativeTo: this.route });
  }

  cancelExit(): void {
    this.showUnsavedDialog.set(false);
    if (this._unsavedResolve) {
      this._unsavedResolve(false);
      this._unsavedResolve = null;
    }
  }

  exitWithoutSaving(): void {
    this.showUnsavedDialog.set(false);
    this.autosave.reset();
    if (this._unsavedResolve) {
      this._unsavedResolve(true);
      this._unsavedResolve = null;
    }
  }

  async saveAndExit(): Promise<void> {
    this.unsavedSaving.set(true);
    const snapshot = this._buildSnapshot();
    if (snapshot) {
      const success = await this.autosave.flush(snapshot);
      if (!success) {
        this.unsavedSaving.set(false);
        return;
      }
      this.dirty.set(false);
      this._editorContentDirty = false;
      const editor = this.editorComponent();
      editor?.markSaved();
    }
    this.unsavedSaving.set(false);
    this.showUnsavedDialog.set(false);
    if (this._unsavedResolve) {
      this._unsavedResolve(true);
      this._unsavedResolve = null;
    }
  }

  private _hasUnsavedChanges(): boolean {
    if (this.saveState() === 'saved' || this.saveState() === 'idle') {
      return false;
    }
    if (this._templateStatus === 'sent') {
      return false;
    }
    const snapshot = this._buildSnapshot();
    if (!snapshot) return false;
    return this.autosave.isChanged(snapshot);
  }

  private _buildSnapshot(): SaveSnapshot | null {
    const editor = this.editorComponent()?._editor;
    if (!editor) return null;
    const content = editor.getContent();
    if (!content) return null;
    return {
      subject: this.subject(),
      designJson: JSON.stringify(content),
      mjml: this.currentMjml(),
      previewText: '',
      fromName: 'אקורדישקייט',
      campaignId: this.campaignId(),
    };
  }

  private _scheduleAutosave(): void {
    if (!this._editorReady) return;

    const autosaveDelay = 2000;

    if (this._templateStatus === 'sent') return;
    if (this._offline) return;

    this._clearDebounce();

    if (!this.dirty()) {
      this.dirty.set(true);
    }

    if (this.autosave.saveState() !== 'saving') {
      this.autosave.saveState.set('dirty');
    }

    this._debounceTimer = setTimeout(() => {
      const snapshot = this._buildSnapshot();
      if (!snapshot) return;
      if (!this.autosave.isChanged(snapshot)) {
        this.autosave.saveState.set('idle');
        return;
      }
      this.autosave.scheduleSave(snapshot);
    }, autosaveDelay);
  }

  private _clearDebounce(): void {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }

  private _onOnline = (): void => {
    this._offline = false;
    if (this._hasUnsavedChanges()) {
      this._scheduleAutosave();
    } else {
      this.autosave.saveState.set('idle');
    }
  };

  private _onOffline = (): void => {
    this._offline = true;
    this.autosave.saveState.set('offline');
  };
}
