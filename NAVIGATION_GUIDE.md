# מדריך ניווט למערכת המנויים

## דפים שנוצרו

### 1. בחירת תוכנית מנוי
**URL**: `/subscription/select`

**שימוש**: דף זה מציג את כל תוכניות המנוי הזמינות ומאפשר למשתמש לבחור ולרכוש מנוי.

**מתי להציג**:
- כשמשתמש חדש רוצה להירשם למנוי
- כשמשתמש רוצה לשדרג את המנוי הקיים
- כש-guard חוסם גישה לתכונה premium

### 2. סטטוס המנוי שלי
**URL**: `/subscription/status`

**שימוש**: דף זה מציג את פרטי המנוי הנוכחי של המשתמש ומאפשר ניהול המנוי.

**מתי להציג**:
- בתפריט המשתמש (User Menu)
- בדשבורד האישי
- בהגדרות חשבון

---

## איך להוסיף קישורים בממשק

### 1. בתפריט ניווט עליון (Header)

```typescript
// בקומפוננט ה-Layout או Header
import { Router } from '@angular/router';
import { AuthService } from './services/auth.service';

export class HeaderComponent {
  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn;
  }

  navigateToMySubscription() {
    this.router.navigate(['/subscription/status']);
  }

  navigateToUpgrade() {
    this.router.navigate(['/subscription/select']);
  }
}
```

```html
<!-- בתבנית ה-Header -->
<nav class="user-menu" *ngIf="isLoggedIn">
  <a routerLink="/subscription/status" routerLinkActive="active">
    💎 המנוי שלי
  </a>
  <a routerLink="/subscription/select" routerLinkActive="active">
    ⬆️ שדרג
  </a>
</nav>
```

### 2. בתפריט נפתח של משתמש (User Dropdown)

```html
<div class="user-dropdown">
  <button class="user-avatar" (click)="toggleDropdown()">
    <img [src]="currentUser?.profileImageUrl || 'assets/default-avatar.png'" />
  </button>

  <div class="dropdown-menu" *ngIf="isDropdownOpen">
    <a routerLink="/profile">
      👤 הפרופיל שלי
    </a>

    <a routerLink="/subscription/status">
      💎 המנוי שלי
    </a>

    <a routerLink="/my-playlists">
      🎵 הרשימות שלי
    </a>

    <hr>

    <button (click)="logout()">
      🚪 התנתק
    </button>
  </div>
</div>
```

### 3. באנר קידום (Promotion Banner)

```html
<!-- להציג למשתמשים עם מנוי חינמי -->
<div class="upgrade-banner" *ngIf="currentUser && !isPremiumUser">
  <div class="banner-content">
    <h3>🚀 שדרג והגדל את החשיפה שלך!</h3>
    <p>קבל נראות מקסימלית, תג "מומלץ" וגישה לכל התכונות המתקדמות</p>
    <a routerLink="/subscription/select" class="upgrade-btn">
      ראה תוכניות מנוי
    </a>
  </div>
</div>
```

### 4. בדף פרופיל של Service Provider / Artist

```html
<!-- בקומפוננט של פרופיל -->
<div class="profile-header">
  <h1>{{ provider.displayName }}</h1>

  <!-- כפתור בוסט - רק למנויים -->
  <button
    *ngIf="isMyProfile && isPremiumUser"
    class="boost-btn"
    (click)="showBoostDialog = true">
    🚀 קנה בוסט
  </button>

  <!-- הצעה לשדרוג - למשתמשים חינמיים -->
  <div *ngIf="isMyProfile && !isPremiumUser" class="upgrade-prompt">
    <p>⚠️ פרופיל חינמי - נראות מוגבלת</p>
    <a routerLink="/subscription/select" class="upgrade-link">
      שדרג עכשיו לתכונות מתקדמות
    </a>
  </div>
</div>

<!-- מודל רכישת בוסט -->
<app-boost-purchase
  *ngIf="showBoostDialog"
  [serviceProviderId]="provider.id"
  [type]="BoostType.TopOfRecommended"
  (purchased)="onBoostPurchased()">
</app-boost-purchase>
```

