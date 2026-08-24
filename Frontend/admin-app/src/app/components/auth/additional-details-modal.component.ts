import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, UpdateSoftProfilePayload } from '../../services/auth.service';
import { CitiesService, City } from '../../services/cities.service';
import { SystemItem, SystemTablesService } from '../../services/system-tables.service';
export { UserType } from './user-type.enum';
import { UserType } from './user-type.enum';

export interface OnboardingProfileChoice {
  userType: UserType;
  addPublicPage: boolean;
  serviceProviderCategoryId?: number;
}

interface InstrumentOption {
  id: number;
  label: string;
}

@Component({
  selector: 'app-additional-details-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './additional-details-modal.component.html',
  styleUrls: ['./additional-details-modal.component.css']
})
export class AdditionalDetailsModalComponent {
  @Input() previewMode = false;
  @Input() seamlessEntry = false;
  @Output() close = new EventEmitter<void>();
  @Output() complete = new EventEmitter<OnboardingProfileChoice>();

  loading = false;
  errorMessage = '';

  currentStep: 'instrument' | 'profileDetails' | 'userType' | 'publicPage' = 'instrument';

  selectedInstrumentIds: number[] = [];
  otherInstrumentSelected = false;
  otherInstrumentEditing = false;
  otherInstrumentName = '';
  notPlaying = false;
  selectedLevel: 1 | 2 | 3 | null = null;
  phone = '';
  cityId: number | null = null;
  citySearch = '';
  address = '';
  birthMonth: number | null = null;
  birthYear: number | null = null;
  cities: City[] = [];
  citiesLoading = true;
  showCityDropdown = false;
  selectedUserType: UserType | null = null;
  selectedServiceProviderCategoryId?: number;
  serviceProviderCategories: SystemItem[] = [];
  categoriesLoading = false;
  categoriesError = '';

