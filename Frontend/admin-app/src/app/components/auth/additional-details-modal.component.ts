import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { SystemTablesService, SystemItem } from '../../services/system-tables.service';

export enum UserType {
  Regular = 'regular',
  Teacher = 'teacher',
  ServiceProvider = 'service-provider',
  Artist = 'artist'
}

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
  errorMessage = '';

  // Form fields
  preferredInstrumentId: number | null = null;
  phone = '';

  // Instruments list
  instruments: SystemItem[] = [];
  loadingInstruments = true;

  // User type enum
  UserType = UserType;

  constructor(
    private authService: AuthService,
    private systemTablesService: SystemTablesService
  ) {}

  ngOnInit() {
    this.loadInstruments();
  }

  loadInstruments() {
    this.loadingInstruments = true;
    this.systemTablesService.getItems('instruments', 1, 100).subscribe({
      next: (response) => {
        this.instruments = response.items;
        this.loadingInstruments = false;
      },
      error: (error) => {
        console.error('Failed to load instruments', error);
        this.loadingInstruments = false;
        this.errorMessage = 'שגיאה בטעינת רשימת כלי הנגינה';
      }
    });
  }

  onContinue(userType: UserType) {
    this.errorMessage = '';
    this.loading = true;

    // Complete profile with instrument and phone if provided
    this.authService.completeProfile(this.preferredInstrumentId, this.phone || undefined).subscribe({
      next: () => {
        this.loading = false;
        this.complete.emit(userType);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || 'שגיאה בעדכון הפרטים';
      }
    });
  }

  onClose() {
    // Allow closing without completing profile
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }
}
