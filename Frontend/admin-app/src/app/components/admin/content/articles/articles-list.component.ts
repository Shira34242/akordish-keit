import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ArticleService, UpdateArticleCategoriesDto } from '../../../../services/admin/article.service';
import { SystemTablesService, SystemItem } from '../../../../services/system-tables.service';
import { Article, ArticleCategory, ArticleContentType, ArticleStatus } from '../../../../models/article.model';
import { PagedResult } from '../../../../models/pagination.model';
import { SiteAlertService } from '../../../../services/site-alert.service';
import { FeaturedContentManagementComponent } from '../featured-content/featured-content-management.component';


@Component({
  selector: 'app-articles-list',
  standalone: true,
  imports: [CommonModule, FormsModule, FeaturedContentManagementComponent],
  templateUrl: './articles-list.component.html',
  styleUrls: ['./articles-list.component.css']
})
export class ArticlesListComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly articleService = inject(ArticleService);
  private readonly router = inject(Router);
  private readonly systemTablesService = inject(SystemTablesService);

  // State
  articles: Article[] = [];
  categories: SystemItem[] = [];
  loading = false;
  publishingArticleIds = new Set<number>();
  selectedArticleIds = new Set<number>();
  categoryModalOpen = false;
  categoryModalArticle: Article | null = null;
  categoryModalMode: UpdateArticleCategoriesDto['mode'] = 'add';
  categoryModalCategoryIds: number[] = [];
  bulkActionLoading = false;
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-articles-view') as 'list' | 'grid') || 'list';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-articles-view', mode); }
  activeTab: 'all' | 'news' | 'blog' | 'featured' = 'news';

  // Pagination
  currentPage = 1;
  pageSize = 25;
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
    const contentType = this.activeTab === 'all'
      ? undefined
      : this.activeTab === 'news'
        ? ArticleContentType.News
        : ArticleContentType.Blog;

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
        this.clearSelection();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading articles:', error);
        this.loading = false;
      }
    });
  }

  switchTab(tab: 'all' | 'news' | 'blog' | 'featured'): void {
    this.activeTab = tab;
    this.currentPage = 1;
    this.clearSelection();
    if (tab !== 'featured') {
      this.loadArticles();
    }
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

  get selectedCount(): number {
    return this.selectedArticleIds.size;
  }

  get selectedArticleIdsArray(): number[] {
    return Array.from(this.selectedArticleIds);
  }

  get allCurrentPageSelected(): boolean {
    return this.articles.length > 0 && this.articles.every(article => this.selectedArticleIds.has(article.id));
  }

  get hasSelection(): boolean {
    return this.selectedArticleIds.size > 0;
  }

  isSelected(articleId: number): boolean {
    return this.selectedArticleIds.has(articleId);
  }

  toggleArticleSelection(articleId: number, event?: Event): void {
    event?.stopPropagation();
    if (this.selectedArticleIds.has(articleId)) {
      this.selectedArticleIds.delete(articleId);
      return;
    }

    this.selectedArticleIds.add(articleId);
  }

  toggleSelectCurrentPage(): void {
    if (this.allCurrentPageSelected) {
      this.articles.forEach(article => this.selectedArticleIds.delete(article.id));
      return;
    }

    this.articles.forEach(article => this.selectedArticleIds.add(article.id));
  }

  clearSelection(): void {
    this.selectedArticleIds.clear();
  }

  openCategoryModal(article?: Article): void {
    this.categoryModalArticle = article ?? null;
    this.categoryModalMode = article ? 'replace' : 'add';
    this.categoryModalCategoryIds = article?.categoryIds ? [...article.categoryIds] : [];
    this.categoryModalOpen = true;
  }

  closeCategoryModal(): void {
    if (this.bulkActionLoading) {
      return;
    }

    this.categoryModalOpen = false;
    this.categoryModalArticle = null;
    this.categoryModalCategoryIds = [];
    this.categoryModalMode = 'add';
  }

  isModalCategorySelected(categoryId: number): boolean {
    return this.categoryModalCategoryIds.includes(categoryId);
  }

  toggleModalCategory(categoryId: number): void {
    if (this.isModalCategorySelected(categoryId)) {
      this.categoryModalCategoryIds = this.categoryModalCategoryIds.filter(id => id !== categoryId);
      return;
    }

    this.categoryModalCategoryIds = [...this.categoryModalCategoryIds, categoryId];
  }

  applyCategoryModal(): void {
    const articleIds = this.categoryModalArticle ? [this.categoryModalArticle.id] : this.selectedArticleIdsArray;
    if (articleIds.length === 0 || this.categoryModalCategoryIds.length === 0) {
      alert('בחר קטגוריה אחת לפחות');
      return;
    }

    this.bulkActionLoading = true;
    const payload: UpdateArticleCategoriesDto = {
      categoryIds: this.categoryModalCategoryIds,
      mode: this.categoryModalMode
    };

    const onSuccess = () => {
      alert('הקטגוריות עודכנו בהצלחה');
      this.bulkActionLoading = false;
      this.closeCategoryModal();
      this.loadArticles();
    };
    const onError = (error: any) => {
      console.error('Error updating article categories:', error);
      alert(error?.error?.message || 'שגיאה בעדכון הקטגוריות');
      this.bulkActionLoading = false;
    };

    if (this.categoryModalArticle) {
      this.articleService.updateArticleCategories(this.categoryModalArticle.id, payload).subscribe({
        next: onSuccess,
        error: onError
      });
      return;
    }

    this.articleService.bulkUpdateArticleCategories({ ...payload, articleIds }).subscribe({
      next: () => {
        onSuccess();
      },
      error: onError
    });
  }

  async bulkDeleteSelected(): Promise<void> {
    const ids = this.selectedArticleIdsArray;
    if (ids.length === 0) {
      return;
    }

    if (!(await this.siteAlerts.confirm(`למחוק ${ids.length} כתבות שנבחרו?`))) {
      return;
    }

    this.bulkActionLoading = true;
    this.articleService.bulkDeleteArticles({ articleIds: ids }).subscribe({
      next: () => {
        this.bulkActionLoading = false;
        this.loadArticles();
      },
      error: (error) => {
        console.error('Error deleting selected articles:', error);
        alert(error?.error?.message || 'שגיאה במחיקת הכתבות');
        this.bulkActionLoading = false;
      }
    });
  }

  async bulkDuplicateSelected(): Promise<void> {
    const ids = this.selectedArticleIdsArray;
    if (ids.length === 0) {
      return;
    }

    if (!(await this.siteAlerts.confirm(`לשכפל ${ids.length} כתבות שנבחרו?`))) {
      return;
    }

    this.bulkActionLoading = true;
    this.articleService.bulkDuplicateArticles({ articleIds: ids }).subscribe({
      next: (result) => {
        alert(`${result.affectedCount} כתבות שוכפלו בהצלחה`);
        this.bulkActionLoading = false;
        this.loadArticles();
      },
      error: (error) => {
        console.error('Error duplicating selected articles:', error);
        alert(error?.error?.message || 'שגיאה בשכפול הכתבות');
        this.bulkActionLoading = false;
      }
    });
  }

  async bulkStatusSelected(status: ArticleStatus): Promise<void> {
    const ids = this.selectedArticleIdsArray;
    if (ids.length === 0) {
      return;
    }

    const actionName = status === ArticleStatus.Published ? 'לפרסם' : 'להעביר לארכיון';
    if (!(await this.siteAlerts.confirm(`${actionName} ${ids.length} כתבות שנבחרו?`))) {
      return;
    }

    this.bulkActionLoading = true;
    this.articleService.bulkUpdateArticleStatus({ articleIds: ids, status }).subscribe({
      next: () => {
        this.bulkActionLoading = false;
        this.loadArticles();
      },
      error: (error) => {
        console.error('Error updating selected article status:', error);
        alert(error?.error?.message || 'שגיאה בעדכון הסטטוס');
        this.bulkActionLoading = false;
      }
    });
  }

  createNew(): void {
    const contentType = this.activeTab === 'blog' ? 'blog' : 'news';
    this.router.navigate(['/admin/content/articles/new'], {
      queryParams: { type: contentType }
    });
  }

  editArticle(id: number): void {
    this.router.navigate(['/admin/content/articles/edit', id]);
  }

  viewArticle(article: Article): void {
    const path = article.contentType === ArticleContentType.News ? 'news' : 'blog';
    this.router.navigate([path, article.slug]);
  }

  async publishArticle(article: Article): Promise<void> {
    if (article.status === ArticleStatus.Published || this.publishingArticleIds.has(article.id)) {
      return;
    }

    if (!article.categoryIds || article.categoryIds.length === 0) {
      alert('אי אפשר לפרסם כתבה בלי קטגוריה. פתחי עריכה ובחרי קטגוריה מתאימה.');
      return;
    }

    if (!(await this.siteAlerts.confirm(`לפרסם עכשיו את הכתבה "${article.title}"?`))) {
      return;
    }

    this.publishingArticleIds.add(article.id);
    this.articleService.updateArticleStatus(article.id, ArticleStatus.Published).subscribe({
      next: () => {
        alert('הכתבה פורסמה בהצלחה');
        this.publishingArticleIds.delete(article.id);
        this.loadArticles();
      },
      error: (error) => {
        console.error('Error publishing article:', error);
        alert(error?.error?.message || 'שגיאה בפרסום הכתבה');
        this.publishingArticleIds.delete(article.id);
      }
    });
  }


  async duplicateArticle(article: Article): Promise<void> {
    if (await this.siteAlerts.confirm(`האם לשכפל את הכתבה "${article.title}"?`)) {
      this.articleService.duplicateArticle(article.id).subscribe({
        next: (duplicate) => {
          alert(`הכתבה "${duplicate.title}" שוכפלה בהצלחה!`);
          this.loadArticles();
        },
        error: (err) => {
          console.error('שגיאה בשכפול כתבה:', err);
          alert('שגיאה בשכפול הכתבה');
        }
      });
    }
  }

  async deleteArticle(article: Article): Promise<void> {
    if (await this.siteAlerts.confirm(`האם אתה בטוח שברצונך למחוק את הכתבה "${article.title}"?`)) {
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
