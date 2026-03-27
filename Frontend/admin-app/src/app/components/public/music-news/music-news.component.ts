import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';
import { FeaturedContentService } from '../../../services/admin/featured-content.service';
import { ArticleService } from '../../../services/admin/article.service';
import { FeaturedContent } from '../../../models/featured-content.model';
import { Article, ArticleContentType } from '../../../models/article.model';

@Component({
  selector: 'app-music-news',
  standalone: true,
  imports: [CommonModule, RouterModule, NewsBannerComponent],
  templateUrl: './music-news.component.html',
  styleUrl: './music-news.component.css'
})
export class MusicNewsComponent implements OnInit, OnDestroy {
  @ViewChild('sentinel', { static: false }) sentinelRef!: ElementRef;

  private readonly featuredContentService = inject(FeaturedContentService);
  private readonly articleService = inject(ArticleService);
  private readonly destroyRef = inject(DestroyRef);

  featuredArticles: FeaturedContent[] = [];
  newsArticles: Article[] = [];
  isLoading = true;
  isLoadingMore = false;

  private currentPage = 1;
  private readonly pageSize = 12;
  private hasMore = true;
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    this.loadFeaturedContent().then(() => this.loadNewsArticles()).then(() => {
      this.isLoading = false;
      setTimeout(() => this.setupObserver(), 100);
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
          error: () => resolve()
        });
    });
  }

  private loadNewsArticles(): Promise<void> {
    if (!this.hasMore || this.isLoadingMore) return Promise.resolve();
    this.isLoadingMore = true;
    return new Promise((resolve) => {
      this.articleService.getArticles(
        this.currentPage, this.pageSize,
        undefined, undefined, ArticleContentType.News
      )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (result) => {
            const featuredIds = new Set(this.featuredArticles.map(f => f.article.id));
            const newItems = result.items.filter(a => !featuredIds.has(a.id));
            this.newsArticles = [...this.newsArticles, ...newItems];
            this.hasMore = result.hasNextPage;
            this.currentPage++;
            this.isLoadingMore = false;
            resolve();
          },
          error: () => {
            this.isLoadingMore = false;
            resolve();
          }
        });
    });
  }

  private setupObserver(): void {
    if (!this.sentinelRef?.nativeElement) return;
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

  getCellClass(index: number): string {
    // מחזור 12 פריטים — ממלא 6 עמודות ללא חורים
    // כל band גובה שונה → אין תחושת שורות אחידות
    // Band 1 (~472px): [sc-a 4col×40] [sc-b 2col×40]  → 4+2=6 ✓
    // Band 2 (~340px): [sc-c 3col×29] [sc-d 3col×29]  → 3+3=6 ✓
    // Band 3 (~400px): [sc-e 2col×34] [sc-f 4col×34]  → 2+4=6 ✓ הפוך!
    // Band 4 (~304px): [sc-g 3col×26] [sc-h 3col×26]  → 3+3=6 ✓
    // Band 5 (~436px): [sc-i 4col×37] [sc-j 2col×37]  → 4+2=6 ✓
    // Band 6 (~364px): [sc-k 3col×31] [sc-l 3col×31]  → 3+3=6 ✓
    const patterns = [
      'sc-a',  //  0 — נוף רחב גדול    (4col, ~472px)
      'sc-b',  //  1 — פורטרט גדול     (2col, ~472px)
      'sc-c',  //  2 — ריבועי          (3col, ~340px)
      'sc-d',  //  3 — ריבועי          (3col, ~340px)
      'sc-e',  //  4 — פורטרט בינוני   (2col, ~400px)
      'sc-f',  //  5 — נוף רחב הפוך    (4col, ~400px)
      'sc-g',  //  6 — ריבועי קצר      (3col, ~304px)
      'sc-h',  //  7 — ריבועי קצר      (3col, ~304px)
      'sc-i',  //  8 — נוף רחב         (4col, ~436px)
      'sc-j',  //  9 — פורטרט          (2col, ~436px)
      'sc-k',  // 10 — ריבועי בינוני   (3col, ~364px)
      'sc-l',  // 11 — ריבועי בינוני   (3col, ~364px)
    ];
    return patterns[index % patterns.length];
  }
}
