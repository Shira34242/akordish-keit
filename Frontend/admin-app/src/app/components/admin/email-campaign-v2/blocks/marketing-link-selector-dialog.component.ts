import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MarketingCampaignService,
  MarketingCampaignSummary,
} from '../../../../services/admin/marketing-campaign.service';

@Component({
  selector: 'app-marketing-link-selector-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="backdrop" dir="rtl" (click)="closed.emit()">
      <section class="dialog" role="dialog" aria-modal="true" aria-label="בחירת קישור מעקב" (click)="$event.stopPropagation()">
        <header>
          <div><span>פרסום במייל</span><h2>בחירת קישור מעקב</h2></div>
          <button type="button" class="icon" aria-label="סגירה" (click)="closed.emit()">×</button>
        </header>

        <div class="toolbar">
          <input [(ngModel)]="search" placeholder="חיפוש לפי שם, מקור או יעד">
          <button type="button" class="primary" (click)="creating.set(!creating())">{{ creating() ? 'חזרה לרשימה' : 'קישור חדש' }}</button>
        </div>

        @if (error()) { <p class="error">{{ error() }}</p> }

        @if (creating()) {
          <form class="create-form" (ngSubmit)="create()">
            <label>שם הפרסום<input name="name" [(ngModel)]="name" required maxlength="160" placeholder="לדוגמה: מפרסם — באנר שבועי"></label>
            <label>יעד<input name="targetPath" [(ngModel)]="targetPath" required maxlength="500" dir="ltr" placeholder="https://example.com או /path"></label>
            <button class="primary" type="submit" [disabled]="saving() || !name.trim() || !targetPath.trim()">{{ saving() ? 'יוצר...' : 'יצירה ובחירה' }}</button>
          </form>
        } @else if (loading()) {
          <div class="state">טוען קישורי מעקב...</div>
        } @else {
          <div class="list">
            @for (item of filtered; track item.id) {
              <button type="button" class="row" (click)="selected.emit(item)">
                <span class="identity"><strong>{{ item.name }}</strong><small>{{ item.source }} · {{ item.targetPath }}</small></span>
                <span class="metrics"><b>{{ item.visits | number }}</b><small>לחיצות</small></span>
                <span class="choose">בחירה</span>
              </button>
            } @empty {
              <div class="state">לא נמצאו קישורים מתאימים</div>
            }
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 10020; font-family: 'Open Sans', Arial, sans-serif; }
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: grid; place-items: center; padding: var(--space-lg, 20px); }
    .dialog { width: min(720px, 96vw); max-height: 86vh; overflow: auto; background: #fff; border-radius: 24px; padding: var(--space-lg, 20px); color: #000; }
    header, .toolbar, .row { display: flex; align-items: center; gap: var(--space-base, 14px); }
    header { justify-content: space-between; margin-bottom: var(--space-base, 14px); }
    header span, small { color: #404040; font-size: var(--font-xs, 12px); }
    h2 { margin: 0; font-size: var(--font-2xl, 28px); line-height: 1.2; }
    button, input { font: inherit; }
    .icon { width: 34px; height: 34px; border: 0; border-radius: 50%; background: #F2F2F2; cursor: pointer; font-size: 24px; }
    .toolbar { margin-bottom: var(--space-base, 14px); }
    .toolbar input { flex: 1; }
    input { box-sizing: border-box; width: 100%; border: 1px solid #d8d8d8; border-radius: 12px; padding: var(--space-md, 10px) var(--space-base, 14px); }
    .primary, .choose { border: 0; border-radius: 999px; background: #ddff53; color: #000; font-weight: 800; padding: var(--space-md, 10px) var(--space-base, 14px); cursor: pointer; white-space: nowrap; }
    .list { display: grid; gap: var(--space-sm, 6px); }
    .row { width: 100%; justify-content: space-between; border: 0; border-radius: 16px; background: #F2F2F2; padding: var(--space-base, 14px); text-align: right; cursor: pointer; }
    .row:hover { background: #e8e8e8; }
    .identity { flex: 1; min-width: 0; display: grid; gap: var(--space-xs, 4px); }
    .identity small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .metrics { display: grid; text-align: center; }
    .create-form { display: grid; gap: var(--space-base, 14px); }
    label { display: grid; gap: var(--space-xs, 4px); font-weight: 800; font-size: var(--font-sm, 14px); }
    .state, .error { padding: var(--space-xl, 28px); text-align: center; }
    .error { color: #991b1b; background: #F2F2F2; border-radius: 12px; }
    @media (max-width: 600px) { .metrics { display: none; } .toolbar { align-items: stretch; flex-direction: column; } }
  `],
})
export class MarketingLinkSelectorDialogComponent implements OnInit {
  private readonly service = inject(MarketingCampaignService);
  @Output() selected = new EventEmitter<MarketingCampaignSummary>();
  @Output() closed = new EventEmitter<void>();

  readonly loading = signal(true);
  readonly creating = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  campaigns: MarketingCampaignSummary[] = [];
  search = '';
  name = '';
  targetPath = '';

  get filtered(): MarketingCampaignSummary[] {
    const query = this.search.trim().toLocaleLowerCase('he');
    return this.campaigns.filter(item => item.isActive && (!query ||
      `${item.name} ${item.source} ${item.targetPath}`.toLocaleLowerCase('he').includes(query)));
  }

  ngOnInit(): void {
    this.service.getDashboard().subscribe({
      next: result => { this.campaigns = result.campaigns; this.loading.set(false); },
      error: () => { this.error.set('טעינת קישורי המעקב נכשלה'); this.loading.set(false); },
    });
  }

  create(): void {
    const name = this.name.trim();
    const targetPath = this.targetPath.trim();
    if (!name || (!targetPath.startsWith('/') && !/^https:\/\//i.test(targetPath))) {
      this.error.set('יש להזין שם ויעד פנימי או כתובת https תקינה');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.service.create({ name, source: 'Email', targetPath }).subscribe({
      next: campaign => { this.saving.set(false); this.selected.emit(campaign); },
      error: err => { this.saving.set(false); this.error.set(err?.error?.message || 'יצירת הקישור נכשלה'); },
    });
  }
}
