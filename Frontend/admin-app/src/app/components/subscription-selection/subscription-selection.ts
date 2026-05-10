import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { SubscriptionService } from '../../services/subscription.service';
import { AuthService } from '../../services/auth.service';
import {
  SubscriptionPlan,
  SubscriptionPlanHelper,
  SubscriptionDto
} from '../../models/subscription.model';
import { LanguageService } from '../../services/language.service';

type ProfileType = 'artist' | 'teacher' | 'service-provider' | null;

interface PlanFeatures {
  basic: string[];
  plus: string[];
  pro: string[];
}

const PROFILE_PLAN_FEATURES: Record<string, PlanFeatures> = {
  teacher: {
    basic: [
      'sub_select.feat_photo',
      'sub_select.feat_name',
      'sub_select.feat_desc',
      'sub_select.feat_location',
      'sub_select.feat_phone',
      'sub_select.feat_email'
    ],
    plus: [
      'sub_select.feat_search_boost',
      'sub_select.feat_homepage_once',
      'sub_select.feat_whatsapp',
      'sub_select.feat_recommended',
      'sub_select.feat_banner',
      'sub_select.feat_social',
      'sub_select.feat_teacher_gallery_3',
      'sub_select.feat_teacher_reviews_2'
    ],
    pro: [
      'sub_select.feat_homepage_perm',
      'sub_select.feat_search_perm',
      'sub_select.feat_video_gallery',
      'sub_select.feat_gallery_7',
      'sub_select.feat_teacher_reviews_4'
    ]
  },
  'service-provider': {
    basic: [
      'sub_select.feat_photo',
      'sub_select.feat_name',
      'sub_select.feat_desc',
      'sub_select.feat_location',
      'sub_select.feat_phone',
      'sub_select.feat_email',
      'sub_select.feat_website',
      'sub_select.feat_hours'
    ],
    plus: [
      'sub_select.feat_search_boost',
      'sub_select.feat_homepage_once',
      'sub_select.feat_whatsapp',
      'sub_select.feat_nav_btn',
      'sub_select.feat_recommended',
      'sub_select.feat_banner',
      'sub_select.feat_social',
      'sub_select.feat_sp_gallery_3',
      'sub_select.feat_sp_reviews_2'
    ],
    pro: [
      'sub_select.feat_homepage_perm',
      'sub_select.feat_search_perm',
      'sub_select.feat_video_gallery',
      'sub_select.feat_gallery_7',
      'sub_select.feat_sp_reviews_4'
    ]
  },
  artist: {
    basic: [
      'sub_select.feat_photo',
      'sub_select.feat_name',
      'sub_select.feat_biography',
      'sub_select.feat_basic_banner',
      'sub_select.feat_tagged_content'
    ],
    plus: [
      'sub_select.feat_homepage_once',
      'sub_select.feat_gif_banner',
      'sub_select.feat_gallery_12',
      'sub_select.feat_social',
      'sub_select.feat_music_apps',
      'sub_select.feat_website'
    ],
    pro: [
      'sub_select.feat_homepage_perm',
      'sub_select.feat_gallery_12',
      'sub_select.feat_top_artist',
      'sub_select.feat_video_gallery',
      'sub_select.feat_event_boost',
      'sub_select.feat_upcoming_event'
    ]
  }
};

const DEFAULT_FEATURES: PlanFeatures = {
  basic: [
    'sub_select.feat_photo',
    'sub_select.feat_name',
    'sub_select.feat_desc',
    'sub_select.feat_location',
    'sub_select.feat_phone',
    'sub_select.feat_email'
  ],
  plus: [
    'sub_select.feat_def_search',
    'sub_select.feat_def_homepage',
    'sub_select.feat_def_whatsapp',
    'sub_select.feat_recommended',
    'sub_select.feat_def_banner',
    'sub_select.feat_def_gallery'
  ],
  pro: [
    'sub_select.feat_def_homepage_perm',
    'sub_select.feat_def_search_perm',
    'sub_select.feat_def_video',
    'sub_select.feat_def_gallery_ext',
    'sub_select.feat_def_reviews'
  ]
};

interface PlanOption {
  plan: SubscriptionPlan;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  recommended?: boolean;
}

@Component({
  selector: 'app-subscription-selection',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscription-selection.html',
  styleUrls: ['./subscription-selection.css']
})
export class SubscriptionSelectionComponent implements OnInit {
  currentSubscription?: SubscriptionDto;
  selectedPlan: SubscriptionPlan = SubscriptionPlan.Regular;
  billingCycle: 'Monthly' | 'Yearly' = 'Monthly';
  loading = false;
  error = '';
  fromProfileComplete = false;

  profileTypes: ProfileType[] = [];
  primaryProfileType: ProfileType = null;
  activeTab: ProfileType = null;

  planOptions: PlanOption[] = [];
  SubscriptionPlan = SubscriptionPlan;

  private readonly langService = inject(LanguageService);