```typescript
export class ProfileComponent {
  showBoostDialog = false;
  BoostType = BoostType; // להצגת enum ב-template

  get isPremiumUser(): boolean {
    return this.provider?.tier === ProfileTier.Subscribed;
  }

  get isMyProfile(): boolean {
    const currentUser = this.authService.currentUserValue;
    return currentUser?.id === this.provider?.userId;
  }

  onBoostPurchased() {
    this.showBoostDialog = false;
    // רענן את הפרופיל להציג סטטוס מעודכן
    this.loadProfile();
  }
}
```

### 5. בדף הגדרות / דשבורד

```html
<div class="settings-page">
  <h1>הגדרות החשבון</h1>

  <section class="subscription-section">
    <h2>💎 מנוי ותשלומים</h2>

    <div class="subscription-card">
      <div class="current-plan" *ngIf="currentSubscription">
        <span class="plan-name">{{ currentSubscription.planName }}</span>
        <span class="plan-status" [class]="getStatusClass()">
          {{ currentSubscription.statusName }}
        </span>
      </div>

      <div class="no-subscription" *ngIf="!currentSubscription">
        <p>אין לך מנוי פעיל</p>
      </div>

      <div class="subscription-actions">
        <a routerLink="/subscription/status" class="btn-secondary">
          ניהול המנוי
        </a>
        <a routerLink="/subscription/select" class="btn-primary">
          שדרג תוכנית
        </a>
      </div>
    </div>
  </section>
</div>
```

### 6. בעמוד הבית / Landing Page

```html
<section class="pricing-section">
  <h2>תוכניות המנוי שלנו</h2>
  <p>בחר את התוכנית המתאימה לך והתחל להגדיל את החשיפה שלך עוד היום</p>

  <div class="pricing-cards">
    <!-- כרטיס חינמי -->
    <div class="pricing-card">
      <h3>חינמי</h3>
      <div class="price">0₪ <span>/חודש</span></div>
      <ul>
        <li>פרופיל בסיסי</li>
        <li>הופעה בחיפוש</li>
      </ul>
      <button class="btn-outline">התחל חינם</button>
    </div>

    <!-- כרטיס רגיל -->
    <div class="pricing-card featured">
      <div class="badge">מומלץ ביותר</div>
      <h3>רגיל</h3>
      <div class="price">49₪ <span>/חודש</span></div>
      <ul>
        <li>פרופיל מקצועי מלא</li>
        <li>תג "מומלץ"</li>
        <li>קדימות בחיפוש</li>
        <li>גלריית תמונות</li>
      </ul>
      <a routerLink="/subscription/select" class="btn-primary">
        התחל עכשיו
      </a>
    </div>

    <!-- כרטיס פרימיום -->
    <div class="pricing-card">
      <h3>פרימיום</h3>
      <div class="price">99₪ <span>/חודש</span></div>
      <ul>
        <li>2 פרופילים מקצועיים</li>
        <li>כל התכונות של "רגיל"</li>
        <li>נראות מקסימלית</li>
        <li>תמיכה מועדפת</li>
      </ul>
      <a routerLink="/subscription/select" class="btn-primary">
        שדרג עכשיו
      </a>
    </div>
  </div>
</section>
```

---

## שימוש ב-Guards

### הגנה על תכונות Premium

```typescript
// app.routes.ts
{
  path: 'profile/gallery',
  component: GalleryManagementComponent,
  canActivate: [subscribedTierGuard],
  title: 'ניהול גלריה'
}
```

### דוגמה לשימוש בקומפוננט

```typescript
import { ProfileTier } from './models/subscription.model';

export class FeatureComponent {
  profile: ServiceProvider;

  get canAccessFeature(): boolean {
    return this.profile.tier === ProfileTier.Subscribed;
  }
}
```

```html
<!-- הצגת תכונה רק למנויים -->
<div *ngIf="canAccessFeature" class="premium-feature">
  <h3>גלריית תמונות</h3>
  <!-- תוכן התכונה -->
</div>

<!-- הצעה לשדרוג למשתמשים חינמיים -->
<div *ngIf="!canAccessFeature" class="upgrade-prompt">
  <h3>🔒 גלריית תמונות</h3>
  <p>תכונה זו זמינה רק למנויים</p>
  <a routerLink="/subscription/select" class="upgrade-btn">
    שדרג עכשיו
  </a>
</div>
```

---

## דוגמאות CSS לכפתורים ובאנרים

