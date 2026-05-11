import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
import { ChordRequestMatch } from '../../models/report.model';
import { QuickAddEntryPoint } from '../../services/quick-add-assistant.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

export type QuickAddAction =
  | 'index-teacher'
  | 'index-service-provider'
  | 'index-service-provider-general'
  | `index-service-provider-category:${number}`
  | 'artist-account'
  | 'artist-community'
  | 'contact'
  | 'chord-requests'
  | 'admin-edit';

type AssistantStep = 'root' | 'content' | 'index' | 'artist';
type AssistantMode = 'choices' | 'song' | 'article' | 'event' | 'chord-request' | 'contact' | 'success';
type MessageTone = 'question' | 'helper' | 'user';

interface AssistantOption {
  id: string;
  label: string;
  action?: QuickAddAction | 'song' | 'content-news' | 'content-article' | `content-category:${number}` | 'event' | 'chord-request' | 'contact-form';
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
  imports: [CommonModule, FormsModule, AddSongModalComponent, TranslatePipe],
  templateUrl: './quick-add-assistant-modal.component.html',
  styleUrls: ['./quick-add-assistant-modal.component.css']
})
export class QuickAddAssistantModalComponent implements OnInit, OnChanges {
  private readonly articleService = inject(ArticleService);
  private readonly eventService = inject(EventService);
  private readonly mediaService = inject(MediaService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly artistService = inject(ArtistService);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly reportService = inject(ReportService);
  private readonly router = inject(Router);
  private readonly langService = inject(LanguageService);

  @Input() adminEditLabel: string | null = null;
  @Input() entryPoint: QuickAddEntryPoint = 'root';

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
  chordRequestMatch: ChordRequestMatch | null = null;
  chordRequestChecked = false;
  isCheckingChordRequest = false;

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
  articleCategories: SystemItem[] = [];
  selectedEventArtistIds: number[] = [];
  eventArtistSearchQuery = '';
  isLoadingEventArtists = false;
  showEventArtistDropdown = false;

  constructor() {
    this.initProfileSearch();
    this.initializeUploaderSelector();
    this.loadEventArtists();
    this.loadProfessionalCategories();
    this.loadArticleCategories();
  }

  ngOnInit(): void {
    this.resetConversation();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entryPoint'] && !changes['entryPoint'].firstChange) {
      this.resetConversation();
    }
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
    return this.langService.translate('fab.optional_label');
  }

  get eventOptionalLabel(): string {
    return this.langService.translate('fab.optional_label');
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

    if (typeof option.action === 'string' && option.action.startsWith('content-category:')) {
      const categoryId = parseInt(option.action.split(':')[1], 10);
      const category = this.articleCategories.find(c => c.id === categoryId);
      const contentType = (category as any)?.section === 0 ? ArticleContentType.News : ArticleContentType.Blog;
      this.openArticleFlow(contentType, categoryId);
      return;
    }

    switch (option.action) {
      case 'song':
        this.modeOriginStep = this.currentStep;
        this.currentMode = 'song';
        this.messages.push({
          id: `bot-${this.messages.length + 1}`,
          tone: 'question',
          text: this.langService.translate('fab.song_selected')
        });
        break;
      case 'chord-request':
        this.modeOriginStep = this.currentStep;
        this.currentMode = 'chord-request';
        this.chordRequest = { songName: '', artistName: '' };
        this.chordRequestMatch = null;
        this.chordRequestChecked = false;
        this.messages.push({
          id: `bot-${this.messages.length + 1}`,
          tone: 'question',
          text: this.langService.translate('fab.chord_request_question')
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
      case 'chord-requests':
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

    if (!this.hasArticleDraftContent()) {
      alert(this.langService.translate('quick_add.fill_one_field'));
      return;
    }

    this.isSubmitting = true;
    this.prepareArticleDraftForSubmit();
    this.article.slug = this.generateUniqueSlug(this.article.title);
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
          ? this.langService.translate('fab.success_news')
          : this.langService.translate('fab.success_article');
      },
      error: (error) => {
        this.isSubmitting = false;
        alert(this.langService.translate('quick_add.error_submit') + (error.error?.message || error.message));
      }
    });
  }

