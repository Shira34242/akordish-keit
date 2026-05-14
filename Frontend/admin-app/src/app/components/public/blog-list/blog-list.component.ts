import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';
import { ArticleService } from '../../../services/admin/article.service';
import { Article, ArticleContentType, ArticleStatus } from '../../../models/article.model';
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

  readonly managedSlots = Array.from({ length: 5 }, (_, i) => i);
  private readonly pageSize = 12;

  managedArticles: Article[] = [];
  streamArticles: Article[] = [];
  isLoading = true;
  isLoadingMore = false;
  hasError = false;
  loadFailed = false;

  private currentPage = 2;
  private hasMore = true;
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    this.loadInitialArticles();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private loadInitialArticles(): void {
    this.articleService.getArticles(1, this.pageSize, undefined, undefined, ArticleContentType.Blog, ArticleStatus.Published)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.managedArticles = result.items.slice(0, 5);
          this.streamArticles = result.items.slice(5);
          this.hasMore = result.hasNextPage;
          this.isLoading = false;

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

    this.articleService.getArticles(this.currentPage, this.pageSize, undefined, undefined, ArticleContentType.Blog, ArticleStatus.Published)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.streamArticles = [...this.streamArticles, ...result.items];
          this.hasMore = result.hasNextPage;
          this.currentPage++;
          this.isLoadingMore = false;
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
