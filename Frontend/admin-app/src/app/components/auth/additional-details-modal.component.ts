import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

export enum UserType {
  Regular = 'regular',
  Teacher = 'teacher',
  ServiceProvider = 'service-provider',
  Artist = 'artist'
}

@Component({
  selector: 'app-additional-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './additional-details-modal.component.html',
  styleUrls: ['./additional-details-modal.component.css']
})
export class AdditionalDetailsModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() complete = new EventEmitter<UserType>();

  loading = false;
  errorMessage = '';

  currentStep: 'instrument' | 'userType' = 'instrument';
  selectedInstrument: string | null = null;
  selectedLevel = 'מתחיל/ה';
  selectedUserType: UserType | null = null;

  UserType = UserType;

  constructor(private authService: AuthService) {}

  onContinue() {
    this.currentStep = 'userType';
  }

  onFinish() {
    this.errorMessage = '';
    this.loading = true;

    this.authService.completeProfile(null, undefined).subscribe({
      next: () => {
        this.loading = false;
        this.complete.emit(this.selectedUserType ?? UserType.Regular);
      },
      error: (error: any) => {
        this.loading = false;
        this.errorMessage = error.error?.message || 'שגיאה בעדכון הפרטים';
      }
    });
  }

  onClose() {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
