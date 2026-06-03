import { AfterViewInit, Component, HostListener, NgZone, OnInit } from '@angular/core';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { GoogleSigninButtonModule, SocialAuthService, SocialUser } from '@abacritt/angularx-social-login';
import { AuthResponse, AuthService, User } from '../../services/auth.service';
import { SongService } from '../../services/song.service';
import { ModalService } from '../../services/modal.service';
import { SessionTimeoutService } from '../../services/session-timeout.service';
import { ArtistPageService } from '../../services/artist-page.service';
import { ContentPageService } from '../../services/content-page.service';
import { AddSongModalComponent } from '../add-song-modal/add-song-modal.component';
import { QuickAddAction, QuickAddAssistantModalComponent } from '../quick-add-assistant-modal/quick-add-assistant-modal.component';
import { AuthModalComponent } from '../auth/auth-modal.component';
import { AdditionalDetailsModalComponent, UserType } from '../auth/additional-details-modal.component';
import { ProfileSoftReminderModalComponent } from '../auth/profile-soft-reminder-modal.component';
import { ProfileReminderService, ReminderKind } from '../../services/profile-reminder.service';
import { ForgotPasswordModalComponent } from '../auth/forgot-password-modal.component';
import { ReportModalComponent } from '../shared/report-modal/report-modal.component';
import { TeacherCreateComponent } from '../teacher-create/teacher-create.component';
import { ServiceProviderCreateComponent } from '../service-provider-create/service-provider-create.component';
import { ArtistCreateComponent } from '../artist-create/artist-create.component';
import { NotificationService } from '../../services/notification.service';
import { NotificationDto } from '../../models/notification.model';
import { QuickAddAssistantService, QuickAddEntryPoint } from '../../services/quick-add-assistant.service';
import { LanguageService, Lang } from '../../services/language.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    GoogleSigninButtonModule,
    AddSongModalComponent,
    QuickAddAssistantModalComponent,
    AuthModalComponent,
    AdditionalDetailsModalComponent,
    ProfileSoftReminderModalComponent,
    ForgotPasswordModalComponent,
    ReportModalComponent,
    TeacherCreateComponent,
    ServiceProviderCreateComponent,
    ArtistCreateComponent,
    RouterModule,
    ImgFallbackDirective,
    TranslatePipe
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit, AfterViewInit {
  user: User | null = null;
  socialUser: SocialUser | null = null;
  loggedIn = false;
  currentLang: Lang = 'he';
  showUserMenu = false;
  showAddSongModal = false;
  showMobileMenu = false;
  showQuickAddAssistant = false;
  isQuickAddClosing = false;
  quickAddEntryPoint: QuickAddEntryPoint = 'root';
  showNotificationsPopup = false;
  showNotificationsCenterModal = false;
  notificationsPreview: NotificationDto[] = [];
  notificationsPreviewLoading = false;
  notificationsPreviewError = '';
  notificationsCenter: NotificationDto[] = [];
  notificationsCenterLoading = false;
  notificationsCenterError = '';
  isScrolled = false;
  fabOnYellow = false;
  adminEditTarget: { label: string; url: string } | null = null;
  unreadNotificationCount = 0;
  isArtistPage = false;
  isArticlePage = false;
  isPodcastViewerPage = false;

  showAuthModal = false;
  showAdditionalDetailsModal = false;
  showSoftReminderModal = false;
  softReminderKind: ReminderKind = 'profile';
  softReminderUser: User | null = null;
  showForgotPasswordModal = false;
  showReportModal = false;
  sessionExpiredToast = false;
  showTeacherCreateModal = false;
  showServiceProviderCreateModal = false;
  showArtistCreateModal = false;
  serviceProviderPresetCategoryId?: number;
  allowGeneralServiceProvider = false;

  private currentArticleId: number | null = null;
  private lastScrollY = 0;

  constructor(
    private router: Router,
    private songService: SongService,
    private authService: AuthService,
    private socialAuthService: SocialAuthService,
    private modalService: ModalService,
    private sessionTimeoutService: SessionTimeoutService,
    private artistPageService: ArtistPageService,
    private contentPageService: ContentPageService,
    private notificationService: NotificationService,
    private quickAddAssistantService: QuickAddAssistantService,
    private profileReminderService: ProfileReminderService,
    public langService: LanguageService,
    private ngZone: NgZone
  ) {}

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const current = window.scrollY;
    let newScrolled = this.isScrolled;
    if (current > this.lastScrollY && current > 80) {
      newScrolled = true;
    } else if (current < this.lastScrollY) {
      newScrolled = false;
    }
    this.lastScrollY = current;

    const needsStateChange = newScrolled !== this.isScrolled
      || this.showUserMenu
      || this.showNotificationsPopup
      || this.showMobileMenu;

    this.ngZone.runOutsideAngular(() => this.checkFabBackground());

    if (needsStateChange) {
      this.isScrolled = newScrolled;
      this.showUserMenu = false;
      this.showNotificationsPopup = false;
      this.showMobileMenu = false;
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showUserMenu = false;
    this.showNotificationsPopup = false;
    this.showMobileMenu = false;
  }

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
      this.loggedIn = !!user;

      if (user) {
        this.notificationService.refreshUnreadCount();
      } else {
        this.notificationService.clearUnreadCount();
        this.notificationsPreview = [];
        this.showNotificationsPopup = false;
        this.notificationsCenter = [];
        this.showNotificationsCenterModal = false;
      }
    });

    this.profileReminderService.request$.subscribe(req => {
      if (req && !this.showAdditionalDetailsModal && !this.showAuthModal) {
        this.softReminderKind = req.kind;
        this.softReminderUser = req.user;
        this.showSoftReminderModal = true;
      }
    });

    this.notificationService.unreadCount$.subscribe(count => {
      this.unreadNotificationCount = count;
    });

    this.modalService.modalState$.subscribe(state => {
      this.showAddSongModal = state.isOpen;
    });

    this.authService.loginRequest$.subscribe(shouldShowLogin => {
      if (shouldShowLogin && !this.showAuthModal) {
        this.openAuthModal();
        this.authService.clearLoginRequest();
      }
    });

    this.sessionTimeoutService.startWatching();

    if (sessionStorage.getItem('session_expired') === '1') {
      sessionStorage.removeItem('session_expired');
      this.sessionExpiredToast = true;
      setTimeout(() => { this.sessionExpiredToast = false; }, 6000);
    }

    this.quickAddAssistantService.openRequests$.subscribe(entryPoint => {
      this.openQuickAddAssistant(entryPoint);
    });

    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.showUserMenu = false;
        this.showNotificationsPopup = false;
        this.showMobileMenu = false;
        setTimeout(() => this.checkFabBackground(), 200);
        setTimeout(() => this.checkFabBackground(), 800);
        this.updateAdminEditTarget(event.urlAfterRedirects);
        this.updatePodcastViewerState(event.urlAfterRedirects);
        if (this.loggedIn) {
          this.notificationService.refreshUnreadCount();
          this.profileReminderService.checkAndShow();
        }
      }
    });

    this.updateAdminEditTarget(this.router.url);
    this.updatePodcastViewerState(this.router.url);

    this.contentPageService.currentArticleId$.subscribe(id => {
      this.currentArticleId = id;
    });

    this.langService.lang$.subscribe(lang => {
      this.currentLang = lang;
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.checkFabBackground(), 200);
    setTimeout(() => this.checkFabBackground(), 800);
  }

  get isAdmin(): boolean {
    return !!(this.user && (this.user.role === 'Admin' || this.user.role === 4));
  }

  get canEditArtistPage(): boolean {
    return this.isAdmin && !!this.adminEditTarget;
  }

  get canViewChordRequests(): boolean {
    return !!this.user && (this.isAdmin || (this.user.hasProfessionalProfile ?? false) || (this.user.contentTag ?? 0) >= 2);
  }

  handleLogoClick(): void {
    this.router.navigate(['/']);
  }

  handleImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (target) {
      target.src = '/logo.png';
    }
  }

  handleRandomSongClick(): void {
    this.songService.getRandomSong().subscribe({
      next: song => {
        if (song?.id) {
          this.router.navigate(['/song', song.id]);
        }
      },
      error: err => console.error('Failed to get random song', err)
    });
  }

  private checkFabBackground(): void {
    const fab = document.querySelector('.fab-add-song') as HTMLElement | null;
    if (!fab) return;

    const rect = fab.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const elements = document.elementsFromPoint(centerX, centerY);

    let result = false;
    for (const el of elements) {
      if (fab === el || fab.contains(el as Node)) continue;

      const background = getComputedStyle(el as Element).backgroundColor;
      if (background === 'rgb(221, 255, 83)') {
        result = true;
        break;
      }

      if (background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') {
        break;
      }
    }

    if (result !== this.fabOnYellow) {
      this.ngZone.run(() => { this.fabOnYellow = result; });
    }
  }

  private updateAdminEditTarget(url: string): void {
    const cleanUrl = url.split('?')[0];
    const artistMatch = cleanUrl.match(/^\/artist\/(\w+)/);
    const teacherMatch = cleanUrl.match(/^\/teacher\/(\w+)/);
    const newsMatch = cleanUrl.match(/^\/news\/.+/);
    const blogMatch = cleanUrl.match(/^\/blog\/.+/);
    const songMatch = cleanUrl.match(/^\/song\/(\d+)/);

    this.isArtistPage = false;
    this.isArticlePage = false;

    if (artistMatch) {
      this.isArtistPage = true;
      this.adminEditTarget = { label: '\u05e2\u05e8\u05d9\u05db\u05ea \u05d3\u05e3 \u05d0\u05de\u05df', url: '' };
      return;
    }

    if (teacherMatch) {
      this.adminEditTarget = {
        label: '\u05e2\u05e8\u05d9\u05db\u05ea \u05d3\u05e3 \u05de\u05d5\u05e8\u05d4',
        url: `/admin/teachers/edit/${teacherMatch[1]}`
      };
      return;
    }

    if (cleanUrl === '/professionals') {
      this.adminEditTarget = {
        label: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05d1\u05e2\u05dc\u05d9 \u05de\u05e7\u05e6\u05d5\u05e2',
        url: '/admin/service-providers'
      };
      return;
    }

    if (newsMatch) {
      this.isArticlePage = true;
      this.adminEditTarget = { label: '\u05e2\u05e8\u05d9\u05db\u05ea \u05db\u05ea\u05d1\u05d4', url: '' };
      return;
    }

    if (blogMatch) {
      this.isArticlePage = true;
      this.adminEditTarget = { label: '\u05e2\u05e8\u05d9\u05db\u05ea \u05ea\u05d5\u05db\u05df', url: '' };
      return;
    }

    if (cleanUrl === '/music-news') {
      this.adminEditTarget = {
        label: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05d7\u05d3\u05e9\u05d5\u05ea',
        url: '/admin/content/articles'
      };
      return;
    }

    if (cleanUrl === '/articles') {
      this.adminEditTarget = {
        label: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05ea\u05d5\u05db\u05df',
        url: '/admin/content/articles'
      };
      return;
    }

    if (cleanUrl === '/teachers') {
      this.adminEditTarget = {
        label: '\u05e0\u05d9\u05d4\u05d5\u05dc \u05de\u05d5\u05e8\u05d9\u05dd',
        url: '/admin/teachers'
      };
      return;
    }

    if (songMatch) {
      this.adminEditTarget = {
        label: '\u05e2\u05e8\u05d9\u05db\u05ea \u05e9\u05d9\u05e8',
        url: '/admin/content/songs'
      };
      return;
    }

    this.adminEditTarget = null;
  }

  private updatePodcastViewerState(url: string): void {
    const [path, query = ''] = url.split('?');
    this.isPodcastViewerPage = path === '/podcasts' && new URLSearchParams(query).has('series');
  }

  fabAdminEdit(): void {
    if (!this.adminEditTarget) return;

    this.closeFabMenu();

    if (this.isArtistPage) {
      this.artistPageService.triggerEdit();
      return;
    }

    if (this.isArticlePage) {
      if (this.currentArticleId) {
        this.router.navigate([`/admin/content/articles/edit/${this.currentArticleId}`]);
      } else {
        this.router.navigate(['/admin/content/articles']);
      }
      return;
    }

    this.router.navigate([this.adminEditTarget.url]);
  }

  goToAdmin(): void {
    this.closeUserMenu();
    this.router.navigate(['/admin']);
  }

  toggleNotificationsPopup(event?: Event): void {
    event?.stopPropagation();

    if (!this.loggedIn) {
      this.authService.requestLogin('/notifications');
      return;
    }

    this.showUserMenu = false;
    this.showNotificationsCenterModal = false;
    this.showNotificationsPopup = !this.showNotificationsPopup;

    if (this.showNotificationsPopup) {
      this.loadNotificationsPreview();
    }
  }

  closeNotificationsPopup(): void {
    this.showNotificationsPopup = false;
  }

  goToNotificationsPage(event?: Event): void {
    event?.stopPropagation();
    this.closeNotificationsPopup();
    this.showMobileMenu = false;
    this.showNotificationsCenterModal = true;
    this.loadNotificationsCenter();
  }

  closeNotificationsCenter(): void {
    this.showNotificationsCenterModal = false;
  }

  deleteAllCenterNotifications(event: Event): void {
    event.stopPropagation();

    this.notificationService.deleteAllNotifications().subscribe({
      next: () => {
        this.notificationsCenter = [];
        this.notificationsPreview = [];
      }
    });
  }

  openNotificationFromPopup(event: Event, notification: NotificationDto): void {
    event.stopPropagation();

    const openAction = () => {
      this.closeNotificationsPopup();
      this.showMobileMenu = false;
      if (notification.actionUrl) {
        this.openNotificationAction(notification.actionUrl);
      } else {
        this.showNotificationsCenterModal = true;
        this.loadNotificationsCenter();
      }
    };

    if (notification.isRead) {
      openAction();
      return;
    }

    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        notification.isRead = true;
        notification.readAt = new Date().toISOString();
        openAction();
      },
      error: openAction
    });
  }

  openNotificationFromCenter(notification: NotificationDto): void {
    const openAction = () => {
      if (notification.actionUrl) {
        this.closeNotificationsCenter();
        this.closeNotificationsPopup();
        this.showMobileMenu = false;
        this.openNotificationAction(notification.actionUrl);
      }
    };

    if (notification.isRead) {
      openAction();
      return;
    }

    this.notificationService.markAsRead(notification.id).subscribe({
      next: () => {
        const readAt = new Date().toISOString();
        notification.isRead = true;
        notification.readAt = readAt;
        this.notificationsPreview = this.notificationsPreview.map(item =>
          item.id === notification.id ? { ...item, isRead: true, readAt } : item
        );
        openAction();
      },
      error: openAction
    });
  }

  shouldShowNotificationDate(notifications: NotificationDto[], index: number): boolean {
    if (index === 0) {
      return true;
    }

    return this.getNotificationDateKey(notifications[index].createdAt) !== this.getNotificationDateKey(notifications[index - 1].createdAt);
  }

  formatNotificationDateOnly(dateValue: string): string {
    const locale = this.langService.currentLang === 'he' ? 'he-IL' : 'en-US';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(dateValue));
  }

  shouldShowNotificationTitle(notification: NotificationDto): boolean {
    return notification.type !== 3
      && notification.type !== 6
      && !!notification.title
      && notification.title.trim() !== notification.message.trim();
  }

  getNotificationAttachmentIcon(type: string): string {
    switch (type) {
      case 'image':
        return 'image';
      case 'video':
        return 'smart_display';
      case 'file':
        return 'attach_file';
      default:
        return 'link';
    }
  }

  private getNotificationDateKey(dateValue: string): string {
    const date = new Date(dateValue);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  private loadNotificationsPreview(): void {
    this.notificationsPreviewLoading = true;
    this.notificationsPreviewError = '';

    this.notificationService.getNotifications().subscribe({
      next: notifications => {
        this.notificationsPreview = notifications.filter(notification => !notification.isRead).slice(0, 6);
        this.notificationsPreviewLoading = false;
        this.markPreviewAsSeen();
      },
      error: () => {
        this.notificationsPreviewError = this.langService.translate('notif.error');
        this.notificationsPreviewLoading = false;
      }
    });
  }

  private markPreviewAsSeen(): void {
    const unreadPreview = this.notificationsPreview.filter(notification => !notification.isRead);
    if (unreadPreview.length === 0) {
      return;
    }

    let pending = unreadPreview.length;
    const finishOne = () => {
      pending--;
      if (pending === 0) {
        this.notificationService.refreshUnreadCount();
      }
    };

    unreadPreview.forEach(notification => {
      this.notificationService.markAsRead(notification.id).subscribe({
        next: () => {
          const readAt = new Date().toISOString();
          this.notificationsPreview = this.notificationsPreview.map(item =>
            item.id === notification.id
              ? { ...item, isRead: true, readAt: item.readAt ?? readAt }
              : item
          );
          finishOne();
        },
        error: () => finishOne()
      });
    });
  }

  private openNotificationAction(actionUrl: string): void {
    if (/^https?:\/\//i.test(actionUrl)) {
      window.open(actionUrl, '_blank', 'noopener');
      return;
    }

    this.router.navigateByUrl(actionUrl);
  }

  private loadNotificationsCenter(): void {
    this.notificationsCenterLoading = true;
    this.notificationsCenterError = '';

    this.notificationService.getNotifications().subscribe({
      next: notifications => {
        this.notificationsCenter = notifications;
        this.notificationsCenterLoading = false;
      },
      error: () => {
        this.notificationsCenterError = this.langService.translate('notif.error');
        this.notificationsCenterLoading = false;
      }
    });
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    const next = !this.showUserMenu;
    this.showUserMenu = next;
    if (next) {
      this.showNotificationsPopup = false;
      this.showNotificationsCenterModal = false;
    }
  }

  closeUserMenu(): void {
    this.showUserMenu = false;
    this.showMobileMenu = false;
  }

  toggleMobileMenu(event: Event): void {
    event.stopPropagation();
    this.showMobileMenu = !this.showMobileMenu;
  }

  closeMobileMenu(): void {
    this.showMobileMenu = false;
  }

  signOut(): void {
    this.showUserMenu = false;
    this.showMobileMenu = false;
    this.showNotificationsPopup = false;
    this.showNotificationsCenterModal = false;
    this.authService.logout();
    this.socialAuthService.signOut().catch(() => {});
    this.router.navigate(['/']);
  }

  openAuthModal(): void {
    if (this.loggedIn) return;
    this.showAuthModal = true;
  }

  closeAuthModal(): void {
    this.showAuthModal = false;
  }

  onAuthSuccess(response: AuthResponse): void {
    this.closeAuthModal();

    if (response.requiresProfileCompletion) {
      this.showAdditionalDetailsModal = true;
      return;
    }

    const returnUrl = this.authService.getAndClearReturnUrl();
    if (returnUrl && returnUrl !== '/') {
      this.router.navigate([returnUrl]);
    }

    // אחרי לוגין רגיל (משתמש קיים) — נבדוק אם להציג תזכורת רכה
    setTimeout(() => this.profileReminderService.checkAndShow(), 1500);
  }

  closeSoftReminderModal(): void {
    this.showSoftReminderModal = false;
    this.softReminderUser = null;
    this.profileReminderService.clearRequest();
  }

  closeAdditionalDetailsModal(): void {
    this.showAdditionalDetailsModal = false;
  }

  onProfileComplete(userType: UserType): void {
    this.closeAdditionalDetailsModal();

    if (userType === UserType.Regular) {
      this.router.navigate(['/']);
      return;
    }

    localStorage.setItem('pendingProfessionalType', userType);

    switch (userType) {
      case UserType.Artist:
        this.router.navigate(['/artist/create'], { queryParams: { from: 'registration' } });
        break;
      case UserType.Teacher:
        this.quickAddAssistantService.requestOpen('index');
        break;
      case UserType.ServiceProvider:
        this.quickAddAssistantService.requestOpen('index');
        break;
      default:
        this.router.navigate(['/subscription/select'], { queryParams: { from: 'registration' } });
        break;
    }
  }

  onForgotPassword(): void {
    this.closeAuthModal();
    this.showForgotPasswordModal = true;
  }

  closeForgotPasswordModal(): void {
    this.showForgotPasswordModal = false;
  }

  onPasswordResetSuccess(): void {
    this.closeForgotPasswordModal();
    this.openAuthModal();
  }

  toggleFabMenu(event: Event): void {
    event.stopPropagation();

    if (this.showQuickAddAssistant) {
      this.closeFabMenu();
      return;
    }

    this.openQuickAddAssistant('root');
  }

  closeFabMenu(): void {
    this.isQuickAddClosing = true;
    setTimeout(() => {
      this.showQuickAddAssistant = false;
      this.quickAddEntryPoint = 'root';
      this.isQuickAddClosing = false;
    }, 280);
  }

  handleQuickAddAction(action: QuickAddAction): void {
    if (action === 'contact') {
      this.closeFabMenu();
      this.openReportModal();
      return;
    }

    if (action === 'admin-edit') {
      this.fabAdminEdit();
      this.showQuickAddAssistant = false;
      this.quickAddEntryPoint = 'root';
      return;
    }

    if (action === 'chord-requests') {
      this.router.navigate(['/chord-requests']);
      this.showQuickAddAssistant = false;
      this.quickAddEntryPoint = 'root';
      return;
    }

    if (!this.loggedIn) {
      this.authService.requestLogin(this.router.url);
      return;
    }

    this.showQuickAddAssistant = false;
    this.quickAddEntryPoint = 'root';

    switch (action) {
      case 'index-teacher':
        this.showTeacherCreateModal = true;
        break;
      case 'index-service-provider':
        this.serviceProviderPresetCategoryId = undefined;
        this.allowGeneralServiceProvider = false;
        this.showServiceProviderCreateModal = true;
        break;
      case 'index-service-provider-general':
        this.serviceProviderPresetCategoryId = undefined;
        this.allowGeneralServiceProvider = true;
        this.showServiceProviderCreateModal = true;
        break;
      case 'artist-account':
        localStorage.setItem('pendingProfessionalType', 'artist');
        this.showArtistCreateModal = true;
        break;
      case 'artist-community':
        this.showArtistCreateModal = true;
        break;
      default:
        if (action.startsWith('index-service-provider-category:')) {
          this.serviceProviderPresetCategoryId = Number(action.split(':')[1]);
          this.allowGeneralServiceProvider = false;
          this.showServiceProviderCreateModal = true;
        }
        break;
    }
  }

  goToAddSong(): void {
    this.modalService.openAddSongModal();
  }

  closeAddSongModal(): void {
    this.modalService.closeModal();
  }

  onSongAdded(): void {
    this.modalService.closeModal();
  }

  openReportModal(): void {
    this.showReportModal = true;
  }

  openContactAssistant(): void {
    if (!this.loggedIn) {
      this.authService.requestLogin(this.router.url);
      return;
    }
    this.quickAddEntryPoint = 'contact';
    this.showQuickAddAssistant = true;
  }

  closeReportModal(): void {
    this.showReportModal = false;
  }

  closeTeacherCreateModal(): void {
    this.showTeacherCreateModal = false;
  }

  backTeacherCreateModalToChat(): void {
    this.showTeacherCreateModal = false;
    this.showQuickAddAssistant = true;
  }

  closeServiceProviderCreateModal(): void {
    this.showServiceProviderCreateModal = false;
    this.serviceProviderPresetCategoryId = undefined;
    this.allowGeneralServiceProvider = false;
  }

  backServiceProviderCreateModalToChat(): void {
    this.showServiceProviderCreateModal = false;
    this.serviceProviderPresetCategoryId = undefined;
    this.allowGeneralServiceProvider = false;
    this.showQuickAddAssistant = true;
  }

  closeArtistCreateModal(): void {
    this.showArtistCreateModal = false;
  }

  backArtistCreateModalToChat(): void {
    this.showArtistCreateModal = false;
    this.showQuickAddAssistant = true;
  }

  upgradeSubscription(): void {
    localStorage.removeItem('selectedSubscriptionPlan');
    localStorage.removeItem('selectedBillingCycle');
    localStorage.removeItem('pendingProfessionalType');

    this.closeUserMenu();
    this.closeMobileMenu();

    this.router.navigate(['/subscription/select']);
  }

  private openQuickAddAssistant(entryPoint: QuickAddEntryPoint): void {
    if (!this.loggedIn) {
      this.authService.requestLogin(this.router.url);
      return;
    }

    this.quickAddEntryPoint = entryPoint;
    this.showQuickAddAssistant = true;
  }
}
