import { Component, OnInit, OnDestroy, inject, DestroyRef, NgZone } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ArticleService } from '../../../services/admin/article.service';
import { Article, ArticleCategory, ArticleContentType, ArticleStatus } from '../../../models/article.model';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { LanguageService } from '../../../services/language.service';
import { SystemTablesService } from '../../../services/system-tables.service';
import { NewsPageSectionService } from '../../../services/news-page-section.service';

@Component({
  selector: 'app-articles-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NewsBannerComponent, TranslatePipe],
  templateUrl: './articles-list.component.html',
  styleUrl: './articles-list.component.css'
})
export class ArticlesListComponent implements OnInit, OnDestroy {
  private readonly articleService = inject(ArticleService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly langService = inject(LanguageService);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly newsPageSectionService = inject(NewsPageSectionService);
  private readonly ngZone = inject(NgZone);

  articles: Article[] = [];
  isLoading = true;
  currentPage = 1;
  pageSize = 20;
  totalCount = 0;
  totalPages = 0;

  // Filter parameters
  categoryId?: ArticleCategory;
  contentType?: ArticleContentType;
  categoryName = '';
  searchTerm = '';
  tagId?: number;
  tagName = '';
  sortMode: 'recent' | 'popular' | 'liked' | 'title' = 'recent';
  private visibleCategoryIds: number[] = [];
  isMobile = false;
  private mobileMql?: MediaQueryList;
  private mobileMqlHandler = (e: MediaQueryListEvent) => {
    this.ngZone.run(() => {
      this.isMobile = e.matches;
      this.invalidateCache();
    });
  };
  private cachedManagedRows: { slots: number[]; gridCols: string }[] | null = null;
  private cachedStreamRows: { articles: Article[]; gridCols: string }[] | null = null;
  readonly managedSlots = Array.from({ length: 5 }, (_, index) => index);

  get categories(): Array<{ id: ArticleCategory; key: string }> {
    return [
      { id: ArticleCategory.General, key: 'articles.cat_general' },
      { id: ArticleCategory.News, key: 'articles.cat_news' },
      { id: ArticleCategory.Reviews, key: 'articles.cat_reviews' },
      { id: ArticleCategory.Interviews, key: 'articles.cat_interviews' },
      { id: ArticleCategory.Features, key: 'articles.cat_features' },
      { id: ArticleCategory.LiveReports, key: 'articles.cat_live' },
      { id: ArticleCategory.AlbumReviews, key: 'articles.cat_album_reviews' },
      { id: ArticleCategory.MusicTech, key: 'articles.cat_music_tech' },
      { id: ArticleCategory.Education, key: 'articles.cat_education' },
      { id: ArticleCategory.Popular, key: 'articles.cat_popular' },
      { id: ArticleCategory.Clips, key: 'articles.cat_clips' },
      { id: ArticleCategory.Blog, key: 'articles.cat_blog' },
      { id: ArticleCategory.Opinion, key: 'articles.cat_opinion' },
      { id: ArticleCategory.Charts, key: 'articles.cat_charts' },
      { id: ArticleCategory.BehindTheScenes, key: 'articles.cat_behind' }
    ];
  }

  get contentTypes(): Array<{ id: ArticleContentType; key: string }> {
    return [
      { id: ArticleContentType.News, key: 'articles.type_news' },
      { id: ArticleContentType.Blog, key: 'articles.type_blog' }
    ];
  }

  ngOnInit(): void {
    this.mobileMql = window.matchMedia('(max-width: 640px)');
    this.isMobile = this.mobileMql.matches;
    this.mobileMql.addEventListener('change', this.mobileMqlHandler);

    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        // Reset filter state when query params change
        this.categoryId = undefined;
        this.categoryName = '';
        this.contentType = undefined;
        this.searchTerm = '';
        this.tagId = undefined;
        this.tagName = '';

        // Get category from query params
        if (params['category']) {
          this.categoryId = +params['category'];
          this.categoryName = this.getCategoryName(this.categoryId);
        }

        // Get content type from query params
        if (params['contentType']) {
          this.contentType = +params['contentType'];
        }

        // Get search term from query params
        if (params['search']) {
          this.searchTerm = params['search'];
        }

        // Get tag from query params
        if (params['tagId']) {
          this.tagId = +params['tagId'];
          this.tagName = params['tagName'] || '';
          if (!this.tagName) {
            this.loadTagName(this.tagId);
          }
        }

        // Get page from query params
        if (params['page']) {
          this.currentPage = +params['page'];
        } else {
          this.currentPage = 1;
        }

        this.loadVisibleCategorySettings();
      });
  }

  ngOnDestroy(): void {
    this.mobileMql?.removeEventListener('change', this.mobileMqlHandler);
  }

  private invalidateCache(): void {
    this.cachedManagedRows = null;
    this.cachedStreamRows = null;
  }

  private loadVisibleCategorySettings(): void {
    this.newsPageSectionService.getActiveSections()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sections) => {
          this.visibleCategoryIds = sections
            .filter(section => section.contentTypeId === ArticleContentType.Blog)
            .flatMap(section => section.categoryIds?.length ? section.categoryIds : section.categoryId ? [section.categoryId] : [])
            .filter((id, index, arr) => arr.indexOf(id) === index);

          this.loadArticles();
        },
        error: () => {
          this.visibleCategoryIds = [];
          this.loadArticles();
        }
      });
  }

  private loadTagName(tagId: number): void {
    this.systemTablesService.getTag(tagId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tag) => { this.tagName = tag?.name || `#${tagId}`; },
        error: () => { this.tagName = `#${tagId}`; }
      });
  }

  private loadArticles(): void {
    this.isLoading = true;

    const categoryIds = this.categoryId === undefined && this.tagId === undefined
      ? this.visibleCategoryIds
      : undefined;

    this.articleService.getArticles(
      this.currentPage,
      this.pageSize,
      this.searchTerm || undefined, // search
      this.categoryId,
      this.contentType,
      ArticleStatus.Published,
      undefined, // isFeatured
      undefined, // isPremium
      undefined, // authorName
      this.tagId,
      categoryIds
    ).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.articles = result.items;
          this.totalCount = result.totalCount;
          this.totalPages = result.totalPages;
          this.isLoading = false;
          this.invalidateCache();
        },
        error: (error) => {
          console.error('Error loading articles:', error);
          this.isLoading = false;
        }
      });
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackById(_index: number, article: Article): number {
    return article.id;
  }

  getManagedArticle(index: number): Article | null {
    return this.sortedArticles[index] ?? null;
  }

  getStreamArticles(): Article[] {
    return this.sortedArticles.slice(this.managedSlots.length);
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

  getStreamRows(): { articles: Article[]; gridCols: string }[] {
    if (this.cachedStreamRows) return this.cachedStreamRows;

    const articles = this.getStreamArticles();
    const rows: { articles: Article[]; gridCols: string }[] = [];
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

  get sortedArticles(): Article[] {
    const articles = [...this.articles];

    switch (this.sortMode) {
      case 'popular':
        return articles.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
      case 'liked':
        return articles.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
      case 'title':
        return articles.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'he'));
      case 'recent':
      default:
        return articles.sort((a, b) => this.getArticleDateValue(b) - this.getArticleDateValue(a));
    }
  }

  get hasActiveFilters(): boolean {
    return this.categoryId !== undefined ||
      this.contentType !== undefined ||
      !!this.searchTerm ||
      this.tagId !== undefined ||
      this.sortMode !== 'recent';
  }

  private getArticleDateValue(article: Article): number {
    return new Date(article.publishDate || article.createdAt || 0).getTime();
  }

  private getCategoryName(categoryId: ArticleCategory): string {
    const categoryKeys: { [key: number]: string } = {
      [ArticleCategory.General]: 'articles.cat_general',
      [ArticleCategory.News]: 'articles.cat_news',
      [ArticleCategory.Reviews]: 'articles.cat_reviews',
      [ArticleCategory.Interviews]: 'articles.cat_interviews',
      [ArticleCategory.Features]: 'articles.cat_features',
      [ArticleCategory.LiveReports]: 'articles.cat_live',
      [ArticleCategory.AlbumReviews]: 'articles.cat_album_reviews',
      [ArticleCategory.MusicTech]: 'articles.cat_music_tech',
      [ArticleCategory.Education]: 'articles.cat_education',
      [ArticleCategory.Popular]: 'articles.cat_popular',
      [ArticleCategory.Clips]: 'articles.cat_clips',
      [ArticleCategory.Blog]: 'articles.cat_blog',
      [ArticleCategory.Opinion]: 'articles.cat_opinion',
      [ArticleCategory.Charts]: 'articles.cat_charts',
      [ArticleCategory.BehindTheScenes]: 'articles.cat_behind'
    };

    const key = categoryKeys[categoryId];
    return key ? this.langService.translate(key) : this.langService.translate('articles.count_suffix');
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;

    const queryParams: any = { page };

    if (this.categoryId !== undefined) {
      queryParams.category = this.categoryId;
    }

    if (this.contentType !== undefined) {
      queryParams.contentType = this.contentType;
    }

    if (this.tagId !== undefined) {
      queryParams.tagId = this.tagId;
      if (this.tagName) queryParams.tagName = this.tagName;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;

    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  /**
   * Apply filters and reload articles
   */
  applyFilters(): void {
    this.currentPage = 1;
    const queryParams: any = { page: 1 };

    if (this.categoryId !== undefined) {
      queryParams.category = this.categoryId;
    }

    if (this.contentType !== undefined) {
      queryParams.contentType = this.contentType;
    }

    if (this.searchTerm) {
      queryParams.search = this.searchTerm;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: ''
    });
  }

  /**
   * Reset all filters
   */
  resetFilters(): void {
    this.categoryId = undefined;
    this.contentType = undefined;
    this.searchTerm = '';
    this.sortMode = 'recent';
    this.currentPage = 1;

    this.router.navigate(['/articles']);
  }
}
