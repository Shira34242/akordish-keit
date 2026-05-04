import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ArticleService } from '../../../services/admin/article.service';
import { Article, ArticleCategory, ArticleContentType, ArticleStatus } from '../../../models/article.model';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';
import { TranslatePipe } from '../../../pipes/translate.pipe';
import { LanguageService } from '../../../services/language.service';

@Component({
  selector: 'app-articles-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, NewsBannerComponent, TranslatePipe],
  templateUrl: './articles-list.component.html',
  styleUrl: './articles-list.component.css'
})
export class ArticlesListComponent implements OnInit {
  private readonly articleService = inject(ArticleService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly langService = inject(LanguageService);

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
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
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

        // Get page from query params
        if (params['page']) {
          this.currentPage = +params['page'];
        }

        this.loadArticles();
      });
  }

  private loadArticles(): void {
    this.isLoading = true;

    this.articleService.getArticles(
      this.currentPage,
      this.pageSize,
      this.searchTerm || undefined, // search
      this.categoryId,
      this.contentType,
      ArticleStatus.Published,
      undefined, // isFeatured
      undefined, // isPremium
      undefined  // authorName
    ).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.articles = result.items;
          this.totalCount = result.totalCount;
          this.totalPages = result.totalPages;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading articles:', error);
          this.isLoading = false;
        }
      });
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

  navigateToArticle(article: Article): void {
    const route = article.contentType === ArticleContentType.News ? '/news' : '/blog';
    this.router.navigate([route, article.slug]);
  }

  getCellClass(index: number): string {
    if (index === 0) {
      return 'sc-feature-main';
    }

    if (index === 1) {
      return 'sc-feature-side';
    }

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

    return patterns[(index - 2) % patterns.length];
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
    this.currentPage = 1;

    this.router.navigate(['/articles']);
  }
}
