// Enums
export enum SubscriptionPlan {
  Free = 0,
  Regular = 1,
  Premium = 2
}

export enum SubscriptionStatus {
  PendingPayment = 0,
  Trial = 1,
  Active = 2,
  Cancelled = 3,
  Expired = 4,
  Suspended = 5
}

export enum ProfileTier {
  Free = 0,
  Subscribed = 1
}

export enum BoostType {
  TopOfRecommended = 0,
  HomepageBanner = 1
}

// DTOs
export interface SubscriptionDto {
  id: number;
  userId: number;
  plan: SubscriptionPlan;
  planName: string;
  status: SubscriptionStatus;
  statusName: string;
  isTrial: boolean;
  startDate: Date;
  endDate?: Date;
  renewalDate?: Date;
  nextBillingDate?: Date;  // alias for renewalDate
  trialEndDate?: Date;
  isAutoRenew: boolean;
  cancelledAt?: Date;
  cancellationReason?: string;
  price?: number;
  currency: string;
  billingCycle: 'Monthly' | 'Yearly';
  createdAt: Date;
  isActive: boolean;
  isPremiumActive: boolean;
  daysRemaining?: number;
  totalProfilesUsed: number;  // total profiles linked to subscription
}

export interface CreateSubscriptionDto {
  userId: number;
  plan: SubscriptionPlan;
  isTrial?: boolean;
  isAutoRenew?: boolean;
  billingCycle?: string;
}

export interface UpdateSubscriptionStatusDto {
  status: SubscriptionStatus;
  reason?: string;
}

export interface UpgradeSubscriptionDto {
  newPlan: SubscriptionPlan;
  billingCycle?: string;
}

export interface CancelSubscriptionDto {
  reason?: string;
  cancelImmediately?: boolean;
}

export interface FeatureAccessDto {
  hasAccess: boolean;
  reason?: string;
  requiredPlan?: SubscriptionPlan;
}

export interface BoostDto {
  id: number;
  serviceProviderId: number;
  price: number;
  externalPaymentId?: string;
  type: BoostType;
  typeName: string;
  purchaseDate: Date;
  startDate?: Date;
  expiryDate?: Date;
  isActive: boolean;
}

// Helper classes
export class SubscriptionPlanHelper {
  static getName(plan: SubscriptionPlan): string {
    switch (plan) {
      case SubscriptionPlan.Free:
        return 'חינמי';
      case SubscriptionPlan.Regular:
        return 'רגיל';
      case SubscriptionPlan.Premium:
        return 'פרימיום';
      default:
        return 'לא ידוע';
    }
  }

  static getPrice(plan: SubscriptionPlan, billingCycle: 'Monthly' | 'Yearly' = 'Monthly'): number {
    if (plan === SubscriptionPlan.Free) return 0;

    const monthlyPrice = plan === SubscriptionPlan.Regular ? 49 : 99;

    if (billingCycle === 'Yearly') {
      return monthlyPrice * 10; // הנחה של חודשיים
    }

    return monthlyPrice;
  }

  static getIncludedProfiles(plan: SubscriptionPlan): number {
    switch (plan) {
      case SubscriptionPlan.Regular:
        return 1;
      case SubscriptionPlan.Premium:
        return 2;
      default:
        return 0;
    }
  }

  static calculateTotalPrice(
    plan: SubscriptionPlan,
    totalProfiles: number,
    billingCycle: 'Monthly' | 'Yearly' = 'Monthly'
  ): number {
    if (plan === SubscriptionPlan.Free || totalProfiles === 0) return 0;

    const includedProfiles = this.getIncludedProfiles(plan);
    const additionalProfiles = Math.max(0, totalProfiles - includedProfiles);

    const basePrice = this.getPrice(plan, billingCycle);

    let addonPricePerProfile = 25;
    if (billingCycle === 'Yearly') {
      addonPricePerProfile *= 10;
    }

    return basePrice + additionalProfiles * addonPricePerProfile;
  }
}

export class BoostTypeHelper {
  static getName(type: BoostType): string {
    switch (type) {
      case BoostType.TopOfRecommended:
        return 'ראש רשימת המומלצים';
      case BoostType.HomepageBanner:
        return 'באנר בדף הבית';
      default:
        return 'לא ידוע';
    }
  }

  static getPrice(type: BoostType): number {
    return 10; // כרגע כל הבוסטים 10₪
  }
}
