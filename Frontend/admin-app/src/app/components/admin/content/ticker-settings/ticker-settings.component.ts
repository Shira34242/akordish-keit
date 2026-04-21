import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, takeUntil } from 'rxjs';
import { TickerSettingsService, TickerConfig, TICKER_DEFAULT } from '../../../../services/ticker-settings.service';
import { ArticleContentType, ArticleCategory } from '../../../../models/article.model';

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

  cfg!: TickerConfig;
  saved = false;
  dirty = false;
  saving = false;
  saveError = false;
  previewMode: 'desktop' | 'mobile' = 'desktop';
  previewFrameSrc!: SafeResourceUrl;
  private destroy$ = new Subject<void>();

  readonly fontWeights = [
    { label: 'Light 300',      value: 300 },
    { label: 'Regular 400',    value: 400 },
    { label: 'Semi-Bold 600',  value: 600 },
    { label: 'Bold 700',       value: 700 },
    { label: 'ExtraBold 800',  value: 800 }
  ];

  // כל קטגוריות + סוגי תוכן
  readonly filterOptions: FilterOption[] = [
    { label: 'חדשות המוזיקה',       filterType: 'contentType', contentType: ArticleContentType.News },
    { label: 'תוכן ובלוג',          filterType: 'contentType', contentType: ArticleContentType.Blog },
    { label: 'כללי',                filterType: 'category', categoryId: ArticleCategory.General },
    { label: 'חדשות',               filterType: 'category', categoryId: ArticleCategory.News },
    { label: 'ביקורות',             filterType: 'category', categoryId: ArticleCategory.Reviews },
    { label: 'ראיונות',             filterType: 'category', categoryId: ArticleCategory.Interviews },
    { label: 'כתבות',               filterType: 'category', categoryId: ArticleCategory.Features },
    { label: 'דיווחי הופעות',       filterType: 'category', categoryId: ArticleCategory.LiveReports },
    { label: 'ביקורות אלבומים',     filterType: 'category', categoryId: ArticleCategory.AlbumReviews },
    { label: 'טכנולוגיה מוזיקלית',  filterType: 'category', categoryId: ArticleCategory.MusicTech },
    { label: 'חינוך',               filterType: 'category', categoryId: ArticleCategory.Education },
    { label: 'פופולרי',             filterType: 'category', categoryId: ArticleCategory.Popular },
    { label: 'קליפים',              filterType: 'category', categoryId: ArticleCategory.Clips },
    { label: 'בלוג',                filterType: 'category', categoryId: ArticleCategory.Blog },
    { label: 'דעה',                 filterType: 'category', categoryId: ArticleCategory.Opinion },
    { label: 'מצעדים',              filterType: 'category', categoryId: ArticleCategory.Charts },
    { label: 'מאחורי הקלעים',       filterType: 'category', categoryId: ArticleCategory.BehindTheScenes }
  ];

  constructor(
    public settingsService: TickerSettingsService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.refreshPreview();
    // עובד על עותק מקומי כדי שה-save יהיה מפורש
    this.cfg = { ...this.settingsService.config };
    this.settingsService.config$
      .pipe(takeUntil(this.destroy$))
      .subscribe(cfg => {
        if (this.saving) return;
        this.cfg = { ...cfg };
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // האפשרות הנבחרת כרגע
  get selectedFilter(): FilterOption | undefined {
    return this.filterOptions.find(o =>
      o.filterType === this.cfg.filterType &&
      (o.filterType === 'contentType'
        ? o.contentType === this.cfg.contentType
        : o.categoryId  === this.cfg.categoryId)
    );
  }

  selectFilter(opt: FilterOption): void {
    this.cfg.filterType = opt.filterType;
    if (opt.filterType === 'contentType' && opt.contentType !== undefined) {
      this.cfg.contentType = opt.contentType;
    }
    if (opt.filterType === 'category' && opt.categoryId !== undefined) {
      this.cfg.categoryId = opt.categoryId;
    }
    this.apply();
  }

  toggleEnabled(): void {
    this.cfg.enabled = !this.cfg.enabled;
    this.apply();
  }

  // שמירה מיידית לשירות (reactive — נראה מיד בדף הבית)
  apply(): void {
    this.settingsService.update({ ...this.cfg });
    this.dirty = true;
    this.saved = false;
    this.saveError = false;
    this.refreshPreview();
  }

  resetDefaults(): void {
    this.cfg = { ...TICKER_DEFAULT };
    this.settingsService.reset();
    this.dirty = true;
    this.saved = false;
    this.saveError = false;
    this.refreshPreview();
  }

  setPreviewMode(mode: 'desktop' | 'mobile'): void {
    this.previewMode = mode;
  }

  saveForEveryone(): void {
    this.saving = true;
    this.saveError = false;
    this.settingsService.saveGlobal({ ...this.cfg }).subscribe({
      next: () => {
        this.saving = false;
        this.dirty = false;
        this.refreshPreview();
        this.flashSaved();
      },
      error: () => {
        this.saving = false;
        this.saveError = true;
      }
    });
  }

  private refreshPreview(): void {
    this.previewFrameSrc = this.sanitizer.bypassSecurityTrustResourceUrl(
      `/?tickerPreview=${Date.now()}`
    );
  }

  private flashSaved(): void {
    this.saved = true;
    setTimeout(() => { this.saved = false; }, 2000);
  }
}
