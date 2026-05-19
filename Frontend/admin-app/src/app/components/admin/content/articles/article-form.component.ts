import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { FileUploadInputComponent } from '../../../shared/file-upload-input/file-upload-input.component';
import { ArticleService } from '../../../../services/admin/article.service';
import { SystemTablesService, SystemItem } from '../../../../services/system-tables.service';
import { ArtistService } from '../../../../services/artist.service';
import { UserService } from '../../../../services/user.service';
import { AuthService } from '../../../../services/auth.service';
import { ArtistListDto } from '../../../../models/artist.model';
import { UserWithProfileDto } from '../../../../models/user.model';
import { SiteAlertService } from '../../../../services/site-alert.service';

import {
  Article,
  CreateArticleDto,
  ArticleCategory,
  ArticleContentType,
  ArticleStatus
} from '../../../../models/article.model';

interface CategoryWithSection extends SystemItem {
  section?: number; // 0 = News, 1 = Content
}

interface SelectedTag {
  id: number;
  name: string;
}

@Component({
  selector: 'app-article-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadInputComponent],
  templateUrl: './article-form.component.html',
  styleUrls: ['./article-form.component.css']
})
export class ArticleFormComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly articleService = inject(ArticleService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly artistService = inject(ArtistService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);

  // State
  categories: CategoryWithSection[] = [];
  artists: ArtistListDto[] = [];

  // Tag state
  selectedTags: SelectedTag[] = [];
  popularTags: SelectedTag[] = [];
  tagSearchQuery = '';
  tagSearchResults: SelectedTag[] = [];
  showTagDropdown = false;
  private tagSearch$ = new Subject<string>();
  isEditMode = false;
  articleId?: number;
  loading = false;
  saving = false;
  saveError = '';
  fetchingYouTube = false;
  youtubeMessage = '';

  // Uploader profile search state
  profileSearchQuery = '';
  profileSearchResults: UserWithProfileDto[] = [];
  profileSearchLoading = false;
  selectedProfile: UserWithProfileDto | null = null;
  myUploaderProfiles: UserWithProfileDto[] = [];
  profileTypeFilter: 'none' | 'all' | 'artist' | 'teacher' | 'serviceProvider' | 'user' = 'none';
  profileSort: 'name' | 'type' = 'name';
  showProfileDropdown = false;
  tagAsMyself = true;
  private profileSearch$ = new Subject<string>();

  get isAdminUser(): boolean {
    return this.authService.isAdminOrManager();
  }

  get isProfessionalNonAdmin(): boolean {
    return (this.authService.currentUserValue?.hasProfessionalProfile ?? false) && !this.isAdminUser;
  }

  get filteredProfileSearchResults(): UserWithProfileDto[] {
    if (this.profileTypeFilter === 'none') return [];

    const filtered = this.profileSearchResults.filter(profile => {
      if (this.profileTypeFilter === 'all') return true;
      if (this.profileTypeFilter === 'user') return profile.profileType === 'user';
      if (this.profileTypeFilter === 'teacher') return profile.profileType === 'serviceProvider' && profile.isTeacher;
      if (this.profileTypeFilter === 'serviceProvider') return profile.profileType === 'serviceProvider' && !profile.isTeacher;
      return profile.profileType === this.profileTypeFilter;
    });

    return [...filtered].sort((a, b) => {
      if (this.profileSort === 'type') {
        const typeCompare = this.getProfileTypeLabel(a.profileType, a.isTeacher)
          .localeCompare(this.getProfileTypeLabel(b.profileType, b.isTeacher), 'he');
        if (typeCompare !== 0) return typeCompare;
      }

      return a.displayName.localeCompare(b.displayName, 'he');
    });
  }

  // Gallery state
  newGalleryImage = { imageUrl: '', caption: '' };

  // Artists collapse state
  artistsExpanded = false;

  // Enums for template
  ArticleCategory = ArticleCategory;
  ArticleStatus = ArticleStatus;
  ArticleContentType = ArticleContentType;

  // Form model
  article: CreateArticleDto = {
    title: '',
    subtitle: '',
    content: '',
    featuredImageUrl: '',
    authorName: '',
    categoryIds: [], // Default to empty array
    contentType: ArticleContentType.News,
    slug: '',
    canonicalUrl: '',
    videoEmbedUrl: '',
    audioEmbedUrl: '',
    imageCredit: '',
    shortDescription: '',
    isFeatured: false,
    displayOrder: 0,
    status: ArticleStatus.Draft,
    scheduledDate: undefined,
    isPremium: false,
    metaTitle: '',
    metaDescription: '',
    openGraphImageUrl: '',
    readTimeMinutes: undefined,
    tagIds: [],
    galleryImages: [],
    artistIds: []
  };

  ngOnInit(): void {
    this.loadCategories();
    this.loadArtists();
    this.loadPopularTags();
    this.initProfileSearch();
    this.initTagSearch();

    // Check if we're in edit mode
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.articleId = +params['id'];
        this.loadArticle();
      } else {
        this.isEditMode = false;
        this.articleId = undefined;
        this.article = this.createEmptyArticle(this.article.contentType);
        this.selectedProfile = null;
        this.profileSearchQuery = '';
        this.selectedTags = [];
        this.tagSearchQuery = '';
        this.artistsExpanded = false;
        this.newGalleryImage = { imageUrl: '', caption: '' };
        this.initializeUploaderSelector();
      }
    });

    // Check query params for content type (when creating new)
    this.route.queryParams.subscribe(params => {
      if (params['type'] === 'blog') {
        this.article.contentType = ArticleContentType.Blog;
      }
    });
  }

  private createEmptyArticle(contentType: ArticleContentType): CreateArticleDto {
    return {
      title: '',
      subtitle: '',
      content: '',
      featuredImageUrl: '',
      authorName: '',
      categoryIds: [],
      contentType,
      slug: '',
      canonicalUrl: '',
      videoEmbedUrl: '',
      audioEmbedUrl: '',
      imageCredit: '',
      shortDescription: '',
      isFeatured: false,
      displayOrder: 0,
      status: ArticleStatus.Draft,
      scheduledDate: undefined,
      isPremium: false,
      metaTitle: '',
      metaDescription: '',
      openGraphImageUrl: '',
      readTimeMinutes: undefined,
      tagIds: [],
      galleryImages: [],
      artistIds: [],
      uploaderUserId: undefined,
      uploaderProfileType: undefined,
      uploaderProfileId: undefined
    };
  }

  initializeUploaderSelector(): void {
    if (this.isAdminUser) {
      this.tagAsMyself = false;
      this.profileTypeFilter = 'none';
      this.clearProfile();
      this.onProfileFilterChange();
      return;
    }

    this.autoFillUploaderFromCurrentUser();
  }

  autoFillUploaderFromCurrentUser(): void {
    if (!this.isProfessionalNonAdmin) return;

    this.userService.getMyAllPages().subscribe(profiles => {
      this.myUploaderProfiles = profiles;

      if (!this.tagAsMyself) {
        return;
      }

      if (profiles.length === 1) {
        this.selectProfile(profiles[0]);
        return;
      }

      if (profiles.length > 1) {
        this.tagAsMyself = true;
        this.clearProfile();
      }
    });
  }

  onTagAsMyselfChange(): void {
    if (this.tagAsMyself) {
      this.autoFillUploaderFromCurrentUser();
    } else {
      this.clearProfile();
    }
  }

  initProfileSearch(): void {
    this.profileSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        if (this.profileTypeFilter === 'none') {
          this.profileSearchLoading = false;
          return of([]);
        }

        this.profileSearchLoading = true;
        return this.userService.searchUsersWithProfiles(q, 100, this.profileTypeFilter);
      })
    ).subscribe({
      next: (results) => {
        this.profileSearchResults = results;
        this.profileSearchLoading = false;
        this.showProfileDropdown = true;
      },
      error: () => { this.profileSearchLoading = false; }
    });
  }

  onProfileSearchInput(): void {
    this.profileSearch$.next(this.profileSearchQuery);
  }

  onProfileFilterChange(): void {
    this.clearProfile();

    if (this.profileTypeFilter === 'none') {
      this.profileSearchLoading = false;
      this.profileSearchResults = [];
      this.showProfileDropdown = false;
      return;
    }

    this.profileSearchLoading = true;
    this.userService.searchUsersWithProfiles('', 100, this.profileTypeFilter)
      .pipe(catchError(() => of([])))
      .subscribe(results => {
        this.profileSearchResults = results;
        this.profileSearchLoading = false;
        this.showProfileDropdown = true;
      });
  }

  selectProfile(profile: UserWithProfileDto): void {
    this.selectedProfile = profile;
    this.article.uploaderUserId = profile.userId;
    this.article.uploaderProfileType = profile.profileType;
    this.article.uploaderProfileId = profile.profileId;
    this.profileSearchQuery = profile.displayName;
    this.showProfileDropdown = false;
    this.profileSearchResults = [];
  }

  clearProfile(): void {
    this.selectedProfile = null;
    this.article.uploaderUserId = undefined;
    this.article.uploaderProfileType = undefined;
    this.article.uploaderProfileId = undefined;
    this.profileSearchQuery = '';
    this.profileSearchResults = [];
    this.showProfileDropdown = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile-search-wrapper')) {
      this.showProfileDropdown = false;
    }
    if (!target.closest('.tag-input-wrapper')) {
      this.showTagDropdown = false;
    }
  }

  getProfileTypeLabel(type: string, isTeacher: boolean = false): string {
    if (type === 'artist') return 'אמן';
    if (type === 'user') return 'חבר רגיל';
    if (type === 'serviceProvider') return isTeacher ? 'מורה' : 'נותן שירות';
    return type === 'artist' ? 'אמן' : 'מורה / בעל מקצוע';
  }

  getProfileConnectionLabel(profile: UserWithProfileDto | null): string {
    return profile && profile.profileType !== 'user' && !profile.userId
      ? ' · לא מקושר לחשבון'
      : '';
  }

  loadCategories(): void {
    this.systemTablesService.getItems('article-categories', 1, 100).subscribe({
      next: (result) => {
        this.categories = result.items;
        this.syncContentTypeFromCategories();
      },
      error: (err) => console.error('Error loading categories', err)
    });
  }

  loadArtists(): void {
    this.artistService.getArtists(undefined, undefined, 1, 100, 'name').subscribe({
      next: (result) => {
        this.artists = result.items;
      },
      error: (err) => console.error('Error loading artists', err)
    });
  }

  loadPopularTags(): void {
    this.systemTablesService.getPopularTags(20).subscribe({
      next: (tags) => { this.popularTags = tags.map(t => ({ id: t.id, name: t.name })); },
      error: (err) => console.error('Error loading popular tags', err)
    });
  }

  initTagSearch(): void {
    this.tagSearch$.pipe(
      debounceTime(200),
      distinctUntilChanged(),
      switchMap(q => this.systemTablesService.searchTags(q, 8).pipe(catchError(() => of([] as SystemItem[]))))
    ).subscribe(results => {
      this.tagSearchResults = results.map(r => ({ id: r.id, name: r.name }));
      this.showTagDropdown = this.tagSearchQuery.trim().length > 0;
    });
  }

  onTagSearchInput(): void {
    this.tagSearch$.next(this.tagSearchQuery);
  }

  isTagSelected(tagId: number): boolean {
    return this.selectedTags.some(t => t.id === tagId);
  }

  selectTag(tag: SelectedTag): void {
    if (this.isTagSelected(tag.id)) return;
    this.selectedTags.push(tag);
    this.article.tagIds = this.selectedTags.map(t => t.id);
    this.tagSearchQuery = '';
    this.tagSearchResults = [];
    this.showTagDropdown = false;
  }

  removeTag(tagId: number): void {
    this.selectedTags = this.selectedTags.filter(t => t.id !== tagId);
    this.article.tagIds = this.selectedTags.map(t => t.id);
  }

  addTagFromInput(): void {
    const name = this.tagSearchQuery.trim();
    if (!name) return;

    const existing = this.tagSearchResults.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      this.selectTag(existing);
      return;
    }

    this.systemTablesService.findOrCreateTag(name).subscribe({
      next: (tag) => {
        this.selectTag({ id: tag.id, name: tag.name });
        if (!this.popularTags.some(p => p.id === tag.id)) {
          this.popularTags = [{ id: tag.id, name: tag.name }, ...this.popularTags];
        }
      },
      error: (err) => console.error('Error creating tag', err)
    });
  }

  // אזור באתר נגזר מהקטגוריות שנבחרו: אם יש קטגוריה אחת לפחות "חדשות מוזיקה" → news, אחרת → blog
  get derivedSlugBase(): 'news' | 'blog' {
    if (!this.article.categoryIds || this.article.categoryIds.length === 0) {
      return this.article.contentType === ArticleContentType.Blog ? 'blog' : 'news';
    }
    const hasNews = this.categories.some(c => this.article.categoryIds.includes(c.id) && (c.section ?? 0) === 0);
    return hasNews ? 'news' : 'blog';
  }

  get newsCategories(): CategoryWithSection[] {
    return this.categories.filter(c => (c.section ?? 0) === 0);
  }

  get contentCategories(): CategoryWithSection[] {
    return this.categories.filter(c => (c.section ?? 0) === 1);
  }

  loadArticle(): void {
    if (!this.articleId) return;

    this.loading = true;
    this.articleService.getArticle(this.articleId).subscribe({
      next: (data: Article) => {
        this.article = {
          title: data.title,
          subtitle: data.subtitle || '',
          content: data.content,
          featuredImageUrl: data.featuredImageUrl || '',
          authorName: data.authorName || '',
          categoryIds: data.categoryIds || [],
          contentType: data.contentType,
          slug: data.slug,
          canonicalUrl: data.canonicalUrl || '',
          videoEmbedUrl: data.videoEmbedUrl || '',
          audioEmbedUrl: data.audioEmbedUrl || '',
          imageCredit: data.imageCredit || '',
          shortDescription: data.shortDescription || '',
          isFeatured: data.isFeatured,
          displayOrder: data.displayOrder,
          status: data.status,
          scheduledDate: data.scheduledDate,
          isPremium: data.isPremium,
          metaTitle: data.metaTitle || '',
          metaDescription: data.metaDescription || '',
          openGraphImageUrl: data.openGraphImageUrl || '',
          readTimeMinutes: data.readTimeMinutes,
          tagIds: data.tagIds || [],
          galleryImages: data.galleryImages.map(img => ({
            imageUrl: img.imageUrl,
            caption: img.caption || '',
            displayOrder: img.displayOrder
          })),
          artistIds: data.taggedArtists?.map(a => a.artistId) || [],
          uploaderUserId: data.uploaderUserId,
          uploaderProfileType: data.uploaderProfileType,
          uploaderProfileId: data.uploaderProfileId
        };
        // Populate selectedTags from the loaded article (tagIds + tag names)
        const ids = data.tagIds || [];
        const names = data.tags || [];
        this.selectedTags = ids.map((id, idx) => ({ id, name: names[idx] ?? `#${id}` }));
        if (data.uploaderProfile) {
          this.selectedProfile = {
            userId: data.uploaderUserId,
            displayName: data.uploaderProfile.name,
            imageUrl: data.uploaderProfile.imageUrl,
            profileType: data.uploaderProfile.type,
            profileId: data.uploaderProfileId ?? data.uploaderProfile.profileId,
            profileUrl: data.uploaderProfile.profileUrl,
            isTeacher: false,
            status: 'None',
            categories: []
          };
          this.profileSearchQuery = data.uploaderProfile.name;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading article:', error);
        alert('שגיאה בטעינת הכתבה');
        this.goBack();
      }
    });
  }

  onTitleChange(): void {
    // Auto-generate slug from title if it's a new article
    if (!this.isEditMode && this.article.title) {
      this.article.slug = this.generateSlug(this.article.title);
    }

    // Auto-generate meta title if empty
    if (!this.article.metaTitle) {
      this.article.metaTitle = this.article.title;
    }
  }

  generateSlug(text: string): string {
    const cleaned = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
    return cleaned || `article-${Date.now()}`;
  }

  calculateReadTime(): void {
    if (this.article.content) {
      const wordsPerMinute = 200;
      const wordCount = this.article.content.split(/\s+/).length;
      this.article.readTimeMinutes = Math.ceil(wordCount / wordsPerMinute);
    }
  }

  onSubmit(): void {
    this.saveError = '';

    if (!this.validateForm()) {
      return;
    }

    this.syncContentTypeFromCategories();
    this.saving = true;

    if (this.isEditMode && this.articleId) {
      // Update existing article
      this.articleService.updateArticle(this.articleId, this.article).subscribe({
        next: () => {
          this.goBack();
        },
        error: (error) => {
          console.error('Error updating article:', error);
          this.saveError = 'לא הצלחנו לשמור את הכתבה: ' + this.getArticleErrorMessage(error);
          alert('שגיאה בעדכון הכתבה: ' + this.getArticleErrorMessage(error));
          this.saving = false;
        }
      });
    } else {
      // Create new article
      this.articleService.createArticle(this.article).subscribe({
        next: () => {
          this.goBack();
        },
        error: (error) => {
          console.error('Error creating article:', error);
          this.saveError = 'לא הצלחנו לשמור את הכתבה: ' + this.getArticleErrorMessage(error);
          alert('שגיאה ביצירת הכתבה: ' + this.getArticleErrorMessage(error));
          this.saving = false;
        }
      });
    }
  }

  validateForm(): boolean {
    if (!this.article.title?.trim()) {
      alert('נא להזין כותרת');
      return false;
    }

    if (!this.article.content?.trim()) {
      alert('נא להזין תוכן');
      return false;
    }

    if (!this.article.slug?.trim()) {
      alert('נא להזין Slug');
      return false;
    }

    if (!this.article.categoryIds) {
      this.article.categoryIds = [];
    }

    if (this.article.categoryIds.length === 0) {
      alert('נא לבחור קטגוריה כדי לקבוע איפה הכתבה תוצג באתר');
      return false;
    }

    return true;
  }

  private getArticleErrorMessage(error: any): string {
    if (error?.error?.message) {
      return error.error.message;
    }

    if (error?.error?.errors) {
      return this.formatValidationErrors(error.error.errors);
    }

    if (error?.originalError?.error?.errors) {
      return this.formatValidationErrors(error.originalError.error.errors);
    }

    return error?.message || 'שגיאה לא ידועה';
  }

  private formatValidationErrors(errors: Record<string, string[]>): string {
    const messages = Object.entries(errors)
      .flatMap(([field, fieldErrors]) => fieldErrors.map(message => `${field}: ${message}`));

    return messages.length > 0 ? messages.join('\n') : 'יש שדות לא תקינים בטופס';
  }

  goBack(): void {
    this.router.navigate(['/admin/content/articles']);
  }

  // Category selection methods
  isCategorySelected(categoryId: number): boolean {
    return this.article.categoryIds.includes(categoryId);
  }

  toggleCategory(categoryId: number): void {
    const index = this.article.categoryIds.indexOf(categoryId);
    if (index > -1) {
      this.article.categoryIds.splice(index, 1);
    } else {
      this.article.categoryIds.push(categoryId);
    }
    this.syncContentTypeFromCategories();
  }

  private syncContentTypeFromCategories(): void {
    if (!this.article.categoryIds || this.article.categoryIds.length === 0 || this.categories.length === 0) {
      return;
    }

    const hasNewsCategory = this.categories.some(
      category => this.article.categoryIds.includes(category.id) && (category.section ?? 0) === 0
    );

    this.article.contentType = hasNewsCategory ? ArticleContentType.News : ArticleContentType.Blog;
  }

  // Artist selection methods
  isArtistSelected(artistId: number): boolean {
    return this.article.artistIds?.includes(artistId) || false;
  }

  toggleArtist(artistId: number): void {
    if (!this.article.artistIds) {
      this.article.artistIds = [];
    }

    const index = this.article.artistIds.indexOf(artistId);
    if (index > -1) {
      this.article.artistIds.splice(index, 1);
    } else {
      this.article.artistIds.push(artistId);
    }
  }

  toggleArtistsExpanded(): void {
    this.artistsExpanded = !this.artistsExpanded;
  }

  getVisibleArtists(): ArtistListDto[] {
    if (this.artistsExpanded) {
      return this.artists;
    }
    // Show only first 5 artists when collapsed
    return this.artists.slice(0, 5);
  }

  get hasMoreArtists(): boolean {
    return this.artists.length > 5;
  }

  getStatusName(status: ArticleStatus): string {
    const names: Record<ArticleStatus, string> = {
      [ArticleStatus.Draft]: 'טיוטה',
      [ArticleStatus.Published]: 'פורסם',
      [ArticleStatus.Scheduled]: 'מתוזמן',
      [ArticleStatus.Archived]: 'ארכיון'
    };
    return names[status];
  }

  onVideoUrlChange(): void {
    // Auto-fetch thumbnail when user finishes typing
    if (this.article.videoEmbedUrl && !this.article.featuredImageUrl) {
      this.fetchYouTubeThumbnail();
    }
  }

  fetchYouTubeThumbnail(): void {
    if (!this.article.videoEmbedUrl) {
      return;
    }

    this.fetchingYouTube = true;
    this.youtubeMessage = 'שולף תמונה מיוטיוב...';

    this.articleService.getYouTubeMetadata(this.article.videoEmbedUrl).subscribe({
      next: (metadata) => {
        if (metadata.success && metadata.thumbnailUrl) {
          this.article.featuredImageUrl = metadata.thumbnailUrl;
          this.youtubeMessage = '✓ תמונה נשלפה בהצלחה';
          setTimeout(() => this.youtubeMessage = '', 3000);
        } else {
          this.youtubeMessage = '⚠️ לא ניתן לשלוף תמונה: ' + (metadata.errorMessage || 'שגיאה לא ידועה');
        }
        this.fetchingYouTube = false;
      },
      error: (error) => {
        console.error('Error fetching YouTube metadata:', error);
        this.youtubeMessage = '⚠️ שגיאה בשליפת התמונה';
        this.fetchingYouTube = false;
      }
    });
  }

  // Gallery methods
  addGalleryImage(): void {
    if (!this.newGalleryImage.imageUrl.trim()) {
      alert('נא להזין URL לתמונה');
      return;
    }

    const displayOrder = this.article.galleryImages ? this.article.galleryImages.length : 0;

    if (!this.article.galleryImages) {
      this.article.galleryImages = [];
    }

    this.article.galleryImages.push({
      imageUrl: this.newGalleryImage.imageUrl,
      caption: this.newGalleryImage.caption || '',
      displayOrder
    });

    this.newGalleryImage = { imageUrl: '', caption: '' };
  }

  async removeGalleryImage(index: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם למחוק תמונה זו מהגלריה?')) {
      this.article.galleryImages?.splice(index, 1);
      // Update display orders
      this.article.galleryImages?.forEach((img, idx) => {
        img.displayOrder = idx;
      });
    }
  }

  moveGalleryImageUp(index: number): void {
    if (index === 0 || !this.article.galleryImages) return;

    const temp = this.article.galleryImages[index];
    this.article.galleryImages[index] = this.article.galleryImages[index - 1];
    this.article.galleryImages[index - 1] = temp;

    // Update display orders
    this.article.galleryImages.forEach((img, idx) => {
      img.displayOrder = idx;
    });
  }

  moveGalleryImageDown(index: number): void {
    if (!this.article.galleryImages || index === this.article.galleryImages.length - 1) return;

    const temp = this.article.galleryImages[index];
    this.article.galleryImages[index] = this.article.galleryImages[index + 1];
    this.article.galleryImages[index + 1] = temp;

    // Update display orders
    this.article.galleryImages.forEach((img, idx) => {
      img.displayOrder = idx;
    });
  }
}
