import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ArticleService } from '../../../../services/admin/article.service';
import { SystemTablesService, SystemItem } from '../../../../services/system-tables.service';
import { Article, ArticleCategory, ArticleContentType, ArticleStatus } from '../../../../models/article.model';
import { PagedResult } from '../../../../models/pagination.model';

@Component({
  selector: 'app-articles-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './articles-list.component.html',
  styleUrls: ['./articles-list.component.css']
})
export class ArticlesListComponent implements OnInit {
  private readonly articleService = inject(ArticleService);
  private readonly router = inject(Router);
  private readonly systemTablesService = inject(SystemTablesService);

  // State
  articles: Article[] = [];
  categories: SystemItem[] = [];
  loading = false;
  activeTab: 'news' | 'blog' = 'news';

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 0;

  // Filters
  searchTerm = '';
  selectedCategory?: number;
  selectedStatus?: ArticleStatus;
  showFeaturedOnly = false;

  // Enums for template
  ArticleCategory = ArticleCategory;
  ArticleStatus = ArticleStatus;
  ArticleContentType = ArticleContentType;

  ngOnInit(): void {
    this.loadCategories();
    this.loadArticles();
  }

  loadCategories(): void {
    this.systemTablesService.getItems('article-categories', 1, 100).subscribe({
      next: (result) => this.categories = result.items,
      error: (err) => console.error('Error loading categories', err)
    });
  }

  loadArticles(): void {
    this.loading = true;
    const contentType = this.activeTab === 'news' ? ArticleContentType.News : ArticleContentType.Blog;

    this.articleService.getArticles(
      this.currentPage,
      this.pageSize,
      this.searchTerm || undefined,
      this.selectedCategory, // This variable name might be confusing now, it holds ID
      contentType,
      this.selectedStatus,
      this.showFeaturedOnly ? true : undefined
    ).subscribe({
      next: (result: PagedResult<Article>) => {
        this.articles = result.items;
        this.totalItems = result.totalCount;
        this.totalPages = result.totalPages;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading articles:', error);
        this.loading = false;
      }
    });
  }

  switchTab(tab: 'news' | 'blog'): void {
    this.activeTab = tab;
    this.currentPage = 1;
    this.loadArticles();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadArticles();
  }

  onCategoryFilter(category?: number): void {
    this.selectedCategory = category;
    this.currentPage = 1;
    this.loadArticles();
  }

  onStatusFilter(status?: ArticleStatus): void {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.loadArticles();
  }

  toggleFeaturedFilter(): void {
    this.showFeaturedOnly = !this.showFeaturedOnly;
    this.currentPage = 1;
    this.loadArticles();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = undefined;
    this.selectedStatus = undefined;
    this.showFeaturedOnly = false;
    this.currentPage = 1;
    this.loadArticles();
  }

  createNew(): void {
    const contentType = this.activeTab === 'news' ? 'news' : 'blog';
    this.router.navigate(['/admin/content/articles/new'], {
      queryParams: { type: contentType }
    });
  }

  editArticle(id: number): void {
    this.router.navigate(['/admin/content/articles/edit', id]);
  }

  viewArticle(article: Article): void {
    // Navigate to appropriate view based on content type
    const path = article.contentType === ArticleContentType.News ? '/news' : '/blog';
    this.router.navigate([path, article.slug]);
  }


  deleteArticle(article: Article): void {
    if (confirm(`האם אתה בטוח שברצונך למחוק את הכתבה "${article.title}"?`)) {
      this.articleService.deleteArticle(article.id).subscribe({
        next: () => {
          this.loadArticles();
        },
        error: (error) => {
          console.error('Error deleting article:', error);
          alert('שגיאה במחיקת הכתבה');
        }
      });
    }
  }



  getStatusName(status: ArticleStatus): string {
    const names: Record<ArticleStatus, string> = {
      [ArticleStatus.Draft]: 'טיוטה',
      [ArticleStatus.Published]: 'מפורסם',
      [ArticleStatus.Scheduled]: 'מתוזמן',
      [ArticleStatus.Archived]: 'ארכיון'
    };
    return names[status] || 'לא ידוע';
  }

  getStatusClass(status: ArticleStatus): string {
    const classes: Record<ArticleStatus, string> = {
      [ArticleStatus.Draft]: 'status-draft',
      [ArticleStatus.Published]: 'status-published',
      [ArticleStatus.Scheduled]: 'status-scheduled',
      [ArticleStatus.Archived]: 'status-archived'
    };
    return classes[status] || '';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Pagination methods
  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadArticles();
    }
  }

  get pages(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    const halfWindow = Math.floor(maxPagesToShow / 2);

    let startPage = Math.max(1, this.currentPage - halfWindow);
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  // Expose Math to template
  readonly Math = Math;
}
