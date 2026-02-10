import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

export enum RecoveryMethod {
  Email = 'email',
  SMS = 'sms'
}

@Component({
  selector: 'app-forgot-password-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password-modal.component.html',
  styleUrls: ['./forgot-password-modal.component.css']
})
export class ForgotPasswordModalComponent {
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

  // Recovery method enum
  RecoveryMethod = RecoveryMethod;

  constructor(private authService: AuthService) {}

  onRequestReset() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.usernameOrEmail) {
      this.errorMessage = 'נא להזין שם משתמש או אימייל';
      return;
    }

    this.loading = true;

    this.authService.requestPasswordReset(this.usernameOrEmail, this.recoveryMethod).subscribe({
      next: () => {
        this.loading = false;
        this.step = 'verify';
        this.successMessage = this.recoveryMethod === RecoveryMethod.Email
          ? 'קוד אימות נשלח לאימייל שלך'
          : 'קוד אימות נשלח בהודעת SMS';
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || 'שגיאה בשליחת קוד האימות';
      }
    });
  }

  onResetPassword() {
    this.errorMessage = '';

    if (!this.verificationCode) {
      this.errorMessage = 'נא להזין קוד אימות';
      return;
    }

    if (!this.newPassword) {
      this.errorMessage = 'נא להזין סיסמא חדשה';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'הסיסמאות אינן תואמות';
      return;
    }

    if (this.passwordErrors.length > 0) {
      this.errorMessage = 'הסיסמא אינה עומדת בדרישות';
      return;
    }

    this.loading = true;

    this.authService.resetPassword(this.usernameOrEmail, this.verificationCode, this.newPassword).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = 'הסיסמא שונתה בהצלחה!';
        setTimeout(() => {
          this.success.emit();
        }, 2000);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || 'שגיאה באיפוס הסיסמא';
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
      this.passwordErrors.push('לפחות 8 תווים');
    } else {
      score++;
    }

    // Check lowercase
    if (!/[a-z]/.test(this.newPassword)) {
      this.passwordErrors.push('אות קטנה באנגלית');
    } else {
      score++;
    }

    // Check uppercase
    if (!/[A-Z]/.test(this.newPassword)) {
      this.passwordErrors.push('אות גדולה באנגלית');
    } else {
      score++;
    }

    // Check number
    if (!/\d/.test(this.newPassword)) {
      this.passwordErrors.push('ספרה');
    } else {
      score++;
    }

    // Check special character
    if (!/[@$!%*?&#]/.test(this.newPassword)) {
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
    } else {
      this.onClose();
    }
  }
}
