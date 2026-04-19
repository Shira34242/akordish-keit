import { AfterViewInit, Component, HostListener, OnInit } from '@angular/core';
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
import { ForgotPasswordModalComponent } from '../auth/forgot-password-modal.component';
import { ReportModalComponent } from '../shared/report-modal/report-modal.component';
import { TeacherCreateComponent } from '../teacher-create/teacher-create.component';
import { ServiceProviderCreateComponent } from '../service-provider-create/service-provider-create.component';
import { ArtistCreateComponent } from '../artist-create/artist-create.component';
import { NotificationService } from '../../services/notification.service';
import { NotificationDto } from '../../models/notification.model';

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
    ForgotPasswordModalComponent,
    ReportModalComponent,
    TeacherCreateComponent,
    ServiceProviderCreateComponent,
    ArtistCreateComponent,
    RouterModule,
    ImgFallbackDirective
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit, AfterViewInit {
  user: User | null = null;
  socialUser: SocialUser | null = null;
  loggedIn = false;
  showUserMenu = false;
  showAddSongModal = false;
  showMobileMenu = false;
  showQuickAddAssistant = false;
  showNotificationsPopup = false;
  notificationsPreview: NotificationDto[] = [];
  notificationsPreviewLoading = false;
  notificationsPreviewError = '';
  isScrolled = false;
  fabOnYellow = false;
  adminEditTarget: { label: string; url: string } | null = null;
  unreadNotificationCount = 0;
  isArtistPage = false;
  isArticlePage = false;

  showAuthModal = false;
  showAdditionalDetailsModal = false;
  showForgotPasswordModal = false;
  showReportModal = false;
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
    private notificationService: NotificationService
  ) {}

  @HostListener('window:scroll')
  onWindowScroll(): void {
    const current = window.scrollY;
    if (current > this.lastScrollY && current > 80) {
      this.isScrolled = true;
    } else if (current < this.lastScrollY) {
      this.isScrolled = false;
    }

    this.lastScrollY = current;
    this.checkFabBackground();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showUserMenu = false;
    this.showNotificationsPopup = false;
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

    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        setTimeout(() => this.checkFabBackground(), 200);
        setTimeout(() => this.checkFabBackground(), 800);
        this.updateAdminEditTarget(event.urlAfterRedirects);
        if (this.loggedIn) {
          this.notificationService.refreshUnreadCount();
        }
      }
    });

    this.updateAdminEditTarget(this.router.url);

    this.contentPageService.currentArticleId$.subscribe(id => {
      this.currentArticleId = id;
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

    for (const el of elements) {
      if (fab === el || fab.contains(el as Node)) continue;

      const background = getComputedStyle(el as Element).backgroundColor;
      if (background === 'rgb(221, 255, 83)') {
        this.fabOnYellow = true;
        return;
      }

      if (background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') {
        this.fabOnYellow = false;
        return;
      }
    }

    this.fabOnYellow = false;
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
    this.router.navigate(['/admin']);
  }

  toggleNotificationsPopup(event?: Event): void {
    event?.stopPropagation();

    if (!this.loggedIn) {
      this.authService.requestLogin('/notifications');
      return;
    }

    this.showUserMenu = false;
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
    this.router.navigate(['/notifications']);
  }

  openNotificationFromPopup(event: Event, notification: NotificationDto): void {
    event.stopPropagation();

    const openAction = () => {
      this.closeNotificationsPopup();
      this.showMobileMenu = false;
      if (notification.actionUrl) {
        this.router.navigateByUrl(notification.actionUrl);
      } else {
        this.router.navigate(['/notifications']);
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

  markAllPopupNotificationsAsRead(event: Event): void {
    event.stopPropagation();

    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notificationsPreview = this.notificationsPreview.map(notification => ({
          ...notification,
          isRead: true,
          readAt: notification.readAt ?? new Date().toISOString()
        }));
      }
    });
  }

  formatNotificationDate(dateValue: string): string {
    return new Intl.DateTimeFormat('he-IL', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(dateValue));
  }

  private loadNotificationsPreview(): void {
    this.notificationsPreviewLoading = true;
    this.notificationsPreviewError = '';

    this.notificationService.getNotifications().subscribe({
      next: notifications => {
        this.notificationsPreview = notifications.slice(0, 6);
        this.notificationsPreviewLoading = false;
      },
      error: () => {
        this.notificationsPreviewError = 'לא הצלחנו לטעון התראות.';
        this.notificationsPreviewLoading = false;
      }
    });
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.showUserMenu = !this.showUserMenu;
  }

  closeUserMenu(): void {
    this.showUserMenu = false;
  }

  toggleMobileMenu(): void {
    this.showMobileMenu = !this.showMobileMenu;
  }

  closeMobileMenu(): void {
    this.showMobileMenu = false;
  }

  signOut(): void {
    this.showUserMenu = false;
    this.authService.logout();
    this.socialAuthService.signOut().catch(() => {});
    this.router.navigate(['/']);
  }

  openAuthModal(): void {
    this.showAuthModal = true;
  }

  closeAuthModal(): void {
    this.showAuthModal = false;
  }

  onAuthSuccess(response: AuthResponse): void {
    console.log('Auth successful', response);
    this.closeAuthModal();

    if (response.requiresProfileCompletion) {
      this.showAdditionalDetailsModal = true;
      return;
    }

    const returnUrl = this.authService.getAndClearReturnUrl();
    if (returnUrl && returnUrl !== '/') {
      this.router.navigate([returnUrl]);
    }
  }

  closeAdditionalDetailsModal(): void {
    this.showAdditionalDetailsModal = false;
  }

  onProfileComplete(userType: UserType): void {
    console.log('Profile completed as:', userType);
    this.closeAdditionalDetailsModal();

    if (userType === UserType.Regular) {
      this.router.navigate(['/my-profile']);
      return;
    }

    localStorage.setItem('pendingProfessionalType', userType);

    switch (userType) {
      case UserType.Artist:
        this.router.navigate(['/artist/create'], { queryParams: { from: 'registration' } });
        break;
      case UserType.Teacher:
        this.router.navigate(['/teacher/create'], { queryParams: { from: 'registration' } });
        break;
      case UserType.ServiceProvider:
        this.router.navigate(['/service-provider/create'], { queryParams: { from: 'registration' } });
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

    if (!this.loggedIn) {
      this.authService.requestLogin(this.router.url);
      return;
    }

    this.showQuickAddAssistant = !this.showQuickAddAssistant;
  }

  closeFabMenu(): void {
    this.showQuickAddAssistant = false;
  }

  handleQuickAddAction(action: QuickAddAction): void {
    this.closeFabMenu();

    if (action === 'contact') {
      this.openReportModal();
      return;
    }

    if (action === 'admin-edit') {
      this.fabAdminEdit();
      return;
    }

    if (!this.loggedIn) {
      this.authService.requestLogin(this.router.url);
      return;
    }

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
}
