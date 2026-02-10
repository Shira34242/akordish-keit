import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ArticleService } from '../../../services/admin/article.service';
import { Article, ArticleCategory, ArticleContentType, ArticleStatus } from '../../../models/article.model';

@Component({
  selector: 'app-articles-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './articles-list.component.html',
  styleUrl: './articles-list.component.css'
})
export class ArticlesListComponent implements OnInit {
  private readonly articleService = inject(ArticleService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

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

  // All available categories for dropdown
  categories = [
    { id: ArticleCategory.General, name: 'כללי' },
    { id: ArticleCategory.News, name: 'חדשות' },
    { id: ArticleCategory.Reviews, name: 'ביקורות' },
    { id: ArticleCategory.Interviews, name: 'ראיונות' },
    { id: ArticleCategory.Features, name: 'מאמרים' },
    { id: ArticleCategory.LiveReports, name: 'כיסויי הופעות' },
    { id: ArticleCategory.AlbumReviews, name: 'ביקורות אלבומים' },
    { id: ArticleCategory.MusicTech, name: 'טכנולוגיה מוזיקלית' },
    { id: ArticleCategory.Education, name: 'לימודי מוזיקה' },
    { id: ArticleCategory.Popular, name: 'פופולאריים' },
    { id: ArticleCategory.Clips, name: 'קליפים' },
    { id: ArticleCategory.Blog, name: 'בלוג' },
    { id: ArticleCategory.Opinion, name: 'דעה' },
    { id: ArticleCategory.Charts, name: 'מצעדים' },
    { id: ArticleCategory.BehindTheScenes, name: 'מאחורי הקלעים' }
  ];

  // Content types for dropdown
  contentTypes = [
    { id: ArticleContentType.News, name: 'חדשות' },
    { id: ArticleContentType.Blog, name: 'בלוג' }
  ];

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
    const categoryNames: { [key: number]: string } = {
      [ArticleCategory.General]: 'כללי',
      [ArticleCategory.News]: 'חדשות',
      [ArticleCategory.Reviews]: 'ביקורות',
      [ArticleCategory.Interviews]: 'ראיונות',
      [ArticleCategory.Features]: 'מאמרים',
      [ArticleCategory.LiveReports]: 'כיסויי הופעות',
      [ArticleCategory.AlbumReviews]: 'ביקורות אלבומים',
      [ArticleCategory.MusicTech]: 'טכנולוגיה מוזיקלית',
      [ArticleCategory.Education]: 'לימודי מוזיקה',
      [ArticleCategory.Popular]: 'פופולאריים',
      [ArticleCategory.Clips]: 'קליפים',
      [ArticleCategory.Blog]: 'בלוג',
      [ArticleCategory.Opinion]: 'דעה',
      [ArticleCategory.Charts]: 'מצעדים',
      [ArticleCategory.BehindTheScenes]: 'מאחורי הקלעים'
    };

    return categoryNames[categoryId] || 'כתבות';
  }

  navigateToArticle(article: Article): void {
    const route = article.contentType === ArticleContentType.News ? '/news' : '/blog';
    this.router.navigate([route, article.slug]);
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