  readonly instrumentOptions: InstrumentOption[] = [
    { id: 3, label: 'קלידים' },
    { id: 1, label: 'גיטרה' },
    { id: 6, label: 'כינור' },
    { id: 9, label: 'יוקלילי' }
  ];
  readonly months = [
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
  readonly birthYears: number[];

  UserType = UserType;
  private readonly authService = inject(AuthService);
  private readonly citiesService = inject(CitiesService);
  private readonly systemTablesService = inject(SystemTablesService);

  constructor() {
    const currentYear = new Date().getFullYear();
    this.birthYears = Array.from({ length: 96 }, (_, index) => currentYear - 5 - index);
    this.prefillProfileDetails();
    this.loadCities();
    this.loadServiceProviderCategories();
  }

  get progressPercent(): number {
    if (this.currentStep === 'instrument') return 33;
    if (this.currentStep === 'profileDetails') return 66;
    return 100;
  }

  get isPublicPageCandidate(): boolean {
    return (this.selectedUserType ?? UserType.Regular) !== UserType.Regular;
  }

  get canChooseLevel(): boolean {
    return !this.notPlaying && !this.otherInstrumentEditing && (
      this.selectedInstrumentIds.length > 0 ||
      (this.otherInstrumentSelected && this.otherInstrumentName.trim().length >= 2)
    );
  }

  toggleInstrument(id: number): void {
    this.notPlaying = false;
    this.selectedInstrumentIds = this.isInstrumentSelected(id)
      ? this.selectedInstrumentIds.filter(existingId => existingId !== id)
      : [...this.selectedInstrumentIds, id];
  }

  toggleOtherInstrument(): void {
    this.notPlaying = false;
    if (this.otherInstrumentSelected) {
      this.otherInstrumentSelected = false;
      this.otherInstrumentName = '';
      return;
    }

    this.otherInstrumentEditing = true;
  }

  confirmOtherInstrument(): void {
    const instrumentName = this.otherInstrumentName.trim();
    if (instrumentName.length < 2) return;

    this.otherInstrumentName = instrumentName;
    this.otherInstrumentSelected = true;
    this.otherInstrumentEditing = false;
  }

  cancelOtherInstrument(): void {
    this.otherInstrumentEditing = false;
    this.otherInstrumentSelected = false;
    this.otherInstrumentName = '';
  }

  selectNotPlaying(): void {
    this.notPlaying = true;
    this.selectedInstrumentIds = [];
    this.otherInstrumentSelected = false;
    this.otherInstrumentEditing = false;
    this.otherInstrumentName = '';
    this.selectedLevel = null;
    this.currentStep = 'profileDetails';
  }

  selectLevel(level: 1 | 2 | 3): void {
    this.notPlaying = false;
    this.selectedLevel = level;
    this.currentStep = 'profileDetails';
  }

  get filteredCities(): City[] {
    const term = this.citySearch.trim();
    if (!term) return this.cities.slice(0, 30);

    return this.cities
      .filter(city => city.name.includes(term) || (city.englishName ?? '').toLowerCase().includes(term.toLowerCase()))
      .slice(0, 30);
  }

  get canContinueProfileDetails(): boolean {
    return !this.loading;
  }

  onCityInput(): void {
    this.showCityDropdown = true;
    const exactCity = this.cities.find(city => city.name === this.citySearch.trim());
    this.cityId = exactCity?.id ?? null;
  }

  selectCity(city: City): void {
    this.cityId = city.id;
    this.citySearch = city.name;
    this.showCityDropdown = false;
  }

  onCityBlur(): void {
    setTimeout(() => this.showCityDropdown = false, 200);
  }

  saveProfileDetails(): void {
    if (!this.canContinueProfileDetails) return;

    this.errorMessage = '';
    if (this.previewMode) {
      this.currentStep = 'userType';
      return;
    }

    const payload: UpdateSoftProfilePayload = {};
    if (this.phone.trim()) payload.phone = this.phone.trim();
    if (this.cityId) payload.cityId = this.cityId;
    if (this.address.trim()) payload.address = this.address.trim();
    if (this.birthMonth) payload.birthMonth = this.birthMonth;
    if (this.birthYear) payload.birthYear = this.birthYear;

    if (Object.keys(payload).length === 0) {
      this.currentStep = 'userType';
      return;
    }

    this.loading = true;
    this.authService.updateSoftProfile(payload).subscribe({
      next: () => {
        this.loading = false;
        this.currentStep = 'userType';
      },
      error: (error: any) => {
        this.loading = false;
        this.errorMessage = error?.error?.message || 'לא הצלחנו לשמור את הפרטים. אפשר לנסות שוב.';
      }
    });
  }

  isInstrumentSelected(id: number): boolean {
    return this.selectedInstrumentIds.includes(id);
  }

  selectUserType(userType: UserType, categoryId?: number): void {
    this.selectedUserType = userType;
    this.selectedServiceProviderCategoryId = userType === UserType.ServiceProvider ? categoryId : undefined;

    if (userType === UserType.Regular) {
      this.finish(false);
      return;
    }

    this.currentStep = 'publicPage';
  }

  isGeneralServiceSelected(): boolean {
    return this.selectedUserType === UserType.ServiceProvider && !this.selectedServiceProviderCategoryId;
  }

  trackByCategory(_index: number, category: SystemItem): number {
    return category.id;
  }

  onAddPublicPage(): void {
    this.finish(true);
  }

  onSkipPublicPage(): void {
    this.finish(false);
  }

  private finish(addPublicPage: boolean): void {
    this.errorMessage = '';

    if (this.previewMode) {
      this.close.emit();
      return;
    }

    this.loading = true;

    const payload = {
      instrumentIds: this.selectedInstrumentIds,
      otherInstrumentName: this.otherInstrumentSelected ? this.otherInstrumentName.trim() || null : null,
      instrumentLevel: this.selectedLevel,
      userType: this.selectedUserType ?? UserType.Regular
    };

    this.authService.completeProfile(payload).subscribe({
      next: () => {
        const userType = this.selectedUserType ?? UserType.Regular;
        this.loading = false;
        this.complete.emit({ userType, addPublicPage, serviceProviderCategoryId: this.selectedServiceProviderCategoryId });
      },
      error: (error: any) => {
        this.loading = false;
        this.errorMessage = error?.error?.message || 'לא הצלחנו לשמור את הפרטים. אפשר לנסות שוב או לדלג.';
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

  get publicPageTitle(): string {
    if (this.selectedUserType === UserType.Teacher) return 'רוצה לפתוח דף מורה ציבורי באתר?';
    return 'רוצה לפתוח דף ציבורי לשירות שלך באתר?';
  }

  get publicPageText(): string {
    return 'זה יהיה כרטיס אישי שלך באתר, שאנשים יוכלו להיכנס אליו, להכיר אותך, לראות מה אתה מציע וליצור איתך קשר. הדף יכול להגדיל חשיפה ללקוחות רלוונטיים, ותוכל לנהל ולעדכן אותו בעצמך.';
  }

  private loadServiceProviderCategories(): void {
    this.categoriesLoading = true;
    this.categoriesError = '';

    this.systemTablesService.getItems('music-service-provider-categories', 1, 100).subscribe({
      next: (result) => {
        this.serviceProviderCategories = (result.items ?? []).filter(item => this.isServiceProviderCategory(item));
        this.categoriesLoading = false;
      },
      error: () => {
        this.categoriesError = 'לא הצלחנו לטעון את קטגוריות נותני השירות';
        this.categoriesLoading = false;
      }
    });
  }

  private loadCities(): void {
    this.citiesService.getCities().subscribe({
      next: cities => {
        this.cities = cities;
        this.citiesLoading = false;
        if (this.cityId) {
          this.citySearch = this.cities.find(city => city.id === this.cityId)?.name ?? this.citySearch;
        }
      },
      error: () => this.citiesLoading = false
    });
  }

  private prefillProfileDetails(): void {
    const user = this.authService.currentUserValue;
    if (!user) return;

    this.phone = user.phone ?? '';
    this.cityId = user.cityId ?? null;
    this.address = user.address ?? '';

    const birthDateMatch = /^(\d{4})-(\d{2})/.exec(user.birthDate ?? '');
    if (!birthDateMatch) return;

    this.birthYear = Number(birthDateMatch[1]);
    this.birthMonth = Number(birthDateMatch[2]);
  }

  private isServiceProviderCategory(item: SystemItem): boolean {
    const label = `${item.name || ''} ${item['quickCategoryLabel'] || ''}`.toLowerCase();
    const looksLikeTeacherCategory =
      label.includes('מורה') ||
      label.includes('מורים') ||
      label.includes('teacher');

    return item['isActive'] !== false
      && Number(item['quickCategoryType'] ?? 0) !== 1
      && !item['quickCategoryInstrumentId']
      && !looksLikeTeacherCategory;
  }
}
