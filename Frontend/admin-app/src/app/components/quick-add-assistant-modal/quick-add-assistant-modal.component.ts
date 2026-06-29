import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, inject, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { AddSongModalComponent } from '../add-song-modal/add-song-modal.component';
import { ArticleService } from '../../services/admin/article.service';
import { EventService } from '../../services/admin/event.service';
import { MediaService } from '../../services/admin/media.service';
import { PodcastService } from '../../services/podcast.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { ArtistService } from '../../services/artist.service';
import { SystemItem, SystemTablesService } from '../../services/system-tables.service';
import { ReportService } from '../../services/report.service';
import { CreateArticleDto, ArticleContentType, ArticleStatus } from '../../models/article.model';
import { CreateEventDto } from '../../models/event.model';
import { UserWithProfileDto } from '../../models/user.model';
import { ArtistListDto } from '../../models/artist.model';
import { Podcast } from '../../models/podcast.model';
import { ChordRequestMatch } from '../../models/report.model';
import { QuickAddEntryPoint } from '../../services/quick-add-assistant.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
export type { QuickAddAction } from './quick-add-action.type';
import type { QuickAddAction } from './quick-add-action.type';

type AssistantStep = 'root' | 'content' | 'index' | 'artist' | 'podcast';
type AssistantMode = 'choices' | 'song' | 'article' | 'event' | 'podcast-series' | 'podcast-episode' | 'chord-request' | 'contact' | 'success';
type MessageTone = 'question' | 'helper' | 'user';

interface AssistantOption {
  id: string;
  label: string;
  action?: QuickAddAction | 'song' | 'content-news' | 'content-article' | `content-category:${number}` | 'event' | 'podcast-series' | 'podcast-episode' | 'chord-request' | 'contact-form';
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
export class QuickAddAssistantModalComponent implements OnInit, OnChanges, OnDestroy {
  private readonly articleService = inject(ArticleService);
  private readonly eventService = inject(EventService);
  private readonly mediaService = inject(MediaService);
  private readonly podcastService = inject(PodcastService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly artistService = inject(ArtistService);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly reportService = inject(ReportService);
  private readonly router = inject(Router);
  private readonly langService = inject(LanguageService);
  private readonly cdr = inject(ChangeDetectorRef);

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

  isTyping = false;
  botThinking = false;
  typingMessageId: string | null = null;
  successTypedMessage = '';
  formError = '';
  private readonly TYPING_SPEED_MS = 18;
  private readonly THINKING_DELAY_MS = 400;
  private readonly HELPER_PAUSE_MS = 350;
  private destroyed = false;
  private isResetting = false;
  private activeTimers: number[] = [];
  private audioCtx: AudioContext | null = null;

  article: CreateArticleDto = this.createEmptyArticle(ArticleContentType.News);
  event: CreateEventDto = this.createEmptyEvent();
  podcastSeries = { name: '', sourceUrl: '' };
  podcastEpisode = { podcastId: 0, title: '', sourceUrl: '' };
  podcasts: Podcast[] = [];
  isLoadingPodcasts = false;
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
    this.loadPodcasts();
  }

  ngOnInit(): void {
    this.resetConversation();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entryPoint'] && !changes['entryPoint'].firstChange) {
      this.resetConversation();
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.clearAllTimers();
    try {
      if (this.audioCtx) {
        this.audioCtx.close().catch(() => {});
        this.audioCtx = null;
      }
    } catch {}
    try {
      this.profileSearch$.complete();
    } catch {}
  }

  private trackTimer(id: number): number {
    this.activeTimers.push(id);
    return id;
  }

