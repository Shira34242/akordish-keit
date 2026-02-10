# Subscription & Payment System Implementation

## Overview

This document describes the complete subscription and payment system implemented for the AdminTest platform. The system supports multiple professional profiles per user, tiered access control, subscription plans, and one-time boost purchases.

## System Architecture

### Core Concepts

1. **Profile Tiers**
   - `Free (0)`: Basic profile features
   - `Subscribed (1)`: Premium features with active subscription

2. **Subscription Plans**
   - `Free`: No cost, basic features only
   - `Regular (49₪/month)`: 1 professional profile included
   - `Premium (99₪/month)`: 2 professional profiles included

3. **Billing Cycles**
   - `Monthly`: Billed every month
   - `Yearly`: Billed annually (saves 2 months)

4. **Add-on Pricing**
   - Additional profiles beyond plan limit: 25₪/month each

5. **Boost Types** (One-time purchases)
   - `TopOfRecommended (10₪)`: Jump to top of recommended list
   - `HomepageBanner (20₪)`: Featured banner on homepage

### Business Logic

- **One subscription per user**: A user has one subscription that covers multiple profiles
- **Primary vs Add-on profiles**: First profile(s) included in plan price, additional ones cost 25₪ each
- **Trial period**: New subscriptions get 3 months free trial
- **Auto-renewal**: Subscriptions renew automatically unless cancelled
- **Boost competition**: Only one active boost per type; purchasing a new one deactivates the previous
- **Tier downgrade**: When subscription expires, all linked profiles downgrade to Free tier

## Backend Implementation

### Database Schema Changes

#### Subscription Entity
```csharp
- Id (PK)
- UserId (FK to User)
- Plan (enum: Free, Regular, Premium)
- Status (enum: PendingPayment, Trial, Active, Cancelled, Expired, Suspended)
- BillingCycle (string: "Monthly" or "Yearly")
- Price (decimal)
- StartDate, NextBillingDate
- IsTrial, TrialEndDate
- IsAutoRenew
- CancelledAt
- TotalProfilesUsed
```

#### Updated Artist & ServiceProvider Entities
```csharp
- Tier (enum: Free, Subscribed)
- SubscriptionId (FK to Subscription, nullable)
- IsPrimaryProfile (bool)
```

#### Boost Entity
```csharp
- Id (PK)
- ServiceProviderId (FK)
- Type (enum: TopOfRecommended, HomepageBanner)
- Price, PurchaseDate
- StartDate, ExpiryDate
- IsActive
- ExternalPaymentId
```

### Services

#### SubscriptionService
**Location**: `Backend/AdminTest/Services/SubscriptionService.cs`

**Key Methods**:
- `CreateSubscriptionAsync()`: Create new subscription with trial
- `UpgradeSubscriptionAsync()`: Upgrade to higher tier plan
- `CancelSubscriptionAsync()`: Cancel subscription (downgrade at period end)
- `RenewSubscriptionAsync()`: Re-activate cancelled subscription
- `LinkProfileToSubscriptionAsync()`: Link Artist/ServiceProvider to subscription
- `UnlinkProfileFromSubscriptionAsync()`: Remove profile from subscription
- `CalculateTotalPrice()`: Calculate price including add-on profiles
- `UpdateExpiredSubscriptionsAsync()`: Background job to handle expired subscriptions

#### BoostService
**Location**: `Backend/AdminTest/Services/BoostService.cs`

**Key Methods**:
- `PurchaseBoostAsync()`: Buy boost and auto-deactivate previous
- `GetActiveBoostAsync()`: Get currently active boost for profile
- `GetBoostHistoryAsync()`: Get all boosts purchased by profile
- `DeactivateBoostAsync()`: Manually deactivate boost

### Authorization

**Location**: `Backend/AdminTest/Authorization/`

- `SubscribedTierRequirement`: IAuthorizationRequirement
- `SubscribedTierHandler`: Checks if user has subscribed tier profile

**Usage in Controllers**:
```csharp
[Authorize(Policy = "SubscribedTier")]
public async Task<IActionResult> PremiumFeature()
{
    // Only accessible to users with subscribed tier
}
```

### Configuration

**Location**: `Backend/AdminTest/Program.cs`

```csharp
// Services registered:
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
builder.Services.AddScoped<IBoostService, BoostService>();

// Authorization policy:
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SubscribedTier", policy =>
        policy.Requirements.Add(new SubscribedTierRequirement()));
});
builder.Services.AddScoped<IAuthorizationHandler, SubscribedTierHandler>();
```

