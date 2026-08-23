import { Component, EventEmitter, Input, OnDestroy, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GoogleSigninButtonModule, SocialAuthService, GoogleLoginProvider } from '@abacritt/angularx-social-login';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { GoogleOneTapService } from '../../services/google-one-tap.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { TurnstileComponent } from '../shared/turnstile/turnstile.component';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, GoogleSigninButtonModule, TranslatePipe, RouterLink, TurnstileComponent],
  templateUrl: './auth-modal.component.html',
  styleUrls: ['./auth-modal.component.css']
})
export class AuthModalComponent implements OnDestroy {
  @ViewChild(TurnstileComponent) turnstile?: TurnstileComponent;
  @Output() close = new EventEmitter<void>();
  @Output() authSuccess = new EventEmitter<any>();
  @Output() forgotPassword = new EventEmitter<void>();

  @Input()
  set initialMode(mode: 'login' | 'register') {
    this.isLogin = mode === 'login';
    this.registerStep = 'choice';
  }

  isLogin = false; // true = login mode, false = register mode
  registerStep: 'choice' | 'manual' = 'choice';
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
  turnstileToken: string | null = null;

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
    this.registerStep = 'choice';
    this.errorMessage = '';
    this.fieldErrors = {};
    this.clearForm();
  }

  openManualRegister(): void {
    this.errorMessage = '';
    if (!this.canRegister) {
      this.errorMessage = 'כדי להירשם יש לאשר את התקנון, מדיניות הפרטיות וקבלת הדיוור.';
      return;
    }

    this.turnstileToken = null;
    this.registerStep = 'manual';
  }

  backToRegisterChoice(): void {
    this.errorMessage = '';
    this.fieldErrors = {};
    this.registerStep = 'choice';
    this.username = '';
    this.email = '';
    this.password = '';
    this.showPassword = false;
    this.passwordStrength = null;
    this.passwordErrors = [];
    this.turnstileToken = null;
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
    this.turnstileToken = null;
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
    return this.googleTermsRequired;
  }

  get canRegister(): boolean {
    return this.termsApproved && this.marketingConsent;
  }

  get canSubmitRegistration(): boolean {
    return this.canRegister && !!this.turnstileToken;
  }

  onTurnstileToken(token: string | null): void {
    this.turnstileToken = token;
    if (token && this.errorMessage.includes('בדיקת האבטחה')) {
      this.errorMessage = '';
    }
  }

  onTurnstileError(): void {
    this.errorMessage = 'לא הצלחנו לטעון את בדיקת האבטחה. נסו שוב.';
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

    if (!this.canRegister) {
      this.errorMessage = 'כדי להירשם יש לאשר את התקנון, מדיניות הפרטיות וקבלת הדיוור.';
      this.loading = false;
      return;
    }

    if (!this.turnstileToken) {
      this.errorMessage = 'יש להשלים את בדיקת האבטחה לפני ההרשמה.';
      this.loading = false;
      return;
    }

    if (this.passwordErrors.length > 0) {
      this.errorMessage = this.langService.translate('auth.password_must_include') + this.passwordErrors.join(', ');
      this.loading = false;
      return;
    }

    this.authService.register(this.username, this.email, this.password, this.termsApproved, this.marketingConsent, this.turnstileToken).subscribe({
      next: (response) => {
        this.loading = false;
        this.authSuccess.emit(response);
      },
      error: (error) => {
        this.loading = false;
        this.turnstile?.reset();
        this.errorMessage = error.error?.message || this.langService.translate('auth.error_register');
      }
    });
  }

  private handleGoogleLogin(idToken: string) {
    const isRegistrationFlow = !this.isLogin;
    const isRegistrationConsentFlow = isRegistrationFlow || this.googleTermsRequired;

    if (isRegistrationFlow && !this.canRegister) {
      this.errorMessage = 'כדי להירשם יש לאשר את התקנון, מדיניות הפרטיות וקבלת הדיוור.';
      return;
    }

    if (isRegistrationFlow && !this.turnstileToken) {
      this.errorMessage = 'יש להשלים את בדיקת האבטחה לפני ההרשמה.';
      return;
    }

    if (!isRegistrationFlow && this.googleTermsRequired && !this.canRegister) {
      this.errorMessage = 'כדי להירשם יש לאשר את התקנון, מדיניות הפרטיות וקבלת הדיוור.';
      return;
    }

    GoogleOneTapService.setProcessing(true);
    this.loading = true;
    this.authService.googleLogin(
      idToken,
      isRegistrationConsentFlow && this.termsApproved,
      isRegistrationConsentFlow && this.marketingConsent,
      isRegistrationFlow ? this.turnstileToken ?? undefined : undefined
    ).subscribe({
      next: (response) => {
        GoogleOneTapService.setProcessing(false);
        this.loading = false;
        this.authSuccess.emit(response);
      },
      error: (error) => {
        GoogleOneTapService.setProcessing(false);
        this.loading = false;
        if (this.isGoogleRegistrationRequiredError(error)) {
          this.isLogin = false;
          this.registerStep = 'choice';
          this.googleTermsRequired = true;
          this.termsApproved = false;
          this.marketingConsent = false;
          this.turnstileToken = null;
          this.errorMessage = error.error?.code === 'TURNSTILE_REQUIRED'
            ? 'כדי להשלים הרשמה עם Google יש לעבור את בדיקת האבטחה.'
            : 'כדי להשלים הרשמה עם Google יש לאשר את התקנון, מדיניות הפרטיות וקבלת הדיוור.';
          return;
        }
        this.turnstile?.reset();
        this.errorMessage = error.error?.message || this.langService.translate('auth.error_google');
      }
    });
  }

  private isGoogleRegistrationRequiredError(error: any): boolean {
    const body = error?.error;
    const message = typeof body === 'string' ? body : body?.message;

    return body?.code === 'TERMS_REQUIRED'
      || body?.code === 'MARKETING_CONSENT_REQUIRED'
      || body?.code === 'TURNSTILE_REQUIRED'
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
