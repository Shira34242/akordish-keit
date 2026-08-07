import { Component, signal, output, input, type OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { COMPONENT_CATEGORIES, type ComponentCategory, type SaveComponentData } from '../blocks/component-library.types';

@Component({
  selector: 'app-save-component-dialog',
  standalone: true,
  imports: [FormsModule],
  host: { dir: 'rtl' },
  styles: [`
    :host { display: block; }
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 10001; }
    .dialog { background: #ffffff; border-radius: 16px; width: 440px; max-width: 90vw; padding: 24px; box-shadow: 0 8px 40px rgba(0,0,0,0.2); animation: slideUp 0.25s ease; direction: rtl; }
    @keyframes slideUp { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .dialog h2 { margin: 0 0 16px; font-size: 18px; font-weight: 700; color: #1a1a1a; }
    .field { margin-bottom: 12px; }
    .field label { display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 4px; }
    .field .required::after { content: ' *'; color: #dc2626; }
    .field input, .field select, .field textarea { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; color: #1a1a1a; background: #ffffff; box-sizing: border-box; direction: rtl; }
    .field input:focus, .field select:focus, .field textarea:focus { outline: none; border-color: #1a1a1a; box-shadow: 0 0 0 2px rgba(0,0,0,0.08); }
    .field textarea { resize: vertical; min-height: 60px; }
    .tags-input { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; border: 1px solid #d1d5db; border-radius: 6px; min-height: 36px; align-items: center; cursor: text; background: #ffffff; }
    .tags-input:focus-within { border-color: #1a1a1a; box-shadow: 0 0 0 2px rgba(0,0,0,0.08); }
    .tag { display: flex; align-items: center; gap: 2px; padding: 2px 8px; background: #f3f4f6; border-radius: 999px; font-size: 12px; color: #374151; }
    .tag-remove { width: 16px; height: 16px; border: none; border-radius: 50%; background: transparent; color: #9ca3af; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; line-height: 1; }
    .tag-remove:hover { background: #fee2e2; color: #dc2626; }
    .tags-input input { border: none; outline: none; flex: 1; min-width: 80px; font-size: 13px; padding: 2px 4px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 20px; }
    .btn { padding: 8px 20px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; cursor: pointer; background: #ffffff; color: #374151; font-weight: 500; }
    .btn:hover { background: #f3f4f6; }
    .btn-primary { background: #1a1a1a; color: #ddff53; border: none; font-weight: 600; }
    .btn-primary:hover { background: #333333; }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .error-text { font-size: 12px; color: #dc2626; margin-top: 2px; }
  `],
  template: `
    <div class="backdrop" (click)="onBackdrop($event)">
      <div class="dialog">
        <h2>{{ existingId() ? 'עריכת רכיב' : 'שמור כרכיב' }}</h2>

        <div class="field">
          <label class="required">שם הרכיב</label>
          <input type="text" [(ngModel)]="name" placeholder="לדוגמה: כותרת ירוקה" maxlength="60" />
          @if (nameError()) { <div class="error-text">{{ nameError() }}</div> }
        </div>

        <div class="field">
          <label>קטגוריה</label>
          <select [(ngModel)]="category">
            @for (cat of categories; track cat.value) {
              <option [value]="cat.value">{{ cat.label }}</option>
            }
          </select>
        </div>

        <div class="field">
          <label>תיאור</label>
          <textarea [(ngModel)]="description" placeholder="תיאור קצר של הרכיב..." maxlength="200"></textarea>
        </div>

        <div class="field">
          <label>תגיות (לחץ Enter להוספה)</label>
          <div class="tags-input" (click)="focusTagInput()">
            @for (tag of tags(); track tag) {
              <span class="tag">
                {{ tag }}
                <button class="tag-remove" (click)="removeTag(tag)">&times;</button>
              </span>
            }
            <input
              #tagInput
              type="text"
              [value]="tagInputValue"
              (input)="tagInputValue = $any($event.target).value"
              (keydown.enter)="addTag($event)"
              (keydown.backspace)="onBackspace()"
              placeholder="תגית..."
            />
          </div>
        </div>

        <div class="actions">
          <button class="btn" (click)="closed.emit()">ביטול</button>
          <button class="btn btn-primary" (click)="onSave()" [disabled]="!name.trim()">
            {{ existingId() ? 'עדכון' : 'שמירה' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class SaveComponentDialogComponent implements OnInit {
  existingId = input<string | null>(null);
  existingName = input('');
  existingCategory = input<ComponentCategory>('personal');
  existingDescription = input('');
  existingTags = input<string[]>([]);

  saved = output<SaveComponentData>();
  closed = output<void>();

  name = '';
  category: ComponentCategory = 'personal';
  description = '';
  tags = signal<string[]>([]);
  tagInputValue = '';
  nameError = signal('');

  categories = COMPONENT_CATEGORIES.filter((c) => c.value !== 'titles' || true);

  ngOnInit(): void {
    if (this.existingId()) {
      this.name = this.existingName();
      this.category = this.existingCategory();
      this.description = this.existingDescription();
      this.tags.set([...this.existingTags()]);
    }
  }

  focusTagInput(): void {}

  addTag(event: Event): void {
    event.preventDefault();
    const value = this.tagInputValue.trim();
    if (value && !this.tags().includes(value)) {
      this.tags.update((t) => [...t, value]);
    }
    this.tagInputValue = '';
  }

  removeTag(tag: string): void {
    this.tags.update((t) => t.filter((x) => x !== tag));
  }

  onBackspace(): void {
    if (!this.tagInputValue && this.tags().length > 0) {
      this.tags.update((t) => t.slice(0, -1));
    }
  }

  onBackdrop(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('backdrop')) {
      this.closed.emit();
    }
  }

  onSave(): void {
    const nameTrimmed = this.name.trim();
    if (!nameTrimmed) {
      this.nameError.set('שם הרכיב הוא שדה חובה');
      return;
    }
    this.nameError.set('');
    this.saved.emit({
      name: nameTrimmed,
      category: this.category,
      description: this.description.trim() || undefined,
      tags: this.tags().length > 0 ? this.tags() : undefined,
      definition: null as any, // The definition is set by the parent
    });
  }
}
