import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

export enum UserType {
  Regular = 'regular',
  Teacher = 'teacher',
  ServiceProvider = 'service-provider',
  Artist = 'artist'
}

@Component({
  selector: 'app-additional-details-modal',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './additional-details-modal.component.html',
  styleUrls: ['./additional-details-modal.component.css']
})
export class AdditionalDetailsModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() complete = new EventEmitter<UserType>();

  loading = false;
  errorMessage = '';

  currentStep: 'instrument' | 'userType' = 'instrument';

  selectedInstrument: string = '';
  selectedLevel: string = '';
  selectedUserType: UserType | null = null;

  UserType = UserType;
  private readonly langService = inject(LanguageService);

  constructor(private authService: AuthService) {}

  onContinue(): void {
    this.errorMessage = '';
    this.currentStep = 'userType';
  }

  onFinish(): void {
    this.errorMessage = '';
    this.loading = true;

    const levelMap: Record<string, 1 | 2 | 3> = { 'מתחיל/ה': 1, 'מתקדם/ת': 2, 'מקצועי/ת': 3 };
    const instrumentName = this.selectedInstrument !== 'none' ? this.selectedInstrument : null;
    const payload = {
      otherInstrumentName: instrumentName !== 'other' ? instrumentName : null,
      instrumentLevel: this.selectedInstrument !== 'none' ? (levelMap[this.selectedLevel] ?? null) : null,
      userType: this.selectedUserType ?? UserType.Regular
    };

    this.authService.completeProfile(payload).subscribe({
      next: () => {
        this.loading = false;
        this.complete.emit(this.selectedUserType ?? UserType.Regular);
      },
      error: (error: any) => {
        this.loading = false;
        this.errorMessage = error?.error?.message || this.langService.translate('auth.error_update_details');
      }
    });
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
