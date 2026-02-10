import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SubscriptionService } from '../../services/subscription.service';
import { AuthService } from '../../services/auth.service';
import {
  SubscriptionDto,
  SubscriptionPlan,
  SubscriptionPlanHelper,
  SubscriptionStatus
} from '../../models/subscription.model';

@Component({
  selector: 'app-subscription-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './subscription-status.html',
  styleUrls: ['./subscription-status.css']
})
export class SubscriptionStatusComponent implements OnInit {
  currentSubscription?: SubscriptionDto;
  loading = false;
  error = '';
  showCancelConfirmation = false;
  cancelLoading = false;

  SubscriptionPlan = SubscriptionPlan;
  SubscriptionStatus = SubscriptionStatus;

  constructor(
    private subscriptionService: SubscriptionService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadSubscription();
  }

  loadSubscription() {
    const user = this.authService.currentUserValue;
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.loading = true;
    this.error = '';

    this.subscriptionService.getUserActiveSubscription(user.id).subscribe({
      next: (subscription) => {
        this.currentSubscription = subscription || undefined;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = 'שגיאה בטעינת פרטי המנוי';
        console.error('Error loading subscription:', err);
      }
    });
  }

  getPlanName(): string {
    if (!this.currentSubscription) return '';
    return SubscriptionPlanHelper.getName(this.currentSubscription.plan);
  }

  getPlanPrice(): number {
    if (!this.currentSubscription) return 0;
    return SubscriptionPlanHelper.getPrice(
      this.currentSubscription.plan,
      this.currentSubscription.billingCycle as 'Monthly' | 'Yearly'
    );
  }

  getBillingCycleText(): string {
    if (!this.currentSubscription) return '';
    return this.currentSubscription.billingCycle === 'Monthly' ? 'חודשי' : 'שנתי';
  }

  getStatusText(): string {
    if (!this.currentSubscription) return '';

    switch (this.currentSubscription.status) {
      case SubscriptionStatus.Trial:
        return 'תקופת ניסיון';
      case SubscriptionStatus.Active:
        return 'פעיל';
      case SubscriptionStatus.Cancelled:
        return 'מבוטל';
      case SubscriptionStatus.Expired:
        return 'פג תוקף';
      case SubscriptionStatus.Suspended:
        return 'מושעה';
      case SubscriptionStatus.PendingPayment:
        return 'ממתין לתשלום';
      default:
        return '';
    }
  }

  getStatusClass(): string {
    if (!this.currentSubscription) return '';

    switch (this.currentSubscription.status) {
      case SubscriptionStatus.Trial:
      case SubscriptionStatus.Active:
        return 'status-active';
      case SubscriptionStatus.Cancelled:
      case SubscriptionStatus.Expired:
        return 'status-inactive';
      case SubscriptionStatus.Suspended:
      case SubscriptionStatus.PendingPayment:
        return 'status-warning';
      default:
        return '';
    }
  }

  getDaysRemaining(): number {
    if (!this.currentSubscription) return 0;

    const endDate = this.currentSubscription.isTrial
      ? new Date(this.currentSubscription.trialEndDate!)
      : new Date(this.currentSubscription.nextBillingDate || this.currentSubscription.renewalDate!);

    const today = new Date();
    const diff = endDate.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    return Math.max(0, days);
  }

  getNextBillingDate(): string {
    if (!this.currentSubscription) return '';

    if (this.currentSubscription.isTrial && this.currentSubscription.trialEndDate) {
      return new Date(this.currentSubscription.trialEndDate).toLocaleDateString('he-IL');
    }

    const billingDate = this.currentSubscription.nextBillingDate || this.currentSubscription.renewalDate;
    if (billingDate) {
      return new Date(billingDate).toLocaleDateString('he-IL');
    }

    return '';
  }

  getTotalProfilesUsed(): number {
    if (!this.currentSubscription) return 0;
    return this.currentSubscription.totalProfilesUsed;
  }

  getIncludedProfiles(): number {
    if (!this.currentSubscription) return 0;

    switch (this.currentSubscription.plan) {
      case SubscriptionPlan.Regular:
        return 1;
      case SubscriptionPlan.Premium:
        return 1;
      default:
        return 0;
    }
  }

  getAdditionalProfilesCost(): number {
    if (!this.currentSubscription) return 0;

    const included = this.getIncludedProfiles();
    const used = this.getTotalProfilesUsed();
    const additional = Math.max(0, used - included);

    return additional * 30; // 30₪ per additional profile
  }

  canUpgrade(): boolean {
    if (!this.currentSubscription) return true;
    return this.currentSubscription.plan !== SubscriptionPlan.Premium;
  }

  canCancel(): boolean {
    if (!this.currentSubscription) return false;
    return this.currentSubscription.status === SubscriptionStatus.Active ||
           this.currentSubscription.status === SubscriptionStatus.Trial;
  }

  upgradeSubscription() {
    // נקה localStorage מבחירה קודמת לפני שמנתב לבחירת מנוי
    localStorage.removeItem('selectedSubscriptionPlan');
    localStorage.removeItem('selectedBillingCycle');
    localStorage.removeItem('pendingProfessionalType');

    this.router.navigate(['/subscription/select']);
  }

  showCancelDialog() {
    this.showCancelConfirmation = true;
  }

  hideCancelDialog() {
    this.showCancelConfirmation = false;
  }

  confirmCancel() {
    if (!this.currentSubscription) return;

    this.cancelLoading = true;
    this.error = '';

    this.subscriptionService.cancelSubscription(this.currentSubscription.id, {
      cancelImmediately: false
    }).subscribe({
      next: () => {
        this.cancelLoading = false;
        this.showCancelConfirmation = false;
        alert('המנוי בוטל בהצלחה. תוכל להמשיך להשתמש בתכונות עד תום תקופת החיוב.');
        this.loadSubscription(); // Reload to show updated status
      },
      error: (err: any) => {
        this.cancelLoading = false;
        this.error = err.error?.message || 'שגיאה בביטול המנוי';
        console.error('Error cancelling subscription:', err);
      }
    });
  }

  renewSubscription() {
    if (!this.currentSubscription) return;

    this.loading = true;
    this.error = '';

    this.subscriptionService.renewSubscription(this.currentSubscription.id).subscribe({
      next: () => {
        this.loading = false;
        alert('המנוי חודש בהצלחה!');
        this.loadSubscription();
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err.error?.message || 'שגיאה בחידוש המנוי';
        console.error('Error renewing subscription:', err);
      }
    });
  }
}
