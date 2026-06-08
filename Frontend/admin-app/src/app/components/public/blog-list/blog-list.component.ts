import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, DestroyRef, NgZone } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';
import { ArticleService } from '../../../services/admin/article.service';
import { ArticleBanner, ArticleContentType } from '../../../models/article.model';
import { TranslatePipe } from '../../../pipes/translate.pipe';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [CommonModule, RouterModule, NewsBannerComponent, TranslatePipe],
  templateUrl: './blog-list.component.html',
  styleUrl: './blog-list.component.css'
})
export class BlogListComponent implements OnInit, OnDestroy {
  @ViewChild('sentinel', { static: false }) sentinelRef!: ElementRef;

  private readonly articleService = inject(ArticleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  isMobile = false;
  private mobileMql?: MediaQueryList;

  private cachedManagedRows: { slots: number[]; gridCols: string }[] | null = null;
  private cachedStreamRows: { articles: ArticleBanner[]; gridCols: string }[] | null = null;


  private readonly pageSize = 12;

  managedArticles: ArticleBanner[] = [];
  streamArticles: ArticleBanner[] = [];
  isLoading = true;
  isLoadingMore = false;
  hasError = false;
  loadFailed = false;

  private currentPage = 2;
  private hasMore = true;
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    this.mobileMql = window.matchMedia('(max-width: 640px)');
    this.isMobile = this.mobileMql.matches;
    this.mobileMql.addEventListener('change', (e) => {
      this.ngZone.run(() => {
        this.isMobile = e.matches;
        this.invalidateCache();
      });
    });

    this.loadInitialArticles();
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

  private loadInitialArticles(): void {
    this.articleService.getPublishedArticleBanners(ArticleContentType.Blog, 1, this.pageSize)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.managedArticles = result.items.slice(0, 5);
          this.streamArticles = result.items.slice(5);
          this.hasMore = result.hasNextPage;
          this.isLoading = false;
          this.invalidateCache();

          if (result.items.length === 0) {
            this.hasError = true;
          } else {
            setTimeout(() => this.setupObserver(), 100);
          }
        },
        error: () => {
          this.isLoading = false;
          this.loadFailed = true;
        }
      });
  }

  private loadMoreArticles(): void {
    if (!this.hasMore || this.isLoadingMore) return;
    this.isLoadingMore = true;

    this.articleService.getPublishedArticleBanners(ArticleContentType.Blog, this.currentPage, this.pageSize)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.streamArticles = [...this.streamArticles, ...result.items];
          this.hasMore = result.hasNextPage;
          this.currentPage++;
          this.isLoadingMore = false;
          this.invalidateCache();
        },
        error: () => {
          this.isLoadingMore = false;
        }
      });
  }

  private setupObserver(): void {
    if (!this.sentinelRef?.nativeElement) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && this.hasMore && !this.isLoadingMore) {
          this.loadMoreArticles();
        }
      },
      { rootMargin: '300px' }
    );

    this.observer.observe(this.sentinelRef.nativeElement);
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

    const rows: { articles: ArticleBanner[]; gridCols: string }[] = [];
    let i = 0;

    if (this.isMobile) {
      let rowType = 0;
      while (i < this.streamArticles.length) {
        const count = rowType % 2 === 0 ? 2 : 1;
        const end = Math.min(i + count, this.streamArticles.length);
        rows.push({ articles: this.streamArticles.slice(i, end), gridCols: count === 2 ? '1fr 1fr' : '1fr' });
        i = end;
        rowType++;
      }
    } else {
      const twoColPatterns = ['2fr 1fr', '3fr 2fr', '1fr 2fr', '2fr 3fr'];
      const threeColPatterns = ['2fr 1fr 1fr', '1fr 2fr 1fr', '1fr 1fr 2fr', '3fr 2fr 1fr', '2fr 3fr 1fr', '1fr 3fr 2fr'];

      let twoIdx = 0;
      let threeIdx = 0;
      let rowType = 0;

      while (i < this.streamArticles.length) {
        const cols = rowType % 2 === 0 ? 2 : 3;
        const end = Math.min(i + cols, this.streamArticles.length);
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

        rows.push({ articles: this.streamArticles.slice(i, end), gridCols });
        i = end;
        rowType++;
      }
    }

    this.cachedStreamRows = rows;
    return rows;
  }
}
