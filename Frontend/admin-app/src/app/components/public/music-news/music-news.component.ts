import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, DestroyRef, NgZone } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';
import { FeaturedContentService } from '../../../services/admin/featured-content.service';
import { ArticleService } from '../../../services/admin/article.service';
import { NewsPageSectionService } from '../../../services/news-page-section.service';
import { FeaturedContentBanner } from '../../../models/featured-content.model';
import { ArticleBanner, ArticleContentType } from '../../../models/article.model';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { ScrollRestorationService } from '../../../services/scroll-restoration.service';
import { RouteReuseEventsService } from '../../../services/route-reuse-events.service';
import { ContentRefreshNoticeService } from '../../../services/content-refresh-notice.service';
import { catchError, filter, of, take } from 'rxjs';

@Component({
  selector: 'app-music-news',
  standalone: true,
  imports: [CommonModule, RouterModule, NewsBannerComponent, TranslatePipe],
  templateUrl: './music-news.component.html',
  styleUrl: './music-news.component.css'
})
export class MusicNewsComponent implements OnInit, OnDestroy {
  @ViewChild('sentinel', { static: false }) sentinelRef!: ElementRef;

  private readonly featuredContentService = inject(FeaturedContentService);
  private readonly articleService = inject(ArticleService);
  private readonly newsPageSectionService = inject(NewsPageSectionService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly scrollRestoration = inject(ScrollRestorationService);
  private readonly routeReuseEvents = inject(RouteReuseEventsService);
  private readonly contentRefreshNotice = inject(ContentRefreshNoticeService);

  isMobile = false;
  private mobileMql?: MediaQueryList;

  private cachedManagedRows: { slots: number[]; gridCols: string }[] | null = null;
  private cachedStreamRows: { articles: ArticleBanner[]; gridCols: string }[] | null = null;

  readonly managedSlots = Array.from({ length: 5 }, (_, index) => index);

  featuredArticles: FeaturedContentBanner[] = [];
  newsArticles: ArticleBanner[] = [];
  isLoading = true;
  isLoadingMore = false;
  hasError = false;
  loadFailed = false;

  private currentPage = 1;
  private readonly pageSize = 12;
  private hasMore = true;
  private restoreUntilPage = 1;
  private observer?: IntersectionObserver;
  private visibleCategoryIds: number[] = [];

  ngOnInit(): void {
    this.routeReuseEvents.attached$
      .pipe(filter(key => key === 'music-news'), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.checkForNewContent());
    this.restoreUntilPage = Math.max(1, this.scrollRestoration.getViewState<{ nextPage?: number }>('music-news')?.nextPage ?? 1);
    this.mobileMql = window.matchMedia('(max-width: 640px)');
    this.isMobile = this.mobileMql.matches;
    this.mobileMql.addEventListener('change', (e) => {
      this.ngZone.run(() => {
        this.isMobile = e.matches;
        this.invalidateCache();
      });
    });

    Promise.all([
      this.loadFeaturedContent(),
      this.loadVisibleCategorySettings().then(() => this.loadNewsArticles())
    ])
      .then(() => this.loadRestoredPages())
      .then(() => {
        const featuredIds = new Set(this.featuredArticles.map(item => item.article.id));
        this.newsArticles = this.newsArticles.filter(article => !featuredIds.has(article.id));
        this.invalidateCache();
        this.isLoading = false;

        const hasContent = this.featuredArticles.length > 0 || this.newsArticles.length > 0;

        if (!hasContent && this.loadFailed) {
          // כל הטעינות נכשלו ואין תוכן — מצב שגיאה
          this.hasError = true;
        } else if (!hasContent) {
          // טעינה הצליחה אבל אין תוכן — empty state
          this.hasError = true;
        } else {
          // יש תוכן — גם אם featured נכשל, מציגים את מה שיש
          this.loadFailed = false;
          setTimeout(() => {
            this.setupObserver();
            this.scrollRestoration.restoreWhenReady();
          }, 100);
        }
      });
  }

  private loadVisibleCategorySettings(): Promise<void> {
    return new Promise((resolve) => {
      this.newsPageSectionService.getActiveSections()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (sections) => {
            this.visibleCategoryIds = sections
              .filter(section => section.contentTypeId === ArticleContentType.News)
              .flatMap(section => section.categoryIds?.length ? section.categoryIds : section.categoryId ? [section.categoryId] : [])
              .filter((id, index, arr) => arr.indexOf(id) === index);

            resolve();
          },
          error: () => {
            resolve();
          }
        });
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.mobileMql?.removeEventListener('change', () => {});
  }

  private invalidateCache(): void {
    this.cachedManagedRows = null;
    this.cachedStreamRows = null;
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackById(_index: number, article: ArticleBanner): number {
    return article.id;
  }

  private loadFeaturedContent(): Promise<void> {
    return new Promise((resolve) => {
      this.featuredContentService.getActiveFeaturedContentBanners()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (content) => {
            this.featuredArticles = content.sort((a, b) => a.displayOrder - b.displayOrder);
            resolve();
          },
          error: () => {
            this.loadFailed = true;
            resolve();
          }
        });
    });
  }