  submitEvent(): void {
    if (this.isSubmitting) {
      return;
    }

    if (!this.event.name.trim()) {
      alert(this.langService.translate('quick_add.enter_event_name'));
      return;
    }

    if (!this.event.eventDate) {
      alert(this.langService.translate('quick_add.enter_event_date'));
      return;
    }

    const eventLocation = this.event.location?.trim();
    if (!eventLocation) {
      alert(this.langService.translate('quick_add.enter_event_location'));
      return;
    }

    this.isSubmitting = true;
    this.event.name = this.event.name.trim();
    this.event.location = eventLocation;
    this.event.artistName = this.event.artistName?.trim() || '';
    this.event.artistIds = this.selectedEventArtistIds.length > 0 ? [...this.selectedEventArtistIds] : [];

    const payload: CreateEventDto = {
      ...this.event,
      isActive: false,
      displayOrder: 0
    };

    this.eventService.submitEvent(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.currentMode = 'success';
        this.submittedMessage = this.langService.translate('fab.success_event');
      },
      error: (error) => {
        this.isSubmitting = false;
        alert(this.langService.translate('quick_add.error_submit_event') + (error.error?.message || error.message));
      }
    });
  }

  submitChordRequest(): void {
    if (this.isSubmitting || this.isCheckingChordRequest) {
      return;
    }

    if (!this.chordRequest.songName.trim()) {
      alert(this.langService.translate('quick_add.enter_song_name'));
      return;
    }

    if (!this.chordRequest.artistName.trim()) {
      alert(this.langService.translate('quick_add.enter_artist_name'));
      return;
    }

    if (!this.chordRequestChecked) {
      this.checkChordRequestMatches();
      return;
    }

    this.sendChordRequest();
  }

  continueChordRequestAnyway(): void {
    this.chordRequestChecked = true;
    this.sendChordRequest();
  }

  resetChordRequestMatch(): void {
    this.chordRequestMatch = null;
    this.chordRequestChecked = false;
  }

  openMatchedSong(songId: number): void {
    this.close.emit();
    this.router.navigate(['/song', songId]);
  }

  private checkChordRequestMatches(): void {
    this.isCheckingChordRequest = true;
    this.chordRequestMatch = null;

    this.reportService.findChordRequestMatches(
      this.chordRequest.songName.trim(),
      this.chordRequest.artistName.trim()
    ).subscribe({
      next: result => {
        this.isCheckingChordRequest = false;
        this.chordRequestMatch = result;

        if (result.hasMatches) {
          this.chordRequestChecked = false;
          return;
        }

        this.chordRequestChecked = true;
        this.sendChordRequest();
      },
      error: () => {
        this.isCheckingChordRequest = false;
        this.chordRequestChecked = true;
        this.sendChordRequest();
      }
    });
  }

  private sendChordRequest(): void {
    this.isSubmitting = true;
    const description = `בקשת אקורדים לשיר: ${this.chordRequest.songName.trim()} — אמן: ${this.chordRequest.artistName.trim()}`;

    this.reportService.createReport({
      contentType: 'Song',
      contentId: 0,
      reportType: 'ChordRequest',
      description
    }).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.chordRequestMatch = null;
        this.chordRequestChecked = false;
        this.currentMode = 'success';
        this.submittedMessage = this.langService.translate('fab.success_chord_request');
      },
      error: (error) => {
        this.isSubmitting = false;
        alert(this.langService.translate('quick_add.error_submit_request') + (error.error?.message || error.message));
      }
    });
  }

  onSongAdded(): void {
    this.currentMode = 'success';
    this.submittedMessage = this.langService.translate('fab.success_song');
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
        alert(this.langService.translate('quick_add.error_upload_image'));
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
        alert(this.langService.translate('quick_add.error_upload_image'));
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
    const t = (k: string) => this.langService.translate(k);
    if (type === 'artist') return t('fab.profile_type_artist');
    if (type === 'user') return t('fab.profile_type_user');
    if (type === 'serviceProvider') return isTeacher ? t('fab.profile_type_teacher') : t('fab.profile_type_provider');
    return t('fab.profile_type_general');
  }

  getProfileConnectionLabel(profile: UserWithProfileDto | null): string {
    return profile && profile.profileType !== 'user' && !profile.userId
      ? this.langService.translate('fab.not_linked')
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

  private loadArticleCategories(): void {
    this.systemTablesService.getItems('article-categories', 1, 100).pipe(
      catchError(() => of({ items: [] as SystemItem[] }))
    ).subscribe({
      next: (result) => {
        this.articleCategories = result.items ?? [];
      },
      error: () => {
        this.articleCategories = [];
      }
    });
  }

  trackByMessage(_: number, message: AssistantMessage): string {
    return message.id;
  }

  trackByOption(_: number, option: AssistantOption): string {
    return option.id;
  }

  private openArticleFlow(type: ArticleContentType, categoryId?: number): void {
    this.modeOriginStep = this.currentStep;
    this.currentMode = 'article';
    this.article = this.createEmptyArticle(type, categoryId != null ? [categoryId] : []);
    this.showArticleOptional = false;
    this.showArticleImageLinkInput = false;
    this.isUploadingArticleImage = false;
  }

  private resetConversation(): void {
    const initialStep = this.entryPoint === 'index' ? 'index' : 'root';

    this.currentStep = initialStep;
    this.currentMode = 'choices';
    this.modeOriginStep = initialStep;
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
    this.chordRequestMatch = null;
    this.chordRequestChecked = false;
    this.isCheckingChordRequest = false;
    this.contactForm = { fullName: '', email: '', subject: '', message: '' };
    this.contactAttachments = [];

    if (this.entryPoint === 'contact') {
      this.currentMode = 'contact';
      this.modeOriginStep = 'root';
      this.autoFillContactFromCurrentUser();
    } else if (this.entryPoint === 'news') {
      this.messages.push({
        id: 'bot-1',
        tone: 'question',
        text: this.langService.translate('quick_add.news_form_text')
      });
      this.openArticleFlow(ArticleContentType.News);
    } else if (this.entryPoint === 'article') {
      this.messages.push({
        id: 'bot-1',
        tone: 'question',
        text: this.langService.translate('quick_add.content_form_text')
      });
      this.openArticleFlow(ArticleContentType.Blog);
    } else if (this.entryPoint === 'event') {
      this.messages.push({
        id: 'bot-1',
        tone: 'question',
        text: this.langService.translate('quick_add.event_form_text')
      });
      this.modeOriginStep = 'root';
      this.currentMode = 'event';
    } else {
      this.appendBotStep(initialStep);
    }
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
    const t = (k: string) => this.langService.translate(k);
    switch (step) {
      case 'content': {
        const categoryOptions: AssistantOption[] = this.articleCategories.map(category => ({
          id: `content-category-${category.id}`,
          label: category.name,
          action: `content-category:${category.id}`
        }));

        return {
          question: t('fab.content_question'),
          options: [
            ...categoryOptions,
            { id: 'content-article', label: t('fab.opt_blog'), action: 'content-article' }
          ]
        };
      }
      case 'index': {
        const professionalOptions: AssistantOption[] = this.professionalCategories.map(category => ({
          id: `index-service-provider-category-${category.id}`,
          label: category.name,
          action: `index-service-provider-category:${category.id}`
        }));

        return {
          question: t('fab.index_question'),
          options: [
            { id: 'index-teacher', label: t('fab.opt_teacher'), action: 'index-teacher' },
            ...professionalOptions,
            { id: 'index-service-provider-general', label: t('fab.opt_other'), action: 'index-service-provider-general' }
          ]
        };
      }
      case 'artist':
        return {
          question: t('fab.artist_question'),
          options: [
            { id: 'artist-account', label: t('fab.opt_artist_account'), action: 'artist-account' },
            { id: 'artist-community', label: t('fab.opt_artist_community'), action: 'artist-community' }
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
          { id: 'song', label: t('fab.opt_chords'), action: 'song' },
          { id: 'content', label: t('fab.opt_content'), nextStep: 'content' },
          { id: 'event', label: t('fab.opt_event'), action: 'event' },
          { id: 'index', label: t('fab.opt_index'), nextStep: 'index' },
          { id: 'artist', label: t('fab.opt_artist'), nextStep: 'artist' },
          { id: 'chord-request', label: t('fab.opt_chord_request'), action: 'chord-request', isSecondary: true },
          { id: 'contact-form', label: t('fab.opt_contact_form'), action: 'contact-form', isSecondary: true },
          { id: 'contact', label: t('fab.opt_report'), action: 'contact', isSecondary: true }
        );

        return {
          question: t('fab.root_question'),
          helper: t('fab.root_helper'),
          options
        };
      }
    }
  }

  private createEmptyArticle(contentType: ArticleContentType, categoryIds: number[] = []): CreateArticleDto {
    return {
      title: '',
      subtitle: '',
      content: '',
      featuredImageUrl: '',
      authorName: '',
      categoryIds,
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

  private hasArticleDraftContent(): boolean {
    const fields = [
      this.article.title,
      this.article.subtitle,
      this.article.content,
      this.article.featuredImageUrl,
      this.article.authorName,
      this.article.videoEmbedUrl,
      this.article.audioEmbedUrl,
      this.article.imageCredit,
      this.article.shortDescription,
      this.article.metaTitle,
      this.article.metaDescription,
      this.article.openGraphImageUrl
    ];

    return fields.some(value => !!value?.trim()) ||
      (this.article.galleryImages?.length ?? 0) > 0 ||
      !!this.selectedUploaderProfile;
  }

  private prepareArticleDraftForSubmit(): void {
    const fallbackContent = [
      this.article.shortDescription,
      this.article.subtitle,
      this.article.videoEmbedUrl,
      this.article.featuredImageUrl,
      this.article.audioEmbedUrl,
      this.article.authorName
    ].find(value => !!value?.trim())?.trim();

    this.article.title = this.article.title.trim() || 'טיוטת כתבה';
    this.article.content = this.article.content.trim() || fallbackContent || 'טיוטה שנשלחה להשלמה במערכת הניהול.';
    this.article.status = ArticleStatus.Draft;
    this.article.isFeatured = false;
    this.article.isPremium = false;
    this.article.displayOrder = 0;
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
    const cleaned = text
      .toLowerCase()
      .replace(/[^\w\u0590-\u05FF\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');

    return cleaned || 'content';
  }

  private generateUniqueSlug(text: string): string {
    return `${this.generateSlug(text)}-${Date.now()}`;
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
      alert(this.langService.translate('quick_add.enter_full_name'));
      return;
    }

    if (!this.contactForm.email.trim() || !this.contactForm.email.includes('@')) {
      alert(this.langService.translate('quick_add.enter_valid_email'));
      return;
    }

    if (!this.contactForm.subject.trim()) {
      alert(this.langService.translate('quick_add.select_subject'));
      return;
    }

    if (!this.contactForm.message.trim()) {
      alert(this.langService.translate('quick_add.enter_message'));
      return;
    }

    if (this.contactAttachments.some(a => a.uploading)) {
      alert(this.langService.translate('quick_add.wait_upload'));
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
        this.submittedMessage = this.langService.translate('fab.success_contact');
      },
      error: (error) => {
        this.isSubmitting = false;
        alert(this.langService.translate('quick_add.error_submit_message') + (error.error?.message || error.message));
      }
    });
  }

  onContactFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';

    for (const file of files) {
      if (this.contactAttachments.length >= this.CONTACT_MAX_FILES) {
        alert(this.langService.translate('quick_add.max_files') + this.CONTACT_MAX_FILES + this.langService.translate('quick_add.max_files_suffix'));
        break;
      }

      if (file.size > this.CONTACT_MAX_FILE_MB * 1024 * 1024) {
        alert(this.langService.translate('quick_add.file_too_large'));
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
