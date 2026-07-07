import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
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
  @Output() close = new EventEmitter<void>();
  @Output() complete = new EventEmitter<OnboardingProfileChoice>();

  loading = false;
  errorMessage = '';

  currentStep: 'name' | 'instrument' | 'userType' | 'publicPage' = 'name';

  profileName = '';
  selectedInstrumentIds: number[] = [];
  selectedLevel: 1 | 2 | 3 | null = null;
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

  UserType = UserType;
  private readonly authService = inject(AuthService);
  private readonly systemTablesService = inject(SystemTablesService);

  constructor() {
    this.loadServiceProviderCategories();
  }

  get progressPercent(): number {
    if (this.currentStep === 'name') return 33;
    if (this.currentStep === 'instrument') return 66;
    return 100;
  }

  get isPublicPageCandidate(): boolean {
    return (this.selectedUserType ?? UserType.Regular) !== UserType.Regular;
  }

  goNext(): void {
    this.errorMessage = '';

    if (this.currentStep === 'name') {
      this.currentStep = 'instrument';
      return;
    }

    if (this.currentStep === 'instrument') {
      this.currentStep = 'userType';
      return;
    }

    if (this.currentStep === 'userType') {
      const userType = this.selectedUserType ?? UserType.Regular;
      if (userType === UserType.Regular) {
        this.finish(false);
        return;
      }

      this.currentStep = 'publicPage';
    }
  }

  skipStep(): void {
    if (this.currentStep === 'name') {
      this.profileName = '';
      this.currentStep = 'instrument';
      return;
    }

    if (this.currentStep === 'instrument') {
      this.selectedInstrumentIds = [];
      this.selectedLevel = null;
      this.currentStep = 'userType';
      return;
    }

    if (this.currentStep === 'userType') {
      this.selectedUserType = UserType.Regular;
      this.selectedServiceProviderCategoryId = undefined;
      this.finish(false);
    }
  }

  toggleInstrument(id: number): void {
    this.selectedInstrumentIds = this.isInstrumentSelected(id)
      ? this.selectedInstrumentIds.filter(existingId => existingId !== id)
      : [...this.selectedInstrumentIds, id];
  }

  isInstrumentSelected(id: number): boolean {
    return this.selectedInstrumentIds.includes(id);
  }

  selectUserType(userType: UserType, categoryId?: number): void {
    this.selectedUserType = userType;
    this.selectedServiceProviderCategoryId = userType === UserType.ServiceProvider ? categoryId : undefined;
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
    this.loading = true;

    const payload = {
      username: this.profileName.trim() || null,
      instrumentIds: this.selectedInstrumentIds,
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
    if (this.selectedUserType === UserType.Artist) return 'רוצה לפתוח דף אמן ציבורי באתר?';
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
