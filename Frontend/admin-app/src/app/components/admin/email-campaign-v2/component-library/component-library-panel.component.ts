import { Component, input, output } from '@angular/core';
import type { ComponentLibraryItem } from '../blocks/component-library.types';

@Component({
  selector: 'app-component-library-panel',
  standalone: true,
  host: { dir: 'rtl' },
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; background: #ffffff; border-right: 1px solid #e0e0e0; }
    .panel-header { padding: 12px 16px; border-bottom: 1px solid #e0e0e0; flex-shrink: 0; }
    .panel-header h3 { margin: 0 0 8px; font-size: 15px; font-weight: 700; color: #1a1a1a; }
    .search-input { width: 100%; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; direction: rtl; box-sizing: border-box; background: #f9fafb; }
    .search-input:focus { outline: none; border-color: #1a1a1a; background: #ffffff; }
    .search-input::placeholder { color: #9ca3af; }
    .category-filters { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px 16px; border-bottom: 1px solid #f3f4f6; flex-shrink: 0; }
    .category-chip { padding: 3px 10px; border: 1px solid #e0e0e0; border-radius: 999px; font-size: 11px; cursor: pointer; background: #ffffff; color: #6b7280; white-space: nowrap; transition: all 0.15s; }
    .category-chip:hover { border-color: #1a1a1a; color: #1a1a1a; }
    .category-chip.active { background: #1a1a1a; color: #ddff53; border-color: #1a1a1a; }
    .blocks-list { flex: 1; overflow-y: auto; padding: 8px; }
    .section-label { font-size: 11px; font-weight: 700; color: #9ca3af; padding: 8px 8px 4px; text-transform: uppercase; letter-spacing: 0.5px; }
    .block-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; cursor: pointer; transition: background 0.15s; margin-bottom: 2px; border: 1px solid transparent; }
    .block-card:hover { background: #f3f4f6; border-color: #e0e0e0; }
    .block-card:active { background: #e8eaed; }
    .block-icon { width: 36px; height: 36px; border-radius: 6px; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #6b7280; flex-shrink: 0; }
    .block-info { flex: 1; min-width: 0; }
    .block-name { font-size: 13px; font-weight: 600; color: #1a1a1a; line-height: 1.3; }
    .block-desc { font-size: 11px; color: #9ca3af; margin-top: 1px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .block-actions { display: flex; gap: 2px; flex-shrink: 0; }
    .action-btn { width: 26px; height: 26px; border: none; border-radius: 4px; background: transparent; color: #9ca3af; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; }
    .action-btn:hover { background: #eee; color: #1a1a1a; }
    .action-delete:hover { background: #fee2e2; color: #dc2626; }
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 16px; text-align: center; gap: 8px; }
    .empty-icon { font-size: 36px; color: #d1d5db; }
    .empty-title { font-size: 14px; font-weight: 600; color: #6b7280; margin: 0; }
    .empty-subtitle { font-size: 12px; color: #9ca3af; margin: 0; }
    .tooltip { position: relative; }
    .tooltip-text { visibility: hidden; position: absolute; bottom: 100%; right: 50%; transform: translateX(50%); background: #1a1a1a; color: #ddff53; font-size: 10px; padding: 3px 8px; border-radius: 4px; white-space: nowrap; z-index: 10; margin-bottom: 4px; }
    .action-btn:hover .tooltip-text { visibility: visible; }
  `],
  template: `
    <div class="panel-header">
      <h3>רכיבים מוכנים</h3>
      <input
        class="search-input"
        type="text"
        [value]="searchQuery()"
        (input)="searchQueryChange.emit($any($event.target).value)"
        placeholder="חיפוש רכיבים..."
      />
    </div>

    <div class="category-filters">
      <button
        class="category-chip"
        [class.active]="!selectedCategory()"
        (click)="selectedCategoryChange.emit(null)"
      >הכל</button>
      @for (cat of categories(); track cat.value) {
        <button
          class="category-chip"
          [class.active]="selectedCategory() === cat.value"
          (click)="selectedCategoryChange.emit(cat.value)"
        >{{ cat.label }}</button>
      }
    </div>

    <div class="blocks-list">
      @if (systemBlocks().length === 0 && userBlocks().length === 0) {
        <div class="empty-state">
          <span class="empty-icon material-symbols-outlined">category</span>
          <p class="empty-title">אין רכיבים</p>
          <p class="empty-subtitle">{{ searchQuery() ? 'לא נמצאו תוצאות חיפוש' : 'אין רכיבים בקטגוריה זו' }}</p>
        </div>
      } @else {
        @if (systemBlocks().length > 0) {
          <div class="section-label">רכיבי מערכת</div>
          @for (block of systemBlocks(); track block.id) {
            <div class="block-card" (click)="addBlock.emit(block)" [title]="block.description || block.name">
              <div class="block-icon material-symbols-outlined">{{ block.icon || 'widgets' }}</div>
              <div class="block-info">
                <div class="block-name">{{ block.name }}</div>
                <div class="block-desc">{{ block.description || '' }}</div>
              </div>
            </div>
          }
        }
        @if (userBlocks().length > 0) {
          <div class="section-label" style="margin-top:8px">הרכיבים שלי</div>
          @for (block of userBlocks(); track block.id) {
            <div class="block-card" (click)="addBlock.emit(block)" [title]="block.description || block.name">
              <div class="block-icon material-symbols-outlined">{{ block.icon || 'bookmark' }}</div>
              <div class="block-info">
                <div class="block-name">{{ block.name }}</div>
                <div class="block-desc">{{ block.categoryLabel }} · {{ block.description || '' }}</div>
              </div>
              <div class="block-actions" (click)="$event.stopPropagation()">
                <button class="action-btn" (click)="editBlock.emit(block)" title="עריכה">
                  <span class="material-symbols-outlined" style="font-size:16px">edit</span>
                </button>
                <button class="action-btn" (click)="duplicateBlock.emit(block)" title="שכפול">
                  <span class="material-symbols-outlined" style="font-size:16px">content_copy</span>
                </button>
                <button class="action-btn action-delete" (click)="deleteBlock.emit(block)" title="מחיקה">
                  <span class="material-symbols-outlined" style="font-size:16px">delete</span>
                </button>
              </div>
            </div>
          }
        }
      }
    </div>
  `,
})
export class ComponentLibraryPanelComponent {
  searchQuery = input('');
  selectedCategory = input<string | null>(null);
  categories = input<{ value: string; label: string }[]>([]);
  systemBlocks = input<ComponentLibraryItem[]>([]);
  userBlocks = input<ComponentLibraryItem[]>([]);

  searchQueryChange = output<string>();
  selectedCategoryChange = output<string | null>();
  addBlock = output<ComponentLibraryItem>();
  editBlock = output<ComponentLibraryItem>();
  duplicateBlock = output<ComponentLibraryItem>();
  deleteBlock = output<ComponentLibraryItem>();
}
