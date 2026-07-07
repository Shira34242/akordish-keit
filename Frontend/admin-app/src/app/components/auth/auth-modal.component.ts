import { Component, EventEmitter, OnDestroy, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GoogleSigninButtonModule, SocialAuthService, GoogleLoginProvider } from '@abacritt/angularx-social-login';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { GoogleOneTapService } from '../../services/google-one-tap.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, GoogleSigninButtonModule, TranslatePipe, RouterLink],
  templateUrl: './auth-modal.component.html',
  styleUrls: ['./auth-modal.component.css']
})
export class AuthModalComponent implements OnDestroy {
  @Output() close = new EventEmitter<void>();
  @Output() authSuccess = new EventEmitter<any>();
  @Output() forgotPassword = new EventEmitter<void>();

  isLogin = false; // true = login mode, false = register mode
  loading = false;
  errorMessage = '';
  showPassword = false; // Password visibility toggle
  fieldErrors: Record<string, string> = {};

  // Form fields
  username = '';
  email = '';
  password = '';
  termsApproved = false;
  marketingConsent = false;
  googleTermsRequired = false;

  // Password strength
  passwordStrength: 'weak' | 'medium' | 'strong' | null = null;
  passwordErrors: string[] = [];
  private googleAuthSubscription?: Subscription;
  private readonly langService = inject(LanguageService);

  constructor(
    private authService: AuthService,
    private socialAuthService: SocialAuthService
  ) {
    // 🔒 בזמן שהמודל פתוח — One Tap הסרוויס לא יטפל בהתחברות, המודל יטפל
    GoogleOneTapService.setModalActive(true);

    // Listen for Google sign-in — רק אם המשתמש לא כבר מחובר
    // (authState הוא ReplaySubject שמשדר מיד בפתיחת המודל — בלי הבדיקה הזאת
    //  כל פתיחת מודל הייתה מפעילה google-login מחדש אם יש סשן Google פעיל בדפדפן)
    this.googleAuthSubscription = this.socialAuthService.authState.subscribe((user) => {
      if (user && user.idToken && !this.authService.isLoggedIn && !GoogleOneTapService.isProcessing()) {
        this.handleGoogleLogin(user.idToken);
      }
    });
  }

  ngOnDestroy() {
    this.googleAuthSubscription?.unsubscribe();
    GoogleOneTapService.setModalActive(false);
  }

