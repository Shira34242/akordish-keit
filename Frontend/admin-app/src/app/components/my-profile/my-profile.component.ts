import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { PagedResult } from '../../models/pagination.model';
import { AuthService, User } from '../../services/auth.service';
import { LikedContentService } from '../../services/liked-content.service';
import { LikedContent } from '../../models/liked-content.model';
import { SongService } from '../../services/song.service';
import { SongBasicDto } from '../../models/song.model';
import { EventDto, EventService } from '../../services/event.service';
import { ArticleService, ArticleDto } from '../../services/article.service';
import { UserService } from '../../services/user.service';
import { UserWithProfileDto } from '../../models/user.model';
import { KnownChordInstrument, UserKnownChord, UserKnownChordService } from '../../services/user-known-chord.service';
import { ArtistEditModalComponent } from '../admin/artists/artist-edit-modal.component';
import { ServiceProviderFormComponent } from '../admin/service-providers/service-provider-form.component';
import { TeacherFormComponent } from '../admin/teachers/teacher-form.component';
import { SubscriptionService } from '../../services/subscription.service';
import { SubscriptionDto, SubscriptionPlan, SubscriptionStatus } from '../../models/subscription.model';
import { QuickAddAssistantService } from '../../services/quick-add-assistant.service';
import { SongCardComponent } from '../shared/song-card/song-card.component';
import { NewsBannerComponent } from '../shared/news-banner/news-banner.component';
import { EventCardComponent } from '../shared/event-card/event-card.component';
import { EventModalComponent } from '../shared/event-modal/event-modal.component';
import { EventCardData } from '../../utils/event.utils';
import { Article, ArticleContentType, ArticleStatus } from '../../models/article.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { ProfileReminderService } from '../../services/profile-reminder.service';
import { getArticleLink } from '../../utils/article-route.utils';
import { artistPath } from '../../utils/slug';

interface ProfileSongCard {
  id: number;
  title: string;
  imageUrl?: string;
  isApproved?: boolean;
  artists: Array<{ name: string }>;
}

interface ProfileArticleCard {
  id: number;
  title: string;
  slug: string;
  imageUrl?: string;
  featuredImageUrl?: string;
  shortDescription?: string;
  contentType?: number;
  status?: number;
}

