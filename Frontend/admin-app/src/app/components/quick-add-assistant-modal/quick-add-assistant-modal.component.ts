import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { AddSongModalComponent } from '../add-song-modal/add-song-modal.component';
import { ArticleService } from '../../services/admin/article.service';
import { EventService } from '../../services/admin/event.service';
import { MediaService } from '../../services/admin/media.service';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { ArtistService } from '../../services/artist.service';
import { CreateArticleDto, ArticleContentType, ArticleStatus } from '../../models/article.model';
import { CreateEventDto } from '../../models/event.model';
import { UserWithProfileDto } from '../../models/user.model';
import { ArtistListDto } from '../../models/artist.model';

export type QuickAddAction =
  | 'index-teacher'
  | 'index-service-provider'
  | 'artist-account'
  | 'artist-community'
  | 'contact'
  | 'admin-edit';

type AssistantStep = 'root' | 'content' | 'index' | 'artist';
type AssistantMode = 'choices' | 'song' | 'article' | 'event' | 'success';
type MessageTone = 'question' | 'helper' | 'user';

interface AssistantOption {
  id: string;
  label: string;
  action?: QuickAddAction | 'song' | 'content-news' | 'content-article' | 'event';
  nextStep?: AssistantStep;
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

  profileSearchQuery = '';
  profileSearchResults: UserWithProfileDto[] = [];
  profileSearchLoading = false;
  selectedUploaderProfile: UserWithProfileDto | null = null;
  showProfileDropdown = false;
  tagAsMyself = true;
  private readonly profileSearch$ = new Subject<string>();
  eventArtists: ArtistListDto[] = [];
  selectedEventArtistIds: number[] = [];
  eventArtistSearchQuery = '';
  isLoadingEventArtists = false;
  showEventArtistDropdown = false;

  constructor() {
    this.initProfileSearch();
    this.autoFillUploaderFromCurrentUser();
    this.loadEventArtists();
    this.resetConversation();
  }

  get currentOptions(): AssistantOption[] {
    return this.currentMode === 'choices' ? this.getStepDefinition(this.currentStep).options : [];
  }

  get articleOptionalLabel(): string {
    return 'עוד כמה פרטים להשלמת החוויה, לא חובה';
  }

  get eventOptionalLabel(): string {
    return 'עוד כמה פרטים להשלמת החוויה, לא חובה';
  }

  get isAdminUser(): boolean {
    return Number(this.authService.currentUserValue?.role) >= 3;
  }

  get isProfessionalNonAdmin(): boolean {
    return (this.authService.currentUserValue?.hasProfessionalProfile ?? false) && !this.isAdminUser;
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

  onProfileSearchInput(): void {
    this.profileSearch$.next(this.profileSearchQuery);
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

  getProfileTypeLabel(type: string): string {
    return type === 'artist' ? 'אמן' : 'מורה / נותן שירות';
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
      case 'index':
        return {
          question: 'הבנתי, איזה פרופיל תרצה לאינדקס?',
          options: [
            { id: 'index-teacher', label: 'מורה', action: 'index-teacher' },
            { id: 'index-service-provider', label: 'נותן שירות', action: 'index-service-provider' }
          ]
        };
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
          { id: 'contact', label: 'יצירת קשר', action: 'contact' }
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
      uploaderProfileType: undefined
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

  private autoFillUploaderFromCurrentUser(): void {
    if (!this.isProfessionalNonAdmin) {
      return;
    }

    this.userService.getMyUploaderProfile().subscribe(profile => {
      if (profile) {
        this.selectUploaderProfile(profile);
        this.tagAsMyself = true;
      }
    });
  }

  private initProfileSearch(): void {
    this.profileSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        this.profileSearchLoading = true;
        return this.userService.searchUsersWithProfiles(query, 20).pipe(catchError(() => of([])));
      })
    ).subscribe({
      next: (results) => {
        this.profileSearchResults = results;
        this.profileSearchLoading = false;
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