## Frontend Implementation

### Models

**Location**: `Frontend/admin-app/src/app/models/subscription.model.ts`

**Enums**:
- `SubscriptionPlan`: Free, Regular, Premium
- `SubscriptionStatus`: PendingPayment, Trial, Active, Cancelled, Expired, Suspended
- `ProfileTier`: Free, Subscribed
- `BoostType`: TopOfRecommended, HomepageBanner

**DTOs**:
- `SubscriptionDto`: Full subscription data
- `CreateSubscriptionDto`: Data for creating subscription
- `UpgradeSubscriptionDto`: Data for upgrading
- `BoostDto`: Boost purchase data

**Helper Classes**:
- `SubscriptionPlanHelper`: Static methods for pricing and names
- `BoostTypeHelper`: Static methods for boost pricing and names

### Services

#### SubscriptionService
**Location**: `Frontend/admin-app/src/app/services/subscription.service.ts`

**Methods**:
- `createSubscription()`: POST new subscription
- `getUserActiveSubscription()`: GET active subscription for user
- `upgradeSubscription()`: PUT upgrade request
- `cancelSubscription()`: PUT cancel request
- `renewSubscription()`: PUT renew request
- `linkProfileToSubscription()`: POST link profile
- `unlinkProfileFromSubscription()`: DELETE unlink profile

#### BoostService
**Location**: `Frontend/admin-app/src/app/services/boost.service.ts`

**Methods**:
- `purchaseBoost()`: POST new boost purchase
- `getActiveBoost()`: GET active boost for profile
- `getBoostHistory()`: GET all boosts for profile
- `deactivateBoost()`: PUT deactivate boost

### Components

#### 1. SubscriptionSelectionComponent
**Location**: `Frontend/admin-app/src/app/components/subscription-selection/`

**Purpose**: Allow users to select and purchase subscription plans

**Features**:
- Plan comparison grid (Free, Regular, Premium)
- Billing cycle toggle (Monthly/Yearly)
- Feature lists for each plan
- Current plan indicator
- Trial period notice
- Pricing calculator

**Usage**:
```html
<app-subscription-selection></app-subscription-selection>
```

#### 2. SubscriptionStatusComponent
**Location**: `Frontend/admin-app/src/app/components/subscription-status/`

**Purpose**: Display and manage current subscription

**Features**:
- Current plan details
- Status badge (Active, Trial, Cancelled, etc.)
- Days remaining counter
- Next billing date
- Profile usage stats
- Add-on costs display
- Upgrade/Cancel/Renew buttons
- Cancel confirmation dialog

**Usage**:
```html
<app-subscription-status></app-subscription-status>
```

#### 3. BoostPurchaseComponent
**Location**: `Frontend/admin-app/src/app/components/boost-purchase/`

**Purpose**: Purchase one-time boosts for profiles

**Features**:
- Boost type selection
- Dynamic pricing display
- Purchase flow with mock payment
- Success/error handling
- Loading states

**Usage**:
```html
<app-boost-purchase
  [serviceProviderId]="providerId"
  [type]="BoostType.TopOfRecommended"
  (purchased)="onBoostPurchased()">
</app-boost-purchase>
```

### Guards

**Location**: `Frontend/admin-app/src/app/guards/tier.guard.ts`

#### subscribedTierGuard
Protects routes that require subscribed tier.

**Usage**:
```typescript
// In routes:
{
  path: 'premium-feature',
  component: PremiumFeatureComponent,
  canActivate: [subscribedTierGuard]
}

// Check specific profile type:
{
  path: 'artist-premium',
  component: ArtistPremiumComponent,
  canActivate: [subscribedTierGuard],
  data: { profileType: 'artist' }
}
```

#### anySubscribedProfileGuard
More lenient - allows if ANY profile is subscribed.

**Usage**:
```typescript
{
  path: 'mixed-premium',
  component: MixedComponent,
  canActivate: [anySubscribedProfileGuard]
}
```

#### planGuard
Checks for specific subscription plan (for future use).

## Integration Guide

### Setting Up Routes

```typescript
// app.routes.ts
import { subscribedTierGuard } from './guards/tier.guard';

export const routes: Routes = [
  {
    path: 'subscription',
    children: [
      {
        path: 'select',
        component: SubscriptionSelectionComponent
      },
      {
        path: 'status',
        component: SubscriptionStatusComponent
      }
    ]
  },
  {
    path: 'profile/edit',
    component: ProfileEditComponent,
    canActivate: [subscribedTierGuard]
  }
];
```