@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ArtistEditModalComponent,
    ServiceProviderFormComponent,
    TeacherFormComponent,
    SongCardComponent,
    NewsBannerComponent,
    EventCardComponent,
    EventModalComponent,
    TranslatePipe
  ],
  templateUrl: './my-profile.component.html',
  styleUrls: ['./my-profile.component.css']
})
export class MyProfileComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild('avatarInput') avatarInput!: ElementRef<HTMLInputElement>;
  @ViewChild('profileHero') profileHero?: ElementRef<HTMLDivElement>;
  private fullHeroHeight = 0;
  private heroRafPending = false;
  private expandedAvatarSize = 160;
  private expandedAvatarBottom = -68;

  readonly accountWarningTitle = '\u05e9\u05d9\u05e0\u05d5\u05d9 \u05e1\u05d5\u05d2 \u05d7\u05e9\u05d1\u05d5\u05df';
  readonly accountWarningSubtitle = '\u05dc\u05d0 \u05d0\u05e4\u05e9\u05e8 \u05dc\u05d4\u05d9\u05d5\u05ea \u05d1\u05e2\u05dc\u05d9\u05dd \u05e9\u05dc \u05d9\u05d5\u05ea\u05e8 \u05de\u05d3\u05e3 \u05d0\u05d7\u05d3. \u05d1\u05dc\u05d7\u05d9\u05e6\u05d4 \u05e2\u05dc \u05e2\u05d6\u05d5\u05d1 \u05d3\u05e3 \u05d4\u05d3\u05e3 \u05d9\u05d9\u05e9\u05d0\u05e8 \u05d1\u05de\u05e6\u05d1\u05d5 \u05d4\u05e0\u05d5\u05db\u05d7\u05d9, \u05d0\u05da \u05d9\u05ea\u05e0\u05ea\u05e7 \u05de\u05d4\u05de\u05e9\u05ea\u05de\u05e9 \u05d5\u05d4\u05d7\u05e9\u05d1\u05d5\u05df \u05d9\u05ea\u05e0\u05ea\u05e7.';
  readonly accountWarningContinueLabel = '\u05e2\u05d6\u05d5\u05d1 \u05d3\u05e3';
  readonly accountWarningCancelLabel = '\u05d1\u05d9\u05d8\u05d5\u05dc';
  readonly accountWarningErrorLabel = '\u05dc\u05d0 \u05d4\u05e6\u05dc\u05d7\u05e0\u05d5 \u05dc\u05e0\u05ea\u05e7 \u05d0\u05ea \u05d4\u05d3\u05e3 \u05db\u05e8\u05d2\u05e2. \u05e0\u05e1\u05d5 \u05e9\u05d5\u05d1.';

  user: User | null = null;
  uploadingAvatar = false;
  myPageInfo: UserWithProfileDto | null = null;
  myPages: UserWithProfileDto[] = [];

  mySongs: ProfileSongCard[] = [];
  myArticles: ProfileArticleCard[] = [];
  myEvents: EventCardData[] = [];
  likedContent: LikedContent[] = [];
  selectedEventModal: EventCardData | null = null;
  knownChords: UserKnownChord[] = [];
  knownChordInstruments: KnownChordInstrument[] = ['guitar', 'piano', 'ukulele'];
  quickAddingBasic: Record<KnownChordInstrument, boolean> = {
    guitar: false,
    piano: false,
    ukulele: false
  };
  quickRemovingAll: Record<KnownChordInstrument, boolean> = {
    guitar: false,
    piano: false,
    ukulele: false
  };
  readonly basicChordsByInstrument: Record<KnownChordInstrument, string[]> = {
    guitar: ['C', 'D', 'E', 'G', 'A', 'Am', 'Dm', 'Em', 'F', 'Bm', 'B7', 'D7', 'E7', 'G7'],
    piano: ['C', 'D', 'E', 'G', 'A', 'Am', 'Dm', 'Em', 'F', 'Bm', 'B7', 'D7', 'E7', 'G7'],
    ukulele: ['C', 'D', 'F', 'G', 'A', 'Am', 'Dm', 'Em', 'Fmaj7', 'G7', 'A7', 'C7']
  };

  showEditPageModal = false;
  marketingSaving = false;
  editPageType: 'artist' | 'teacher' | 'provider' | null = null;
  editPageId: number | null = null;

  subscription: SubscriptionDto | null = null;
  pageLoadError = false;
  togglingPageId: number | null = null;
  songsPage = 1;
  articlesPage = 1;
  eventsPage = 1;
  hasMoreSongs = false;
  hasMoreArticles = false;
  hasMoreEvents = false;
  isLoadingMoreSongs = false;
  isLoadingMoreArticles = false;
  isLoadingMoreEvents = false;
  visibleLikedCount = 4;

  showAccountTypeModal = false;
  leavingCurrentPage = false;

  readonly MAX_LEVEL = 3;
  readonly levelSteps = [0, 1, 2, 3];
  readonly levelThresholds = [0, 1, 5, 20];
  readonly levelDisplayPositions = [3, 20, 43, 97];
  readonly DISPLAY_POINTS_MULTIPLIER = 10;
  progressAnimated = false;

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (this.heroRafPending) return;
    this.heroRafPending = true;
    requestAnimationFrame(() => {
      this.shrinkHero();
      this.heroRafPending = false;
    });
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.initHeroHeight();
  }

  constructor(
    private authService: AuthService,
    private likedContentService: LikedContentService,
    private songService: SongService,
    private eventService: EventService,
    private articleService: ArticleService,
    private userService: UserService,
    private userKnownChordService: UserKnownChordService,
    private subscriptionService: SubscriptionService,
    private router: Router,
    private quickAddAssistantService: QuickAddAssistantService,
    private profileReminderService: ProfileReminderService,
    public langService: LanguageService
  ) {}

  ngOnInit() {
    this.user = this.authService.currentUserValue;
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.user = user;
      });

    this.authService.refreshSession()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.user = response.user;
        },
        error: () => {}
      });

    this.loadMySongs();
    this.loadMyArticles();
    this.loadMyEvents();
    this.loadLikedSongs();
    this.loadKnownChords();
    this.loadMyProfileDetails();
    this.loadMyPageInfo();
    this.loadMyAllPages();
    this.loadSubscription();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initHeroHeight(), 0);
    setTimeout(() => this.progressAnimated = true, 120);
  }

  private initHeroHeight(): void {
    const hero = this.profileHero?.nativeElement;
    if (!hero) return;

    this.fullHeroHeight = 300;
    this.expandedAvatarSize = window.innerWidth <= 600 ? 144 : 160;
    this.expandedAvatarBottom = window.innerWidth <= 600 ? -60 : -68;
    hero.style.height = `${this.fullHeroHeight}px`;
    hero.style.setProperty('--profile-hero-full-height', `${this.fullHeroHeight}px`);
    this.shrinkHero();
  }

  private shrinkHero(): void {
    const hero = this.profileHero?.nativeElement;
    if (!hero || this.fullHeroHeight === 0) return;

    const minHeight = 56;
    const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
    const collapseRange = this.fullHeroHeight - minHeight;
    const progress = collapseRange > 0
      ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
      : 0;
    const avatarSize = this.expandedAvatarSize - ((this.expandedAvatarSize - 88) * progress);
    const avatarBottom = this.expandedAvatarBottom + ((-24 - this.expandedAvatarBottom) * progress);

    hero.style.height = `${newHeight}px`;
    hero.style.setProperty('--profile-collapse-progress', String(progress));
    hero.style.setProperty('--profile-avatar-size', `${avatarSize}px`);
    hero.style.setProperty('--profile-avatar-bottom', `${avatarBottom}px`);
  }

  get profileIncomplete(): boolean {
    return !this.user?.phone || !this.user?.cityId || !this.user?.address || !this.user?.birthDate;
  }

  get canViewChordRequests(): boolean {
    return !!this.user && ((this.user.hasProfessionalProfile ?? false) || (this.user.contentTag ?? 0) >= 2 || this.authService.isAdminOrManager(this.user));
  }

  openProfileCompletion(): void {
    this.profileReminderService.requestProfileCompletion();
  }

  toggleMarketingConsent(): void {
    if (!this.user || this.marketingSaving) return;

    const nextValue = !(this.user.marketingConsent ?? false);
    this.marketingSaving = true;

    this.authService.updateMarketingConsent(nextValue).subscribe({
      next: (updatedUser) => {
        this.user = updatedUser;
        this.marketingSaving = false;
      },
      error: () => {
        this.marketingSaving = false;
      }
    });
  }

  triggerAvatarUpload() {
    this.avatarInput.nativeElement.click();
  }

  onAvatarFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.uploadingAvatar = true;
    this.userService.uploadProfileImage(file).subscribe({
      next: (url) => {
        this.userService.updateMyProfile({ profileImageUrl: url }).subscribe({
          next: () => {
            if (this.user) {
              this.user = { ...this.user, profileImageUrl: url };
              this.authService.updateCurrentUser(this.user);
            }
            this.uploadingAvatar = false;
          },
          error: () => { this.uploadingAvatar = false; }
        });
      },
      error: () => { this.uploadingAvatar = false; }
    });

    (event.target as HTMLInputElement).value = '';
  }

  private loadMyProfileDetails() {
    this.userService.getMyProfile().subscribe({
      next: (data) => {
        if (this.user) {
          this.user = {
            ...this.user,
            phone: data.phone,
            address: data.address,
            birthDate: data.birthDate,
            contentTag: data.contentTag ?? this.user.contentTag,
            uploadCount: data.uploadCount ?? this.user.uploadCount
          };
          this.authService.updateCurrentUser(this.user);
        }
      },
      error: () => {}
    });
  }

  private loadMySongs() {
    this.songService.getMySongs(this.songsPage).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result: PagedResult<any>) => {
        this.mySongs = result.items.map((song: any) => this.toProfileSongCard(song));
        this.hasMoreSongs = result.hasNextPage;
      },
      error: () => { this.mySongs = []; }
    });
  }

  private loadMyArticles() {
    this.articleService.getMyArticles(this.articlesPage).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result: PagedResult<any>) => {
        this.myArticles = result.items.map((article: any) => this.toProfileArticleCard(article));
        this.hasMoreArticles = result.hasNextPage;
      },
      error: () => { this.myArticles = []; }
    });
  }

  private loadMyEvents() {
    this.eventService.getMyEvents(this.eventsPage).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result: PagedResult<any>) => {
        this.myEvents = result.items.map((event: any) => this.toEventCardData(event));
        this.hasMoreEvents = result.hasNextPage;
      },
      error: () => { this.myEvents = []; }
    });
  }

  private loadLikedSongs() {
    this.likedContentService.getUserLikedContent().subscribe({
      next: (items) => {
        this.likedContent = items.slice(0, 6);
      },
      error: () => {
        this.likedContent = [];
      }
    });
  }

  private toProfileSongCard(song: SongBasicDto): ProfileSongCard {
    const artistNames = song.artistNames
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);

    return {
      id: song.id,
      title: song.title,
      imageUrl: song.imageUrl,
      isApproved: song.isApproved,
      artists: artistNames.map(name => ({ name }))
    };
  }

  private toProfileArticleCard(article: ArticleDto): ProfileArticleCard {
    return {
      id: article.id,
      title: article.title,
      slug: article.slug,
      imageUrl: article.featuredImageUrl || article.imageUrl,
      featuredImageUrl: article.featuredImageUrl || article.imageUrl,
      shortDescription: article.shortDescription,
      contentType: article.contentType,
      status: (article as ArticleDto & { status?: number }).status
    };
  }

  private toEventCardData(event: EventDto): EventCardData {
    return {
      id: event.id,
      name: event.name,
      imageUrl: event.imageUrl,
      ticketUrl: event.ticketUrl,
      eventDate: event.eventDate,
      location: event.location,
      artistName: event.artistName,
      eventStatus: this.getEventStatusLabel(event.eventDate),
      isPast: new Date(event.eventDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0),
      isApproved: event.isActive
    };
  }

  private getEventStatusLabel(eventDate: string): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = new Date(eventDate);
    target.setHours(0, 0, 0, 0);

    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return this.langService.translate('profile.expired');
    if (diffDays === 0) return this.langService.translate('profile.today');
    return this.langService.translate('profile.soon');
  }

  private loadKnownChords() {
    this.userKnownChordService.ensureLoaded('guitar').subscribe(() => this.refreshKnownChords());
    this.userKnownChordService.ensureLoaded('piano').subscribe(() => this.refreshKnownChords());
    this.userKnownChordService.ensureLoaded('ukulele').subscribe(() => this.refreshKnownChords());
  }

  private refreshKnownChords() {
    this.userKnownChordService.getKnownChords().subscribe(chords => {
      this.knownChords = chords;
    });
  }

  getKnownChordsForInstrument(instrument: KnownChordInstrument): UserKnownChord[] {
    return this.knownChords.filter(chord => chord.instrument === instrument);
  }

  getSafeInstrumentLabel(instrument: KnownChordInstrument): string {
    const keys: Record<KnownChordInstrument, string> = {
      guitar: 'profile.instrument_guitar',
      piano: 'profile.instrument_piano',
      ukulele: 'profile.instrument_ukulele'
    };
    return this.langService.translate(keys[instrument]);
  }

  getInstrumentLabel(instrument: KnownChordInstrument): string {
    return this.getSafeInstrumentLabel(instrument);
  }

  getMissingBasicChordCount(instrument: KnownChordInstrument): number {
    const known = new Set(
      this.getKnownChordsForInstrument(instrument)
        .map(chord => this.userKnownChordService.normalizeChordName(chord.chordName))
    );

    return this.basicChordsByInstrument[instrument]
      .filter(chord => !known.has(this.userKnownChordService.normalizeChordName(chord)))
      .length;
  }

  addBasicKnownChords(instrument: KnownChordInstrument) {
    const known = new Set(
      this.getKnownChordsForInstrument(instrument)
        .map(chord => this.userKnownChordService.normalizeChordName(chord.chordName))
    );
    const missing = this.basicChordsByInstrument[instrument]
      .filter(chord => !known.has(this.userKnownChordService.normalizeChordName(chord)));

    if (missing.length === 0 || this.quickAddingBasic[instrument]) return;

    this.quickAddingBasic[instrument] = true;
    forkJoin(missing.map(chord => this.userKnownChordService.add(instrument, chord))).subscribe({
      next: () => {
        this.quickAddingBasic[instrument] = false;
        this.refreshKnownChords();
      },
      error: () => {
        this.quickAddingBasic[instrument] = false;
      }
    });
  }

  removeKnownChord(chord: UserKnownChord) {
    this.userKnownChordService.remove(chord.instrument, chord.chordName).subscribe(removed => {
      if (removed) {
        this.knownChords = this.knownChords.filter(item => item.id !== chord.id);
      }
    });
  }

  removeAllKnownChords(instrument: KnownChordInstrument) {
    const chords = this.getKnownChordsForInstrument(instrument);
    if (chords.length === 0 || this.quickRemovingAll[instrument]) return;

    const confirmed = window.confirm(`${this.langService.translate('profile.confirm_remove_all')} ${this.getInstrumentLabel(instrument)}?`);
    if (!confirmed) return;

    this.quickRemovingAll[instrument] = true;
    forkJoin(chords.map(chord => this.userKnownChordService.remove(instrument, chord.chordName))).subscribe({
      next: (results) => {
        this.quickRemovingAll[instrument] = false;
        if (results.every(Boolean)) {
          this.knownChords = this.knownChords.filter(item => item.instrument !== instrument);
        } else {
          this.refreshKnownChords();
        }
      },
      error: () => {
        this.quickRemovingAll[instrument] = false;
        this.refreshKnownChords();
      }
    });
  }

  private loadSubscription() {
    if (!this.user?.id) return;
    this.subscriptionService.getUserActiveSubscription(this.user.id).subscribe({
      next: (sub) => { this.subscription = sub; },
      error: () => { this.subscription = null; }
    });
  }

  getSubscriptionBadgeText(): string {
    if (!this.subscription || this.subscription.plan === SubscriptionPlan.Free) return 'FREE';
    return 'PRO';
  }

  getSubscriptionBadgeClass(): string {
    if (!this.subscription || this.subscription.plan === SubscriptionPlan.Free) return 'sub-badge--free';
    return 'sub-badge--pro';
  }

  getSubscriptionStatusDotClass(): string {
    if (!this.subscription) return 'status-dot--inactive';
    switch (this.subscription.status) {
      case SubscriptionStatus.Active:
      case SubscriptionStatus.Trial:
        return 'status-dot--active';
      case SubscriptionStatus.PendingPayment:
      case SubscriptionStatus.Cancelled:
        return 'status-dot--pending';
      default:
        return 'status-dot--inactive';
    }
  }

  getSubscriptionStatusText(): string {
    return this.getSafeSubscriptionStatusText();
  }

  getSafeSubscriptionStatusText(): string {
    const t = (k: string) => this.langService.translate(k);
    if (!this.subscription) return t('profile.sub_free');
    switch (this.subscription.status) {
      case SubscriptionStatus.Active: return t('profile.sub_active');
      case SubscriptionStatus.Trial: return t('profile.sub_trial');
      case SubscriptionStatus.PendingPayment: return t('profile.sub_pending');
      case SubscriptionStatus.Cancelled: return t('profile.sub_cancelled');
      case SubscriptionStatus.Expired: return t('profile.sub_expired');
      case SubscriptionStatus.Suspended: return t('profile.sub_suspended');
      default: return t('profile.sub_inactive');
    }
  }

  navigateToUpgrade() {
    const types = this.myPages.map(page => {
      if (page.profileType === 'artist') return 'artist';
      if (page.isTeacher) return 'teacher';
      return 'service-provider';
    });

    if (types.length === 0) {
      this.router.navigate(['/subscription/select']);
      return;
    }

    this.router.navigate(['/subscription/select'], {
      queryParams: { types: types.join(','), primary: types[0] }
    });
  }

  canUpgradeSubscription(): boolean {
    if (!this.subscription) return true;
    return this.subscription.plan !== SubscriptionPlan.Premium;
  }

  private loadMyPageInfo() {
    this.userService.getMyUploaderProfile().subscribe({
      next: (info) => {
        this.myPageInfo = info;
        this.pageLoadError = false;
      },
      error: () => { this.pageLoadError = true; }
    });
  }

  private loadMyAllPages() {
    this.userService.getMyAllPages().subscribe({
      next: (pages) => { this.myPages = pages; },
      error: () => { this.myPages = []; }
    });
  }

  openEditPageModal(page: UserWithProfileDto) {
    this.editPageId = page.profileId;

    if (page.profileType === 'artist') {
      this.editPageType = 'artist';
    } else if (page.isTeacher) {
      this.editPageType = 'teacher';
    } else {
      this.editPageType = 'provider';
    }

    this.showEditPageModal = true;
  }

  closeEditPageModal() {
    this.showEditPageModal = false;
    this.editPageType = null;
    this.editPageId = null;
    this.loadMyPageInfo();
    this.loadMyAllPages();
  }

  openManageAccountFlow(): void {
    if (this.myPages.length === 0) {
      this.openIndexProfileFlow();
      return;
    }

    this.showAccountTypeModal = true;
  }

  closeAccountTypeModal(): void {
    if (this.leavingCurrentPage) {
      return;
    }

    this.showAccountTypeModal = false;
  }

  getPageLabel(page: UserWithProfileDto): string {
    if (page.profileType === 'artist') return this.langService.translate('profile.page_type_artist');
    if (page.isTeacher) return this.langService.translate('profile.page_type_teacher');
    if (page.categories?.length > 0) return page.categories[0];
    return this.langService.translate('profile.page_type_provider');
  }

  getPageStatusClass(page?: UserWithProfileDto): string {
    const status = (page ?? this.myPageInfo)?.status;
    if (status === 'Active') return 'status-dot--active';
    if (status === 'Pending') return 'status-dot--pending';
    return 'status-dot--inactive';
  }

  getPageStatusLabel(page?: UserWithProfileDto): string {
    const status = (page ?? this.myPageInfo)?.status;
    if (status === 'Active') return this.langService.translate('profile.page_active');
    if (status === 'Pending') return this.langService.translate('profile.page_pending_approval');
    return this.langService.translate('profile.page_off');
  }

  isPageActive(page: UserWithProfileDto): boolean {
    return page.status === 'Active';
  }

  canTogglePage(page: UserWithProfileDto): boolean {
    return page.status !== 'Pending';
  }

  togglePageVisibility(page: UserWithProfileDto): void {
    if (!this.canTogglePage(page) || this.togglingPageId === page.profileId) {
      return;
    }

    const nextIsActive = !this.isPageActive(page);
    this.togglingPageId = page.profileId;

    this.userService.setPageVisibility({
      profileType: page.profileType === 'artist' ? 'artist' : 'serviceProvider',
      profileId: page.profileId,
      isActive: nextIsActive
    }).subscribe({
      next: (updatedPage) => {
        this.togglingPageId = null;
        if (!updatedPage) return;

        this.myPages = this.myPages.map(item =>
          item.profileType === updatedPage.profileType && item.profileId === updatedPage.profileId
            ? updatedPage
            : item
        );

        if (this.myPageInfo?.profileType === updatedPage.profileType && this.myPageInfo?.profileId === updatedPage.profileId) {
          this.myPageInfo = updatedPage;
        }
      },
      error: () => {
        this.togglingPageId = null;
      }
    });
  }

  getAddPageUrl(type: 'artist' | 'teacher' | 'provider'): string {
    if (type === 'artist') return '/artist/create';
    if (type === 'teacher') return '/teacher/create';
    return '/service-provider/create';
  }

  private getManagedPage(): UserWithProfileDto | null {
    return this.myPageInfo ?? this.myPages[0] ?? null;
  }

  leaveCurrentPage(): void {
    if (this.leavingCurrentPage) {
      return;
    }

    const page = this.getManagedPage();
    if (!page) {
      this.openIndexProfileFlow();
      return;
    }

    this.leavingCurrentPage = true;
    this.userService.revokePage(page.profileType, page.profileId).subscribe({
      next: (ok) => {
        this.leavingCurrentPage = false;

        if (!ok) {
          window.alert(this.accountWarningErrorLabel);
          return;
        }

        this.myPages = this.myPages.filter(
          item => !(item.profileType === page.profileType && item.profileId === page.profileId)
        );
        if (this.myPageInfo?.profileType === page.profileType && this.myPageInfo?.profileId === page.profileId) {
          this.myPageInfo = this.myPages[0] ?? null;
        }

        this.showAccountTypeModal = false;
        this.authService.logout();
        void this.router.navigate(['/']);
      },
      error: () => {
        this.leavingCurrentPage = false;
        window.alert(this.accountWarningErrorLabel);
      }
    });
  }

  openIndexProfileFlow(): void {
    this.closeAccountTypeModal();
    this.quickAddAssistantService.requestOpen('index');
  }

  getPageTypeName(): string {
    return this.myPageInfo ? this.getPageLabel(this.myPageInfo) : this.langService.translate('profile.page_type_user');
  }

  getEditPageUrl(page?: UserWithProfileDto): string {
    const targetPage = page ?? this.myPageInfo;
    if (!targetPage) return '/service-provider/create';
    if (targetPage.profileType === 'artist') return '/artist/create';
    if (targetPage.isTeacher) return '/teacher/create';
    return '/service-provider/create';
  }

  getViewPageUrl(page?: UserWithProfileDto): string {
    const profilePage = page ?? this.myPageInfo;
    if (!profilePage) {
      return '/professionals';
    }

    if (profilePage.profileType === 'artist') {
      return artistPath({ id: profilePage.profileId, name: profilePage.displayName });
    }

    if (profilePage.isTeacher) {
      return `/teacher/${profilePage.profileId}`;
    }

    return `/professional/${profilePage.profileId}`;
  }

  getLevelNumber(): number {
    const tag = this.user?.contentTag ?? 0;
    if (tag >= 3) return 3;
    if (tag >= 2) return 2;
    if (tag >= 1) return 1;
    return 0;
  }

  getLevelName(level = this.getLevelNumber()): string {
    const keys: Record<number, string> = {
      0: 'profile.level_0',
      1: 'profile.level_1',
      2: 'profile.level_2',
      3: 'profile.level_3'
    };
    return this.langService.translate(keys[level]);
  }

  getContributionPoints(): number {
    return this.user?.uploadCount ?? 0;
  }

  getDisplayPoints(): number {
    return this.getContributionPoints() * this.DISPLAY_POINTS_MULTIPLIER;
  }

  getLevelThreshold(level: number): number {
    return this.levelThresholds[level] ?? 0;
  }

  getDisplayLevelThreshold(level: number): number {
    return this.getLevelThreshold(level) * this.DISPLAY_POINTS_MULTIPLIER;
  }

  getLevelCheckpointDisplayPercent(level: number): number {
    return this.levelDisplayPositions[level] ?? 0;
  }

  getLevelTrackPercent(): number {
    const points = this.getContributionPoints();
    if (points >= this.levelThresholds[this.MAX_LEVEL]) {
      return this.levelDisplayPositions[this.MAX_LEVEL];
    }

    for (let level = 0; level < this.MAX_LEVEL; level++) {
      const startPoints = this.levelThresholds[level];
      const endPoints = this.levelThresholds[level + 1];
      if (points <= endPoints) {
        const segmentProgress = Math.max(0, (points - startPoints) / (endPoints - startPoints));
        const startPosition = this.levelDisplayPositions[level];
        const endPosition = this.levelDisplayPositions[level + 1];
        return startPosition + ((endPosition - startPosition) * segmentProgress);
      }
    }

    return this.levelDisplayPositions[0];
  }

  getNextThreshold(): number {
    const tag = this.user?.contentTag ?? 0;
    switch (tag) {
      case 0: return 1;
      case 1: return 5;
      case 2: return 20;
      default: return -1;
    }
  }

  getUploadsForNextLevel(): number {
    const count = this.user?.uploadCount ?? 0;
    const threshold = this.getNextThreshold();
    if (threshold < 0) return 0;
    return Math.max(0, threshold - count);
  }

  isMaxLevel(): boolean {
    return (this.user?.contentTag ?? 0) >= this.MAX_LEVEL;
  }

  getLevelProgressText(): string {
    if (this.isMaxLevel()) {
      return this.langService.translate('profile.level_max');
    }
    const needed = this.getUploadsForNextLevel() * this.DISPLAY_POINTS_MULTIPLIER;
    return this.langService.translate('profile.level_needed_prefix') + needed + this.langService.translate('profile.level_needed_suffix');
  }

  getRelativeTime(dateStr: string | Date): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return this.langService.translate('profile.uploaded_today');
    if (diffDays === 1) return this.langService.translate('profile.uploaded_yesterday');
    if (diffDays < 14) return this.langService.translate('profile.uploaded_days_ago_prefix') + diffDays + this.langService.translate('profile.uploaded_days_ago_suffix');
    if (diffDays < 30) return this.langService.translate('profile.uploaded_two_weeks_ago');
    if (diffDays < 60) return this.langService.translate('profile.uploaded_month_ago');
    return this.langService.translate('profile.uploaded_days_ago_prefix') + Math.floor(diffDays / 30) + this.langService.translate('profile.uploaded_months_ago_suffix');
  }

  isBlogContent(contentType?: number | string): boolean {
    return contentType === ArticleContentType.Blog || contentType === 'BlogPost';
  }

  getArticleRoute(item: ProfileArticleCard | LikedContent): string[] {
    const id = 'contentId' in item ? item.contentId : item.id;
    if (!id) {
      return ['/my-playlists'];
    }

    return getArticleLink({
      id,
      title: item.title || item.slug || '',
      slug: item.slug || '',
      contentType: this.isBlogContent(item.contentType) ? ArticleContentType.Blog : ArticleContentType.News
    } as Article);
  }

  getArticleTypeLabel(contentType?: number | string): string {
    return this.isBlogContent(contentType)
      ? this.langService.translate('profile.type_blog')
      : this.langService.translate('profile.type_article');
  }

  isArticleApproved(article: ProfileArticleCard): boolean {
    return article.status === 1;
  }

  hasUploadedContent(): boolean {
    return this.mySongs.length > 0 || this.myArticles.length > 0 || this.myEvents.length > 0;
  }

  getArticleBannerInput(item: ProfileArticleCard | LikedContent): Article {
    const contentType = this.isBlogContent(item.contentType) ? ArticleContentType.Blog : ArticleContentType.News;
    const imageUrl = 'imageUrl' in item ? item.imageUrl : undefined;
    const featuredImageUrl = 'featuredImageUrl' in item ? item.featuredImageUrl : imageUrl;
    const contentId = 'contentId' in item ? item.contentId : item.id;

    return {
      id: contentId,
      title: item.title || '',
      subtitle: 'subtitle' in item ? item.subtitle : undefined,
      content: '',
      featuredImageUrl: featuredImageUrl || imageUrl || '/assets/default-article.png',
      publishDate: '',
      createdAt: '',
      authorName: '',
      categoryIds: [],
      categoryNames: [],
      contentType,
      slug: item.slug || '',
      shortDescription: 'shortDescription' in item ? item.shortDescription : ('subtitle' in item ? item.subtitle : undefined),
      isFeatured: false,
      displayOrder: 0,
      status: ArticleStatus.Published,
      isPremium: false,
      viewCount: 0,
      likeCount: 0,
      tagIds: [],
      tags: [],
      galleryImages: [],
      taggedArtists: []
    };
  }

  showMoreSongs(): void {
    if (this.isLoadingMoreSongs || !this.hasMoreSongs) return;
    this.isLoadingMoreSongs = true;
    this.songsPage++;
    this.songService.getMySongs(this.songsPage).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result: PagedResult<any>) => {
        this.mySongs = [...this.mySongs, ...result.items.map((s: any) => this.toProfileSongCard(s))];
        this.hasMoreSongs = result.hasNextPage;
        this.isLoadingMoreSongs = false;
      },
      error: () => { this.isLoadingMoreSongs = false; }
    });
  }

  showMoreArticles(): void {
    if (this.isLoadingMoreArticles || !this.hasMoreArticles) return;
    this.isLoadingMoreArticles = true;
    this.articlesPage++;
    this.articleService.getMyArticles(this.articlesPage).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result: PagedResult<any>) => {
        this.myArticles = [...this.myArticles, ...result.items.map((a: any) => this.toProfileArticleCard(a))];
        this.hasMoreArticles = result.hasNextPage;
        this.isLoadingMoreArticles = false;
      },
      error: () => { this.isLoadingMoreArticles = false; }
    });
  }

  showMoreEvents(): void {
    if (this.isLoadingMoreEvents || !this.hasMoreEvents) return;
    this.isLoadingMoreEvents = true;
    this.eventsPage++;
    this.eventService.getMyEvents(this.eventsPage).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result: PagedResult<any>) => {
        this.myEvents = [...this.myEvents, ...result.items.map((e: any) => this.toEventCardData(e))];
        this.hasMoreEvents = result.hasNextPage;
        this.isLoadingMoreEvents = false;
      },
      error: () => { this.isLoadingMoreEvents = false; }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  showMoreLiked(): void {
    this.visibleLikedCount += 4;
  }

  openEventModal(event: EventCardData): void {
    this.selectedEventModal = event;
  }

  closeEventModal(): void {
    this.selectedEventModal = null;
  }

  viewLikedContent(item: LikedContent): void {
    void this.router.navigate(this.getArticleRoute(item));
  }

  removeLikedContent(item: LikedContent, event: Event): void {
    event.stopPropagation();

    this.likedContentService.removeLikedContent(item.contentType, item.contentId).subscribe({
      next: () => {
        this.likedContent = this.likedContent.filter(
          likedItem => !(likedItem.contentType === item.contentType && likedItem.contentId === item.contentId)
        );
      },
      error: () => {}
    });
  }
}