  private clearAllTimers(): void {
    for (const id of this.activeTimers) {
      clearTimeout(id);
      clearInterval(id);
    }
    this.activeTimers = [];
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

  async selectOption(option: AssistantOption, event?: MouseEvent): Promise<void> {
    if (this.destroyed || this.isResetting) return;
    event?.stopPropagation();

    this.playClickSound();

    this.messages = [...this.messages, {
      id: `user-${this.messages.length + 1}`,
      tone: 'user' as MessageTone,
      text: option.label
    }];

    if (option.nextStep) {
      this.currentStep = option.nextStep;
      await this.appendBotStep(option.nextStep);
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
      const categoryName = category?.name ?? '';
      const msg = categoryName
        ? `מעולה, נמשיך להוספת כתבה בקטגוריית "${categoryName}". מה תרצה לכלול?`
        : this.langService.translate('quick_add.content_form_text');
      await this.typeMessage(msg, 'question');
      this.openArticleFlow(contentType, categoryId);
      return;
    }

    switch (option.action) {
      case 'song':
        this.modeOriginStep = this.currentStep;
        await this.typeMessage(this.langService.translate('fab.song_selected'), 'question');
        this.currentMode = 'song';
        this.scrollToActiveFlowStart(true);
        break;
      case 'chord-request':
        this.modeOriginStep = this.currentStep;
        this.chordRequest = { songName: '', artistName: '' };
        this.chordRequestMatch = null;
        this.chordRequestChecked = false;
        await this.typeMessage(this.langService.translate('fab.chord_request_question'), 'question');
        this.currentMode = 'chord-request';
        this.scrollToActiveFlowStart(true);
        break;
      case 'contact-form':
        this.modeOriginStep = this.currentStep;
        this.contactForm = { fullName: '', email: '', subject: '', message: '' };
        this.contactAttachments = [];
        this.autoFillContactFromCurrentUser();
        await this.typeMessage(this.langService.translate('quick_add.contact_form_text'), 'question');
        this.currentMode = 'contact';
        this.scrollToActiveFlowStart(true);
        break;
      case 'content-article':
        await this.typeMessage(this.langService.translate('quick_add.content_form_text'), 'question');
        this.openArticleFlow(ArticleContentType.Blog);
        break;
      case 'event':
        this.modeOriginStep = this.currentStep;
        this.event = this.createEmptyEvent();
        this.showEventOptional = false;
        this.showEventImageLinkInput = false;
        this.selectedEventArtistIds = [];
        this.eventArtistSearchQuery = '';
        this.showEventArtistDropdown = false;
        await this.typeMessage(this.langService.translate('quick_add.event_form_text'), 'question');
        this.currentMode = 'event';
        this.scrollToActiveFlowStart(true);
        break;
      case 'podcast-series':
        this.modeOriginStep = this.currentStep;
        this.podcastSeries = { name: '', sourceUrl: '' };
        await this.typeMessage(this.langService.translate('quick_add.podcast_series_form_text'), 'question');
        this.currentMode = 'podcast-series';
        this.scrollToActiveFlowStart(true);
        break;
      case 'podcast-episode':
        this.modeOriginStep = this.currentStep;
        this.podcastEpisode = { podcastId: this.podcasts[0]?.id ?? 0, title: '', sourceUrl: '' };
        this.loadPodcasts();
        await this.typeMessage(this.langService.translate('quick_add.podcast_episode_form_text'), 'question');
        this.currentMode = 'podcast-episode';
        this.scrollToActiveFlowStart(true);
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

  async goBackToPreviousStep(event?: MouseEvent): Promise<void> {
    event?.stopPropagation();
    this.currentMode = 'choices';
    this.currentStep = this.modeOriginStep;
    this.isSubmitting = false;
    this.submittedMessage = '';
    this.messages = [];
    this.botThinking = false;
    this.isTyping = true;
    this.typingMessageId = null;
    this.successTypedMessage = '';
    await this.appendBotStep(this.currentStep);
  }

  submitArticle(): void {
    if (this.isSubmitting) {
      return;
    }

    if (!this.hasArticleDraftContent()) {
      this.messages = [...this.messages, {
        id: `bot-${this.messages.length + 1}`,
        tone: 'helper' as MessageTone,
        text: this.langService.translate('quick_add.fill_one_field')
      }];
      this.scrollToBottomSmooth();
      return;
    }

    this.isSubmitting = true;
    this.prepareArticleDraftForSubmit();
    this.article.slug = this.generateUniqueSlug(this.article.title);
    this.article.metaTitle = this.article.metaTitle?.trim() || this.article.title;
    this.article.shortDescription = this.article.shortDescription?.trim() || undefined;
    this.article.readTimeMinutes = Math.max(1, Math.ceil(this.article.content.split(/\s+/).length / 200));
    this.article.uploaderUserId = this.selectedUploaderProfile?.userId;
    this.article.uploaderProfileType = this.selectedUploaderProfile?.profileType === 'agency' ? undefined : this.selectedUploaderProfile?.profileType;
    this.article.uploaderProfileId = this.selectedUploaderProfile?.profileType === 'agency' ? undefined : this.selectedUploaderProfile?.profileId;

    this.articleService.submitArticle(this.article).subscribe({
      next: () => {
        if (this.destroyed) return;
        this.isSubmitting = false;
        const msg = this.article.contentType === ArticleContentType.News
          ? this.langService.translate('fab.success_news')
          : this.langService.translate('fab.success_article');
        this.submittedMessage = msg;
        this.successTypedMessage = '';
        this.currentMode = 'success';
        this.animateSuccessMessage(msg);
      },
      error: (error) => {
        if (this.destroyed) return;
        this.isSubmitting = false;
        this.messages = [...this.messages, {
          id: `bot-${this.messages.length + 1}`,
          tone: 'helper' as MessageTone,
          text: this.langService.translate('quick_add.error_submit')
        }];
        this.scrollToBottomSmooth();
      }
    });
  }

  submitEvent(): void {
    if (this.isSubmitting) {
      return;
    }

    if (!this.event.eventDate) {
      this.pushError(this.langService.translate('quick_add.enter_event_date'));
      return;
    }

    const eventLocation = this.event.location?.trim();
    if (!eventLocation) {
      this.pushError(this.langService.translate('quick_add.enter_event_location'));
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
        if (this.destroyed) return;
        this.isSubmitting = false;
        const msg = this.langService.translate('fab.success_event');
        this.submittedMessage = msg;
        this.successTypedMessage = '';
        this.currentMode = 'success';
        this.animateSuccessMessage(msg);
      },
      error: () => {
        if (this.destroyed) return;
        this.isSubmitting = false;
        this.pushError(this.langService.translate('quick_add.error_submit_event'));
      }
    });
  }

  submitPodcastSeries(): void {
    if (this.isSubmitting) {
      return;
    }

    const name = this.podcastSeries.name.trim();
    const sourceUrl = this.podcastSeries.sourceUrl.trim();

    if (!name) {
      this.pushError(this.langService.translate('quick_add.enter_podcast_name'));
      return;
    }

    if (!sourceUrl) {
      this.pushError(this.langService.translate('quick_add.enter_podcast_link'));
      return;
    }

    this.isSubmitting = true;
    this.podcastService.submitPodcast({ name, sourceUrl }).subscribe({
      next: () => {
        if (this.destroyed) return;
        this.isSubmitting = false;
        this.loadPodcasts();
        const msg = this.langService.translate('fab.success_podcast');
        this.submittedMessage = msg;
        this.successTypedMessage = '';
        this.currentMode = 'success';
        this.animateSuccessMessage(msg);
      },
      error: () => {
        if (this.destroyed) return;
        this.isSubmitting = false;
        this.pushError(this.langService.translate('quick_add.error_submit_podcast'));
      }
    });
  }

  submitPodcastEpisode(): void {
    if (this.isSubmitting) {
      return;
    }

    const title = this.podcastEpisode.title.trim();
    const sourceUrl = this.podcastEpisode.sourceUrl.trim();

    if (!this.podcastEpisode.podcastId) {
      this.pushError(this.langService.translate('quick_add.select_podcast_series'));
      return;
    }

    if (!title) {
      this.pushError(this.langService.translate('quick_add.enter_podcast_episode_title'));
      return;
    }

    if (!sourceUrl) {
      this.pushError(this.langService.translate('quick_add.enter_podcast_episode_link'));
      return;
    }

    this.isSubmitting = true;
    this.podcastService.submitEpisode({
      podcastId: this.podcastEpisode.podcastId,
      title,
      sourceUrl
    }).subscribe({
      next: () => {
        if (this.destroyed) return;
        this.isSubmitting = false;
        const msg = this.langService.translate('fab.success_podcast_episode');
        this.submittedMessage = msg;
        this.successTypedMessage = '';
        this.currentMode = 'success';
        this.animateSuccessMessage(msg);
      },
      error: () => {
        if (this.destroyed) return;
        this.isSubmitting = false;
        this.pushError(this.langService.translate('quick_add.error_submit_podcast_episode'));
      }
    });
  }

  submitChordRequest(): void {
    if (this.isSubmitting || this.isCheckingChordRequest) {
      return;
    }

    if (!this.chordRequest.songName.trim()) {
      this.pushError(this.langService.translate('quick_add.enter_song_name'));
      return;
    }

    if (!this.chordRequest.artistName.trim()) {
      this.pushError(this.langService.translate('quick_add.enter_artist_name'));
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
        const msg = this.langService.translate('fab.success_chord_request');
        this.submittedMessage = msg;
        this.successTypedMessage = '';
        this.currentMode = 'success';
        this.animateSuccessMessage(msg);
      },
      error: () => {
        this.isSubmitting = false;
        this.pushError(this.langService.translate('quick_add.error_submit_request'));
      }
    });
  }

