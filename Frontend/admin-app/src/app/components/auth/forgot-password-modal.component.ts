import { Component, EventEmitter, Output, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

export enum RecoveryMethod {
  Email = 'email',
}

@Component({
  selector: 'app-forgot-password-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './forgot-password-modal.component.html',
  styleUrls: ['./forgot-password-modal.component.css']
})
export class ForgotPasswordModalComponent implements OnDestroy {
  @Output() close = new EventEmitter<void>();
  @Output() success = new EventEmitter<void>();

  step: 'request' | 'verify' = 'request';
  loading = false;
  errorMessage = '';
  successMessage = '';

  // Form fields
  usernameOrEmail = '';
  recoveryMethod: RecoveryMethod = RecoveryMethod.Email;
  verificationCode = '';
  newPassword = '';
  confirmPassword = '';

  // Password visibility
  showNewPassword = false;
  showConfirmPassword = false;

  // Password strength
  passwordStrength: 'weak' | 'medium' | 'strong' | null = null;
  passwordErrors: string[] = [];

  // Resend countdown
  resendCountdown = 0;
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  // Recovery method enum
  RecoveryMethod = RecoveryMethod;
  private readonly langService = inject(LanguageService);

  constructor(private authService: AuthService) {}

  ngOnDestroy() {
    this.clearCountdown();
  }

  private startResendCountdown(seconds = 60) {
    this.clearCountdown();
    this.resendCountdown = seconds;
    this.countdownInterval = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) {
        this.clearCountdown();
      }
    }, 1000);
  }

  private clearCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    this.resendCountdown = 0;
  }

  onResendCode() {
    if (this.resendCountdown > 0 || this.loading) return;
    this.errorMessage = '';
    this.successMessage = '';
    this.loading = true;
    this.authService.requestPasswordReset(this.usernameOrEmail, this.recoveryMethod).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = this.langService.translate('auth.code_sent_email');
        this.startResendCountdown();
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || this.langService.translate('auth.error_send_code');
      }
    });
  }

  onRequestReset() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.usernameOrEmail) {
      this.errorMessage = this.langService.translate('auth.enter_username_email');
      return;
    }

    this.loading = true;

    this.authService.requestPasswordReset(this.usernameOrEmail, this.recoveryMethod).subscribe({
      next: () => {
        this.loading = false;
        this.step = 'verify';
        this.successMessage = this.langService.translate('auth.code_sent_email');
        this.startResendCountdown();
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || this.langService.translate('auth.error_send_code');
      }
    });
  }

  onResetPassword() {
    this.errorMessage = '';

    if (!this.verificationCode) {
      this.errorMessage = this.langService.translate('auth.enter_verification_code');
      return;
    }

    if (!this.newPassword) {
      this.errorMessage = this.langService.translate('auth.enter_new_password');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = this.langService.translate('auth.passwords_mismatch');
      return;
    }

    if (this.passwordErrors.length > 0) {
      this.errorMessage = this.langService.translate('auth.password_requirements');
      return;
    }

    this.loading = true;

    this.authService.resetPassword(this.usernameOrEmail, this.verificationCode, this.newPassword).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = this.langService.translate('auth.password_changed');
        setTimeout(() => {
          this.success.emit();
        }, 2000);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || this.langService.translate('auth.error_reset_password');
      }
    });
  }

  onPasswordChange() {
    if (!this.newPassword) {
      this.passwordStrength = null;
      this.passwordErrors = [];
      return;
    }

    this.passwordErrors = [];
    let score = 0;

    // Check length
    if (this.newPassword.length < 8) {
      this.passwordErrors.push(this.langService.translate('auth.pw_min_length'));
    } else {
      score++;
    }

    // Check lowercase
    if (!/[a-z]/.test(this.newPassword)) {
      this.passwordErrors.push(this.langService.translate('auth.pw_lowercase'));
    } else {
      score++;
    }

    // Check uppercase
    if (!/[A-Z]/.test(this.newPassword)) {
      this.passwordErrors.push(this.langService.translate('auth.pw_uppercase'));
    } else {
      score++;
    }

    // Check number
    if (!/\d/.test(this.newPassword)) {
      this.passwordErrors.push(this.langService.translate('auth.pw_number'));
    } else {
      score++;
    }

    // Check special character
    if (!/[@$!%*?&#]/.test(this.newPassword)) {
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

  toggleNewPasswordVisibility() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  goBack() {
    if (this.step === 'verify') {
      this.step = 'request';
      this.errorMessage = '';
      this.successMessage = '';
      this.clearCountdown();
    } else {
      this.onClose();
    }
  }
}
