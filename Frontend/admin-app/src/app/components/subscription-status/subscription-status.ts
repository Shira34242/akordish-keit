import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
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
  imports: [CommonModule, RouterModule],
  templateUrl: './subscription-status.html',
  styleUrls: ['./subscription-status.css']
})
export class SubscriptionStatusComponent implements OnInit {
  currentSubscription?: SubscriptionDto;
  loading = false;
  error = '';
  successMessage = '';
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
      this.authService.requestLogin('/subscription/status');
      return;
    }

    this.loading = true;
    this.error = '';

    this.subscriptionService.getUserActiveSubscription(user.id).subscribe({
      next: (subscription) => {
        this.currentSubscription = subscription || undefined;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'שגיאה בטעינת פרטי המנוי';
      }
    });
  }

  getPlanDisplayName(): string {
    if (!this.currentSubscription) return 'BASIC';
    switch (this.currentSubscription.plan) {
      case SubscriptionPlan.Free: return 'BASIC';
      case SubscriptionPlan.Regular: return 'PLUS+';
      case SubscriptionPlan.Premium: return 'PRO';
      default: return 'BASIC';
    }
  }

  getPlanChipClass(): string {
    if (!this.currentSubscription || this.currentSubscription.plan === SubscriptionPlan.Free) return 'chip--free';
    return 'chip--pro';
  }

  getStatusChipClass(): string {
    if (!this.currentSubscription) return '';
    switch (this.currentSubscription.status) {
      case SubscriptionStatus.Active:
      case SubscriptionStatus.Trial:
        return 'chip--active';
      case SubscriptionStatus.Cancelled:
      case SubscriptionStatus.Expired:
        return 'chip--inactive';
      default:
        return 'chip--warn';
    }
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
    return this.currentSubscription.billingCycle === 'Monthly' ? 'חודש' : 'שנה';
  }

  getStatusText(): string {
    if (!this.currentSubscription) return '';
    switch (this.currentSubscription.status) {
      case SubscriptionStatus.Trial: return 'ניסיון חינם';
      case SubscriptionStatus.Active: return 'פעיל';
      case SubscriptionStatus.Cancelled: return 'בוטל';
      case SubscriptionStatus.Expired: return 'פג תוקף';
      case SubscriptionStatus.Suspended: return 'מושהה';
      case SubscriptionStatus.PendingPayment: return 'ממתין לתשלום';
      default: return '';
    }
  }

  getDaysRemaining(): number {
    if (!this.currentSubscription) return 0;
    const endDate = this.currentSubscription.isTrial
      ? new Date(this.currentSubscription.trialEndDate!)
      : new Date(this.currentSubscription.nextBillingDate || this.currentSubscription.renewalDate!);
    const diff = endDate.getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  getNextBillingDate(): string {
    if (!this.currentSubscription) return '';
    if (this.currentSubscription.isTrial && this.currentSubscription.trialEndDate) {
      return new Date(this.currentSubscription.trialEndDate).toLocaleDateString('he-IL');
    }
    const date = this.currentSubscription.nextBillingDate || this.currentSubscription.renewalDate;
    if (date) return new Date(date).toLocaleDateString('he-IL');
    return '';
  }

  getTotalProfilesUsed(): number {
    return this.currentSubscription?.totalProfilesUsed ?? 0;
  }

  getIncludedProfiles(): number {
    if (!this.currentSubscription) return 0;
    return this.currentSubscription.plan === SubscriptionPlan.Regular ? 1
         : this.currentSubscription.plan === SubscriptionPlan.Premium ? 2
         : 0;
  }

  getAdditionalProfilesCost(): number {
    const extra = Math.max(0, this.getTotalProfilesUsed() - this.getIncludedProfiles());
    return extra * 30;
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
        this.successMessage = 'המנוי בוטל. תוכל להשתמש בתכונות עד תום תקופת החיוב.';
        this.loadSubscription();
        setTimeout(() => { this.successMessage = ''; }, 5000);
      },
      error: (err: any) => {
        this.cancelLoading = false;
        this.error = err.error?.message || 'שגיאה בביטול המנוי';
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
        this.successMessage = 'המנוי חודש בהצלחה!';
        this.loadSubscription();
        setTimeout(() => { this.successMessage = ''; }, 5000);
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err.error?.message || 'שגיאה בחידוש המנוי';
      }
    });
  }
}
