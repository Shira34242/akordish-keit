import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';
import { FeaturedContentService } from '../../../services/admin/featured-content.service';
import { ArticleService } from '../../../services/admin/article.service';
import { NewsPageSectionService } from '../../../services/news-page-section.service';
import { FeaturedContent } from '../../../models/featured-content.model';
import { Article, ArticleContentType, ArticleStatus } from '../../../models/article.model';
import { TranslatePipe } from '../../../pipes/translate.pipe';

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

  readonly managedSlots = Array.from({ length: 5 }, (_, index) => index);

  featuredArticles: FeaturedContent[] = [];
  newsArticles: Article[] = [];
  isLoading = true;
  isLoadingMore = false;
  hasError = false;
  loadFailed = false;

  private currentPage = 1;
  private readonly pageSize = 12;
  private hasMore = true;
  private observer?: IntersectionObserver;
  private visibleCategoryIds: number[] = [];

  ngOnInit(): void {
    this.loadVisibleCategorySettings()
      .then(() => this.loadFeaturedContent())
      .then(() => this.loadNewsArticles())
      .then(() => {
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
          setTimeout(() => this.setupObserver(), 100);
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
  }

  private loadFeaturedContent(): Promise<void> {
    return new Promise((resolve) => {
      this.featuredContentService.getActiveFeaturedContent()
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
      this.articleService.getArticles(
        this.currentPage,
        this.pageSize,
        undefined,
        undefined,
        ArticleContentType.News,
        ArticleStatus.Published,
        undefined,
        undefined,
        undefined,
        undefined,
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
            this.isLoadingMore = false;
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

  getFeaturedArticle(index: number): Article | null {
    return this.featuredArticles[index]?.article ?? null;
  }

  getManagedArticle(index: number): Article | null {
    const featuredArticle = this.getFeaturedArticle(index);
    if (featuredArticle) {
      return featuredArticle;
    }

    const fallbackIndex = this.getFallbackIndexForSlot(index);
    return this.newsArticles[fallbackIndex] ?? null;
  }

  getStreamArticles(): Article[] {
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

  getCellClass(index: number): string {
    const patterns = [
      'sc-third',
      'sc-third',
      'sc-third',
      'sc-duo-narrow',
      'sc-duo-wide',
      'sc-third-tall',
      'sc-third-tall',
      'sc-third-tall'
    ];

    return patterns[index % patterns.length];
  }
}
