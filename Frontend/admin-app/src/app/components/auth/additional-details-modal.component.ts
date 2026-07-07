import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { SystemItem, SystemTablesService } from '../../services/system-tables.service';
export { UserType } from './user-type.enum';
import { UserType } from './user-type.enum';

export interface OnboardingProfileChoice {
  userType: UserType;
  addPublicPage: boolean;
  serviceProviderCategoryId?: number;
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
  @Output() complete = new EventEmitter<OnboardingProfileChoice>();

  loading = false;
  errorMessage = '';

  currentStep: 'instrument' | 'userType' | 'publicPage' = 'instrument';

  selectedInstrument: string = '';
  selectedLevel: string = '';
  selectedUserType: UserType | null = null;
  selectedServiceProviderCategoryId?: number;
  serviceProviderCategories: SystemItem[] = [];
  categoriesLoading = false;
  categoriesError = '';

  UserType = UserType;
  private readonly langService = inject(LanguageService);

  constructor(
    private authService: AuthService,
    private systemTablesService: SystemTablesService
  ) {
    this.loadServiceProviderCategories();
  }

  onContinue(): void {
    this.errorMessage = '';
    this.currentStep = 'userType';
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

  onUserTypeContinue(): void {
    const userType = this.selectedUserType ?? UserType.Regular;
    if (userType === UserType.Regular) {
      this.finish(false);
      return;
    }

    this.currentStep = 'publicPage';
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

    const levelMap: Record<string, 1 | 2 | 3> = { 'מתחיל/ה': 1, 'מתקדם/ת': 2, 'מקצועי/ת': 3 };
    const instrumentName = this.selectedInstrument !== 'none' ? this.selectedInstrument : null;
    const payload = {
      otherInstrumentName: instrumentName !== 'other' ? instrumentName : null,
      instrumentLevel: this.selectedInstrument !== 'none' ? (levelMap[this.selectedLevel] ?? null) : null,
      userType: this.selectedUserType ?? UserType.Regular
    };

    this.authService.completeProfile(payload).subscribe({
      next: () => {
        const userType = this.selectedUserType ?? UserType.Regular;
        if (!addPublicPage && userType !== UserType.Regular) {
          this.authService.deferPublicPageReminder({
            userType,
            categoryId: this.selectedServiceProviderCategoryId ?? null
          }).subscribe({
            next: () => {
              this.loading = false;
              this.complete.emit({ userType, addPublicPage, serviceProviderCategoryId: this.selectedServiceProviderCategoryId });
            },
            error: () => {
              this.loading = false;
              this.complete.emit({ userType, addPublicPage, serviceProviderCategoryId: this.selectedServiceProviderCategoryId });
            }
          });
          return;
        }

        this.loading = false;
        this.complete.emit({ userType, addPublicPage, serviceProviderCategoryId: this.selectedServiceProviderCategoryId });
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

  get publicPageTitle(): string {
    if (this.selectedUserType === UserType.Artist) return 'רוצה להוסיף דף אמן ציבורי?';
    if (this.selectedUserType === UserType.Teacher) return 'רוצה להוסיף דף מורה ציבורי?';
    return 'רוצה להוסיף דף ציבורי לשירות שלך?';
  }

  get publicPageText(): string {
    if (this.selectedUserType === UserType.Artist) {
      return 'דף אמן הוא כרטיס אישי שלך באתר. אנשים יוכלו להיכנס, להכיר אותך, לראות שירים, הופעות, תמונות וקישורים, ואתה תוכל לנהל ולעדכן אותו בעצמך.';
    }

    if (this.selectedUserType === UserType.Teacher) {
      return 'דף מורה עוזר לתלמידים למצוא אותך באתר, להבין מה אתה מלמד, באיזה אזור, ואיך אפשר ליצור איתך קשר. את הדף תוכל לנהל ולעדכן בעצמך.';
    }

    return 'זה יהיה כרטיס מקצועי שלך באתר, עם פרטים על השירות, אזור פעילות ודרכי יצירת קשר. הדף יכול להגדיל חשיפה ללקוחות רלוונטיים, ואתה תוכל לנהל אותו בעצמך.';
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
