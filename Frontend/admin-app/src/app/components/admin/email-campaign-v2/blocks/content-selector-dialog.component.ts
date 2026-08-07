import {
  Component,
  signal,
  output,
  inject,
  type OnInit,
  type OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ContentApiService } from './content-api.service';
import { ContentItem, ArticleSelectionResult, ContentSelectionResult, ContentSelectorConfig } from './types';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-content-selector-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    :host {
      display: block;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    }

    .dialog {
      background: #ffffff;
      border-radius: 16px;
      width: 90%;
      max-width: 900px;
      height: 85vh;
      max-height: 800px;
      display: flex;
      flex-direction: column;
      direction: rtl;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.2);
      animation: slideUp 0.25s ease;
    }

    @keyframes slideUp {
      from { transform: translateY(24px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      color: #1a1a1a;
    }

    .selected-count {
      font-size: 13px;
      color: #6b7280;
      margin-right: 8px;
    }

    .close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #6b7280;
      cursor: pointer;
      font-size: 20px;
      line-height: 1;
    }
    .close-btn:hover { background: #f3f4f6; color: #1a1a1a; }

    .dialog-body {
      flex: 1;
      display: flex;
      min-height: 0;
      overflow: hidden;
    }

    .search-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      border-left: 1px solid #e5e7eb;
      min-width: 0;
    }

    .search-box {
      padding: 12px 16px;
      flex-shrink: 0;
    }

    .search-box input {
      width: 100%;
      padding: 8px 12px;
      padding-right: 36px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      color: #1a1a1a;
      background: #f9fafb;
      direction: rtl;
      box-sizing: border-box;
    }
    .search-box input:focus {
      outline: none;
      border-color: #1a1a1a;
      background: #ffffff;
    }
    .search-box input::placeholder { color: #9ca3af; }

    .search-icon {
      position: absolute;
      right: 28px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 18px;
      color: #9ca3af;
    }

    .results-list {
      flex: 1;
      overflow-y: auto;
      padding: 0 16px 16px;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s;
    }
    .result-item:hover { background: #f3f4f6; }
    .result-item.selected { background: rgba(221, 255, 83, 0.15); }

    .grid-results {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 8px;
    }

    .grid-item {
      border-radius: 10px;
      cursor: pointer;
      overflow: hidden;
      background: #f9fafb;
      transition: transform 0.15s;
      position: relative;
    }
    .grid-item:hover { transform: scale(1.02); }
    .grid-item.selected { box-shadow: 0 0 0 2px #1a1a1a, 0 0 0 4px rgba(221,255,83,0.4); }

    .grid-item-thumb {
      width: 100%;
      aspect-ratio: 4/3;
      object-fit: cover;
      display: block;
      background: #e5e7eb;
    }

    .grid-item-info {
      padding: 6px 8px 8px;
    }

    .grid-item-title {
      font-size: 12px;
      font-weight: 600;
      color: #1a1a1a;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .grid-item-date {
      font-size: 10px;
      color: #9ca3af;
      margin-top: 2px;
    }

    .grid-item-check {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 20px;
      height: 20px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.35);
    }
    .grid-item.selected .grid-item-check {
      background: #1a1a1a;
      color: #ddff53;
    }
    .grid-item-check span {
      font-size: 12px;
      color: transparent;
    }
    .grid-item.selected .grid-item-check span {
      color: #ddff53;
    }

    .result-thumb {
      width: 56px;
      height: 56px;
      border-radius: 6px;
      object-fit: cover;
      flex-shrink: 0;
      background: #e5e7eb;
    }

    .result-info {
      flex: 1;
      min-width: 0;
    }

    .result-title {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .result-date {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 2px;
    }

    .result-check {
      width: 22px;
      height: 22px;
      border: 2px solid #d1d5db;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 14px;
      color: transparent;
      transition: all 0.15s;
    }
    .result-item.selected .result-check {
      background: #1a1a1a;
      border-color: #1a1a1a;
      color: #ddff53;
    }

    .pagination-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      flex-shrink: 0;
      border-top: 1px solid #e5e7eb;
    }

    .pagination-btn {
      padding: 6px 14px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #ffffff;
      color: #374151;
      font-size: 13px;
      cursor: pointer;
    }
    .pagination-btn:hover:not(:disabled) { background: #f3f4f6; }
    .pagination-btn:disabled { opacity: 0.4; cursor: default; }

    .page-info { font-size: 13px; color: #6b7280; }

    .selected-panel {
      width: 340px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .selected-header {
      padding: 12px 16px;
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }

    .selected-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .selected-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-radius: 8px;
      background: #f9fafb;
      margin-bottom: 4px;
    }

    .selected-item-thumb {
      width: 40px;
      height: 40px;
      border-radius: 4px;
      object-fit: cover;
      flex-shrink: 0;
      background: #e5e7eb;
    }

    .selected-item-title {
      flex: 1;
      font-size: 13px;
      color: #1a1a1a;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .selected-item-remove {
      width: 24px;
      height: 24px;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: #9ca3af;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .selected-item-remove:hover { background: #fee2e2; color: #dc2626; }

    .empty-selected {
      padding: 24px;
      text-align: center;
      color: #9ca3af;
      font-size: 13px;
    }

    .layout-options {
      padding: 12px 16px;
      border-top: 1px solid #e5e7eb;
      flex-shrink: 0;
    }

    .option-label {
      font-size: 13px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 4px;
    }

    .option-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 0;
    }

    .option-row span {
      font-size: 13px;
      color: #4b5563;
    }

    .toggle {
      width: 40px;
      height: 22px;
      border-radius: 11px;
      background: #d1d5db;
      cursor: pointer;
      position: relative;
      transition: background 0.2s;
      border: none;
    }
    .toggle.active { background: #1a1a1a; }

    .toggle-knob {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #ffffff;
      position: absolute;
      top: 2px;
      right: 2px;
      transition: transform 0.2s;
    }
    .toggle.active .toggle-knob {
      transform: translateX(-18px);
    }

    .dialog-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      border-top: 1px solid #e5e7eb;
      flex-shrink: 0;
    }

    .max-warning {
      font-size: 12px;
      color: #dc2626;
    }

    .footer-actions {
      display: flex;
      gap: 8px;
    }

    .btn {
      padding: 8px 20px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      background: #ffffff;
      color: #374151;
      font-weight: 500;
    }
    .btn:hover { background: #f3f4f6; }

    .btn-primary {
      background: #1a1a1a;
      color: #ddff53;
      border: none;
      font-weight: 600;
    }
    .btn-primary:hover { background: #333333; }
    .btn-primary:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .loading-state {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
    }

    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid #e5e7eb;
      border-top-color: #1a1a1a;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .empty-state {
      padding: 32px;
      text-align: center;
      color: #9ca3af;
      font-size: 14px;
    }

    .moved-up { animation: moveUp 0.2s ease; }
    .moved-down { animation: moveDown 0.2s ease; }

    @keyframes moveUp {
      from { transform: translateY(8px); opacity: 0.5; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes moveDown {
      from { transform: translateY(-8px); opacity: 0.5; }
      to { transform: translateY(0); opacity: 1; }
    }
  `],
  template: `
    <div class="backdrop" (click)="onBackdropClick($event)">
      <div class="dialog">
        <div class="dialog-header">
          <div>
            <h2>{{ config?.title || 'בחירת תוכן' }}</h2>
          </div>
          <button class="close-btn" (click)="onClose()">&times;</button>
        </div>

        <div class="dialog-body">
          <div class="search-panel">
            <div class="search-box" style="position:relative">
              <span class="search-icon material-symbols-outlined">search</span>
              <input
                type="text"
                [ngModel]="searchTerm()"
                (ngModelChange)="onSearch($event)"
                [placeholder]="config?.searchPlaceholder || 'חיפוש...'"
              />
            </div>

            <div style="display:flex;align-items:center;gap:8px;padding:0 16px 8px;flex-shrink:0;">
              @if (config?.sourceOptions && config!.sourceOptions!.length > 0) {
                <select
                  [ngModel]="selectedSourceIndex()"
                  (ngModelChange)="onSourceChange($event)"
                  style="padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;color:#374151;background:#fff;cursor:pointer;"
                >
                  @for (opt of config!.sourceOptions; track $index) {
                    <option [value]="$index">{{ opt.label }}</option>
                  }
                </select>
              }
              <div style="display:flex;gap:3px;flex-wrap:wrap;">
                @for (qk of quickOptions(); track qk.value) {
                  <button
                    style="padding:3px 8px;border:1px solid #d1d5db;border-radius:999px;font-size:11px;cursor:pointer;white-space:nowrap;"
                    [style.background]="activeQuick() === qk.value ? '#1a1a1a' : '#fff'"
                    [style.color]="activeQuick() === qk.value ? '#ddff53' : '#6b7280'"
                    [style.borderColor]="activeQuick() === qk.value ? '#1a1a1a' : '#d1d5db'"
                    (click)="applyQuick(qk.value)"
                  >{{ qk.label }}</button>
                }
              </div>
              <select
                [ngModel]="sortBy()"
                (ngModelChange)="onSortChange($event)"
                style="padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;color:#374151;background:#fff;cursor:pointer;"
              >
                <option value="">ברירת מחדל</option>
                <option value="publishDate_desc">חדשים ראשונים</option>
                <option value="publishDate_asc">ישנים ראשונים</option>
                <option value="viewCount_desc">פופולריים השבוע</option>
              </select>
              <button
                style="padding:4px 8px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;color:#374151;background:#fff;cursor:pointer;display:flex;align-items:center;gap:4px;"
                [style.background]="gridView() ? '#1a1a1a' : '#fff'"
                [style.color]="gridView() ? '#ddff53' : '#374151'"
                [style.borderColor]="gridView() ? '#1a1a1a' : '#d1d5db'"
                (click)="gridView.set(!gridView())"
              >
                <span class="material-symbols-outlined" style="font-size:16px;">{{ gridView() ? 'grid_view' : 'list' }}</span>
                {{ gridView() ? 'גריד' : 'רשימה' }}
              </button>
              <span style="font-size:11px;color:#9ca3af;margin-right:auto;">{{ totalCount() }} תוצאות</span>
            </div>

            <div class="results-list" [class.grid-results]="gridView()">
              @if (loading()) {
                <div class="loading-state"><div class="spinner"></div></div>
              } @else if (results().length === 0) {
                <div class="empty-state">
                  @if (searchTerm()) {
                    לא נמצאו תוצאות
                  } @else {
                    מקלידים לחיפוש...
                  }
                </div>
              } @else {
                @for (item of results(); track item.id) {
                  @if (gridView()) {
                    <div
                      class="grid-item"
                      [class.selected]="isSelected(item.id)"
                      (click)="toggleItem(item)"
                    >
                      <img
                        class="grid-item-thumb"
                        [src]="item.imageUrl"
                        [alt]="item.altText"
                        loading="lazy"
                        (error)="onImageError($event)"
                      />
                      <div class="grid-item-info">
                        <div class="grid-item-title">{{ item.title }}</div>
                        <div class="grid-item-date">{{ item.publishDate | date:'dd/MM/yy' }}</div>
                      </div>
                      <div class="grid-item-check">
                        <span class="material-symbols-outlined">check</span>
                      </div>
                    </div>
                  } @else {
                    <div
                      class="result-item"
                      [class.selected]="isSelected(item.id)"
                      (click)="toggleItem(item)"
                    >
                      <img
                        class="result-thumb"
                        [src]="item.imageUrl"
                        [alt]="item.altText"
                        loading="lazy"
                        (error)="onImageError($event)"
                      />
                      <div class="result-info">
                        <div class="result-title">{{ item.title }}</div>
                        <div class="result-date">{{ item.publishDate | date:'dd/MM/yy' }}</div>
                      </div>
                      <div class="result-check">
                        <span class="material-symbols-outlined" style="font-size:14px">check</span>
                      </div>
                    </div>
                  }
                }
              }
            </div>

            @if (totalCount() > 0) {
              <div class="pagination-row">
                <button
                  class="pagination-btn"
                  [disabled]="page() <= 1"
                  (click)="loadPage(page() - 1)"
                >הקודם</button>
                <span class="page-info">
                  עמוד {{ page() }} מתוך {{ totalPages() || 1 }} ({{ totalCount() }} תוצאות)
                </span>
                <button
                  class="pagination-btn"
                  [disabled]="!hasMore()"
                  (click)="loadPage(page() + 1)"
                >הבא</button>
              </div>
            }
          </div>

          <div class="selected-panel">
            <div class="selected-header">
              נבחרו {{ selectedItems().length }} / {{ config?.maxItems || 8 }}
              <span class="selected-count">{{ config?.type === 'articles' ? 'כתבות' : 'פריטים' }}</span>
            </div>

            <div class="selected-list">
              @if (selectedItems().length === 0) {
                <div class="empty-selected">בחרו פריטים מהרשימה</div>
              } @else {
                @for (item of selectedItems(); track item.id; let i = $index) {
                  <div class="selected-item">
                    <img
                      class="selected-item-thumb"
                      [src]="item.imageUrl"
                      [alt]="item.altText"
                      (error)="onImageError($event)"
                    />
                    <div class="selected-item-title">{{ item.title }}</div>
                    <button class="selected-item-remove" (click)="removeItem(i)" title="הסרה">
                      &times;
                    </button>
                    @if (i > 0) {
                      <button
                        style="width:24px;height:24px;border:none;border-radius:4px;background:transparent;color:#9ca3af;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0"
                        (click)="moveItemUp(i)"
                        title="הזזה למעלה"
                      >&#9650;</button>
                    } @else {
                      <div style="width:24px;flex-shrink:0"></div>
                    }
                    @if (i < selectedItems().length - 1) {
                      <button
                        style="width:24px;height:24px;border:none;border-radius:4px;background:transparent;color:#9ca3af;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0"
                        (click)="moveItemDown(i)"
                        title="הזזה למטה"
                      >&#9660;</button>
                    } @else {
                      <div style="width:24px;flex-shrink:0"></div>
                    }
                  </div>
                }
              }
            </div>

            <div class="layout-options">
              <div class="option-row">
                <span>הצגת תקציר</span>
                <button
                  class="toggle"
                  [class.active]="showDescription()"
                  (click)="showDescription.set(!showDescription())"
                >
                  <span class="toggle-knob"></span>
                </button>
              </div>
              <div class="option-row">
                <span>הצגת קטגוריה</span>
                <button
                  class="toggle"
                  [class.active]="showCategory()"
                  (click)="showCategory.set(!showCategory())"
                >
                  <span class="toggle-knob"></span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <div>
            @if (selectedItems().length >= (config?.maxItems || 8)) {
              <span class="max-warning">הגעתם למגבלה ({{ config?.maxItems || 8 }} פריטים)</span>
            }
          </div>
          <div class="footer-actions">
            <button class="btn" (click)="onClose()">ביטול</button>
            <button
              class="btn btn-primary"
              [disabled]="selectedItems().length === 0"
              (click)="onConfirm()"
            >
              הוספה למייל ({{ selectedItems().length }})
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ContentSelectorDialogComponent implements OnInit, OnDestroy {
  confirmed = output<ArticleSelectionResult>();
  contentConfirmed = output<ContentSelectionResult>();
  closed = output<void>();

  config: ContentSelectorConfig | null = null;
  existingItems: ContentItem[] = [];

  searchTerm = signal('');
  page = signal(1);
  loading = signal(false);
  results = signal<ContentItem[]>([]);
  totalCount = signal(0);
  totalPages = signal(0);
  hasMore = signal(false);
  selectedItems = signal<ContentItem[]>([]);
  showDescription = signal(true);
  showCategory = signal(true);
  gridView = signal(true);
  sortBy = signal('');
  selectedSourceIndex = signal(0);
  activeQuick = signal('');

  quickOptions = signal<{ label: string; value: string }[]>([]);

  private apiService = inject(ContentApiService);
  private searchSubject = new Subject<string>();
  private searchSub!: Subscription;
  private pageSize = 10;

  ngOnInit(): void {
    this.selectedItems.set([...this.existingItems]);

    this._buildQuickOptions();

    this.searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.page.set(1);
      this.loadResults();
    });

    this.loadResults();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.searchSubject.next(term);
  }

  onSortChange(value: string): void {
    this.sortBy.set(value);
    this.page.set(1);
    this.loadResults();
  }

  onSourceChange(index: number): void {
    this.selectedSourceIndex.set(index);
    this.page.set(1);
    this.loadResults();
  }

  loadPage(pageNum: number): void {
    this.page.set(pageNum);
    this.loadResults();
  }

  isSelected(id: number): boolean {
    return this.selectedItems().some((item) => item.id === id);
  }

  toggleItem(item: ContentItem): void {
    const current = this.selectedItems();
    const max = this.config?.maxItems || 8;
    const idx = current.findIndex((i) => i.id === item.id);

    if (idx >= 0) {
      const updated = [...current];
      updated.splice(idx, 1);
      this.selectedItems.set(updated);
    } else if (current.length < max) {
      this.selectedItems.set([...current, item]);
    }
  }

  removeItem(index: number): void {
    const current = [...this.selectedItems()];
    current.splice(index, 1);
    this.selectedItems.set(current);
  }

  moveItemUp(index: number): void {
    if (index <= 0) return;
    const items = [...this.selectedItems()];
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    this.selectedItems.set(items);
  }

  moveItemDown(index: number): void {
    const items = this.selectedItems();
    if (index >= items.length - 1) return;
    const updated = [...items];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    this.selectedItems.set(updated);
  }

  onConfirm(): void {
    const items = this.selectedItems();

    if (this.config?.type === 'articles') {
      this.confirmed.emit({
        items,
        layout: 'two-column',
        showDescription: this.showDescription(),
        showCategory: this.showCategory(),
        borderRadius: 8,
        spacing: 8,
        cardBackground: '#ffffff',
      });
    } else {
      this.contentConfirmed.emit({ items });
    }
  }

  onClose(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('backdrop')) {
      this.onClose();
    }
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><rect fill="#e5e7eb" width="56" height="56"/><text x="28" y="32" text-anchor="middle" fill="#9ca3af" font-size="12" font-family="Arial">תמונה</text></svg>'
    );
  }

  applyQuick(value: string): void {
    this.activeQuick.set(this.activeQuick() === value ? '' : value);
    if (this.activeQuick()) {
      switch (value) {
        case 'latest': this.sortBy.set('publishDate_desc'); break;
        case 'popular': this.sortBy.set('viewCount_desc'); break;
        case 'upcoming': this.sortBy.set('eventDate_asc'); break;
      }
    } else {
      this.sortBy.set('');
    }
    this.page.set(1);
    this.loadResults();
  }

  private _buildQuickOptions(): void {
    const type = this.config?.type;
    const opts: { label: string; value: string }[] = [];
    switch (type) {
      case 'articles':
        opts.push({ label: 'האחרונות', value: 'latest' }, { label: 'הפופולריות', value: 'popular' });
        break;
      case 'chords':
        opts.push({ label: 'החדשים', value: 'latest' }, { label: 'הפופולריים', value: 'popular' });
        break;
      case 'podcasts':
        opts.push({ label: 'האחרונים', value: 'latest' }, { label: 'הפופולריים', value: 'popular' });
        break;
      case 'events':
        opts.push({ label: 'הקרובות', value: 'upcoming' });
        break;
      case 'profiles':
      case 'providers':
      case 'teachers':
        opts.push({ label: 'החדשים', value: 'latest' }, { label: 'מומלצים', value: 'featured' });
        break;
    }
    this.quickOptions.set(opts);
  }

  private loadResults(): void {
    this.loading.set(true);

    let searchFn;
    const sourceOptions = this.config?.sourceOptions;
    if (sourceOptions && sourceOptions.length > 0) {
      const idx = this.selectedSourceIndex();
      searchFn = sourceOptions[idx]?.searchFn || this.config!.searchFn;
    } else {
      searchFn = this.config?.searchFn;
    }

    const observable = searchFn
      ? searchFn(this.searchTerm(), this.page(), this.pageSize)
      : this.apiService.searchArticles(this.searchTerm(), this.page(), this.pageSize);

    observable.subscribe({
      next: (result) => {
        this.results.set(result.items);
        this.totalCount.set(result.totalCount);
        this.hasMore.set(result.hasMore);
        this.totalPages.set(Math.ceil(result.totalCount / this.pageSize));
        this.loading.set(false);
      },
      error: () => {
        this.results.set([]);
        this.loading.set(false);
      },
    });
  }
}
