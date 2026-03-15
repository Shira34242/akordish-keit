import { Component, OnInit, AfterViewInit, HostListener } from '@angular/core';
import { NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { SocialAuthService, GoogleLoginProvider, SocialUser, GoogleSigninButtonModule } from '@abacritt/angularx-social-login';
import { AuthService, User, AuthResponse } from '../../services/auth.service';
import { SongService } from '../../services/song.service';
import { ModalService } from '../../services/modal.service';
import { SessionTimeoutService } from '../../services/session-timeout.service';
import { AddSongModalComponent } from '../add-song-modal/add-song-modal.component';
import { AuthModalComponent } from '../auth/auth-modal.component';
import { AdditionalDetailsModalComponent, UserType } from '../auth/additional-details-modal.component';
import { ForgotPasswordModalComponent } from '../auth/forgot-password-modal.component';
import { ReportModalComponent } from '../shared/report-modal/report-modal.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    GoogleSigninButtonModule,
    AddSongModalComponent,
    AuthModalComponent,
    AdditionalDetailsModalComponent,
    ForgotPasswordModalComponent,
    ReportModalComponent,
    RouterModule
  ],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit, AfterViewInit {
  user: User | null = null;
  socialUser: SocialUser | null = null;
  loggedIn: boolean = false;
  showUserMenu: boolean = false;
  showAddSongModal: boolean = false;
  showMobileMenu: boolean = false;
  showFabMenu: boolean = false;
  showArtistSubMenu: boolean = false;
  isScrolled: boolean = false;
  fabOnYellow: boolean = false;
  adminEditTarget: { label: string; url: string } | null = null;
  private lastScrollY: number = 0;

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

  private checkFabBackground(): void {
    const fab = document.querySelector('.fab-add-song') as HTMLElement;
    if (!fab) return;
    const rect = fab.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const elements = document.elementsFromPoint(cx, cy);
    for (const el of elements) {
      if (fab === el || fab.contains(el as Node)) continue;
      const bg = getComputedStyle(el as Element).backgroundColor;
      if (bg === 'rgb(221, 255, 83)') { this.fabOnYellow = true; return; }
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') { this.fabOnYellow = false; return; }
    }
    this.fabOnYellow = false;
  }

  // New modals
  showAuthModal: boolean = false;
  showAdditionalDetailsModal: boolean = false;
  showForgotPasswordModal: boolean = false;
  showReportModal: boolean = false;

  constructor(
    private router: Router,
    private songService: SongService,
    private authService: AuthService,
    private socialAuthService: SocialAuthService,
    private modalService: ModalService,
    private sessionTimeoutService: SessionTimeoutService
  ) { }

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.user = user;
      this.loggedIn = !!user;
    });

    // Subscribe to modal state
    this.modalService.modalState$.subscribe(state => {
      this.showAddSongModal = state.isOpen;
    });

    // 🔒 הקשבה לבקשות לוגין מה-Guards
    // כשמישהו מנסה להגיע לדף מוגן בלי להיות מחובר, ה-Guard מבקש לוגין
    this.authService.loginRequest$.subscribe(shouldShowLogin => {
      if (shouldShowLogin && !this.showAuthModal) {
        this.openAuthModal();
        this.authService.clearLoginRequest(); // מנקה את הבקשה
      }
    });

    // ⏱️ הפעלת Session Timeout - ניתוק אוטומטי אחרי 30 דקות של חוסר פעילות
    this.sessionTimeoutService.startWatching();

    // זיהוי צבע FAB + עדכון כפתור עריכה למנהל אחרי כל ניווט
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        setTimeout(() => this.checkFabBackground(), 100);
        this.updateAdminEditTarget(event.urlAfterRedirects);
      }
    });

    // עדכון כפתור עריכה גם בטעינה הראשונית
    this.updateAdminEditTarget(this.router.url);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.checkFabBackground(), 100);
  }

  handleLogoClick() {
    this.router.navigate(['/']);
  }
    handleImageError(event: any) {
        event.target.src = 'public/logo.png';
    }
  handleRandomSongClick() {
    this.songService.getRandomSong().subscribe({
      next: (song) => {
        if (song?.id) {
          this.router.navigate(['/song', song.id]);
        }
      },
      error: (err) => console.error('Failed to get random song', err)
    });
  }

  get isAdmin(): boolean {
    return !!(this.user && (this.user.role === 'Admin' || this.user.role === 4));
  }

  private updateAdminEditTarget(url: string): void {
    const cleanUrl = url.split('?')[0];
    const artistMatch = cleanUrl.match(/^\/artist\/(\w+)/);
    const teacherMatch = cleanUrl.match(/^\/teacher\/(\w+)/);

    if (artistMatch) {
      this.adminEditTarget = { label: 'עריכת דף אמן', url: '/admin/artists' };
    } else if (teacherMatch) {
      this.adminEditTarget = { label: 'עריכת דף מורה', url: `/admin/teachers/edit/${teacherMatch[1]}` };
    } else if (cleanUrl === '/professionals') {
      this.adminEditTarget = { label: 'ניהול בעלי מקצוע', url: '/admin/service-providers' };
    } else {
      this.adminEditTarget = null;
    }
  }

  fabAdminEdit(): void {
    if (!this.adminEditTarget) return;
    this.closeFabMenu();
    this.router.navigate([this.adminEditTarget.url]);
  }

  goToAdmin() {
    this.router.navigate(['/admin']);
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.showUserMenu = !this.showUserMenu;
  }

  toggleMobileMenu(): void {
    this.showMobileMenu = !this.showMobileMenu;
  }

  closeMobileMenu(): void {
    this.showMobileMenu = false;
  }

  closeUserMenu(): void {
    this.showUserMenu = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    this.showUserMenu = false;
    this.showFabMenu = false;
    this.showArtistSubMenu = false;
  }

  signOut(): void {
    this.showUserMenu = false;
    this.authService.logout();
    this.socialAuthService.signOut();
    window.location.reload();
  }

  // Auth Modal Functions
  openAuthModal(): void {
    this.showAuthModal = true;
  }

  closeAuthModal(): void {
    this.showAuthModal = false;
  }

  onAuthSuccess(response: AuthResponse): void {
    console.log('Auth successful', response);
    this.closeAuthModal();

    // If user needs to complete profile, show the additional details modal
    if (response.requiresProfileCompletion) {
      this.showAdditionalDetailsModal = true;
    } else {
      // ✅ לוגין הצליח! עכשיו מנתבים את המשתמש לדף שהוא ביקש
      const returnUrl = this.authService.getAndClearReturnUrl();
      if (returnUrl && returnUrl !== '/') {
        this.router.navigate([returnUrl]);
      }
    }
  }

  closeAdditionalDetailsModal(): void {
    this.showAdditionalDetailsModal = false;
  }

  onProfileComplete(userType: UserType): void {
    console.log('Profile completed as:', userType);
    this.closeAdditionalDetailsModal();

    // Handle different user types
    if (userType === UserType.Regular) {
      // משתמש רגיל - מופנה ישירות לאתר
      window.location.reload();
    } else {
      // משתמש מקצועי - קודם ממלא פרופיל, אחר כך בוחר חבילה
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
      }
    }
  }

  // Forgot Password Modal Functions
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
    this.showFabMenu = !this.showFabMenu;
    if (!this.showFabMenu) {
      this.showArtistSubMenu = false;
    }
  }

  closeFabMenu(): void {
    this.showFabMenu = false;
    this.showArtistSubMenu = false;
  }

  toggleArtistSubMenu(event: Event): void {
    event.stopPropagation();
    this.showArtistSubMenu = !this.showArtistSubMenu;
  }

  fabAddChords(): void {
    this.closeFabMenu();
    if (!this.loggedIn) { this.openAuthModal(); return; }
    this.modalService.openAddSongModal();
  }

  fabAddNews(): void {
    this.closeFabMenu();
    if (!this.loggedIn) { this.openAuthModal(); return; }
    this.router.navigate(['/submit/article'], { queryParams: { type: 'news' } });
  }

  fabAddContent(): void {
    this.closeFabMenu();
    if (!this.loggedIn) { this.openAuthModal(); return; }
    this.router.navigate(['/submit/article'], { queryParams: { type: 'content' } });
  }

  fabAddEvent(): void {
    this.closeFabMenu();
    if (!this.loggedIn) { this.openAuthModal(); return; }
    this.router.navigate(['/submit/event']);
  }

  fabCreatePlaylist(): void {
    this.closeFabMenu();
    if (!this.loggedIn) { this.openAuthModal(); return; }
    this.router.navigate(['/my-playlists']);
  }

  fabAddArtist(): void {
    this.closeFabMenu();
    if (!this.loggedIn) { this.openAuthModal(); return; }
    this.router.navigate(['/artist/create'], { queryParams: { mode: 'community' } });
  }

  fabUpgradeToArtist(): void {
    this.closeFabMenu();
    if (!this.loggedIn) { this.openAuthModal(); return; }
    this.router.navigate(['/subscription/select'], { queryParams: { type: 'artist' } });
  }

  fabUpgradeToTeacher(): void {
    this.closeFabMenu();
    if (!this.loggedIn) { this.openAuthModal(); return; }
    this.router.navigate(['/subscription/select'], { queryParams: { type: 'teacher' } });
  }

  goToAddSong() {
    this.modalService.openAddSongModal();
  }

  closeAddSongModal() {
    this.modalService.closeModal();
  }

  onSongAdded() {
    this.modalService.closeModal();
  }

  // Report Modal Functions
  openReportModal(): void {
    this.showReportModal = true;
  }

  closeReportModal(): void {
    this.showReportModal = false;
  }

  upgradeSubscription(): void {
    // נקה localStorage מבחירה קודמת כדי לאפשר בחירה חדשה
    localStorage.removeItem('selectedSubscriptionPlan');
    localStorage.removeItem('selectedBillingCycle');
    localStorage.removeItem('pendingProfessionalType');

    // סגור תפריטים פתוחים
    this.closeUserMenu();
    this.closeMobileMenu();

    // נווט לדף בחירת מנוי
    this.router.navigate(['/subscription/select']);
  }
}