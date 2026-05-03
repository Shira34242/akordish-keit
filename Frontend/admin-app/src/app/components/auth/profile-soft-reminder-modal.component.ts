import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../services/auth.service';
import { CitiesService, City } from '../../services/cities.service';
import { ReminderKind } from '../../services/profile-reminder.service';

@Component({
  selector: 'app-profile-soft-reminder-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-soft-reminder-modal.component.html',
  styleUrls: ['./profile-soft-reminder-modal.component.css']
})
export class ProfileSoftReminderModalComponent implements OnInit {
  @Input() kind: ReminderKind = 'contact';
  @Input() user: User | null = null;

  @Output() saved = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();

  loading = false;
  errorMessage = '';

  // contact form
  phone = '';
  cityId: number | null = null;
  citySearch = '';
  cities: City[] = [];
  citiesLoading = true;
  showCityDropdown = false;

  // birthday form
  birthMonth: number | null = null;
  birthYear: number | null = null;

  months = [
    { value: 1, label: 'ינואר' },
    { value: 2, label: 'פברואר' },
    { value: 3, label: 'מרץ' },
    { value: 4, label: 'אפריל' },
    { value: 5, label: 'מאי' },
    { value: 6, label: 'יוני' },
    { value: 7, label: 'יולי' },
    { value: 8, label: 'אוגוסט' },
    { value: 9, label: 'ספטמבר' },
    { value: 10, label: 'אוקטובר' },
    { value: 11, label: 'נובמבר' },
    { value: 12, label: 'דצמבר' }
  ];
  years: number[] = [];

  constructor(
    private authService: AuthService,
    private citiesService: CitiesService
  ) {
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 5; y >= currentYear - 100; y--) {
      this.years.push(y);
    }
  }

  ngOnInit(): void {
    if (this.user) {
      this.phone = this.user.phone ?? '';
      this.cityId = this.user.cityId ?? null;
    }

    if (this.kind === 'contact') {
      this.citiesService.getCities().subscribe({
        next: cities => {
          this.cities = cities;
          this.citiesLoading = false;
          if (this.cityId) {
            const found = this.cities.find(c => c.id === this.cityId);
            if (found) this.citySearch = found.name;
          }
        },
        error: () => {
          this.citiesLoading = false;
        }
      });
    }
  }

  get title(): string {
    return this.kind === 'birthday' ? 'שנפתיע אותך ביומולדת? 🎂' : 'שנכיר קצת יותר? 🎵';
  }

  get subtitle(): string {
    return this.kind === 'birthday'
      ? 'נשמח לשלוח לך ברכה ביום ההולדת'
      : 'כדי שנוכל להמליץ לך על מורים ובעלי מקצוע באזור שלך';
  }

  get filteredCities(): City[] {
    const term = this.citySearch.trim();
    if (!term) return this.cities.slice(0, 50);
    return this.cities
      .filter(c => c.name.includes(term) || (c.englishName ?? '').toLowerCase().includes(term.toLowerCase()))
      .slice(0, 30);
  }

  selectCity(city: City): void {
    this.cityId = city.id;
    this.citySearch = city.name;
    this.showCityDropdown = false;
  }

  onCityInput(): void {
    this.showCityDropdown = true;
    // Clear cityId if user is typing freely (will need to re-pick)
    const exact = this.cities.find(c => c.name === this.citySearch.trim());
    this.cityId = exact ? exact.id : null;
  }

  get canSave(): boolean {
    if (this.loading) return false;
    if (this.kind === 'contact') {
      return !!(this.phone.trim() || this.cityId);
    }
    return !!(this.birthMonth && this.birthYear);
  }

  onSave(): void {
    this.errorMessage = '';
    this.loading = true;

    const payload: Record<string, unknown> = {};
    if (this.kind === 'contact') {
      if (this.phone.trim()) payload['phone'] = this.phone.trim();
      if (this.cityId) payload['cityId'] = this.cityId;
    } else {
      if (this.birthMonth) payload['birthMonth'] = this.birthMonth;
      if (this.birthYear) payload['birthYear'] = this.birthYear;
    }

    this.authService.updateSoftProfile(payload).subscribe({
      next: () => {
        this.loading = false;
        this.saved.emit();
      },
      error: (err: any) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'שגיאה בשמירת הפרטים';
      }
    });
  }

  onDismiss(): void {
    this.authService.dismissProfileReminder().subscribe({
      next: () => this.dismissed.emit(),
      error: () => this.dismissed.emit() // emit anyway — UX shouldn't block on it
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onDismiss();
    }
  }
}
