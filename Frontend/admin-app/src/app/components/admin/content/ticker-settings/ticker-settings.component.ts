import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import {
  TickerConfig,
  TICKER_DEFAULT,
  TickerMoveDirection,
  TickerSettingsService
} from '../../../../services/ticker-settings.service';
import { SystemItem, SystemTablesService } from '../../../../services/system-tables.service';
import { ArticleContentType } from '../../../../models/article.model';

export interface FilterOption {
  label: string;
  filterType: 'contentType' | 'category';
  contentType?: ArticleContentType;
  categoryId?: number;
}

interface CategoryWithSection extends SystemItem {
  section?: number;
}

@Component({
  selector: 'app-ticker-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ticker-settings.component.html',
  styleUrls: ['./ticker-settings.component.css']
})
export class TickerSettingsComponent implements OnInit, OnDestroy {
  cfg: TickerConfig = { ...TICKER_DEFAULT };
  previewMode: 'desktop' | 'mobile' = 'desktop';
  dirty = false;
  saved = false;
  saving = false;
  saveError = false;
  previewFrameSrc!: SafeResourceUrl;

  readonly fontWeights = [
    { label: 'Light', value: 300 },
    { label: 'Regular', value: 400 },
    { label: 'Bold', value: 700 },
    { label: 'ExtraBold', value: 800 }
  ];

  readonly directionOptions: Array<{ label: string; value: TickerMoveDirection }> = [
    { label: 'ימינה', value: 'rtl' },
    { label: 'שמאלה', value: 'ltr' }
  ];

  filterOptions: FilterOption[] = this.baseFilterOptions;

  private destroy$ = new Subject<void>();

  constructor(
    private settingsService: TickerSettingsService,
    private sanitizer: DomSanitizer,
    private systemTablesService: SystemTablesService
  ) {}

  ngOnInit(): void {
    this.previewFrameSrc = this.sanitizer.bypassSecurityTrustResourceUrl('/?tickerPreview=1');
    this.cfg = { ...this.settingsService.config };
    this.loadCategories();
    this.settingsService.config$
      .pipe(takeUntil(this.destroy$))
      .subscribe(cfg => {
        if (this.dirty || this.saving) return;
        this.cfg = { ...cfg };
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get selectedFilter(): FilterOption | undefined {
    return this.filterOptions.find(option =>
      option.filterType === this.cfg.filterType &&
      (option.filterType === 'contentType'
        ? option.contentType === this.cfg.contentType
        : option.categoryId === this.cfg.categoryId)
    );
  }

  get screenClass(): string {
    return this.previewMode;
  }

  selectFilter(option: FilterOption): void {
    this.cfg.filterType = option.filterType;
    if (option.contentType !== undefined) this.cfg.contentType = option.contentType;
    if (option.categoryId !== undefined) this.cfg.categoryId = option.categoryId;
    this.markDraft();
  }

  toggleEnabled(): void {
    this.cfg.enabled = !this.cfg.enabled;
    this.markDraft();
  }

  setPreviewMode(mode: 'desktop' | 'mobile'): void {
    this.previewMode = mode;
  }

  setDirection(direction: TickerMoveDirection): void {
    this.cfg.direction = direction;
    this.markDraft();
  }

  setFontWeight(weight: number): void {
    this.cfg.fontWeight = weight;
    this.markDraft();
  }

  markDraft(): void {
    this.settingsService.updateDraft({ ...this.cfg });
    this.dirty = true;
    this.saved = false;
    this.saveError = false;
  }

  resetDraft(): void {
    this.cfg = { ...TICKER_DEFAULT };
    this.settingsService.resetDraft();
    this.dirty = true;
    this.saved = false;
    this.saveError = false;
  }

  saveForEveryone(): void {
    this.saving = true;
    this.saveError = false;
    this.settingsService.saveGlobal({ ...this.cfg }).subscribe({
      next: () => {
        this.saving = false;
        this.dirty = false;
        this.saved = true;
        setTimeout(() => { this.saved = false; }, 2200);
      },
      error: () => {
        this.saving = false;
        this.saveError = true;
      }
    });
  }

  private get baseFilterOptions(): FilterOption[] {
    return [
      { label: 'חדשות המוזיקה', filterType: 'contentType', contentType: ArticleContentType.News },
      { label: 'תוכן ובלוג', filterType: 'contentType', contentType: ArticleContentType.Blog }
    ];
  }

  private loadCategories(): void {
    this.systemTablesService.getItems('article-categories', 1, 200).subscribe({
      next: (result) => {
        const categoryOptions = (result.items as CategoryWithSection[])
          .sort((a, b) => (a.section ?? 0) - (b.section ?? 0) || a.name.localeCompare(b.name, 'he'))
          .map(category => ({
            label: category.name,
            filterType: 'category' as const,
            categoryId: category.id
          }));

        this.filterOptions = [...this.baseFilterOptions, ...categoryOptions];

        if (this.cfg.filterType === 'category' && !categoryOptions.some(option => option.categoryId === this.cfg.categoryId)) {
          this.cfg.filterType = 'contentType';
          this.cfg.contentType = ArticleContentType.News;
          this.markDraft();
        }
      },
      error: (err) => console.error('Error loading article categories for ticker', err)
    });
  }
}
