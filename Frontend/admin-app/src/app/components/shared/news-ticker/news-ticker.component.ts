import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, switchMap, of } from 'rxjs';
import { ArticleService } from '../../../services/admin/article.service';
import { TickerSettingsService, TickerConfig } from '../../../services/ticker-settings.service';
import { Article, ArticleStatus } from '../../../models/article.model';

@Component({
  selector: 'app-news-ticker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './news-ticker.component.html',
  styleUrls: ['./news-ticker.component.css']
})
export class NewsTickerComponent implements OnInit, OnDestroy {

  articles: Article[] = [];
  cfg!: TickerConfig;
  readonly isPreviewFrame = window.location.search.includes('tickerPreview=');
  readonly previewTitles = [
    'הסינגל החדש שמטלטל את עולם המוזיקה היהודית',
    'ראיון מיוחד מאחורי הקלעים',
    'מצעד השבוע: השירים שהכי אהבתם',
    'הופעה חדשה בדרך לבמות'
  ];
  private destroy$ = new Subject<void>();

  constructor(
    private articleService: ArticleService,
    private tickerSettings: TickerSettingsService
  ) {}

  ngOnInit(): void {
    this.tickerSettings.config$
      .pipe(
        takeUntil(this.destroy$),
        switchMap(cfg => {
          this.cfg = cfg;
          if (!cfg.enabled) return of({ items: [] as Article[] });

          if (cfg.filterType === 'category') {
            return this.articleService.getArticles(
              1, 12, undefined, cfg.categoryId, undefined, ArticleStatus.Published
            );
          }
          return this.articleService.getArticles(
            1, 12, undefined, undefined, cfg.contentType, ArticleStatus.Published
          );
        })
      )
      .subscribe({
        next: (res: any) => { this.articles = res.items || []; },
        error: ()        => { this.articles = []; }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* ---- inline styles ---- */

  get wrapperStyle(): Record<string, string> {
    const c = this.cfg;
    if (!c) return {};
    const extend = Math.max(0, c.leftExtend);
    return {
      top:             `${c.topOffset}px`,
      left:            `-${extend}vw`,
      width:           `calc(100vw + ${extend * 2}vw)`,
      transform:       `rotate(${c.rotation}deg)`,
      transformOrigin: '50% 0'
    };
  }

  get bandStyle(): Record<string, string> {
    const c = this.cfg;
    if (!c) return {};
    return {
      height:          `${c.bandHeight}px`,
      backgroundColor: c.backgroundColor
    };
  }

  get titleStyle(): Record<string, string> {
    const c = this.cfg;
    if (!c) return {};
    return {
      color:      c.textColor,
      fontSize:   `${c.fontSize}px`,
      fontWeight: String(c.fontWeight)
    };
  }

  get sepStyle(): Record<string, string> {
    return { color: this.cfg?.separatorColor ?? '#ddff53' };
  }

  get tickerTitles(): string[] {
    const titles = this.articles
      .map(a => a.title)
      .filter((title): title is string => !!title?.trim());

    if (titles.length > 0) return titles;
    return this.isPreviewFrame ? this.previewTitles : [];
  }

  get animationDuration(): string {
    const chars = this.tickerTitles.reduce((s, title) => s + title.length, 0);
    const dur = Math.max(18, Math.min(70, chars * 0.24));
    return `${dur}s`;
  }
}
