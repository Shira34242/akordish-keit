import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ArticleNewsCleanupSettingsDto,
  ArticleService,
  UpdateArticleArtistsDto,
  UpdateArticleCategoriesDto
} from '../../../../services/admin/article.service';
import { SystemTablesService, SystemItem } from '../../../../services/system-tables.service';
import { ArtistService } from '../../../../services/artist.service';
import { UserService } from '../../../../services/user.service';
import { Article, ArticleCategory, ArticleContentType, ArticleStatus } from '../../../../models/article.model';
import { PagedResult } from '../../../../models/pagination.model';
import { SiteAlertService } from '../../../../services/site-alert.service';
import { FeaturedContentManagementComponent } from '../featured-content/featured-content-management.component';
import { NewsPageSectionsMangementComponent } from '../news-page-sections/news-page-sections-management.component';
import { ArtistListDto } from '../../../../models/artist.model';
import { UserWithProfileDto } from '../../../../models/user.model';
import { BumpModalComponent } from '../../../shared/bump-modal/bump-modal.component';
import { getArticleLink } from '../../../../utils/article-route.utils';

@Component({
  selector: 'app-articles-list',
  standalone: true,
  imports: [CommonModule, FormsModule, FeaturedContentManagementComponent, NewsPageSectionsMangementComponent, BumpModalComponent],
  templateUrl: './articles-list.component.html',
  styleUrls: ['./articles-list.component.css']
})
export class ArticlesListComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly articleService = inject(ArticleService);
  private readonly router = inject(Router);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly artistService = inject(ArtistService);
  private readonly userService = inject(UserService);

  // State
  articles: Article[] = [];
  categories: SystemItem[] = [];
  artists: ArtistListDto[] = [];
  loading = false;
  publishingArticleIds = new Set<number>();
  selectedArticleIds = new Set<number>();
  bumpModalOpen = false;
  categoryModalOpen = false;
  categoryModalArticle: Article | null = null;
  categoryModalMode: UpdateArticleCategoriesDto['mode'] = 'add';
  categoryModalCategoryIds: number[] = [];
  artistModalOpen = false;
  artistModalArticle: Article | null = null;
  artistModalMode: UpdateArticleArtistsDto['mode'] = 'add';
  artistModalArtistIds: number[] = [];
  artistsExpanded = false;
  uploaderModalOpen = false;
  uploaderModalArticle: Article | null = null;
  uploaderProfileSearchQuery = '';
  uploaderProfileSearchResults: UserWithProfileDto[] = [];
  uploaderProfileSearchLoading = false;
  uploaderProfileTypeFilter: 'all' | 'artist' | 'teacher' | 'serviceProvider' | 'user' = 'all';
  selectedUploaderProfile: UserWithProfileDto | null = null;
  bulkActionLoading = false;
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-articles-view-v2') as 'list' | 'grid') || 'grid';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-articles-view-v2', mode); }
  activeTab: 'all' | 'news' | 'blog' | 'featured' | 'sections' | 'cleanup' = 'all';
  cleanupSettings: ArticleNewsCleanupSettingsDto = {
    autoDeleteEnabled: false,
    retentionDays: 365,
    lastRunAt: null
  };
  cleanupSettingsDraft = { autoDeleteEnabled: false, retentionDays: 365 };
  manualCleanupDays = 365;
  cleanupLoading = false;
  cleanupSettingsLoading = false;

  // Pagination
  currentPage = 1;
  pageSize = 25;
  totalItems = 0;
  totalPages = 0;

  // Filters
  searchTerm = '';
  selectedCategory?: number;
  selectedStatus?: ArticleStatus;
  selectedArtistId?: number;
  uploaderSearch = '';
  dateFrom = '';
  dateTo = '';
  sortBy = 'date';
  showFeaturedOnly = false;

  // Enums for template
  ArticleCategory = ArticleCategory;
  ArticleStatus = ArticleStatus;
  ArticleContentType = ArticleContentType;

  ngOnInit(): void {
    this.loadCategories();
    this.loadArtists();
    this.loadArticles();
  }

  loadCategories(): void {
    this.systemTablesService.getItems('article-categories', 1, 100).subscribe({
      next: (result) => this.categories = result.items,
      error: (err) => console.error('Error loading categories', err)
    });
  }

  loadArtists(): void {
    this.artistService.getArtists(undefined, undefined, 1, 200, 'name').subscribe({
      next: (result) => this.artists = result.items,
      error: (err) => console.error('Error loading artists', err)
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
      this.showFeaturedOnly ? true : undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      this.selectedArtistId,
      this.uploaderSearch || undefined,
      this.dateFrom || undefined,
      this.dateTo || undefined,
      this.sortBy
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

  switchTab(tab: 'all' | 'news' | 'blog' | 'featured' | 'sections' | 'cleanup'): void {
    this.activeTab = tab;
    this.currentPage = 1;
    this.clearSelection();
    if (this.isArticleListTab) {
      this.loadArticles();
    }
  }

  get isArticleListTab(): boolean {
    return this.activeTab !== 'featured' && this.activeTab !== 'sections' && this.activeTab !== 'cleanup';
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

  onFilterChange(): void {
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
    this.selectedStatus = undefined;
    this.selectedArtistId = undefined;
    this.uploaderSearch = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.sortBy = 'date';
    this.showFeaturedOnly = false;
    this.currentPage = 1;
    this.loadArticles();
  }

  get hasActiveFilters(): boolean {
    return !!(
      this.searchTerm ||
      this.selectedStatus !== undefined ||
      this.selectedArtistId !== undefined ||
      this.dateFrom ||
      this.dateTo ||
      this.sortBy !== 'date' ||
      this.showFeaturedOnly
    );
  }

  loadCleanupSettings(): void {
    this.cleanupSettingsLoading = true;
    this.articleService.getNewsCleanupSettings().subscribe({
      next: (settings) => {
        this.cleanupSettings = settings;
        this.cleanupSettingsDraft = {
          autoDeleteEnabled: settings.autoDeleteEnabled,
          retentionDays: settings.retentionDays
        };
        this.manualCleanupDays = settings.retentionDays || this.manualCleanupDays;
        this.cleanupSettingsLoading = false;
      },
      error: (error) => {
        console.error('Error loading news cleanup settings:', error);
        this.cleanupSettingsLoading = false;
      }
    });
  }

  saveCleanupSettings(): void {
    this.cleanupLoading = true;
    this.articleService.updateNewsCleanupSettings({
      autoDeleteEnabled: this.cleanupSettingsDraft.autoDeleteEnabled,
      retentionDays: this.cleanupSettingsDraft.retentionDays
    }).subscribe({
      next: (settings) => {
        this.cleanupSettings = settings;
        this.cleanupSettingsDraft = {
          autoDeleteEnabled: settings.autoDeleteEnabled,
          retentionDays: settings.retentionDays
        };
        this.manualCleanupDays = settings.retentionDays;
        this.cleanupLoading = false;
        alert('הגדרות הניקוי נשמרו בהצלחה');
      },
      error: (error) => {
        console.error('Error saving news cleanup settings:', error);
        alert(error?.error?.message || 'שגיאה בשמירת הגדרות הניקוי');
        this.cleanupLoading = false;
      }
    });
  }

  async runManualCleanup(): Promise<void> {
    const days = this.manualCleanupDays;
    if (!days || days < 30) {
      alert('בחר לפחות 30 ימים כדי למנוע מחיקה רחבה מדי');
      return;
    }

    if (!(await this.siteAlerts.confirm(`למחוק חדשות מוזיקה שפורסמו לפני יותר מ-${days} ימים?`))) {
      return;
    }

    this.cleanupLoading = true;
    this.articleService.cleanupOldNews({ olderThanDays: days }).subscribe({
      next: (result) => {
        this.cleanupLoading = false;
        this.loadCleanupSettings();
        this.loadArticles();
        alert(`נמחקו ${result.deletedCount} כתבות חדשות ישנות`);
      },
      error: (error) => {
        console.error('Error cleaning old news:', error);
        alert(error?.error?.message || 'שגיאה במחיקת חדשות ישנות');
        this.cleanupLoading = false;
      }
    });
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

  selectAllCurrentPage(): void {
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

  openArtistModal(article?: Article): void {
    this.artistModalArticle = article ?? null;
    this.artistModalMode = article ? 'replace' : 'add';
    this.artistModalArtistIds = article?.taggedArtists?.map(artist => artist.artistId) ?? [];
    this.artistsExpanded = false;
    this.artistModalOpen = true;
  }

  closeArtistModal(): void {
    if (this.bulkActionLoading) {
      return;
    }

    this.artistModalOpen = false;
    this.artistModalArticle = null;
    this.artistModalArtistIds = [];
    this.artistModalMode = 'add';
    this.artistsExpanded = false;
  }

  isModalArtistSelected(artistId: number): boolean {
    return this.artistModalArtistIds.includes(artistId);
  }

  toggleModalArtist(artistId: number): void {
    if (this.isModalArtistSelected(artistId)) {
      this.artistModalArtistIds = this.artistModalArtistIds.filter(id => id !== artistId);
      return;
    }

    this.artistModalArtistIds = [...this.artistModalArtistIds, artistId];
  }

  get visibleModalArtists(): ArtistListDto[] {
    return this.artistsExpanded ? this.artists : this.artists.slice(0, 24);
  }

  get hasMoreModalArtists(): boolean {
    return this.artists.length > 24;
  }

  applyArtistModal(): void {
    const articleIds = this.artistModalArticle ? [this.artistModalArticle.id] : this.selectedArticleIdsArray;
    if (articleIds.length === 0 || this.artistModalArtistIds.length === 0) {
      alert('בחר אמן אחד לפחות');
      return;
    }

    this.bulkActionLoading = true;
    const payload: UpdateArticleArtistsDto = {
      artistIds: this.artistModalArtistIds,
      mode: this.artistModalMode
    };

    const onSuccess = () => {
      alert('האומנים עודכנו בהצלחה');
      this.bulkActionLoading = false;
      this.closeArtistModal();
      this.loadArticles();
    };
    const onError = (error: any) => {
      console.error('Error updating article artists:', error);
      alert(error?.error?.message || 'שגיאה בעדכון האומנים');
      this.bulkActionLoading = false;
    };

    if (this.artistModalArticle) {
      this.articleService.updateArticleArtists(this.artistModalArticle.id, payload).subscribe({
        next: onSuccess,
        error: onError
      });
      return;
    }

    this.articleService.bulkUpdateArticleArtists({ ...payload, articleIds }).subscribe({
      next: onSuccess,
      error: onError
    });
  }

  openUploaderModal(article?: Article): void {
    this.uploaderModalArticle = article ?? null;
    this.selectedUploaderProfile = null;
    this.uploaderProfileSearchQuery = '';
    this.uploaderProfileSearchResults = [];
    this.uploaderProfileTypeFilter = 'all';
    this.uploaderModalOpen = true;
    this.loadUploaderProfileResults();
  }

  closeUploaderModal(): void {
    if (this.bulkActionLoading) {
      return;
    }

    this.uploaderModalOpen = false;
    this.uploaderModalArticle = null;
    this.selectedUploaderProfile = null;
    this.uploaderProfileSearchQuery = '';
    this.uploaderProfileSearchResults = [];
    this.uploaderProfileSearchLoading = false;
  }

  loadUploaderProfileResults(): void {
    this.uploaderProfileSearchLoading = true;
    this.userService.searchUsersWithProfiles(
      this.uploaderProfileSearchQuery,
      60,
      this.uploaderProfileTypeFilter
    ).subscribe({
      next: (results) => {
        this.uploaderProfileSearchResults = [...results].sort((a, b) =>
          a.displayName.localeCompare(b.displayName, 'he')
        );
        this.uploaderProfileSearchLoading = false;
      },
      error: (error) => {
        console.error('Error loading uploader profiles:', error);
        this.uploaderProfileSearchLoading = false;
      }
    });
  }

  selectUploaderProfile(profile: UserWithProfileDto): void {
    this.selectedUploaderProfile = profile;
    this.uploaderProfileSearchQuery = profile.displayName;
  }

  clearSelectedUploaderProfile(): void {
    this.selectedUploaderProfile = null;
    this.uploaderProfileSearchQuery = '';
    this.loadUploaderProfileResults();
  }

  applyUploaderModal(): void {
    const articleIds = this.uploaderModalArticle ? [this.uploaderModalArticle.id] : this.selectedArticleIdsArray;
    if (articleIds.length === 0 || !this.selectedUploaderProfile) {
      alert('בחר משתמש או פרופיל לשיוך');
      return;
    }

    const profile = this.selectedUploaderProfile;
    this.bulkActionLoading = true;

    const payload = {
      uploaderUserId: profile.userId ?? undefined,
      uploaderProfileType: profile.profileType === 'user' || profile.profileType === 'agency' ? undefined : profile.profileType,
      uploaderProfileId: profile.profileType === 'user' || profile.profileType === 'agency' ? undefined : profile.profileId
    };

    const onSuccess = () => {
      alert('השיוך עודכן בהצלחה');
      this.bulkActionLoading = false;
      this.closeUploaderModal();
      this.loadArticles();
    };
    const onError = (error: any) => {
      console.error('Error updating article uploader:', error);
      alert(error?.error?.message || 'שגיאה בעדכון השיוך');
      this.bulkActionLoading = false;
    };

    if (this.uploaderModalArticle) {
      this.articleService.updateArticleUploader(this.uploaderModalArticle.id, payload).subscribe({
        next: onSuccess,
        error: onError
      });
      return;
    }

    this.articleService.bulkUpdateArticleUploader({ ...payload, articleIds }).subscribe({
      next: onSuccess,
      error: onError
    });
  }

  getProfileTypeLabel(profile: UserWithProfileDto): string {
    if (profile.profileType === 'artist') return 'אמן';
    if (profile.profileType === 'user') return 'משתמש';
    return profile.isTeacher ? 'מורה' : 'בעל מקצוע';
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
    const selectedCategory = this.categories.find(category => category.id === this.selectedCategory);
    const contentType = selectedCategory
      ? (Number(selectedCategory['section']) === 1 ? 'blog' : 'news')
      : this.activeTab === 'blog' ? 'blog' : 'news';
    const queryParams: Record<string, string | number> = { type: contentType };
    if (this.selectedCategory !== undefined) {
      queryParams['categoryId'] = this.selectedCategory;
    }

    this.router.navigate(['/admin/content/articles/new'], {
      queryParams
    });
  }

  editArticle(id: number): void {
    this.router.navigate(['/admin/content/articles/edit', id]);
  }

  viewArticle(article: Article): void {
    this.router.navigate(getArticleLink(article));
  }

  changeArticleStatus(article: Article, statusValue: string | number): void {
    const status = Number(statusValue) as ArticleStatus;
    if (article.status === status || this.publishingArticleIds.has(article.id)) {
      return;
    }

    this.publishingArticleIds.add(article.id);
    this.articleService.updateArticleStatus(article.id, status).subscribe({
      next: (updated) => {
        article.status = updated.status;
        this.publishingArticleIds.delete(article.id);
      },
      error: (error) => {
        console.error('Error updating article status:', error);
        alert(error?.error?.message || 'שגיאה בעדכון הסטטוס');
        this.publishingArticleIds.delete(article.id);
      }
    });
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

  openBumpModal(): void {
    this.bumpModalOpen = true;
  }

  onBumped(): void {
    this.bumpModalOpen = false;
    this.clearSelection();
    this.loadArticles();
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
