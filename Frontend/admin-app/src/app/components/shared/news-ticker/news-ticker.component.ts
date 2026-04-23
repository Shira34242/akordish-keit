import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, of, switchMap, takeUntil } from 'rxjs';
import { Article, ArticleStatus } from '../../../models/article.model';
import { ArticleService } from '../../../services/admin/article.service';
import {
  TickerConfig,
  TICKER_DEFAULT,
  TickerSettingsService
} from '../../../services/ticker-settings.service';

@Component({
  selector: 'app-news-ticker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './news-ticker.component.html',
  styleUrls: ['./news-ticker.component.css']
})
export class NewsTickerComponent implements OnInit, OnChanges, OnDestroy {
  @Input() previewConfig?: TickerConfig;
  @Input() previewTitles: string[] = [];

  cfg: TickerConfig = { ...TICKER_DEFAULT };
  titles: string[] = [];

  readonly trackCopies = [0, 1, 2, 3];
  readonly fallbackTitles = ['חדשות המוזיקה באקורדישקייט'];

  private destroy$ = new Subject<void>();

  constructor(
    private articleService: ArticleService,
    private tickerSettings: TickerSettingsService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.previewConfig) return;
    this.cfg = this.previewConfig;
    this.titles = this.cleanTitles(this.previewTitles);
  }

  ngOnInit(): void {
    if (this.previewConfig) {
      this.cfg = this.previewConfig;
      this.titles = this.cleanTitles(this.previewTitles);
      return;
    }

    this.tickerSettings.config$
      .pipe(
        takeUntil(this.destroy$),
        switchMap(cfg => {
          this.cfg = cfg;
          if (!cfg.enabled) return of({ items: [] as Article[] });

          if (cfg.filterType === 'category') {
            return this.articleService.getArticles(
              1, 16, undefined, cfg.categoryId, undefined, ArticleStatus.Published
            );
          }

          return this.articleService.getArticles(
            1, 16, undefined, undefined, cfg.contentType, ArticleStatus.Published
          );
        })
      )
      .subscribe({
        next: (res: any) => {
          this.titles = this.cleanTitles((res.items || []).map((article: Article) => article.title));
        },
        error: () => {
          this.titles = [];
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get hasContent(): boolean {
    return this.cfg.enabled && this.titles.length > 0;
  }

  get hostStyle(): Record<string, string> {
    return {
      top: `${this.cfg.positionY}%`,
      left: `${this.cfg.positionX}%`,
      width: `${this.cfg.widthVw}%`,
      transform: `translate(-50%, -50%) rotate(${this.cfg.rotation}deg)`,
      '--ticker-height': `${this.cfg.bandHeight}px`,
      '--ticker-bg': this.cfg.backgroundColor,
      '--ticker-text': this.cfg.textColor,
      '--ticker-separator': this.cfg.separatorColor,
      '--ticker-font-size': `${this.cfg.fontSize}px`,
      '--ticker-font-weight': String(this.cfg.fontWeight),
      '--ticker-duration': `${this.cfg.speed}s`,
      '--ticker-direction': this.cfg.direction === 'rtl' ? 'normal' : 'reverse'
    };
  }

  trackCopy(index: number): number {
    return index;
  }

  trackTitle(index: number, title: string): string {
    return `${index}-${title}`;
  }

  private cleanTitles(titles: Array<string | undefined | null>): string[] {
    const clean = titles
      .map(title => (title || '').trim())
      .filter(title => title.length > 0);

    if (clean.length === 0) return [...this.fallbackTitles];
    while (clean.length < 6) clean.push(...clean.slice(0, 6 - clean.length));
    return clean;
  }
}
