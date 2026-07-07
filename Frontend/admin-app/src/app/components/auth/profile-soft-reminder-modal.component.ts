import { Component, EventEmitter, HostListener, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, User } from '../../services/auth.service';
import { CitiesService, City } from '../../services/cities.service';
import { ReminderKind } from '../../services/profile-reminder.service';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-profile-soft-reminder-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-soft-reminder-modal.component.html',
  styleUrls: ['./profile-soft-reminder-modal.component.css']
})
export class ProfileSoftReminderModalComponent implements OnInit {
  @Input() kind: ReminderKind = 'profile';
  @Input() user: User | null = null;

  @Output() saved = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();

  loading = false;
  errorMessage = '';

  phone = '';
  cityId: number | null = null;
  address = '';
  citySearch = '';
  cities: City[] = [];
  citiesLoading = true;
  showCityDropdown = false;

  birthMonth: number | null = null;
  birthYear: number | null = null;

  private readonly langService = inject(LanguageService);

  get months(): { value: number; label: string }[] {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: this.langService.translate(`common.month_${i + 1}`)
    }));
  }
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
      this.address = this.user.address ?? '';
    }

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

  get title(): string {
    if (this.kind === 'public-page') {
      return 'רוצה להשלים את הדף הציבורי שלך?';
    }

    return this.langService.translate('profile_reminder.unified_title');
  }

  get publicPageText(): string {
    return 'אפשר להוסיף עכשיו את הכרטיס הציבורי שלך באתר, כדי שאנשים יוכלו למצוא אותך, להבין מה אתה עושה וליצור איתך קשר. את הדף תוכל לנהל ולעדכן בעצמך.';
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
    const exact = this.cities.find(c => c.name === this.citySearch.trim());
    this.cityId = exact ? exact.id : null;
  }

  onCityBlur(): void {
    setTimeout(() => {
      this.showCityDropdown = false;
    }, 200);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.city-field')) {
      this.showCityDropdown = false;
    }
  }

  get canSave(): boolean {
    if (this.loading) return false;
    return !!(this.phone.trim() && this.cityId && this.address.trim() && this.birthMonth && this.birthYear);
  }

  onSave(): void {
    this.errorMessage = '';
    this.loading = true;

    const payload: Record<string, unknown> = {};
    if (this.phone.trim()) payload['phone'] = this.phone.trim();
    if (this.cityId) payload['cityId'] = this.cityId;
    if (this.address.trim()) payload['address'] = this.address.trim();
    if (this.birthMonth) payload['birthMonth'] = this.birthMonth;
    if (this.birthYear) payload['birthYear'] = this.birthYear;

    this.authService.updateSoftProfile(payload).subscribe({
      next: () => {
        this.loading = false;
        this.saved.emit();
      },
      error: (err: any) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || this.langService.translate('profile_reminder.error_save');
      }
    });
  }

  onDismiss(): void {
    if (this.kind === 'public-page') {
      this.authService.dismissPublicPageReminder().subscribe({
        next: () => this.dismissed.emit(),
        error: () => this.dismissed.emit()
      });
      return;
    }

    this.authService.dismissProfileReminder().subscribe({
      next: () => this.dismissed.emit(),
      error: () => this.dismissed.emit()
    });
  }

  onDismissPermanently(): void {
    this.authService.dismissPublicPageReminder({ permanently: true }).subscribe({
      next: () => this.dismissed.emit(),
      error: () => this.dismissed.emit()
    });
  }

  onAddPublicPage(): void {
    this.saved.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onDismiss();
    }
  }
}
