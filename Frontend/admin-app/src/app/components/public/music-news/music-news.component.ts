import { Component, OnInit, OnDestroy, AfterViewInit, HostListener, inject, DestroyRef, ElementRef, NgZone } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';
import { FeaturedContentService } from '../../../services/admin/featured-content.service';
import { ArticleService } from '../../../services/admin/article.service';
import { FeaturedContent } from '../../../models/featured-content.model';
import { Article, ArticleCategory, ArticleContentType, ArticleStatus } from '../../../models/article.model';

@Component({
  selector: 'app-music-news',
  standalone: true,
  imports: [CommonModule, RouterModule, NewsBannerComponent],
  templateUrl: './music-news.component.html',
  styleUrl: './music-news.component.css'
})
export class MusicNewsComponent implements OnInit, OnDestroy, AfterViewInit {

  private readonly featuredContentService = inject(FeaturedContentService);
  private readonly articleService = inject(ArticleService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly el = inject(ElementRef);
  private readonly ngZone = inject(NgZone);

  featuredArticles: FeaturedContent[] = [];
  popularArticles: Article[] = [];
  blogArticles: Article[] = [];
  clipsArticles: Article[] = [];

  isLoading = true;

  // ───── קטגוריות ─────
  readonly categories = [
    { index: 0, label: 'ראשי' },
    { index: 1, label: 'פופולאריים' },
    { index: 2, label: 'תוכן' },
    { index: 3, label: 'קליפים' },
  ];

  activeCategory = 0;
  prevCategory = -1;
  isTransitioning = false;
  scrollDirection: 'down' | 'up' = 'down';
  labelVisible = true;

  // ───── הרחבה ─────
  expandedCategory: number | null = null;
  expandedClosing = false;

  private lastSwitchTime = 0;
  private touchStartY = 0;
  private wheelHandler?: (e: WheelEvent) => void;

  ngOnInit(): void {
    this.loadAllContent();
  }

  ngAfterViewInit(): void {
    this.wheelHandler = (e: WheelEvent) => {
      // כשה-overlay פתוח — לא לחסום גלילה רגילה
      if (this.expandedCategory !== null) return;
      e.preventDefault();

      // בדיקות ריצה מחוץ ל-zone לתגובה מיידית
      if (this.isTransitioning) return;
      const now = Date.now();
      if (now - this.lastSwitchTime < 900) return;

      // עדכון timestamp לפני zone כדי לחסום את האירוע הבא מיד
      this.lastSwitchTime = now;

      this.ngZone.run(() => {
        if (e.deltaY > 0) this.goToNext();
        else this.goToPrev();
      });
    };
    this.el.nativeElement.addEventListener('wheel', this.wheelHandler, { passive: false });
  }

  ngOnDestroy(): void {
    if (this.wheelHandler) {
      this.el.nativeElement.removeEventListener('wheel', this.wheelHandler);
    }
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent): void {
    this.touchStartY = e.touches[0].clientY;
  }

  @HostListener('touchend', ['$event'])
  onTouchEnd(e: TouchEvent): void {
    if (this.expandedCategory !== null) return;
    const delta = this.touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(delta) < 60) return;
    if (delta > 0) this.goToNext();
    else this.goToPrev();
  }

  goToNext(): void {
    if (this.activeCategory < this.categories.length - 1) {
      this.switchTo(this.activeCategory + 1, 'down');
    }
  }

  goToPrev(): void {
    if (this.activeCategory > 0) {
      this.switchTo(this.activeCategory - 1, 'up');
    }
  }

  switchTo(index: number, direction: 'down' | 'up'): void {
    if (this.isTransitioning || index === this.activeCategory) return;
    this.scrollDirection = direction;
    this.prevCategory = this.activeCategory;
    this.activeCategory = index;
    this.isTransitioning = true;
    this.labelVisible = false;
    setTimeout(() => { this.labelVisible = true; }, 300);
    setTimeout(() => {
      this.ngZone.run(() => {
        this.isTransitioning = false;
        this.prevCategory = -1;
      });
    }, 650);
  }

  isGridVisible(index: number): boolean {
    return this.activeCategory === index || this.prevCategory === index;
  }

  getGridClasses(index: number): Record<string, boolean> {
    const isActive = this.activeCategory === index;
    const isPrev = this.prevCategory === index;
    const dir = this.scrollDirection;
    return {
      'grid-visible':        isActive && !this.isTransitioning,
      'grid-enter-bottom':   isActive && this.isTransitioning && dir === 'down',
      'grid-enter-top':      isActive && this.isTransitioning && dir === 'up',
      'grid-exit-top':       isPrev   && this.isTransitioning && dir === 'down',
      'grid-exit-bottom':    isPrev   && this.isTransitioning && dir === 'up',
    };
  }

  // ───── הרחבה ─────

  expandCategory(index: number): void {
    this.expandedCategory = index;
    this.expandedClosing = false;
  }

  collapseCategory(): void {
    this.expandedClosing = true;
    setTimeout(() => {
      this.ngZone.run(() => {
        this.expandedCategory = null;
        this.expandedClosing = false;
      });
    }, 380);
  }

  collapseAndNext(): void {
    if (this.expandedCategory === null) return;
    const next = this.expandedCategory + 1;
    this.expandedClosing = true;
    setTimeout(() => {
      this.ngZone.run(() => {
        this.expandedCategory = null;
        this.expandedClosing = false;
        if (next < this.categories.length) {
          this.switchTo(next, 'down');
        }
      });
    }, 380);
  }

  // ───── טעינת נתונים ─────

  private loadAllContent(): void {
    this.isLoading = true;
    Promise.all([
      this.loadFeaturedContent(),
      this.loadPopularArticles(),
      this.loadBlogContent(),
      this.loadClips(),
    ]).then(() => {
      this.isLoading = false;
    }).catch(() => {
      this.isLoading = false;
    });
  }

  private loadFeaturedContent(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.featuredContentService.getActiveFeaturedContent()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (content) => {
            this.featuredArticles = content.sort((a, b) => a.displayOrder - b.displayOrder);
            resolve();
          },
          error: (err) => { console.error(err); reject(err); }
        });
    });
  }

  private loadPopularArticles(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.articleService.getArticles(1, 10, undefined, ArticleCategory.Popular, undefined, ArticleStatus.Published)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (result) => {
            this.popularArticles = result.items.sort((a, b) =>
              new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
            );
            resolve();
          },
          error: (err) => { console.error(err); reject(err); }
        });
    });
  }

  private loadBlogContent(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.articleService.getArticles(1, 10, undefined, undefined, ArticleContentType.Blog, ArticleStatus.Published)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (result) => { this.blogArticles = result.items; resolve(); },
          error: (err) => { console.error(err); reject(err); }
        });
    });
  }

  private loadClips(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.articleService.getArticles(1, 10, undefined, ArticleCategory.Clips, undefined, ArticleStatus.Published)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (result) => {
            this.clipsArticles = result.items.sort((a, b) =>
              new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
            );
            resolve();
          },
          error: (err) => { console.error(err); reject(err); }
        });
    });
  }
}