  private loadNewsArticles(): Promise<void> {
    if (!this.hasMore || this.isLoadingMore) {
      return Promise.resolve();
    }

    this.isLoadingMore = true;

    return new Promise((resolve) => {
      this.articleService.getPublishedArticleBanners(
        ArticleContentType.News,
        this.currentPage,
        this.pageSize,
        this.visibleCategoryIds
      )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (result) => {
            const featuredIds = new Set(this.featuredArticles.map(item => item.article.id));
            const newItems = result.items.filter(article => !featuredIds.has(article.id));
            this.newsArticles = [...this.newsArticles, ...newItems];
            this.hasMore = result.hasNextPage;
            this.currentPage++;
            this.scrollRestoration.saveViewState('music-news', { nextPage: this.currentPage });
            this.isLoadingMore = false;
            this.invalidateCache();
            resolve();
          },
          error: (err) => {
            console.error('music-news: failed to load articles', err);
            this.isLoadingMore = false;
            this.loadFailed = true;
            resolve();
          }
        });
    });
  }

  private loadRestoredPages(): Promise<void> {
    if (!this.hasMore || this.currentPage >= this.restoreUntilPage) {
      return Promise.resolve();
    }

    return this.loadNewsArticles().then(() => this.loadRestoredPages());
  }

  private checkForNewContent(): void {
    const currentFirstId = this.newsArticles[0]?.id;
    if (!currentFirstId) return;

    this.articleService.getPublishedArticleBanners(
      ArticleContentType.News, 1, this.pageSize, this.visibleCategoryIds
    ).pipe(take(1), catchError(() => of(null))).subscribe(result => {
      const featuredIds = new Set(this.featuredArticles.map(item => item.article.id));
      const newestId = result?.items?.find(item => !featuredIds.has(item.id))?.id;
      if (newestId && newestId !== currentFirstId) {
        this.contentRefreshNotice.show();
      }
    });
  }

  private setupObserver(): void {
    if (!this.sentinelRef?.nativeElement) {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && this.hasMore && !this.isLoadingMore) {
          this.loadNewsArticles();
        }
      },
      { rootMargin: '300px' }
    );

    this.observer.observe(this.sentinelRef.nativeElement);
  }

  getFeaturedArticle(index: number): ArticleBanner | null {
    return this.featuredArticles[index]?.article ?? null;
  }

  getManagedArticle(index: number): ArticleBanner | null {
    const featuredArticle = this.getFeaturedArticle(index);
    if (featuredArticle) {
      return featuredArticle;
    }

    const fallbackIndex = this.getFallbackIndexForSlot(index);
    return this.newsArticles[fallbackIndex] ?? null;
  }

  getStreamArticles(): ArticleBanner[] {
    return this.newsArticles.slice(this.emptyManagedSlotCount);
  }

  private get emptyManagedSlotCount(): number {
    return this.managedSlots.filter(slot => !this.getFeaturedArticle(slot)).length;
  }

  private getFallbackIndexForSlot(index: number): number {
    return this.managedSlots
      .slice(0, index + 1)
      .filter(slot => !this.getFeaturedArticle(slot))
      .length - 1;
  }

  getManagedRows(): { slots: number[]; gridCols: string }[] {
    if (this.cachedManagedRows) return this.cachedManagedRows;

    if (this.isMobile) {
      this.cachedManagedRows = [
        { slots: [0, 1], gridCols: '1fr 1fr' },
        { slots: [2], gridCols: '1fr' },
        { slots: [3, 4], gridCols: '1fr 1fr' }
      ];
    } else {
      this.cachedManagedRows = [
        { slots: [0, 1], gridCols: '1fr 1fr' },
        { slots: [2, 3, 4], gridCols: '1fr 1fr 1fr' }
      ];
    }
    return this.cachedManagedRows;
  }

  getStreamRows(): { articles: ArticleBanner[]; gridCols: string }[] {
    if (this.cachedStreamRows) return this.cachedStreamRows;

    const articles = this.getStreamArticles();
    const rows: { articles: ArticleBanner[]; gridCols: string }[] = [];
    let i = 0;

    if (this.isMobile) {
      let rowType = 0;
      while (i < articles.length) {
        const count = rowType % 2 === 0 ? 2 : 1;
        const end = Math.min(i + count, articles.length);
        rows.push({ articles: articles.slice(i, end), gridCols: count === 2 ? '1fr 1fr' : '1fr' });
        i = end;
        rowType++;
      }
    } else {
      const twoColPatterns = ['2fr 1fr', '3fr 2fr', '1fr 2fr', '2fr 3fr'];
      const threeColPatterns = ['2fr 1fr 1fr', '1fr 2fr 1fr', '1fr 1fr 2fr', '3fr 2fr 1fr', '2fr 3fr 1fr', '1fr 3fr 2fr'];

      let twoIdx = 0;
      let threeIdx = 0;
      let rowType = 0;

      while (i < articles.length) {
        const cols = rowType % 2 === 0 ? 2 : 3;
        const end = Math.min(i + cols, articles.length);
        const actualCols = end - i;

        let gridCols: string;
        if (actualCols === 1) {
          gridCols = '1fr';
        } else if (actualCols === 2) {
          gridCols = twoColPatterns[twoIdx % twoColPatterns.length];
          twoIdx++;
        } else {
          gridCols = threeColPatterns[threeIdx % threeColPatterns.length];
          threeIdx++;
        }

        rows.push({ articles: articles.slice(i, end), gridCols });
        i = end;
        rowType++;
      }
    }

    this.cachedStreamRows = rows;
    return rows;
  }

}
