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
import { ArticleCategory, ArticleContentType } from '../../../../models/article.model';

export interface FilterOption {
  label: string;
  filterType: 'contentType' | 'category';
  contentType?: ArticleContentType;
  categoryId?: number;
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

  readonly filterOptions: FilterOption[] = [
    { label: 'חדשות המוזיקה', filterType: 'contentType', contentType: ArticleContentType.News },
    { label: 'תוכן ובלוג', filterType: 'contentType', contentType: ArticleContentType.Blog },
    { label: 'כללי', filterType: 'category', categoryId: ArticleCategory.General },
    { label: 'חדשות', filterType: 'category', categoryId: ArticleCategory.News },
    { label: 'ביקורות', filterType: 'category', categoryId: ArticleCategory.Reviews },
    { label: 'ראיונות', filterType: 'category', categoryId: ArticleCategory.Interviews },
    { label: 'כתבות', filterType: 'category', categoryId: ArticleCategory.Features },
    { label: 'דיווחי הופעות', filterType: 'category', categoryId: ArticleCategory.LiveReports },
    { label: 'ביקורות אלבומים', filterType: 'category', categoryId: ArticleCategory.AlbumReviews },
    { label: 'טכנולוגיה מוזיקלית', filterType: 'category', categoryId: ArticleCategory.MusicTech },
    { label: 'חינוך', filterType: 'category', categoryId: ArticleCategory.Education },
    { label: 'פופולרי', filterType: 'category', categoryId: ArticleCategory.Popular },
    { label: 'קליפים', filterType: 'category', categoryId: ArticleCategory.Clips },
    { label: 'בלוג', filterType: 'category', categoryId: ArticleCategory.Blog },
    { label: 'דעה', filterType: 'category', categoryId: ArticleCategory.Opinion },
    { label: 'מצעדים', filterType: 'category', categoryId: ArticleCategory.Charts },
    { label: 'מאחורי הקלעים', filterType: 'category', categoryId: ArticleCategory.BehindTheScenes }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private settingsService: TickerSettingsService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.previewFrameSrc = this.sanitizer.bypassSecurityTrustResourceUrl('/?tickerPreview=1');
    this.cfg = { ...this.settingsService.config };
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
}
