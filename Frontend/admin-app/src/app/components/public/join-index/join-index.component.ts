import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { GoogleSigninButtonModule, SocialAuthService } from '@abacritt/angularx-social-login';
import { Subscription } from 'rxjs';
import { AgencyPublicDto } from '../../../models/agency.model';
import { AgencyService } from '../../../services/agency.service';
import { AuthService, User } from '../../../services/auth.service';
import { GoogleOneTapService } from '../../../services/google-one-tap.service';
import { SystemItem, SystemTablesService } from '../../../services/system-tables.service';
import { TeacherCreateComponent } from '../../teacher-create/teacher-create.component';
import { ServiceProviderCreateComponent } from '../../service-provider-create/service-provider-create.component';
import { LegalPageContent, PAGES } from '../legal-page/legal-page.component';

type JoinIndexType = 'teacher' | 'service-provider';
type JoinIndexLegalKey = 'terms' | 'privacy';

@Component({
  selector: 'app-join-index',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GoogleSigninButtonModule,
    TeacherCreateComponent,
    ServiceProviderCreateComponent
  ],
  templateUrl: './join-index.component.html',
  styleUrls: ['./join-index.component.css']
})
export class JoinIndexComponent implements OnInit, OnDestroy {
  user: User | null = null;
  selectedType: JoinIndexType | null = null;
  loadingGoogle = false;
  googleError = '';
  termsApproved = false;
  marketingConsent = false;
  activeLegalKey: JoinIndexLegalKey | null = null;
  linkCopied = false;
  serviceProviderCategories: SystemItem[] = [];
  selectedServiceProviderCategoryId?: number;
  categoriesLoading = false;
  categoriesError = '';
  agency: AgencyPublicDto | null = null;
  agencyLoading = false;
  agencyError = '';
  agencySlug: string | null = null;
  private userSub?: Subscription;
  private googleAuthSub?: Subscription;

  constructor(
    private authService: AuthService,
    private socialAuthService: SocialAuthService,
    private systemTablesService: SystemTablesService,
    private route: ActivatedRoute,
    private agencyService: AgencyService
  ) {}

  ngOnInit(): void {
    GoogleOneTapService.setModalActive(true);
    this.loadServiceProviderCategories();
    this.loadAgencyContext();

    this.userSub = this.authService.currentUser$.subscribe(user => {
      this.user = user;
    });

    this.googleAuthSub = this.socialAuthService.authState.subscribe(user => {
      if (user?.idToken && !this.user && !GoogleOneTapService.isProcessing()) {
        this.handleGoogleLogin(user.idToken);
      }
    });
  }

  ngOnDestroy(): void {
    this.userSub?.unsubscribe();
    this.googleAuthSub?.unsubscribe();
    GoogleOneTapService.setModalActive(false);
  }

  start(type: JoinIndexType, categoryId?: number): void {
    if (!this.user || !this.agencyReady) return;
    this.selectedType = type;
    this.selectedServiceProviderCategoryId = type === 'service-provider' ? categoryId : undefined;
  }

  selectServiceProviderCategory(categoryId: number): void {
    this.start('service-provider', categoryId);
  }

  isGeneralServiceSelected(): boolean {
    return this.selectedType === 'service-provider' && !this.selectedServiceProviderCategoryId;
  }

  trackByCategory(_index: number, category: SystemItem): number {
    return category.id;
  }

  get agencyId(): number | undefined {
    return this.agency?.id;
  }

  get agencyReady(): boolean {
    return !this.agencySlug || !!this.agency;
  }

  get activeLegalPage(): LegalPageContent | null {
    return this.activeLegalKey ? PAGES[this.activeLegalKey] : null;
  }

  openLegal(key: JoinIndexLegalKey): void {
    this.activeLegalKey = key;
  }

  closeLegal(): void {
    this.activeLegalKey = null;
  }

  async copyPageLink(): Promise<void> {
    const link = typeof window !== 'undefined' ? window.location.href : '/join-index';

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        this.copyWithTextarea(link);
      }

      this.showLinkCopied();
    } catch {
      this.copyWithTextarea(link);
      this.showLinkCopied();
    }
  }

  private handleGoogleLogin(idToken: string): void {
    if (!this.termsApproved || !this.marketingConsent) {
      this.googleError = 'כדי להתחבר עם Google יש לאשר את התקנון, מדיניות הפרטיות וקבלת הדיוור.';
      return;
    }

    this.loadingGoogle = true;
    this.googleError = '';
    GoogleOneTapService.setProcessing(true);

    this.authService.googleLogin(idToken, true, true).subscribe({
      next: () => {
        this.loadingGoogle = false;
        GoogleOneTapService.setProcessing(false);
      },
      error: (error) => {
        this.loadingGoogle = false;
        GoogleOneTapService.setProcessing(false);

        if (this.isGoogleTermsRequiredError(error)) {
          this.googleError = 'כדי להשלים הרשמה עם Google יש לאשר את התקנון, מדיניות הפרטיות וקבלת הדיוור.';
          return;
        }

        this.googleError = error?.error?.message || 'שגיאה בכניסה עם Google';
      }
    });
  }

  private isGoogleTermsRequiredError(error: any): boolean {
    const body = error?.error;
    const message = typeof body === 'string' ? body : body?.message;

    return body?.code === 'TERMS_REQUIRED'
      || (typeof message === 'string' && message.includes('תקנון'));
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

  private loadAgencyContext(): void {
    this.agencySlug = this.route.snapshot.paramMap.get('slug');
    if (!this.agencySlug) return;

    this.agencyLoading = true;
    this.agencyError = '';

    this.agencyService.getAgencyBySlug(this.agencySlug).subscribe({
      next: (agency) => {
        this.agency = agency;
        this.agencyLoading = false;
      },
      error: () => {
        this.agencyError = 'לא הצלחנו לטעון את פרטי הסוכנות';
        this.agencyLoading = false;
      }
    });
  }

  private showLinkCopied(): void {
    this.linkCopied = true;
    setTimeout(() => this.linkCopied = false, 1800);
  }

  private copyWithTextarea(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
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