```css
/* כפתור שדרוג */
.upgrade-btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);
  color: white;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  transition: transform 0.2s;
}

.upgrade-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* באנר קידום */
.upgrade-banner {
  background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);
  color: white;
  padding: 2rem;
  border-radius: 12px;
  margin: 1rem 0;
  text-align: center;
}

.upgrade-banner h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.5rem;
}

.upgrade-banner p {
  margin: 0 0 1rem 0;
  opacity: 0.9;
}

/* תג מנוי בפרופיל */
.premium-badge {
  display: inline-block;
  background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
  color: #333;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
}

/* הצעה לשדרוג בתוך פרופיל */
.upgrade-prompt {
  background: #FEF3C7;
  border: 1px solid #F59E0B;
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
}

.upgrade-prompt p {
  margin: 0 0 0.5rem 0;
  color: #92400E;
}

.upgrade-link {
  color: #F59E0B;
  font-weight: 600;
  text-decoration: underline;
}
```

---

## תזרים משתמש טיפוסי

### תרחיש 1: משתמש חדש נרשם
1. משתמש נכנס לאתר → `/`
2. רואה באנר קידום או מחירון
3. לוחץ "התחל עכשיו" → `/subscription/select`
4. בוחר תוכנית ומבצע תשלום
5. מועבר אוטומטית לעמוד יצירת פרופיל

### תרחיש 2: משתמש קיים רוצה לשדרג
1. נכנס לחשבון שלו
2. רואה "המנוי שלי" בתפריט
3. לוחץ → `/subscription/status`
4. רואה פרטי מנוי נוכחי
5. לוחץ "שדרג תוכנית" → `/subscription/select`
6. בוחר תוכנית חדשה ומשדרג

### תרחיש 3: משתמש מנסה לגשת לתכונה premium
1. לוחץ על "הוסף תמונה לגלריה"
2. ה-Guard חוסם
3. מקבל alert: "תכונה זו דורשת מנוי פעיל"
4. מועבר אוטומטית → `/subscription/select`
5. רוכש מנוי וחוזר לתכונה

### תרחיש 4: רכישת בוסט
1. בעל מקצוע נכנס לפרופיל שלו
2. רואה כפתור "🚀 קנה בוסט"
3. לוחץ → מופיע מודל `<app-boost-purchase>`
4. בוחר סוג בוסט (Top של מומלצים / באנר)
5. משלם
6. הפרופיל קופץ לראש הרשימה

---

## עצות נוספות

### 1. התאמה אישית לפי סטטוס משתמש

```typescript
export class HeaderComponent implements OnInit {
  currentSubscription?: SubscriptionDto;

  ngOnInit() {
    const user = this.authService.currentUserValue;
    if (user) {
      this.subscriptionService.getUserActiveSubscription(user.id)
        .subscribe(sub => this.currentSubscription = sub);
    }
  }

  get subscriptionStatus(): string {
    if (!this.currentSubscription) return 'אין מנוי';
    return this.currentSubscription.planName;
  }

  get shouldShowUpgradePrompt(): boolean {
    return !this.currentSubscription ||
           this.currentSubscription.plan === SubscriptionPlan.Free;
  }
}
```

### 2. התראות על תום מנוי

```html
<!-- בכותרת העליונה -->
<div class="expiration-alert" *ngIf="isSubscriptionExpiringSoon()">
  ⚠️ המנוי שלך יפוג בעוד {{ daysUntilExpiration }} ימים
  <a routerLink="/subscription/status">חדש עכשיו</a>
</div>
```

### 3. אייקונים ותגיות ויזואליות

```html
<!-- בכרטיס פרופיל ברשימה -->
<div class="profile-card">
  <img [src]="profile.imageUrl" />
  <h3>{{ profile.displayName }}</h3>

  <!-- תג premium -->
  <span class="premium-badge" *ngIf="profile.tier === ProfileTier.Subscribed">
    ⭐ מומלץ
  </span>

  <!-- אינדיקטור בוסט פעיל -->
  <span class="boost-indicator" *ngIf="profile.hasActiveBoost">
    🚀 בוסט פעיל
  </span>
</div>
```

---

זהו! עכשיו יש לך את כל הכלים להוסיף את מערכת המנויים לממשק המשתמש שלך 🎉