  onSongAdded(): void {
    const msg = this.langService.translate('fab.success_song');
    this.submittedMessage = msg;
    this.successTypedMessage = '';
    this.currentMode = 'success';
    this.animateSuccessMessage(msg);
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
        this.pushError(this.langService.translate('quick_add.error_upload_image'));
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

  showArticleOptionalFields(): void {
    this.showArticleOptional = true;
    this.scrollToElement('.smart-optional-grid', false);
  }

  toggleArticleImageLinkInput(): void {
    this.showArticleImageLinkInput = !this.showArticleImageLinkInput;
    if (this.showArticleImageLinkInput) {
      this.scrollToElement('.smart-media-link-input', false);
    }
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
        this.pushError(this.langService.translate('quick_add.error_upload_image'));
      }
    });
  }

  clearEventImage(): void {
    this.event.imageUrl = '';
  }

  showEventOptionalFields(): void {
    this.showEventOptional = true;
    this.scrollToElement('.smart-optional-grid', false);
  }

  toggleEventImageLinkInput(): void {
    this.showEventImageLinkInput = !this.showEventImageLinkInput;
    if (this.showEventImageLinkInput) {
      this.scrollToElement('.smart-media-link-input', false);
    }
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

  private loadPodcasts(): void {
    this.isLoadingPodcasts = true;
    this.podcastService.getPublicPodcasts().pipe(
      catchError(() => of([] as Podcast[]))
    ).subscribe({
      next: (podcasts) => {
        this.podcasts = podcasts ?? [];
        if (!this.podcastEpisode.podcastId && this.podcasts.length > 0) {
          this.podcastEpisode.podcastId = this.podcasts[0].id;
        }
        this.isLoadingPodcasts = false;
      },
      error: () => {
        this.podcasts = [];
        this.isLoadingPodcasts = false;
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
    this.scrollToActiveFlowStart(true);
  }

  private async resetConversation(): Promise<void> {
    if (this.isResetting) return;
    this.isResetting = true;

    try {
    const initialStep = this.entryPoint === 'index' ? 'index' : 'root';

    this.currentStep = initialStep;
    this.currentMode = 'choices';
    this.modeOriginStep = initialStep;
    this.isSubmitting = false;
    this.submittedMessage = '';
    this.successTypedMessage = '';
    this.formError = '';
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
    this.podcastSeries = { name: '', sourceUrl: '' };
    this.podcastEpisode = { podcastId: this.podcasts[0]?.id ?? 0, title: '', sourceUrl: '' };
    this.chordRequest = { songName: '', artistName: '' };
    this.chordRequestMatch = null;
    this.chordRequestChecked = false;
    this.isCheckingChordRequest = false;
    this.contactForm = { fullName: '', email: '', subject: '', message: '' };
    this.contactAttachments = [];
    this.botThinking = false;
    this.isTyping = true;
    this.typingMessageId = null;

    if (this.entryPoint === 'contact') {
      this.currentMode = 'contact';
      this.modeOriginStep = 'root';
      this.autoFillContactFromCurrentUser();
      this.scrollToActiveFlowStart(true);
    } else if (this.entryPoint === 'news') {
      await this.typeMessage(this.langService.translate('quick_add.news_form_text'), 'question');
      this.openArticleFlow(ArticleContentType.News);
    } else if (this.entryPoint === 'article') {
      await this.typeMessage(this.langService.translate('quick_add.content_form_text'), 'question');
      this.openArticleFlow(ArticleContentType.Blog);
    } else if (this.entryPoint === 'event') {
      await this.typeMessage(this.langService.translate('quick_add.event_form_text'), 'question');
      this.modeOriginStep = 'root';
      this.currentMode = 'event';
      this.scrollToActiveFlowStart(true);
    } else {
      await this.appendBotStep(initialStep);
    }
    } finally {
      this.isResetting = false;
    }
  }

  private async appendBotStep(step: AssistantStep): Promise<void> {
    const definition = this.getStepDefinition(step);

    await this.typeMessage(definition.question, 'question');

    if (definition.helper) {
      this.isTyping = true;
      this.botThinking = true;
      this.cdr.detectChanges();
      await this.delay(this.HELPER_PAUSE_MS);
      this.botThinking = false;
      await this.typeMessage(definition.helper, 'helper');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      const id = window.setTimeout(resolve, ms);
      this.trackTimer(id);
    });
  }

  private animateSuccessMessage(text: string): void {
    if (this.destroyed) return;
    this.successTypedMessage = '';
    let i = 0;
    const id = window.setInterval(() => {
      if (this.destroyed) { clearInterval(id); return; }
      i++;
      this.successTypedMessage = text.substring(0, i);
      this.cdr.detectChanges();
      if (i >= text.length) {
        clearInterval(id);
      }
    }, this.TYPING_SPEED_MS);
    this.trackTimer(id);
  }

  private pushError(text: string): void {
    if (this.destroyed) return;
    if (this.currentMode === 'choices') {
      this.messages = [...this.messages, {
        id: `bot-${this.messages.length + 1}`,
        tone: 'helper' as MessageTone,
        text
      }];
      this.scrollToBottomSmooth();
    } else {
      this.formError = text;
      this.cdr.detectChanges();
      const id = window.setTimeout(() => {
        if (!this.destroyed) { this.formError = ''; this.cdr.detectChanges(); }
      }, 4000);
      this.trackTimer(id);
    }
  }

  private typeMessage(text: string, tone: MessageTone): Promise<void> {
    return new Promise<void>(resolve => {
      if (this.destroyed) { resolve(); return; }
      this.botThinking = true;
      this.cdr.detectChanges();

      const thinkingId = window.setTimeout(() => {
        if (this.destroyed) { resolve(); return; }
        this.botThinking = false;
        const messageId = `bot-${this.messages.length + 1}`;
        const message: AssistantMessage = { id: messageId, tone, text: '' };
        this.messages = [...this.messages, message];
        this.isTyping = true;
        this.typingMessageId = messageId;
        this.playPopSound();
        this.scrollToBottomSmooth();

        let charIndex = 0;
        const totalChars = text.length;
        const typingId = window.setInterval(() => {
          if (this.destroyed) { clearInterval(typingId); resolve(); return; }
          charIndex++;
          this.messages = this.messages.map(m =>
            m.id === messageId ? { ...m, text: text.substring(0, charIndex) } : m
          );

          if (charIndex >= totalChars) {
            clearInterval(typingId);
            this.isTyping = false;
            this.typingMessageId = null;
            this.cdr.detectChanges();
            this.scrollToBottomSmooth();
            resolve();
          }
        }, this.TYPING_SPEED_MS);
        this.trackTimer(typingId);
      }, this.THINKING_DELAY_MS);
      this.trackTimer(thinkingId);
    });
  }

  private getAudioContext(): AudioContext | null {
    if (this.destroyed) return null;
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      try { this.audioCtx = new AudioContext(); } catch { return null; }
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx.state !== 'closed' ? this.audioCtx : null;
  }

  private playPopSound(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } catch { /* audio not available */ }
  }

  private playClickSound(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch { /* audio not available */ }
  }

  private scrollToBottomSmooth(): void {
    if (this.destroyed || this.currentMode !== 'choices') return;
    const id = window.setTimeout(() => {
      if (this.destroyed) return;
      const content = document.querySelector('.modal-content');
      if (content) {
        content.scrollTo({ top: content.scrollHeight, behavior: 'smooth' });
      }
    }, 20);
    this.trackTimer(id);
  }

  private scrollToActiveFlowStart(focusFirstField: boolean): void {
    this.scrollToElement('.embedded-flow', focusFirstField);
  }

  private scrollToElement(targetSelector: string, focusFirstField: boolean): void {
    const id = window.setTimeout(() => {
      if (this.destroyed) return;

      const content = document.querySelector('.modal-content') as HTMLElement | null;
      const target = document.querySelector(targetSelector) as HTMLElement | null;
      if (!content || !target) return;

      const contentRect = content.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetTop = content.scrollTop + targetRect.top - contentRect.top;

      content.scrollTo({
        top: Math.max(0, targetTop - 8),
        behavior: 'smooth'
      });

      if (!focusFirstField) return;

      const focusId = window.setTimeout(() => {
        if (this.destroyed) return;
        const firstField = target.querySelector(
          'input:not([type="file"]):not([hidden]), textarea, select'
        ) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;

        firstField?.focus({ preventScroll: true });
      }, 180);

      this.trackTimer(focusId);
    }, 40);

    this.trackTimer(id);
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
      case 'podcast':
        return {
          question: t('fab.podcast_question'),
          options: [
            { id: 'podcast-series', label: t('fab.opt_podcast_series'), action: 'podcast-series' },
            { id: 'podcast-episode', label: t('fab.opt_podcast_episode'), action: 'podcast-episode' }
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
          { id: 'podcast', label: t('fab.opt_podcast'), nextStep: 'podcast' },
          { id: 'index', label: t('fab.opt_index'), nextStep: 'index' },
          { id: 'artist', label: t('fab.opt_artist'), nextStep: 'artist' },
          { id: 'chord-request', label: t('fab.opt_chord_request'), action: 'chord-request', isSecondary: true },
          { id: 'contact-form', label: t('fab.opt_contact_form'), action: 'contact-form', isSecondary: true }
        );

        const userName = this.authService.currentUserValue?.username;
        const rawQuestion = t('fab.root_question');
        const baseQuestion = userName
          ? `${t('fab.root_greeting_prefix')} ${userName}, ${rawQuestion}`
          : rawQuestion;

        return {
          question: baseQuestion,
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
      this.pushError(this.langService.translate('quick_add.enter_full_name'));
      return;
    }

    if (!this.contactForm.email.trim() || !this.contactForm.email.includes('@')) {
      this.pushError(this.langService.translate('quick_add.enter_valid_email'));
      return;
    }

    if (!this.contactForm.subject.trim()) {
      this.pushError(this.langService.translate('quick_add.select_subject'));
      return;
    }

    if (!this.contactForm.message.trim()) {
      this.pushError(this.langService.translate('quick_add.enter_message'));
      return;
    }

    if (this.contactAttachments.some(a => a.uploading)) {
      this.pushError(this.langService.translate('quick_add.wait_upload'));
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
        const msg = this.langService.translate('fab.success_contact');
        this.submittedMessage = msg;
        this.successTypedMessage = '';
        this.currentMode = 'success';
        this.animateSuccessMessage(msg);
      },
      error: () => {
        this.isSubmitting = false;
        this.pushError(this.langService.translate('quick_add.error_submit_message'));
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
