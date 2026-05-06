import { Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GoogleSigninButtonModule, SocialAuthService, GoogleLoginProvider } from '@abacritt/angularx-social-login';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { GoogleOneTapService } from '../../services/google-one-tap.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

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

  isLogin = true; // true = login mode, false = register mode
  loading = false;
  errorMessage = '';
  showPassword = false; // Password visibility toggle

  // Form fields
  username = '';
  email = '';
  password = '';
  termsApproved = false;
  marketingConsent = false;

  // Password strength
  passwordStrength: 'weak' | 'medium' | 'strong' | null = null;
  passwordErrors: string[] = [];
  private googleAuthSubscription?: Subscription;

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
    this.showPassword = false;
    this.passwordStrength = null;
    this.passwordErrors = [];
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
      this.passwordErrors.push('לפחות 8 תווים');
    } else {
      score++;
    }

    // Check lowercase
    if (!/[a-z]/.test(this.password)) {
      this.passwordErrors.push('אות קטנה באנגלית');
    } else {
      score++;
    }

    // Check uppercase
    if (!/[A-Z]/.test(this.password)) {
      this.passwordErrors.push('אות גדולה באנגלית');
    } else {
      score++;
    }

    // Check number
    if (!/\d/.test(this.password)) {
      this.passwordErrors.push('ספרה');
    } else {
      score++;
    }

    // Check special character
    if (!/[@$!%*?&#]/.test(this.password)) {
      this.passwordErrors.push('תו מיוחד (@$!%*?&#)');
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
    this.loading = true;

    if (this.isLogin) {
      this.handleLogin();
    } else {
      this.handleRegister();
    }
  }

  private handleLogin() {
    this.authService.login(this.username, this.password).subscribe({
      next: (response) => {
        this.loading = false;
        this.authSuccess.emit(response);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || 'שגיאה בכניסה למערכת';
      }
    });
  }

  private handleRegister() {
    if (!this.email || !this.username || !this.password) {
      this.errorMessage = 'נא למלא את כל השדות';
      this.loading = false;
      return;
    }

    if (!this.termsApproved) {
      this.errorMessage = 'יש לאשר את התקנון ומדיניות הפרטיות כדי להירשם';
      this.loading = false;
      return;
    }

    if (this.passwordErrors.length > 0) {
      this.errorMessage = 'הסיסמא חייבת לכלול: ' + this.passwordErrors.join(', ');
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
        this.errorMessage = error.error?.message || 'שגיאה בהרשמה למערכת';
      }
    });
  }

  private handleGoogleLogin(idToken: string) {
    if (!this.isLogin && !this.termsApproved) {
      this.errorMessage = 'יש לאשר את התקנון ומדיניות הפרטיות כדי להירשם';
      return;
    }

    GoogleOneTapService.setProcessing(true);
    this.loading = true;
    this.authService.googleLogin(idToken, !this.isLogin && this.termsApproved, !this.isLogin && this.marketingConsent).subscribe({
      next: (response) => {
        GoogleOneTapService.setProcessing(false);
        this.loading = false;
        this.authSuccess.emit(response);
      },
      error: (error) => {
        GoogleOneTapService.setProcessing(false);
        this.loading = false;
        this.errorMessage = error.error?.message || 'שגיאה בכניסה עם Google';
      }
    });
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
