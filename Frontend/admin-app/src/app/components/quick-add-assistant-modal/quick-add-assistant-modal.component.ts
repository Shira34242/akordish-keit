import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { AddSongModalComponent } from '../add-song-modal/add-song-modal.component';
import { ArticleService } from '../../services/admin/article.service';
import { EventService } from '../../services/admin/event.service';
import { MediaService } from '../../services/admin/media.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { ArtistService } from '../../services/artist.service';
import { SystemItem, SystemTablesService } from '../../services/system-tables.service';
import { ReportService } from '../../services/report.service';
import { CreateArticleDto, ArticleContentType, ArticleStatus } from '../../models/article.model';
import { CreateEventDto } from '../../models/event.model';
import { UserWithProfileDto } from '../../models/user.model';
import { ArtistListDto } from '../../models/artist.model';

export type QuickAddAction =
  | 'index-teacher'
  | 'index-service-provider'
  | 'index-service-provider-general'
  | `index-service-provider-category:${number}`
  | 'artist-account'
  | 'artist-community'
  | 'contact'
  | 'admin-edit';

type AssistantStep = 'root' | 'content' | 'index' | 'artist';
type AssistantMode = 'choices' | 'song' | 'article' | 'event' | 'chord-request' | 'contact' | 'success';
type MessageTone = 'question' | 'helper' | 'user';

interface AssistantOption {
  id: string;
  label: string;
  action?: QuickAddAction | 'song' | 'content-news' | 'content-article' | 'event' | 'chord-request' | 'contact-form';
  nextStep?: AssistantStep;
  isSecondary?: boolean;
}

interface AssistantMessage {
  id: string;
  tone: MessageTone;
  text: string;
}

interface AssistantStepDefinition {
  question: string;
  helper?: string;
  options: AssistantOption[];
}