  constructor(
    private subscriptionService: SubscriptionService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.fromProfileComplete = params['from'] === 'profile-complete';

      if (params['types']) {
        this.profileTypes = (params['types'] as string)
          .split(',')
          .filter(Boolean) as ProfileType[];
        this.primaryProfileType = (params['primary'] as ProfileType) || this.profileTypes[0] || null;
      } else if (params['type']) {
        this.profileTypes = [params['type'] as ProfileType];
        this.primaryProfileType = params['type'] as ProfileType;
      } else {
        const stored = localStorage.getItem('pendingProfessionalType') as ProfileType;
        if (stored) {
          this.profileTypes = [stored];
          this.primaryProfileType = stored;
        }
      }

      this.activeTab = this.primaryProfileType;
      this.buildPlanOptions();
    });

    this.loadCurrentSubscription();
  }

  setActiveTab(type: ProfileType) {
    this.activeTab = type;
    this.buildPlanOptions();
  }

  buildPlanOptions() {
    const displayType = this.activeTab || this.primaryProfileType;
    const features = displayType && PROFILE_PLAN_FEATURES[displayType]
      ? PROFILE_PLAN_FEATURES[displayType]
      : DEFAULT_FEATURES;

    this.planOptions = [
      {
        plan: SubscriptionPlan.Free,
        name: 'BASIC',
        monthlyPrice: 0,
        yearlyPrice: 0,
        features: this.resolveFeatures(features.basic)
      },
      {
        plan: SubscriptionPlan.Regular,
        name: 'PLUS+',
        monthlyPrice: 49,
        yearlyPrice: 490,
        recommended: true,
        features: this.resolveFeatures(features.plus)
      },
      {
        plan: SubscriptionPlan.Premium,
        name: 'PRO',
        monthlyPrice: 99,
        yearlyPrice: 990,
        features: this.resolveFeatures(features.pro)
      }
    ];
  }

  private resolveFeatures(keys: string[]): string[] {
    return keys.map(k => this.langService.translate(k));
  }

  loadCurrentSubscription() {
    const user = this.authService.currentUserValue;
    if (!user) return;

    this.loading = true;
    this.subscriptionService.getUserActiveSubscription(user.id).subscribe({
      next: (subscription) => {
        this.loading = false;
        if (subscription) {
          this.currentSubscription = subscription;
          this.selectedPlan = subscription.plan;
          localStorage.removeItem('selectedSubscriptionPlan');
          localStorage.removeItem('selectedBillingCycle');
          localStorage.removeItem('pendingProfessionalType');
        }
      },
      error: () => { this.loading = false; }
    });
  }

  selectPlan(plan: SubscriptionPlan) {
    this.selectedPlan = plan;
  }

  continueWithFree() {
    localStorage.removeItem('selectedSubscriptionPlan');
    localStorage.removeItem('selectedBillingCycle');
    localStorage.removeItem('pendingProfessionalType');
    this.router.navigate(['/']);
  }

  purchaseSubscription() {
    if (this.selectedPlan === SubscriptionPlan.Free) {
      this.continueWithFree();
      return;
    }

    const user = this.authService.currentUserValue;
    if (!user) {
      this.router.navigate(['/']);
      return;
    }

    if (this.currentSubscription && this.currentSubscription.plan === this.selectedPlan) {
      return;
    }

    this.loading = true;
    this.error = '';

    this.subscriptionService.createCheckoutSession(this.selectedPlan, this.billingCycle).subscribe({
      next: (response) => {
        localStorage.removeItem('selectedSubscriptionPlan');
        localStorage.removeItem('selectedBillingCycle');
        localStorage.removeItem('pendingProfessionalType');
        window.location.href = response.checkoutUrl;
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || this.langService.translate('sub_select.error_checkout');
      }
    });
  }

  getPlanPrice(plan: SubscriptionPlan): number {
    return SubscriptionPlanHelper.getPrice(plan, this.billingCycle);
  }

  getAdditionalProfilesCount(): number {
    return Math.max(0, this.profileTypes.length - 1);
  }

  getAdditionalProfilesCost(): number {
    const extra = this.getAdditionalProfilesCount();
    if (extra === 0) return 0;
    return this.billingCycle === 'Monthly' ? extra * 30 : extra * 300;
  }

  getTabLabel(type: ProfileType): string {
    switch (type) {
      case 'teacher': return this.langService.translate('sub_select.tab_teacher');
      case 'artist': return this.langService.translate('sub_select.tab_artist');
      case 'service-provider': return this.langService.translate('sub_select.tab_service_provider');
      default: return '';
    }
  }

  getProfileTypeLabel(): string {
    if (this.profileTypes.length === 0) return '';
    if (this.profileTypes.length === 1) return this.getTabLabel(this.profileTypes[0]);
    return this.profileTypes.map(t => this.getTabLabel(t)).join(' + ');
  }

  getSavingsText(): string {
    return this.langService.translate('sub_select.savings_text');
  }
}