### Checking Tier in Components

```typescript
// In component:
export class ProfileComponent {
  profile: ServiceProvider;

  get isPremium(): boolean {
    return this.profile.tier === ProfileTier.Subscribed;
  }

  get canAccessFeature(): boolean {
    return this.isPremium;
  }
}
```

```html
<!-- In template: -->
<div *ngIf="isPremium" class="premium-feature">
  <!-- Premium-only content -->
</div>

<button *ngIf="!isPremium" (click)="upgradePrompt()">
  🔒 שדרג לגישה לתכונה זו
</button>
```

### Using Boosts

```typescript
// In service provider profile:
export class ServiceProviderProfileComponent {
  @Input() providerId: number;
  showBoostDialog = false;

  purchaseBoost() {
    this.showBoostDialog = true;
  }

  onBoostPurchased() {
    this.showBoostDialog = false;
    this.loadProfile(); // Refresh to show updated status
  }
}
```

```html
<button (click)="purchaseBoost()">🚀 קנה בוסט</button>

<app-boost-purchase
  *ngIf="showBoostDialog"
  [serviceProviderId]="providerId"
  [type]="BoostType.TopOfRecommended"
  (purchased)="onBoostPurchased()">
</app-boost-purchase>
```

## Payment Integration (Future)

Currently using mock payment IDs. To integrate real payment:

1. **Choose payment provider**: Tranzila, PayPal, Stripe, etc.
2. **Update frontend**: Replace mock payment with provider SDK
3. **Update backend**: Add payment webhook handlers
4. **Add payment verification**: Verify payment before activating subscription

### Example Payment Flow

```typescript
// In subscription-selection.component.ts:
purchaseSubscription() {
  // 1. Initiate payment with provider
  const paymentResult = await this.paymentProvider.charge({
    amount: this.getPlanPrice(),
    description: `${this.getPlanName()} subscription`
  });

  // 2. Create subscription with payment ID
  const dto: CreateSubscriptionDto = {
    userId: user.id,
    plan: this.selectedPlan,
    billingCycle: this.billingCycle,
    isAutoRenew: true,
    externalPaymentId: paymentResult.transactionId
  };

  this.subscriptionService.createSubscription(dto).subscribe(...);
}
```

## Testing

### Backend Testing
- Test subscription creation with trial
- Test upgrade/downgrade flows
- Test profile linking with pricing calculations
- Test expiration handling
- Test boost competition (auto-deactivation)

### Frontend Testing
- Test component rendering for all plans
- Test guard protection on routes
- Test tier-based feature visibility
- Test boost purchase flow
- Test subscription status display

## Known Limitations

1. **Payment Integration**: Currently using mock payments
2. **Background Jobs**: Expiration handling needs scheduled job (Hangfire, Quartz)
3. **Webhooks**: No payment provider webhooks implemented
4. **Email Notifications**: No email notifications for subscription events
5. **Refunds**: No refund logic implemented
6. **Proration**: No proration for mid-cycle upgrades

## Future Enhancements

1. **Payment Integration**
   - Integrate with Tranzila or similar provider
   - Add webhook handlers
   - Implement refund logic

2. **Background Jobs**
   - Set up scheduled job for expiration checks
   - Send email reminders before expiration
   - Clean up old inactive boosts

3. **Analytics**
   - Track subscription conversion rates
   - Monitor boost purchases
   - Analyze tier feature usage

4. **Enhanced Features**
   - Gift subscriptions
   - Discount codes/coupons
   - Referral program
   - Team/agency plans

5. **Admin Dashboard**
   - Subscription management UI
   - Revenue analytics
   - User tier statistics
   - Boost performance metrics

## Migration Notes

### Running the Migration

```bash
cd Backend/AdminTest
dotnet ef migrations add AddSubscriptionSystem
dotnet ef database update
```

### Important Changes
- `User` → `ServiceProvider` relationship changed from 1:0..1 to 1:Many
- Added `Tier` and `SubscriptionId` to both Artist and ServiceProvider
- Cascade delete behaviors set to `NoAction` to prevent cycles

## Support

For questions or issues:
- Check the inline code documentation
- Review component examples in this document
- Consult the API documentation (if available)

---

**Implementation Date**: January 2026
**Backend Framework**: ASP.NET Core 8.0
**Frontend Framework**: Angular 17+ (Standalone Components)
**Database**: SQL Server with Entity Framework Core
