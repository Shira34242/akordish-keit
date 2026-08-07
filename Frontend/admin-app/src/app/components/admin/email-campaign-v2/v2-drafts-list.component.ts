import { Component, signal, computed, inject, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { EmailCampaignV2Service, type EmailV2TemplateDto, type SaveEmailV2TemplateDto } from '../../../services/email-campaign-v2.service';
import { TemplateLibraryService } from '../../../services/template-library.service';

@Component({
  selector: 'app-v2-drafts-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="drafts-page">
      <header class="page-header">
        <div class="title-area">
          <span class="material-symbols-outlined icon-mail">mail</span>
          <div class="title-text">
            <h1>השליחה המשודרגת</h1>
            <p>עיצוב ושליחת מיילים מקצועיים</p>
          </div>
        </div>
        <button class="btn-primary" (click)="createNew()">
          <span class="material-symbols-outlined">add</span> קמפיין חדש
        </button>
      </header>

      <div class="toolbar">
        <div class="search-wrapper">
          <span class="material-symbols-outlined search-icon">search</span>
          <input
            class="search-input"
            type="text"
            [value]="searchQuery()"
            (input)="searchQuery.set($any($event.target).value)"
            placeholder="חיפוש לפי נושא..."
          />
        </div>
        <button class="btn-refresh" (click)="loadDrafts()" [disabled]="loading()">
          <span class="material-symbols-outlined">refresh</span>
        </button>
      </div>

      @if (loading()) {
        <div class="skeletons">
          @for (i of [1, 2, 3]; track i) {
            <div class="skeleton-card">
              <div class="skeleton-line skeleton-line-title"></div>
              <div class="skeleton-line skeleton-line-meta"></div>
            </div>
          }
        </div>
      } @else if (filteredDrafts().length === 0) {
        <div class="empty-state">
          <span class="material-symbols-outlined empty-icon">drafts</span>
          <p class="empty-title">אין טיוטות</p>
          <p class="empty-subtitle">צרו קמפיין חדש והתחילו לעצב מייל מקצועי</p>
          <button class="btn-empty" (click)="createNew()">
            <span class="material-symbols-outlined">add</span> יצירת קמפיין ראשון
          </button>
        </div>
      } @else {
        <div class="drafts-list">
          @for (draft of filteredDrafts(); track draft.campaignId) {
            <div class="draft-card">
              <div class="draft-info">
                <div class="draft-subject">{{ draft.subject }}</div>
                <div class="draft-meta">
                  <span
                    class="status-badge"
                    [class.status-draft]="draft.status === 'draft'"
                    [class.status-sent]="draft.status === 'sent'"
                    [class.status-failed]="draft.status === 'failed'"
                  >{{ draft.status === 'sent' ? 'נשלח' : draft.status === 'failed' ? 'נכשל' : 'טיוטה' }}</span>
                  <span class="draft-date">{{ formatDate(draft.createdAt) }}</span>
                </div>
              </div>
              <div class="draft-actions">
                <button class="action-btn" (click)="editDraft(draft, $event)" title="ערוך">
                  <span class="material-symbols-outlined">edit</span>
                </button>
                <button class="action-btn" (click)="duplicateDraft(draft, $event)" title="שכפל">
                  <span class="material-symbols-outlined">content_copy</span>
                </button>
                <button class="action-btn action-delete" (click)="deleteDraft(draft, $event)" title="מחק">
                  <span class="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        max-width: 900px;
        margin: 0 auto;
        padding: 32px 24px;
      }

      .drafts-page {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      /* ── Header ── */
      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .title-area {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .icon-mail {
        font-size: 32px;
        color: #000;
      }

      .title-text h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        color: #000;
      }

      .title-text p {
        margin: 2px 0 0;
        font-size: 14px;
        color: #888;
      }

      .btn-primary {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        background: #000;
        color: #ddff53;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s ease;
      }

      .btn-primary:hover {
        background: #222;
      }

      .btn-primary .material-symbols-outlined {
        font-size: 18px;
      }

      /* ── Toolbar ── */
      .toolbar {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .search-wrapper {
        position: relative;
        flex: 1;
        max-width: 360px;
      }

      .search-icon {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 18px;
        color: #999;
        pointer-events: none;
      }

      .search-input {
        width: 100%;
        padding: 8px 34px 8px 12px;
        border: 1px solid #ccc;
        border-radius: 8px;
        font-size: 14px;
        box-sizing: border-box;
        direction: rtl;
      }

      .search-input:focus {
        border-color: #000;
        outline: none;
      }

      .search-input::placeholder {
        color: #aaa;
      }

      .btn-refresh {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border: 1px solid #ccc;
        border-radius: 8px;
        background: #fff;
        cursor: pointer;
        transition: background 0.15s ease;
      }

      .btn-refresh:hover:not(:disabled) {
        background: #f0f0f0;
      }

      .btn-refresh:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-refresh .material-symbols-outlined {
        font-size: 20px;
      }

      /* ── Skeletons ── */
      .skeletons {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .skeleton-card {
        padding: 20px 20px;
        border: 1px solid #e8e8e8;
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .skeleton-line {
        height: 14px;
        border-radius: 4px;
        background: linear-gradient(90deg, #eee 25%, #f5f5f5 50%, #eee 75%);
        background-size: 200% 100%;
        animation: skeleton-shimmer 1.4s ease infinite;
      }

      .skeleton-line-title {
        width: 40%;
        height: 16px;
      }

      .skeleton-line-meta {
        width: 25%;
      }

      @keyframes skeleton-shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }

      /* ── Empty state ── */
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 72px 24px;
        text-align: center;
        gap: 12px;
      }

      .empty-icon {
        font-size: 56px;
        color: #ccc;
      }

      .empty-title {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #555;
      }

      .empty-subtitle {
        margin: 0;
        font-size: 14px;
        color: #999;
      }

      .btn-empty {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 8px;
        padding: 10px 20px;
        border: none;
        border-radius: 8px;
        background: #000;
        color: #ddff53;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
      }

      .btn-empty:hover {
        background: #222;
      }

      .btn-empty .material-symbols-outlined {
        font-size: 18px;
      }

      /* ── Drafts list ── */
      .drafts-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .draft-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border: 1px solid #e0e0e0;
        border-radius: 10px;
        cursor: pointer;
        transition: background 0.15s ease, box-shadow 0.15s ease;
      }

      .draft-card:hover {
        background: #f8f8f8;
        box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
      }

      .draft-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
      }

      .draft-subject {
        font-size: 15px;
        font-weight: 500;
        color: #000;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .draft-meta {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .status-badge {
        display: inline-block;
        padding: 2px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
      }

      .status-draft {
        background: #e8e8e8;
        color: #555;
      }

      .status-sent {
        background: #d4f5d4;
        color: #1a7a1a;
      }

      .status-failed {
        background: #fdd;
        color: #c00;
      }

      .draft-date {
        font-size: 12px;
        color: #999;
      }

      .draft-actions {
        display: flex;
        gap: 2px;
        flex-shrink: 0;
      }

      .action-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border: none;
        border-radius: 6px;
        background: transparent;
        cursor: pointer;
        color: #666;
        transition: background 0.15s ease, color 0.15s ease;
      }

      .action-btn:hover {
        background: #eee;
        color: #000;
      }

      .action-delete:hover {
        background: #ffeaea;
        color: #c00;
      }

      .action-btn .material-symbols-outlined {
        font-size: 18px;
      }

      /* ── RTL adjustments ── */
      .search-wrapper {
        direction: rtl;
      }
    `,
  ],
})
export class V2DraftsListComponent implements OnInit {
  private service = inject(EmailCampaignV2Service);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  drafts = signal<EmailV2TemplateDto[]>([]);
  loading = signal(true);
  searchQuery = signal('');

  filteredDrafts = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) {
      return this.drafts();
    }
    return this.drafts().filter((d) => d.subject.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    this.loadDrafts();
  }

  loadDrafts(): void {
    this.loading.set(true);
    this.service.getTemplates().subscribe({
      next: (list) => {
        this.drafts.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  createNew(): void {
    this.router.navigate(['new'], { relativeTo: this.route });
  }

  editDraft(draft: EmailV2TemplateDto, event: Event): void {
    event.stopPropagation();
    this.router.navigate([`${draft.campaignId}/edit`], { relativeTo: this.route });
  }

  duplicateDraft(draft: EmailV2TemplateDto, event: Event): void {
    event.stopPropagation();
    this.service.getTemplate(draft.campaignId).subscribe({
      next: (full) => {
        if (!full?.designJson) {
          return;
        }
        const dto: SaveEmailV2TemplateDto = {
          subject: `[עותק] ${full.subject}`,
          fromName: full.fromName,
          fromEmail: full.fromEmail,
          designJson: full.designJson,
          mjml: '',
          previewText: full.previewText,
        };
        this.service.saveTemplate(dto).subscribe({
          next: () => {
            this.loadDrafts();
          },
        });
      },
    });
  }

  deleteDraft(draft: EmailV2TemplateDto, event: Event): void {
    event.stopPropagation();
    if (!window.confirm(`למחוק את "${draft.subject}"?`)) {
      return;
    }
    this.service.deleteTemplate(draft.campaignId).subscribe({
      next: () => {
        this.loadDrafts();
      },
    });
  }

  formatDate(isoDate: string): string {
    if (!isoDate) {
      return '';
    }
    const d = new Date(isoDate);
    return d.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
