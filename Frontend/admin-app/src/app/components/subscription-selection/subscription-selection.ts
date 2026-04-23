import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { SubscriptionService } from '../../services/subscription.service';
import { AuthService } from '../../services/auth.service';
import {
  SubscriptionPlan,
  SubscriptionPlanHelper,
  SubscriptionDto
} from '../../models/subscription.model';

type ProfileType = 'artist' | 'teacher' | 'service-provider' | null;

interface PlanFeatures {
  basic: string[];
  plus: string[];
  pro: string[];
}

const PROFILE_PLAN_FEATURES: Record<string, PlanFeatures> = {
  teacher: {
    basic: [
      'תמונת פרופיל',
      'שם',
      'תיאור',
      'מיקום',
      'טלפון',
      'מייל'
    ],
    plus: [
      'קידום בתוצאות החיפוש',
      'קידום חד פעמי בדף הבית',
      'לחצן ישיר לוואצפ',
      'סימון "מומלץ"',
      'תמונת באנר מותאמת',
      'לחצני רשתות חברתיות',
      'גלרית תמונות (3)',
      'המלצות תלמידים (2)'
    ],
    pro: [
      'קידום קבוע בדף הבית - רשימת מומלצים',
      'קידום קבוע בדף חיפוש - רשימת מומלצים',
      'וידאו מוטמע בגלריה',
      'גלרית תמונות / וידאו (7)',
      'המלצות תלמידים (4)'
    ]
  },
  'service-provider': {
    basic: [
      'תמונת פרופיל',
      'שם',
      'תיאור',
      'מיקום',
      'טלפון',
      'מייל',
      'קישור לאתר',
      'שעות פעילות'
    ],
    plus: [
      'קידום בתוצאות החיפוש',
      'קידום חד פעמי בדף הבית',
      'לחצן ישיר לוואצפ',
      'לחצן ניווט מהיר',
      'סימון "מומלץ"',
      'תמונת באנר מותאמת',
      'לחצני רשתות חברתיות',
      'גלריה תמונות (3)',
      'המלצות (2)'
    ],
    pro: [
      'קידום קבוע בדף הבית - רשימת מומלצים',
      'קידום קבוע בדף חיפוש - רשימת מומלצים',
      'וידאו מוטמע בגלריה',
      'גלרית תמונות / וידאו (7)',
      'המלצות (4)'
    ]
  },
  artist: {
    basic: [
      'תמונת פרופיל',
      'שם',
      'ביוגרפיה ארוכה',
      'באנר תמונה רגיל',
      'כתבות / תוכן / הופעות שתויגו'
    ],
    plus: [
      'קידום חד פעמי בדף הבית',
      'GIF / וידאו בבאנר',
      'גלרית תמונות (12)',
      'לחצני רשתות חברתיות',
      'הפניה לאפליקציות מוזיקה',
      'קישור לאתר'
    ],
    pro: [
      'קידום קבוע בדף הבית - רשימת מומלצים',
      'גלרית תמונות (12)',
      'סימון אמן "מוביל"',
      'וידאו מוטמע בגלריה',
      'קידום הופעות בדף הבית',
      'קידום הופעה קרובה + הזמנת כרטיסים'
    ]
  }
};

const DEFAULT_FEATURES: PlanFeatures = {
  basic: ['תמונת פרופיל', 'שם', 'תיאור', 'מיקום', 'טלפון', 'מייל'],
  plus: ['קידום בחיפוש', 'קידום בדף הבית', 'לחצן לוואצפ', 'סימון "מומלץ"', 'תמונת באנר', 'גלריה'],
  pro: ['קידום קבוע בדף הבית', 'קידום קבוע בחיפוש', 'וידאו בגלריה', 'גלריה מורחבת', 'המלצות']
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

  // תמיכה בסוגי פרופיל מרובים
  profileTypes: ProfileType[] = [];
  primaryProfileType: ProfileType = null;
  activeTab: ProfileType = null;

  planOptions: PlanOption[] = [];
  SubscriptionPlan = SubscriptionPlan;

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
        // פורמט חדש: ?types=teacher,artist&primary=teacher
        this.profileTypes = (params['types'] as string)
          .split(',')
          .filter(Boolean) as ProfileType[];
        this.primaryProfileType = (params['primary'] as ProfileType) || this.profileTypes[0] || null;
      } else if (params['type']) {
        // פורמט ישן (תאימות לאחור)
        this.profileTypes = [params['type'] as ProfileType];
        this.primaryProfileType = params['type'] as ProfileType;
      } else {
        // fallback מ-localStorage (flow של הרשמה)
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
        features: features.basic
      },
      {
        plan: SubscriptionPlan.Regular,
        name: 'PLUS+',
        monthlyPrice: 49,
        yearlyPrice: 490,
        recommended: true,
        features: features.plus
      },
      {
        plan: SubscriptionPlan.Premium,
        name: 'PRO',
        monthlyPrice: 99,
        yearlyPrice: 990,
        features: features.pro
      }
    ];
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
        this.error = err.error?.message || 'שגיאה ביצירת תהליך התשלום. אנא נסה שנית.';
      }
    });
  }

  getPlanPrice(plan: SubscriptionPlan): number {
    return SubscriptionPlanHelper.getPrice(plan, this.billingCycle);
  }

  // ── מספר פרופילים ──

  getAdditionalProfilesCount(): number {
    return Math.max(0, this.profileTypes.length - 1);
  }

  getAdditionalProfilesCost(): number {
    const extra = this.getAdditionalProfilesCount();
    if (extra === 0) return 0;
    return this.billingCycle === 'Monthly' ? extra * 30 : extra * 300;
  }

  // ── תוויות ──

  getTabLabel(type: ProfileType): string {
    switch (type) {
      case 'teacher': return 'מורה';
      case 'artist': return 'אמן';
      case 'service-provider': return 'בעל מקצוע';
      default: return '';
    }
  }

  getProfileTypeLabel(): string {
    if (this.profileTypes.length === 0) return '';
    if (this.profileTypes.length === 1) return this.getTabLabel(this.profileTypes[0]);
    return this.profileTypes.map(t => this.getTabLabel(t)).join(' + ');
  }

  getSavingsText(): string {
    return 'חסוך 2 חודשים!';
  }
}