@Component({
  selector: 'app-quick-add-assistant-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AddSongModalComponent],
  templateUrl: './quick-add-assistant-modal.component.html',
  styleUrls: ['./quick-add-assistant-modal.component.css']
})
export class QuickAddAssistantModalComponent {
  private readonly articleService = inject(ArticleService);
  private readonly eventService = inject(EventService);
  private readonly mediaService = inject(MediaService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly artistService = inject(ArtistService);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly reportService = inject(ReportService);

  @Input() adminEditLabel: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() actionSelected = new EventEmitter<QuickAddAction>();

  currentStep: AssistantStep = 'root';
  currentMode: AssistantMode = 'choices';
  modeOriginStep: AssistantStep = 'root';
  messages: AssistantMessage[] = [];
  isSubmitting = false;
  isUploadingArticleImage = false;
  isUploadingEventImage = false;
  submittedMessage = '';
  showArticleOptional = false;
  showEventOptional = false;
  showArticleImageLinkInput = false;
  showEventImageLinkInput = false;

  article: CreateArticleDto = this.createEmptyArticle(ArticleContentType.News);
  event: CreateEventDto = this.createEmptyEvent();
  chordRequest = { songName: '', artistName: '' };

  contactForm = { fullName: '', email: '', subject: '', message: '' };
  contactAttachments: { file: File; url: string; uploading: boolean; error: boolean }[] = [];
  readonly CONTACT_MAX_FILE_MB = 20;
  readonly CONTACT_MAX_FILES = 5;

  profileSearchQuery = '';
  profileSearchResults: UserWithProfileDto[] = [];
  profileSearchLoading = false;
  selectedUploaderProfile: UserWithProfileDto | null = null;
  myUploaderProfiles: UserWithProfileDto[] = [];
  profileTypeFilter: 'all' | 'artist' | 'teacher' | 'serviceProvider' | 'user' = 'all';
  profileSort: 'name' | 'type' = 'name';
  showProfileDropdown = false;
  tagAsMyself = true;
  private readonly profileSearch$ = new Subject<string>();
  eventArtists: ArtistListDto[] = [];
  professionalCategories: SystemItem[] = [];
  selectedEventArtistIds: number[] = [];
  eventArtistSearchQuery = '';
  isLoadingEventArtists = false;
  showEventArtistDropdown = false;

  constructor() {
    this.initProfileSearch();
    this.initializeUploaderSelector();
    this.loadEventArtists();
    this.loadProfessionalCategories();
    this.resetConversation();
  }

  get currentOptions(): AssistantOption[] {
    return this.currentMode === 'choices' ? this.getStepDefinition(this.currentStep).options : [];
  }

  get primaryOptions(): AssistantOption[] {
    return this.currentOptions.filter(o => !o.isSecondary);
  }

  get secondaryOptions(): AssistantOption[] {
    return this.currentOptions.filter(o => o.isSecondary);
  }

  get isContactUploading(): boolean {
    return this.contactAttachments.some(a => a.uploading);
  }

  get articleOptionalLabel(): string {
    return 'עוד כמה פרטים להשלמת החוויה, לא חובה';
  }

  get eventOptionalLabel(): string {
    return 'עוד כמה פרטים להשלמת החוויה, לא חובה';
  }

  get isAdminUser(): boolean {
    return this.authService.isAdminOrManager();
  }

  get isProfessionalNonAdmin(): boolean {
    return (this.authService.currentUserValue?.hasProfessionalProfile ?? false) && !this.isAdminUser;
  }

  get filteredProfileSearchResults(): UserWithProfileDto[] {
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

  get canUseVideoThumbnail(): boolean {
    return !!this.getYouTubeThumbnailUrl(this.article.videoEmbedUrl);
  }

  get filteredEventArtists(): ArtistListDto[] {
    const query = this.eventArtistSearchQuery.trim().toLowerCase();
    const artists = query
      ? this.eventArtists.filter(artist => artist.name.toLowerCase().includes(query))
      : this.eventArtists;

    return artists
      .filter(artist => !this.selectedEventArtistIds.includes(artist.id))
      .slice(0, 8);
  }

  selectOption(option: AssistantOption, event?: MouseEvent): void {
    event?.stopPropagation();

    this.messages.push({
      id: `user-${this.messages.length + 1}`,
      tone: 'user',
      text: option.label
    });

    if (option.nextStep) {
      this.currentStep = option.nextStep;
      this.appendBotStep(option.nextStep);
      return;
    }

    if (typeof option.action === 'string' && option.action.startsWith('index-service-provider-category:')) {
      this.actionSelected.emit(option.action as QuickAddAction);
      return;
    }

    switch (option.action) {
      case 'song':
        this.modeOriginStep = this.currentStep;
        this.currentMode = 'song';
        this.messages.push({
          id: `bot-${this.messages.length + 1}`,
          tone: 'question',
          text: 'מעולה, נמשיך להוספת אקורדים.'
        });
        break;
      case 'chord-request':
        this.modeOriginStep = this.currentStep;
        this.currentMode = 'chord-request';
        this.chordRequest = { songName: '', artistName: '' };
        this.messages.push({
          id: `bot-${this.messages.length + 1}`,
          tone: 'question',
          text: 'איזה שיר תרצה שנוסיף אקורדים עבורו?'
        });
        break;
      case 'contact-form':
        this.modeOriginStep = this.currentStep;
        this.currentMode = 'contact';
        this.contactForm = { fullName: '', email: '', subject: '', message: '' };
        this.contactAttachments = [];
        this.autoFillContactFromCurrentUser();
        this.scrollToBottom();
        break;
      case 'content-news':
        this.openArticleFlow(ArticleContentType.News);
        break;
      case 'content-article':
        this.openArticleFlow(ArticleContentType.Blog);
        break;
      case 'event':
        this.modeOriginStep = this.currentStep;
        this.currentMode = 'event';
        this.event = this.createEmptyEvent();
        this.showEventOptional = false;
        this.showEventImageLinkInput = false;
        this.selectedEventArtistIds = [];
        this.eventArtistSearchQuery = '';
        this.showEventArtistDropdown = false;
        break;
      case 'index-teacher':
      case 'index-service-provider':
      case 'index-service-provider-general':
      case 'artist-account':
      case 'artist-community':
      case 'contact':
      case 'admin-edit':
        this.actionSelected.emit(option.action as QuickAddAction);
        break;
      default:
        break;
    }
  }

  goBackToPreviousStep(event?: MouseEvent): void {
    event?.stopPropagation();
    this.currentMode = 'choices';
    this.currentStep = this.modeOriginStep;
    this.isSubmitting = false;
    this.submittedMessage = '';
    this.messages = [];
    this.appendBotStep(this.currentStep);
  }

  submitArticle(): void {
    if (this.isSubmitting) {
      return;
    }

    if (!this.article.title.trim()) {
      alert('נא לכתוב כותרת.');
      return;
    }

    if (!this.article.content.trim()) {
      alert('נא להוסיף את התוכן.');
      return;
    }

    this.isSubmitting = true;
    this.article.slug = this.generateSlug(this.article.title);
    this.article.metaTitle = this.article.metaTitle?.trim() || this.article.title;
    this.article.shortDescription = this.article.shortDescription?.trim() || undefined;
    this.article.readTimeMinutes = Math.max(1, Math.ceil(this.article.content.split(/\s+/).length / 200));
    this.article.uploaderUserId = this.selectedUploaderProfile?.userId;
    this.article.uploaderProfileType = this.selectedUploaderProfile?.profileType;
    this.article.uploaderProfileId = this.selectedUploaderProfile?.profileId;

    this.articleService.submitArticle(this.article).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.currentMode = 'success';
        this.submittedMessage = this.article.contentType === ArticleContentType.News
          ? 'החדשה נשלחה לאישור מנהל.'
          : 'התוכן נשלח לאישור מנהל.';
      },
      error: (error) => {
        this.isSubmitting = false;
        alert('שגיאה בשליחת התוכן: ' + (error.error?.message || error.message));
      }
    });
  }

  submitEvent(): void {
    if (this.isSubmitting) {
      return;
    }

    if (!this.event.imageUrl.trim()) {
      alert('נא לצרף תמונה או קישור לתמונה.');
      return;
    }

    if (!this.event.ticketUrl.trim()) {
      alert('נא להוסיף לינק לכרטיסים.');
      return;
    }

    if (!this.event.eventDate) {
      alert('נא לבחור תאריך.');
      return;
    }

    this.isSubmitting = true;
    this.event.name = this.event.name?.trim() || this.event.artistName?.trim() || 'הופעה חדשה';
    this.event.artistIds = this.selectedEventArtistIds.length > 0 ? [...this.selectedEventArtistIds] : [];

    this.eventService.submitEvent({
      ...this.event,
      isActive: false,
      displayOrder: 0
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.currentMode = 'success';
        this.submittedMessage = 'ההופעה נשלחה לאישור מנהל.';
      },
      error: (error) => {
        this.isSubmitting = false;
        alert('שגיאה בשליחת ההופעה: ' + (error.error?.message || error.message));
      }
    });
  }

  submitChordRequest(): void {
    if (this.isSubmitting) {
      return;
    }

    if (!this.chordRequest.songName.trim()) {
      alert('נא לכתוב את שם השיר.');
      return;
    }

    if (!this.chordRequest.artistName.trim()) {
      alert('נא לכתוב את שם האמן.');
      return;
    }

    this.isSubmitting = true;
    const description = `בקשת אקורדים לשיר: ${this.chordRequest.songName.trim()} — אמן: ${this.chordRequest.artistName.trim()}`;

    this.reportService.createReport({
      contentType: 'Song',
      contentId: 0,
      reportType: 'Other',
      description
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.currentMode = 'success';
        this.submittedMessage = 'הבקשה נשלחה! נעשה כמיטב יכולתנו להוסיף את האקורדים בהקדם.';
      },
      error: (error) => {
        this.isSubmitting = false;
        alert('שגיאה בשליחת הבקשה: ' + (error.error?.message || error.message));
      }
    });
  }

  onSongAdded(): void {
    this.currentMode = 'success';
    this.submittedMessage = 'השיר נשלח לאישור מנהל.';
  }

  closeModal(): void {
    this.close.emit();
  }

  onArticleImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || this.isUploadingArticleImage) {
      return;
    }

    input.value = '';
    this.isUploadingArticleImage = true;

    this.mediaService.uploadMedia(file).subscribe({
      next: (response) => {
        this.article.featuredImageUrl = response.url;
        this.showArticleImageLinkInput = false;
        this.isUploadingArticleImage = false;
      },
      error: () => {
        this.isUploadingArticleImage = false;
        alert('שגיאה בהעלאת התמונה.');
      }
    });
  }

  useVideoThumbnail(): void {
    const thumbnailUrl = this.getYouTubeThumbnailUrl(this.article.videoEmbedUrl);
    if (thumbnailUrl) {
      this.article.featuredImageUrl = thumbnailUrl;
      this.showArticleImageLinkInput = false;
    }
  }

  clearArticleImage(): void {
    this.article.featuredImageUrl = '';
  }

  onEventImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || this.isUploadingEventImage) {
      return;
    }

    input.value = '';
    this.isUploadingEventImage = true;

    this.mediaService.uploadMedia(file).subscribe({
      next: (response) => {
        this.event.imageUrl = response.url;
        this.showEventImageLinkInput = false;
        this.isUploadingEventImage = false;
      },
      error: () => {
        this.isUploadingEventImage = false;
        alert('שגיאה בהעלאת התמונה.');
      }
    });
  }

  clearEventImage(): void {
    this.event.imageUrl = '';
  }

  onEventArtistSearchFocus(): void {
    this.showProfileDropdown = false;
    this.showEventArtistDropdown = true;
  }

  selectEventArtist(artist: ArtistListDto): void {
    if (this.selectedEventArtistIds.includes(artist.id)) {
      return;
    }

    this.selectedEventArtistIds = [...this.selectedEventArtistIds, artist.id];
    this.event.artistIds = [...this.selectedEventArtistIds];
    this.eventArtistSearchQuery = '';
    this.showEventArtistDropdown = false;
  }

  removeEventArtist(artistId: number): void {
    this.selectedEventArtistIds = this.selectedEventArtistIds.filter(id => id !== artistId);
    this.event.artistIds = [...this.selectedEventArtistIds];
  }

  getEventArtistName(artistId: number): string {
    return this.eventArtists.find(artist => artist.id === artistId)?.name || '';
  }

  getEventArtistImage(artistId: number): string {
    return this.eventArtists.find(artist => artist.id === artistId)?.imageUrl || '';
  }

  onTagAsMyselfChange(): void {
    if (this.tagAsMyself) {
      this.autoFillUploaderFromCurrentUser();
    } else {
      this.clearUploaderProfile();
    }
  }

  private initializeUploaderSelector(): void {
    if (this.isAdminUser) {
      this.tagAsMyself = false;
      this.clearUploaderProfile();
      this.onProfileFilterChange();
      return;
    }

    this.autoFillUploaderFromCurrentUser();
  }

  onProfileSearchInput(): void {
    this.showEventArtistDropdown = false;
    this.profileSearch$.next(this.profileSearchQuery);
  }

  onProfileFilterChange(): void {
    this.clearUploaderProfile();
    this.showEventArtistDropdown = false;
    this.profileSearchLoading = true;
    this.userService.searchUsersWithProfiles('', 100, this.profileTypeFilter)
      .pipe(catchError(() => of([])))
      .subscribe(results => {
        this.profileSearchResults = results;
        this.profileSearchLoading = false;
        this.showProfileDropdown = true;
      });
  }

  selectUploaderProfile(profile: UserWithProfileDto): void {
    this.selectedUploaderProfile = profile;
    this.profileSearchQuery = profile.displayName;
    this.showProfileDropdown = false;
    this.profileSearchResults = [];
  }

  clearUploaderProfile(): void {
    this.selectedUploaderProfile = null;
    this.profileSearchQuery = '';
    this.profileSearchResults = [];
    this.showProfileDropdown = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.profile-search-wrapper')) {
      this.showProfileDropdown = false;
      this.showEventArtistDropdown = false;
    }
  }

  getProfileTypeLabel(type: string, isTeacher: boolean = false): string {
    if (type === 'artist') return 'אמן';
    if (type === 'user') return 'חבר רגיל';
    if (type === 'serviceProvider') return isTeacher ? 'מורה' : 'נותן שירות';
    return type === 'artist' ? 'אמן' : 'מורה / נותן שירות';
  }

  getProfileConnectionLabel(profile: UserWithProfileDto | null): string {
    return profile && profile.profileType !== 'user' && !profile.userId
      ? ' · לא מקושר לחשבון'
      : '';
  }

  private loadEventArtists(): void {
    this.isLoadingEventArtists = true;

    this.artistService.getArtists(undefined, 1, 1, 100, 'name').pipe(
      catchError(() => of({ items: [] as ArtistListDto[] }))
    ).subscribe({
      next: (result) => {
        this.eventArtists = result.items ?? [];
        this.isLoadingEventArtists = false;
      },
      error: () => {
        this.eventArtists = [];
        this.isLoadingEventArtists = false;
      }
    });
  }

  private loadProfessionalCategories(): void {
    this.systemTablesService.getItems('music-service-provider-categories', 1, 100).pipe(
      catchError(() => of({ items: [] as SystemItem[] }))
    ).subscribe({
      next: (result) => {
        this.professionalCategories = result.items ?? [];
      },
      error: () => {
        this.professionalCategories = [];
      }
    });
  }

  trackByMessage(_: number, message: AssistantMessage): string {
    return message.id;
  }

  trackByOption(_: number, option: AssistantOption): string {
    return option.id;
  }

  private openArticleFlow(type: ArticleContentType): void {
    this.modeOriginStep = this.currentStep;
    this.currentMode = 'article';
    this.article = this.createEmptyArticle(type);
    this.showArticleOptional = false;
    this.showArticleImageLinkInput = false;
    this.isUploadingArticleImage = false;
  }

  private resetConversation(): void {
    this.currentStep = 'root';
    this.currentMode = 'choices';
    this.modeOriginStep = 'root';
    this.isSubmitting = false;
    this.submittedMessage = '';
    this.showArticleOptional = false;
    this.showEventOptional = false;
    this.showArticleImageLinkInput = false;
    this.showEventImageLinkInput = false;
    this.isUploadingArticleImage = false;
    this.isUploadingEventImage = false;
    this.selectedEventArtistIds = [];
    this.eventArtistSearchQuery = '';
    this.showEventArtistDropdown = false;
    this.messages = [];
    this.article = this.createEmptyArticle(ArticleContentType.News);
    this.event = this.createEmptyEvent();
    this.chordRequest = { songName: '', artistName: '' };
    this.contactForm = { fullName: '', email: '', subject: '', message: '' };
    this.contactAttachments = [];
    this.appendBotStep('root');
  }

  private appendBotStep(step: AssistantStep): void {
    const definition = this.getStepDefinition(step);

    this.messages.push({
      id: `bot-${this.messages.length + 1}`,
      tone: 'question',
      text: definition.question
    });

    if (definition.helper) {
      this.messages.push({
        id: `bot-${this.messages.length + 1}`,
        tone: 'helper',
        text: definition.helper
      });
    }
  }

  private getStepDefinition(step: AssistantStep): AssistantStepDefinition {
    switch (step) {
      case 'content':
        return {
          question: 'מעולה, איזה תוכן תרצה להוסיף?',
          options: [
            { id: 'content-news', label: 'חדשות מוזיקה', action: 'content-news' },
            { id: 'content-article', label: 'תוכן אחר', action: 'content-article' }
          ]
        };
      case 'index': {
        const professionalOptions: AssistantOption[] = this.professionalCategories.map(category => ({
          id: `index-service-provider-category-${category.id}`,
          label: category.name,
          action: `index-service-provider-category:${category.id}`
        }));

        return {
          question: 'הבנתי, איזה פרופיל תרצה לאינדקס?',
          options: [
            { id: 'index-teacher', label: 'מורה למוזיקה', action: 'index-teacher' },
            ...professionalOptions,
            { id: 'index-service-provider-general', label: 'אחר', action: 'index-service-provider-general' }
          ]
        };
      }
      case 'artist':
        return {
          question: 'איך תרצה להוסיף את האמן?',
          options: [
            { id: 'artist-account', label: 'להפוך לחשבון אמן', action: 'artist-account' },
            { id: 'artist-community', label: 'להוסיף אמן ללא בעלות חשבון', action: 'artist-community' }
          ]
        };
      default: {
        const options: AssistantOption[] = [];

        if (this.adminEditLabel) {
          options.push({
            id: 'admin-edit',
            label: this.adminEditLabel,
            action: 'admin-edit'
          });
        }

        options.push(
          { id: 'song', label: 'אקורדים', action: 'song' },
          { id: 'content', label: 'תוכן', nextStep: 'content' },
          { id: 'event', label: 'הופעה', action: 'event' },
          { id: 'index', label: 'פרופיל לאינדקס', nextStep: 'index' },
          { id: 'artist', label: 'אמן', nextStep: 'artist' },
          { id: 'chord-request', label: 'לבקש אקורדים לשיר', action: 'chord-request', isSecondary: true },
          { id: 'contact-form', label: 'יצירת קשר', action: 'contact-form', isSecondary: true },
          { id: 'contact', label: 'דיווח', action: 'contact', isSecondary: true }
        );

        return {
          question: 'איזה תוכן תרצה להוסיף לאתר?',
          helper: 'הוספת תוכן לאתר מתוגמלת בתג מיוחד ואפשרויות בלעדיות באתר לחברים מתקדמים.',
          options
        };
      }
    }
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

  private createEmptyEvent(): CreateEventDto {
    return {
      name: '',
      description: '',
      imageUrl: '',
      ticketUrl: '',
      eventDate: '',
      location: '',
      artistName: '',
      price: undefined,
      displayOrder: 0,
      isActive: false,
      artistIds: []
    };
  }

  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim() || `content-${Date.now()}`;
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const content = document.querySelector('.modal-content');
      if (content) {
        content.scrollTop = content.scrollHeight;
      }
    }, 50);
  }

  private autoFillContactFromCurrentUser(): void {
    const user = this.authService.currentUserValue;
    if (!user) {
      return;
    }
    if (user.username) {
      this.contactForm.fullName = user.username;
    }
    if (user.email) {
      this.contactForm.email = user.email;
    }
  }

  submitContact(): void {
    if (this.isSubmitting) {
      return;
    }

    if (!this.contactForm.fullName.trim()) {
      alert('נא לכתוב שם מלא.');
      return;
    }

    if (!this.contactForm.email.trim() || !this.contactForm.email.includes('@')) {
      alert('נא לכתוב כתובת אימייל תקינה.');
      return;
    }

    if (!this.contactForm.subject.trim()) {
      alert('נא לבחור נושא.');
      return;
    }

    if (!this.contactForm.message.trim()) {
      alert('נא לכתוב הודעה.');
      return;
    }

    if (this.contactAttachments.some(a => a.uploading)) {
      alert('יש להמתין לסיום העלאת הקבצים.');
      return;
    }

    this.isSubmitting = true;

    const attachmentLines = this.contactAttachments
      .filter(a => a.url && !a.error)
      .map((a, i) => `קובץ ${i + 1}: ${a.url}`)
      .join('\n');

    const description = [
      `שם: ${this.contactForm.fullName.trim()}`,
      `אימייל: ${this.contactForm.email.trim()}`,
      `נושא: ${this.contactForm.subject.trim()}`,
      `הודעה:\n${this.contactForm.message.trim()}`,
      attachmentLines ? `\nקבצים מצורפים:\n${attachmentLines}` : ''
    ].filter(Boolean).join('\n');

    this.reportService.createReport({
      contentType: 'General',
      contentId: 0,
      reportType: 'Other',
      description
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.currentMode = 'success';
        this.submittedMessage = 'ההודעה נשלחה! נחזור אליכם בהקדם.';
      },
      error: (error) => {
        this.isSubmitting = false;
        alert('שגיאה בשליחת ההודעה: ' + (error.error?.message || error.message));
      }
    });
  }

  onContactFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';

    for (const file of files) {
      if (this.contactAttachments.length >= this.CONTACT_MAX_FILES) {
        alert(`ניתן לצרף עד ${this.CONTACT_MAX_FILES} קבצים.`);
        break;
      }

      if (file.size > this.CONTACT_MAX_FILE_MB * 1024 * 1024) {
        alert(`הקובץ "${file.name}" גדול מ-${this.CONTACT_MAX_FILE_MB}MB.`);
        continue;
      }

      const entry = { file, url: '', uploading: true, error: false };
      this.contactAttachments = [...this.contactAttachments, entry];

      this.mediaService.uploadMedia(file).subscribe({
        next: (res) => {
          entry.url = res.url;
          entry.uploading = false;
        },
        error: () => {
          entry.uploading = false;
          entry.error = true;
        }
      });
    }
  }

  removeContactAttachment(index: number): void {
    this.contactAttachments = this.contactAttachments.filter((_, i) => i !== index);
  }

  getContactFileIcon(file: File): string {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'picture_as_pdf';
    if (file.type.startsWith('video/')) return 'videocam';
    if (file.type.startsWith('audio/')) return 'audiotrack';
    return 'attach_file';
  }

  private autoFillUploaderFromCurrentUser(): void {
    if (!this.isProfessionalNonAdmin) {
      return;
    }

    this.userService.getMyAllPages().subscribe(profiles => {
      this.myUploaderProfiles = profiles;

      if (!this.tagAsMyself) {
        return;
      }

      if (profiles.length === 1) {
        this.selectUploaderProfile(profiles[0]);
        return;
      }

      if (profiles.length > 1) {
        this.tagAsMyself = true;
        this.clearUploaderProfile();
      }
    });
  }

  private initProfileSearch(): void {
    this.profileSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        this.profileSearchLoading = true;
        return this.userService.searchUsersWithProfiles(query, 100, this.profileTypeFilter).pipe(catchError(() => of([])));
      })
    ).subscribe({
      next: (results) => {
        this.profileSearchResults = results;
        this.profileSearchLoading = false;
        this.showEventArtistDropdown = false;
        this.showProfileDropdown = true;
      },
      error: () => {
        this.profileSearchLoading = false;
      }
    });
  }

  private getYouTubeThumbnailUrl(url?: string): string | null {
    if (!url) {
      return null;
    }

    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/);
    return match?.[1] ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
  }
}
