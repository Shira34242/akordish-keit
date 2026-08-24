import { Component, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { FileUploadInputComponent } from '../../../shared/file-upload-input/file-upload-input.component';
import {
  RichArticleEditorComponent,
  RichArticleMentionRequest
} from '../../../shared/rich-article-editor/rich-article-editor.component';
import { ArticleService } from '../../../../services/admin/article.service';
import { SystemTablesService, SystemItem } from '../../../../services/system-tables.service';
import { ArtistService } from '../../../../services/artist.service';
import { UserService } from '../../../../services/user.service';
import { AuthService } from '../../../../services/auth.service';
import { ArtistListDto } from '../../../../models/artist.model';
import { UserWithProfileDto } from '../../../../models/user.model';
import { SiteAlertService } from '../../../../services/site-alert.service';
import { SmartContentService } from '../../../../services/admin/smart-content.service';
import { ArtistSuggestion, ArtistSuggestionService } from '../../../../services/admin/artist-suggestion.service';
import { ActiveMention, ContentMentionService } from '../../../../services/admin/content-mention.service';
import { StoredSmartDraft } from '../../../../models/smart-content.model';

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

interface SuggestedTag {
  id?: number;
  name: string;
  isNew: boolean;
  score: number;
}

@Component({
  selector: 'app-article-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadInputComponent, RichArticleEditorComponent],
  templateUrl: './article-form.component.html',
  styleUrls: ['./article-form.component.css']
})
export class ArticleFormComponent implements OnInit {
  @ViewChild('richArticleEditor') richArticleEditor?: RichArticleEditorComponent;

  private readonly siteAlerts = inject(SiteAlertService);
  private readonly articleService = inject(ArticleService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly artistService = inject(ArtistService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly smartContentService = inject(SmartContentService);
  private readonly artistSuggestionService = inject(ArtistSuggestionService);
  private readonly contentMentionService = inject(ContentMentionService);

  // State
  categories: CategoryWithSection[] = [];
  artists: ArtistListDto[] = [];

  // Tag state
  selectedTags: SelectedTag[] = [];
  popularTags: SelectedTag[] = [];
  availableTags: SelectedTag[] = [];
  tagSearchQuery = '';
  tagSearchResults: SelectedTag[] = [];
  showTagDropdown = false;
  showNewTagInput = false;
  private tagSearch$ = new Subject<string>();
  tagSuggestions: SuggestedTag[] = [];
  creatingSuggestedTag = '';
  private readonly tagSuggestion$ = new Subject<void>();
  private readonly dismissedTagSuggestions = new Set<string>();
  isEditMode = false;
  articleId?: number;
  loading = false;
  saving = false;
  saveError = '';
  fetchingYouTube = false;
  youtubeMessage = '';
  advancedOpen = false;
  isSmartDraftCreate = false;

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

  get titleExcess(): number {
    return Math.max(0, (this.article.title?.trim().length ?? 0) - 70);
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
  artistSuggestions: ArtistSuggestion[] = [];
  artistSuggestionsLoading = false;
  private readonly artistSuggestion$ = new Subject<void>();
  mentionResults: UserWithProfileDto[] = [];
  mentionLoading = false;
  mentionOpen = false;
  mentionMenuPosition = { x: 12, y: 12 };
  mentionMenuPlacement: 'above' | 'below' = 'below';
  private activeMention: ActiveMention | null = null;
  private mentionTextarea: HTMLTextAreaElement | null = null;
  private readonly mentionSearch$ = new Subject<string>();
  private submitted = false;
  private draftSaved = false;
  private closeWithoutDraftSave = false;

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
    featuredImageCredit: '',
    shortDescription: '',
    isFeatured: false,
    displayOrder: 0,
    status: ArticleStatus.Published,
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
    this.initTagSuggestions();
    this.initArtistSuggestions();
    this.initMentionSearch();

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
        this.showNewTagInput = false;
        this.tagSuggestions = [];
        this.dismissedTagSuggestions.clear();
        this.artistsExpanded = false;
        this.artistSuggestions = [];
        this.advancedOpen = false;
        this.newGalleryImage = { imageUrl: '', caption: '' };
        this.initializeUploaderSelector();
      }
    });

    // Check query params for content type (when creating new)
    this.route.queryParams.subscribe(params => {
      if (this.isEditMode) return;

      this.isSmartDraftCreate = !!params['smartDraft'] || params['source'] === 'smart-add';

      const requestedType = params['type'] === 'blog' ? 'blog' : 'news';
      this.article.contentType = requestedType === 'blog' ? ArticleContentType.Blog : ArticleContentType.News;

      const draft = this.smartContentService.consumeDraft(params['smartDraft'] ?? null);
      if (draft) {
        this.applySmartDraft(draft);
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
      featuredImageCredit: '',
      shortDescription: '',
      isFeatured: false,
      displayOrder: 0,
      status: ArticleStatus.Published,
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
    this.article.uploaderProfileType = profile.profileType === 'agency' ? undefined : profile.profileType;
    this.article.uploaderProfileId = profile.profileType === 'agency' ? undefined : profile.profileId;
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
    this.systemTablesService.getItems('tags', 1, 5000).subscribe({
      next: (result) => {
        this.availableTags = result.items.map(t => ({ id: t.id, name: t.name }));
        this.popularTags = this.availableTags.slice(0, 200);
        this.queueTagSuggestionScan();
      },
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
    this.tagSuggestions = this.tagSuggestions.filter(suggestion =>
      suggestion.id !== tag.id && this.normalizeTagName(suggestion.name) !== this.normalizeTagName(tag.name)
    );
    this.tagSearchQuery = '';
    this.tagSearchResults = [];
    this.showTagDropdown = false;
  }

  removeTag(tagId: number): void {
    this.selectedTags = this.selectedTags.filter(t => t.id !== tagId);
    this.article.tagIds = this.selectedTags.map(t => t.id);
    this.queueTagSuggestionScan();
  }

  addSuggestedTag(suggestion: SuggestedTag): void {
    if (suggestion.id) {
      this.selectTag({ id: suggestion.id, name: suggestion.name });
      return;
    }

    this.creatingSuggestedTag = suggestion.name;
    this.systemTablesService.findOrCreateTag(suggestion.name).subscribe({
      next: tag => {
        const selected = { id: tag.id, name: tag.name };
        this.selectTag(selected);
        if (!this.popularTags.some(item => item.id === tag.id)) {
          this.popularTags = [selected, ...this.popularTags];
        }
        if (!this.availableTags.some(item => item.id === tag.id)) {
          this.availableTags = [selected, ...this.availableTags];
        }
        this.creatingSuggestedTag = '';
      },
      error: () => {
        this.creatingSuggestedTag = '';
        this.siteAlerts.show('לא הצלחנו ליצור את התגית. אפשר לנסות שוב.');
      }
    });
  }

  dismissSuggestedTag(suggestion: SuggestedTag): void {
    this.dismissedTagSuggestions.add(this.normalizeTagName(suggestion.name));
    this.tagSuggestions = this.tagSuggestions.filter(item => item !== suggestion);
  }

  scanTagSuggestions(): void {
    this.dismissedTagSuggestions.clear();
    this.queueTagSuggestionScan();
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
        this.showNewTagInput = false;
      },
      error: (err) => console.error('Error creating tag', err)
    });
  }

  openNewTagInput(): void {
    this.showNewTagInput = true;
    this.tagSearchQuery = '';
    this.showTagDropdown = false;
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
          featuredImageCredit: data.featuredImageCredit || '',
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
        this.queueTagSuggestionScan();
        this.queueArtistSuggestionScan();
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

    this.queueArtistSuggestionScan();
    this.queueTagSuggestionScan();
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
      const plainText = this.article.content
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .trim();
      const wordCount = plainText ? plainText.split(/\s+/).length : 0;
      this.article.readTimeMinutes = Math.ceil(wordCount / wordsPerMinute);
    }
    this.queueArtistSuggestionScan();
    this.queueTagSuggestionScan();
  }

  onRichArticleContentInput(): void {
    this.calculateReadTime();
  }

  onRichArticleMentionChange(event: RichArticleMentionRequest): void {
    if (!event.active) {
      this.closeMentionMenu();
      return;
    }

    this.activeMention = { start: 0, end: 0, query: event.query };
    this.mentionMenuPosition = {
      x: event.x ?? 12,
      y: event.y ?? 12
    };
    this.mentionMenuPlacement = event.placement || 'below';
    this.mentionOpen = true;
    this.mentionSearch$.next(event.query);
  }

  onArticleContentInput(event: Event): void {
    this.calculateReadTime();
    this.handleMentionInput(event);
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
          this.submitted = true;
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
          this.submitted = true;
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

    const plainContent = (this.article.content || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .trim();

    if (!plainContent && !/(<img\b|<iframe\b)/i.test(this.article.content || '')) {
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
    this.closeWithoutDraftSave = true;
    const categoryId = this.article.categoryIds?.[0];
    const queryParams = categoryId ? { categoryId } : undefined;

    this.router.navigate(['/admin/content/articles'], {
      queryParams
    });
  }

  canDeactivate(): boolean | Observable<boolean> {
    if (!this.shouldSaveDraftOnExit()) {
      return true;
    }

    this.saving = true;
    this.saveError = '';

    return this.articleService.createDraftArticle(this.buildDraftArticle()).pipe(
      map(() => {
        this.draftSaved = true;
        this.saving = false;
        return true;
      }),
      catchError((error) => {
        this.saving = false;
        console.error('Error saving article draft:', error);
        return of(true);
      })
    );
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

  private applySmartDraft(draft: StoredSmartDraft): void {
    const description = draft.description?.trim() || '';

    this.article.title = draft.title || this.article.title;
    this.article.subtitle = description;
    this.article.shortDescription = description;
    this.article.content = description
      ? `${description}\n\nמקור: ${draft.sourceUrl}`
      : `מקור: ${draft.sourceUrl}`;
    this.article.featuredImageUrl = draft.imageUrl || this.article.featuredImageUrl;
    this.article.openGraphImageUrl = draft.imageUrl || this.article.openGraphImageUrl;
    this.article.canonicalUrl = draft.sourceUrl;
    this.article.metaTitle = draft.title || this.article.metaTitle;
    this.article.metaDescription = description;
    this.article.status = ArticleStatus.Published;
    this.onTitleChange();
  }

  toggleAdvanced(): void {
    this.advancedOpen = !this.advancedOpen;
  }

  private shouldSaveDraftOnExit(): boolean {
    return !this.isEditMode
      && !this.saving
      && !this.submitted
      && !this.draftSaved
      && !this.closeWithoutDraftSave
      && this.hasMeaningfulDraftContent();
  }

  private hasMeaningfulDraftContent(): boolean {
    return [
      this.article.title,
      this.article.subtitle,
      this.article.shortDescription,
      this.article.featuredImageUrl,
      this.article.videoEmbedUrl,
      this.article.audioEmbedUrl,
      this.article.content?.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    ].some(value => !!value?.trim());
  }

  private buildDraftArticle(): CreateArticleDto {
    const title = this.article.title?.trim() || 'טיוטה ללא כותרת';
    const categoryIds = this.article.categoryIds?.length
      ? [...this.article.categoryIds]
      : this.getFallbackDraftCategoryIds();

    return {
      ...this.article,
      title,
      slug: this.article.slug?.trim() || this.generateSlug(title),
      content: this.article.content?.trim() || '<p></p>',
      categoryIds,
      contentType: this.article.contentType,
      status: ArticleStatus.Draft,
      scheduledDate: undefined
    };
  }

  private getFallbackDraftCategoryIds(): number[] {
    const wantedSection = this.article.contentType === ArticleContentType.Blog ? 1 : 0;
    const category = this.categories.find(item => (item.section ?? 0) === wantedSection)
      || this.categories[0];
    return category ? [category.id] : [];
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
    this.artistSuggestions = this.artistSuggestions.filter(suggestion => suggestion.artistId !== artistId);
  }

  addSuggestedArtist(suggestion: ArtistSuggestion): void {
    if (!this.article.artistIds) {
      this.article.artistIds = [];
    }
    if (!this.article.artistIds.includes(suggestion.artistId)) {
      this.article.artistIds.push(suggestion.artistId);
    }
    this.artistSuggestions = this.artistSuggestions.filter(item => item.artistId !== suggestion.artistId);
  }

  dismissSuggestedArtist(artistId: number): void {
    this.artistSuggestions = this.artistSuggestions.filter(item => item.artistId !== artistId);
  }

  scanArtistSuggestions(): void {
    this.queueArtistSuggestionScan();
  }

  private initArtistSuggestions(): void {
    this.artistSuggestion$.pipe(
      debounceTime(600),
      switchMap(() => {
        const hasText = [this.article.title, this.article.subtitle, this.article.shortDescription, this.article.content]
          .some(value => (value || '').trim().length >= 3);
        if (!hasText) {
          this.artistSuggestionsLoading = false;
          return of([] as ArtistSuggestion[]);
        }

        this.artistSuggestionsLoading = true;
        return this.artistSuggestionService.suggestArtists({
          contentType: this.article.contentType === ArticleContentType.Blog ? 'blog' : 'news',
          title: this.article.title,
          subtitle: this.article.subtitle,
          description: this.article.shortDescription,
          content: this.article.content,
          selectedArtistIds: this.article.artistIds || []
        }).pipe(catchError(() => of([] as ArtistSuggestion[])));
      })
    ).subscribe(suggestions => {
      const selectedIds = new Set(this.article.artistIds || []);
      this.artistSuggestions = suggestions.filter(suggestion => !selectedIds.has(suggestion.artistId));
      this.artistSuggestionsLoading = false;
    });
  }

  private queueArtistSuggestionScan(): void {
    this.artistSuggestion$.next();
  }

  private initTagSuggestions(): void {
    this.tagSuggestion$.pipe(debounceTime(450)).subscribe(() => {
      this.tagSuggestions = this.buildTagSuggestions();
    });
  }

  queueTagSuggestionScan(): void {
    this.tagSuggestion$.next();
  }

  private buildTagSuggestions(): SuggestedTag[] {
    const fields = [
      { value: this.article.title, weight: 8 },
      { value: this.article.subtitle, weight: 5 },
      { value: this.article.shortDescription, weight: 5 },
      { value: this.article.content, weight: 4 }
    ].map(field => ({ ...field, value: this.cleanTagText(field.value || '') }))
      .filter(field => field.value.length >= 3);

    if (fields.length === 0) return [];

    const selectedNames = new Set(this.selectedTags.map(tag => this.normalizeTagName(tag.name)));
    const existingSuggestions: SuggestedTag[] = this.availableTags
      .map(tag => {
        const name = this.normalizeTagName(tag.name);
        const score = name.length < 2 ? 0 : fields.reduce(
          (total, field) => total + (this.countTagPhraseOccurrences(field.value, name) * field.weight),
          0
        );
        return { ...tag, isNew: false, score };
      })
      .filter(tag => tag.score > 0
        && !selectedNames.has(this.normalizeTagName(tag.name))
        && !this.dismissedTagSuggestions.has(this.normalizeTagName(tag.name)));

    const existingNames = new Set(this.availableTags.map(tag => this.normalizeTagName(tag.name)));
    const candidateScores = new Map<string, {
      name: string;
      score: number;
      occurrences: number;
      fieldIndexes: Set<number>;
      explicit: boolean;
      wordCount: number;
    }>();

    // New tags must be meaningful phrases seen more than once or in more than one field.
    // This deliberately avoids turning isolated title words into random-looking tags.
    fields.forEach((field, fieldIndex) => {
      const tokens = field.value.split(' ');
      for (const phraseLength of [3, 2, 1]) {
        for (let index = 0; index <= tokens.length - phraseLength; index += 1) {
          const phraseTokens = tokens.slice(index, index + phraseLength);
          if (!phraseTokens.every(token => this.isUsefulTagToken(token))) continue;

          const name = phraseTokens.map(token => token.replace(/^#/, '')).join(' ');
          const key = this.normalizeTagName(name);
          const current = candidateScores.get(key) || {
            name,
            score: 0,
            occurrences: 0,
            fieldIndexes: new Set<number>(),
            explicit: false,
            wordCount: phraseLength
          };
          current.score += field.weight + (4 - phraseLength);
          current.occurrences += 1;
          current.fieldIndexes.add(fieldIndex);
          candidateScores.set(key, current);
        }
      }
    });

    const sourceText = [this.article.title, this.article.subtitle, this.article.shortDescription, this.article.content].join(' ');
    for (const match of sourceText.matchAll(/#([\p{L}\p{N}][\p{L}\p{N}_-]{1,39})/gu)) {
      const name = match[1].replace(/_/g, ' ');
      candidateScores.set(this.normalizeTagName(name), {
        name,
        score: 30,
        occurrences: 1,
        fieldIndexes: new Set<number>(),
        explicit: true,
        wordCount: name.split(' ').length
      });
    }

    for (const match of sourceText.matchAll(/["״“”]([^"״“”]{3,80})["״“”]/gu)) {
      const name = this.cleanTagText(match[1]);
      const words = name.split(' ').filter(Boolean);
      if (words.length < 2 || words.length > 4 || !words.every(word => this.isUsefulTagToken(word))) continue;

      candidateScores.set(this.normalizeTagName(name), {
        name,
        score: 24,
        occurrences: 1,
        fieldIndexes: new Set<number>(),
        explicit: true,
        wordCount: words.length
      });
    }

    const newSuggestions: SuggestedTag[] = [...candidateScores.values()]
      .filter(candidate => candidate.explicit
        || (candidate.wordCount === 1
          ? candidate.fieldIndexes.size >= 2 && candidate.occurrences >= 3
          : candidate.fieldIndexes.size >= 2 || candidate.occurrences >= 2))
      .filter(candidate => {
        const key = this.normalizeTagName(candidate.name);
        return !existingNames.has(key) && !selectedNames.has(key) && !this.dismissedTagSuggestions.has(key);
      })
      .map(candidate => ({ name: candidate.name, isNew: true, score: candidate.score }));

    const rankedExisting = existingSuggestions
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'he'));
    const rankedNew = newSuggestions
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'he'));

    return [...rankedExisting, ...rankedNew].slice(0, 4);
  }

  private cleanTagText(value: string): string {
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/&(?:nbsp|amp|quot|#39);/gi, ' ')
      .normalize('NFKC')
      .toLocaleLowerCase('he')
      .replace(/[^\p{L}\p{N}#_-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeTagName(value: string): string {
    return this.cleanTagText(value).replace(/^#/, '');
  }

  private countTagPhraseOccurrences(text: string, phrase: string): number {
    const textTokens = text.split(' ').filter(Boolean);
    const phraseTokens = phrase.split(' ').filter(Boolean);
    if (phraseTokens.length === 0 || phraseTokens.length > textTokens.length) return 0;

    let count = 0;

    for (let index = 0; index <= textTokens.length - phraseTokens.length; index += 1) {
      const matches = phraseTokens.every((phraseToken, offset) =>
        this.tagTokenMatches(textTokens[index + offset], phraseToken)
      );
      if (matches) count += 1;
    }

    return count;
  }

  private tagTokenMatches(textToken: string, tagToken: string): boolean {
    if (textToken === tagToken) return true;
    if (!textToken.endsWith(tagToken)) return false;

    const prefix = textToken.slice(0, textToken.length - tagToken.length);
    return prefix.length > 0 && prefix.length <= 2 && /^[ובכלמהש]+$/u.test(prefix);
  }

  private isUsefulTagToken(token: string): boolean {
    const normalized = token.replace(/^#/, '');
    if (normalized.length < 3 || /^\d+$/.test(normalized)) return false;

    return !new Set([
      'אבל', 'אחרי', 'איך', 'אין', 'אלא', 'אלה', 'אם', 'אנחנו', 'אני', 'אצל', 'את', 'אתר', 'אתם',
      'בגלל', 'בין', 'גם', 'דרך', 'הוא', 'היא', 'היה', 'היום', 'הכל', 'הם', 'הן', 'וזה', 'חדש', 'חדשה',
      'חדשים', 'חדשות', 'יותר', 'יכול', 'כבר', 'כדי', 'כל', 'כמה', 'כמו', 'כאן', 'לא', 'להיות', 'למה',
      'לפני', 'לפי', 'מאוד', 'מה', 'מי', 'מול', 'מוזיקה', 'מתוך', 'נוסף', 'עבור', 'עוד', 'על', 'עם',
      'עצמו', 'עכשיו', 'של', 'שוב', 'שיהיה', 'תוכן', 'תוך', 'the', 'and', 'for', 'from', 'that', 'this',
      'with', 'you', 'your', 'article', 'news', 'new'
    ]).has(normalized);
  }

  private initMentionSearch(): void {
    this.mentionSearch$.pipe(
      debounceTime(180),
      distinctUntilChanged(),
      switchMap(query => {
        this.mentionLoading = true;
        return this.userService.searchUsersWithProfiles(query, 8, undefined, true).pipe(catchError(() => of([] as UserWithProfileDto[])));
      })
    ).subscribe(results => {
      this.mentionResults = results.filter(profile => !!profile.profileUrl);
      this.mentionLoading = false;
      this.mentionOpen = !!this.activeMention;
    });
  }

  handleMentionInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    this.mentionTextarea = textarea;
    this.activeMention = this.contentMentionService.getActiveMention(this.article.content || '', textarea.selectionStart || 0);

    if (!this.activeMention) {
      this.closeMentionMenu();
      return;
    }

    this.mentionOpen = true;
    this.mentionSearch$.next(this.activeMention.query);
  }

  insertMention(profile: UserWithProfileDto): void {
    if (!this.activeMention) return;

    const mentionHtml = this.contentMentionService.buildMentionAnchor(profile);
    this.richArticleEditor?.insertMention(mentionHtml);
    this.closeMentionMenu();
    this.calculateReadTime();
    this.queueArtistSuggestionScan();
  }

  closeMentionMenu(): void {
    this.mentionOpen = false;
    this.mentionLoading = false;
    this.mentionResults = [];
    this.mentionMenuPosition = { x: 12, y: 12 };
    this.mentionMenuPlacement = 'below';
    this.activeMention = null;
  }

  getMentionProfileLabel(profile: UserWithProfileDto): string {
    if (profile.profileType === 'artist') return 'אמן';
    if (profile.profileType === 'serviceProvider') return profile.isTeacher ? 'מורה' : 'נותן שירות';
    if (profile.profileType === 'agency') return 'סוכנות';
    return 'משתמש';
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
  onGalleryImagesUploaded(urls: string[]): void {
    if (!this.article.galleryImages) {
      this.article.galleryImages = [];
    }

    urls
      .map(url => url.trim())
      .filter(url => !!url)
      .forEach(url => {
        this.article.galleryImages!.push({
          imageUrl: url,
          caption: this.newGalleryImage.caption || '',
          displayOrder: this.article.galleryImages!.length
        });
      });
  }

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
