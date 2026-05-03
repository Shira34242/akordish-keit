import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Instrument, InstrumentService } from '../../services/instrument.service';

export enum UserType {
  Regular = 'regular',
  Teacher = 'teacher',
  ServiceProvider = 'service-provider',
  Artist = 'artist'
}

const FEATURED_NAMES = ['פסנתר', 'גיטרה', 'קלידים', 'תופים'];

@Component({
  selector: 'app-additional-details-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './additional-details-modal.component.html',
  styleUrls: ['./additional-details-modal.component.css']
})
export class AdditionalDetailsModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() complete = new EventEmitter<UserType>();

  loading = false;
  instrumentsLoading = true;
  errorMessage = '';

  currentStep: 'instrument' | 'userType' = 'instrument';

  allInstruments: Instrument[] = [];
  featuredInstruments: Instrument[] = [];
  otherListInstruments: Instrument[] = [];

  selectedInstrumentIds = new Set<number>();
  selectedNone = false;
  showOther = false;
  otherInstrumentName = '';
  showFullList = false;

  // 1=Beginner, 2=Intermediate, 3=Professional
  selectedLevel: 1 | 2 | 3 = 1;
  selectedUserType: UserType | null = null;

  UserType = UserType;

  constructor(
    private authService: AuthService,
    private instrumentService: InstrumentService
  ) {}

  ngOnInit(): void {
    this.instrumentService.getAll().subscribe({
      next: instruments => {
        this.allInstruments = instruments;
        this.featuredInstruments = FEATURED_NAMES
          .map(name => instruments.find(i => i.name === name))
          .filter((i): i is Instrument => !!i);

        const featuredIds = new Set(this.featuredInstruments.map(i => i.id));
        this.otherListInstruments = instruments.filter(i => !featuredIds.has(i.id));
        this.instrumentsLoading = false;
      },
      error: () => {
        this.instrumentsLoading = false;
      }
    });
  }

  toggleInstrument(id: number): void {
    if (this.selectedNone) {
      this.selectedNone = false;
    }
    if (this.selectedInstrumentIds.has(id)) {
      this.selectedInstrumentIds.delete(id);
    } else {
      this.selectedInstrumentIds.add(id);
    }
  }

  toggleOther(): void {
    this.showOther = !this.showOther;
    if (this.showOther && this.selectedNone) {
      this.selectedNone = false;
    }
    if (!this.showOther) {
      this.otherInstrumentName = '';
    }
  }

  toggleNone(): void {
    this.selectedNone = !this.selectedNone;
    if (this.selectedNone) {
      this.selectedInstrumentIds.clear();
      this.showOther = false;
      this.otherInstrumentName = '';
    }
  }

  toggleFullList(): void {
    this.showFullList = !this.showFullList;
  }

  isInstrumentSelected(id: number): boolean {
    return this.selectedInstrumentIds.has(id);
  }

  get hasInstrumentChoice(): boolean {
    return (
      this.selectedNone ||
      this.selectedInstrumentIds.size > 0 ||
      (this.showOther && this.otherInstrumentName.trim().length > 0)
    );
  }

  onContinue(): void {
    this.errorMessage = '';
    this.currentStep = 'userType';
  }

  onFinish(): void {
    this.errorMessage = '';
    this.loading = true;

    const payload = {
      instrumentIds: this.selectedNone ? [] : Array.from(this.selectedInstrumentIds),
      otherInstrumentName: this.showOther ? this.otherInstrumentName.trim() || null : null,
      instrumentLevel: this.selectedNone ? null : this.selectedLevel,
      userType: this.selectedUserType ?? UserType.Regular
    };

    this.authService.completeProfile(payload).subscribe({
      next: () => {
        this.loading = false;
        this.complete.emit(this.selectedUserType ?? UserType.Regular);
      },
      error: (error: any) => {
        this.loading = false;
        this.errorMessage = error?.error?.message || 'שגיאה בעדכון הפרטים';
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