  toggleMode() {
    this.isLogin = !this.isLogin;
    this.errorMessage = '';
    this.fieldErrors = {};
    this.clearForm();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  clearForm() {
    this.username = '';
    this.email = '';
    this.password = '';
    this.termsApproved = false;
    this.marketingConsent = false;
    this.googleTermsRequired = false;
    this.showPassword = false;
    this.passwordStrength = null;
    this.passwordErrors = [];
    this.fieldErrors = {};
  }

  onFieldInput(field: string): void {
    delete this.fieldErrors[field];
  }

  get shouldShowConsentRows(): boolean {
    return !this.isLogin || this.googleTermsRequired;
  }

  get googleRequiresTermsApproval(): boolean {
    return !this.isLogin || this.googleTermsRequired;
  }

  onPasswordChange() {
    if (!this.password || this.isLogin) {
      this.passwordStrength = null;
      this.passwordErrors = [];
      return;
    }

    this.passwordErrors = [];
    let score = 0;

    // Check length
    if (this.password.length < 8) {
      this.passwordErrors.push(this.langService.translate('auth.pw_min_length'));
    } else {
      score++;
    }

    // Check lowercase
    if (!/[a-z]/.test(this.password)) {
      this.passwordErrors.push(this.langService.translate('auth.pw_lowercase'));
    } else {
      score++;
    }

    // Check uppercase
    if (!/[A-Z]/.test(this.password)) {
      this.passwordErrors.push(this.langService.translate('auth.pw_uppercase'));
    } else {
      score++;
    }

    // Check number
    if (!/\d/.test(this.password)) {
      this.passwordErrors.push(this.langService.translate('auth.pw_number'));
    } else {
      score++;
    }

    // Check special character
    if (!/[@$!%*?&#]/.test(this.password)) {
      this.passwordErrors.push(this.langService.translate('auth.pw_special'));
    } else {
      score++;
    }

    // Determine strength
    if (score === 5) {
      this.passwordStrength = 'strong';
    } else if (score >= 3) {
      this.passwordStrength = 'medium';
    } else {
      this.passwordStrength = 'weak';
    }
  }

  onClose() {
    this.close.emit();
  }

  onForgotPassword() {
    this.forgotPassword.emit();
  }

  onSubmit() {
    this.errorMessage = '';
    this.fieldErrors = {};
    this.loading = true;

    if (this.isLogin) {
      this.handleLogin();
    } else {
      this.handleRegister();
    }
  }

  private handleLogin() {
    if (!this.username) {
      this.fieldErrors['loginEmail'] = 'שדה חובה';
    }
    if (!this.password) {
      this.fieldErrors['password'] = 'שדה חובה';
    }

    if (Object.keys(this.fieldErrors).length > 0) {
      this.loading = false;
      return;
    }

    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        this.loading = false;
        this.authSuccess.emit(response);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || this.langService.translate('auth.error_login');
      }
    });
  }

  private handleRegister() {
    if (!this.username) {
      this.fieldErrors['username'] = 'שדה חובה';
    }
    if (!this.email) {
      this.fieldErrors['email'] = 'שדה חובה';
    }
    if (!this.password) {
      this.fieldErrors['password'] = 'שדה חובה';
    }

    if (Object.keys(this.fieldErrors).length > 0) {
      this.loading = false;
      return;
    }

    if (!this.termsApproved) {
      this.errorMessage = this.langService.translate('auth.approve_terms');
      this.loading = false;
      return;
    }

    if (this.passwordErrors.length > 0) {
      this.errorMessage = this.langService.translate('auth.password_must_include') + this.passwordErrors.join(', ');
      this.loading = false;
      return;
    }

    this.authService.register(this.username, this.email, this.password, this.termsApproved, this.marketingConsent).subscribe({
      next: (response) => {
        this.loading = false;
        this.authSuccess.emit(response);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || this.langService.translate('auth.error_register');
      }
    });
  }

  private handleGoogleLogin(idToken: string) {
    const isRegistrationConsentFlow = this.googleRequiresTermsApproval;

    if (isRegistrationConsentFlow && !this.termsApproved) {
      this.errorMessage = this.langService.translate('auth.approve_terms');
      return;
    }

    GoogleOneTapService.setProcessing(true);
    this.loading = true;
    this.authService.googleLogin(idToken, isRegistrationConsentFlow && this.termsApproved, isRegistrationConsentFlow && this.marketingConsent).subscribe({
      next: (response) => {
        GoogleOneTapService.setProcessing(false);
        this.loading = false;
        this.authSuccess.emit(response);
      },
      error: (error) => {
        GoogleOneTapService.setProcessing(false);
        this.loading = false;
        if (this.isGoogleTermsRequiredError(error)) {
          this.googleTermsRequired = true;
          this.termsApproved = false;
          this.marketingConsent = false;
          this.errorMessage = this.langService.translate('auth.google_terms_required');
          return;
        }
        this.errorMessage = error.error?.message || this.langService.translate('auth.error_google');
      }
    });
  }

  private isGoogleTermsRequiredError(error: any): boolean {
    const body = error?.error;
    const message = typeof body === 'string' ? body : body?.message;

    return body?.code === 'TERMS_REQUIRED'
      || (typeof message === 'string' && message.includes('תקנון'));
  }

  triggerGoogleSignIn() {
    this.socialAuthService.signIn(GoogleLoginProvider.PROVIDER_ID);
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
