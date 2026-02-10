import { Component, OnInit, HostListener } from '@angular/core';
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
export class LayoutComponent implements OnInit {
  user: User | null = null;
  socialUser: SocialUser | null = null;
  loggedIn: boolean = false;
  showUserMenu: boolean = false;
  showAddSongModal: boolean = false;
  showMobileMenu: boolean = false;

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
      // משתמש רגיל - אין צורך במנוי, רק רענון
      window.location.reload();
    } else {
      // משתמש מקצועי (Teacher/ServiceProvider/Artist) - שמירת הבחירה ומעבר לבחירת מנוי
      localStorage.setItem('pendingProfessionalType', userType);

      // ניווט לדף בחירת מנוי (לא תשלום בפועל, רק בחירה)
      this.router.navigate(['/subscription/select'], {
        queryParams: { from: 'registration', type: userType }
      });
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

  goToAddSong() {
    this.modalService.openAddSongModal();
  }

  closeAddSongModal() {
    this.modalService.closeModal();
  }

  onSongAdded() {
    this.modalService.closeModal();
    // Optionally refresh song list or navigate
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