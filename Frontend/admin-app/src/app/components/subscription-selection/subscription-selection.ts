import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SubscriptionService } from '../../services/subscription.service';
import { AuthService } from '../../services/auth.service';
import {
  SubscriptionPlan,
  SubscriptionPlanHelper,
  SubscriptionDto
} from '../../models/subscription.model';

interface PlanOption {
  plan: SubscriptionPlan;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  recommended?: boolean;
  includedProfiles: number;
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

  planOptions: PlanOption[] = [
    {
      plan: SubscriptionPlan.Free,
      name: 'חינמי',
      monthlyPrice: 0,
      yearlyPrice: 0,
      includedProfiles: 0,
      features: [
        'שם, תמונה, תיאור קצר',
        'מיקום וטלפון',
        'הופעה בחיפוש בסיסי',
        'ללא קדימות'
      ]
    },
    {
      plan: SubscriptionPlan.Regular,
      name: 'רגיל',
      monthlyPrice: 49,
      yearlyPrice: 490,
      includedProfiles: 1,
      recommended: true,
      features: [
        '1 פרופיל מקצועי מלא',
        'תג "מומלץ"',
        'קדימות בחיפוש',
        'הצגה בדף הבית',
        'גלריית תמונות',
        'וידאו מוטמע',
        'כפתור WhatsApp',
        'שעות פעילות'
      ]
    },
    {
      plan: SubscriptionPlan.Premium,
      name: 'פרימיום',
      monthlyPrice: 99,
      yearlyPrice: 990,
      includedProfiles: 1,
      features: [
        '1 פרופיל מקצועי מלא',
        'כל התכונות של "רגיל"',
        'יותר שטח נראות',
        'יותר הדגשה עיצובית',
        'תמיכה מועדפת'
      ]
    }
  ];

  constructor(
    private subscriptionService: SubscriptionService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadCurrentSubscription();
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

          // אם יש מנוי פעיל - נקה את ה-localStorage מבחירה קודמת
          localStorage.removeItem('selectedSubscriptionPlan');
          localStorage.removeItem('selectedBillingCycle');
          localStorage.removeItem('pendingProfessionalType');

          console.log('User already has active subscription:', subscription.plan);
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Error loading subscription:', err);
      }
    });
  }

  selectPlan(plan: SubscriptionPlan) {
    this.selectedPlan = plan;
  }

  toggleBillingCycle() {
    this.billingCycle = this.billingCycle === 'Monthly' ? 'Yearly' : 'Monthly';
  }

  getPlanPrice(plan: SubscriptionPlan): number {
    return SubscriptionPlanHelper.getPrice(plan, this.billingCycle);
  }

  purchaseSubscription() {
    if (this.selectedPlan === SubscriptionPlan.Free) {
      return; // לא צריך לרכוש מנוי חינמי
    }

    const user = this.authService.currentUserValue;
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    // אם כבר יש מנוי פעיל - הצג הודעה למשתמש
    if (this.currentSubscription) {
      const confirmChange = confirm(
        `יש לך כבר מנוי ${SubscriptionPlanHelper.getName(this.currentSubscription.plan)}.\n` +
        'האם אתה בטוח שברצונך לשנות את המנוי?'
      );

      if (!confirmChange) {
        return;
      }
    }

    // כרגע לא מבצעים תשלום בפועל - רק שומרים את הבחירה
    // בעתיד כאן יתווסף תהליך התשלום המלא

    // שמירת הבחירה ב-localStorage
    localStorage.setItem('selectedSubscriptionPlan', this.selectedPlan.toString());
    localStorage.setItem('selectedBillingCycle', this.billingCycle);

    // בדיקה אם זה משתמש מקצועי חדש שהגיע מהרשמה
    const pendingType = localStorage.getItem('pendingProfessionalType');

    if (pendingType) {
      // לא מנקים את pendingProfessionalType - נצטרך אותו בעמוד יצירת הפרופיל

      // ניווט לפי סוג המשתמש
      switch (pendingType) {
        case 'artist':
          this.router.navigate(['/artist/create']);
          break;
        case 'teacher':
          this.router.navigate(['/teacher/create']);
          break;
        case 'service-provider':
          this.router.navigate(['/service-provider/create']);
          break;
        default:
          this.router.navigate(['/subscription/status']);
      }
    } else {
      // משתמש קיים ששידרג מנוי - שאל אותו מה הוא רוצה לעשות
      const choice = prompt(
        'מה ברצונך לעשות?\n\n' +
        '1 - יצירת פרופיל מורה חדש\n' +
        '2 - יצירת פרופיל אומן חדש\n' +
        '3 - יצירת פרופיל בעל מקצוע חדש\n' +
        '4 - רק שדרוג מנוי קיים\n\n' +
        'הקלד מספר (1-4):'
      );

      switch (choice?.trim()) {
        case '1':
          localStorage.setItem('pendingProfessionalType', 'teacher');
          this.router.navigate(['/teacher/create']);
          break;
        case '2':
          localStorage.setItem('pendingProfessionalType', 'artist');
          this.router.navigate(['/artist/create']);
          break;
        case '3':
          localStorage.setItem('pendingProfessionalType', 'service-provider');
          this.router.navigate(['/service-provider/create']);
          break;
        case '4':
        default:
          alert('בחירת המנוי נשמרה. תשלום יתווסף בהמשך.');
          this.router.navigate(['/subscription/status']);
          break;
      }
    }
  }

  getSavingsText(): string {
    if (this.billingCycle === 'Yearly') {
      return 'חסוך 2 חודשים!';
    }
    return '';
  }

  getSelectedPlanIncludedProfiles(): number {
    const plan = this.planOptions.find(p => p.plan === this.selectedPlan);
    return plan?.includedProfiles || 0;
  }
}
