# 🏗️ ארכיטקטורת מנויים - תכנון מפורט

## 📊 מבנה ה-Entities

### 1. User (ללא שינוי ב-UserRole)
```csharp
public class User
{
    public int Id { get; set; }
    public string Username { get; set; }
    public string Email { get; set; }
    public UserRole Role { get; set; }  // Admin, Manager, Regular - הרשאות בלבד!

    // Navigation
    public virtual ICollection<MusicServiceProvider> ServiceProviderProfiles { get; set; }  // 1:Many
    public virtual ICollection<Subscription> Subscriptions { get; set; }
    public virtual Artist? ManagedArtist { get; set; }
}

public enum UserRole
{
    Regular = 0,   // משתמש רגיל
    Manager = 3,   // מנהל תוכן
    Admin = 4      // מנהל מערכת
}
```

**הסרת ProfessionalRole לגמרי** - לא צריך! התפקיד המקצועי נקבע לפי קיום ServiceProvider profiles.

---

### 2. MusicServiceProvider (עדכון)
```csharp
public class MusicServiceProvider
{
    public int Id { get; set; }
    public int UserId { get; set; }  // NOT NULL - כל פרופיל שייך למשתמש

    // מידע בסיסי
    public string DisplayName { get; set; }
    public string? ProfileImageUrl { get; set; }
    public string? ShortBio { get; set; }
    public string? FullDescription { get; set; }

    // סוג
    public bool IsTeacher { get; set; }  // האם זה מורה (יש TeacherProfile)

    // 🆕 TIER - רמת הפרופיל
    public ProfileTier Tier { get; set; } = ProfileTier.Free;

    // 🆕 קישור למנוי שמממן פרופיל זה (אם Tier = Subscribed)
    public int? SubscriptionId { get; set; }

    // מיקום, יצירת קשר, וכו' (קיים)
    public int? CityId { get; set; }
    public string? WhatsAppNumber { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? WebsiteUrl { get; set; }
    public string? VideoUrl { get; set; }

    // ניהול
    public ProfileStatus Status { get; set; }  // PendingApproval, Active, Suspended
    public bool IsFeatured { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsDeleted { get; set; }

    // Navigation
    public virtual User User { get; set; }
    public virtual Subscription? Subscription { get; set; }
    public virtual ICollection<MusicServiceProviderCategoryMapping> Categories { get; set; }
    public virtual ICollection<MusicServiceProviderGalleryImage> GalleryImages { get; set; }
    public virtual Teacher? TeacherProfile { get; set; }  // 1:0..1
    public virtual ICollection<Boost> Boosts { get; set; }  // 🆕
}

public enum ProfileTier
{
    /// <summary>
    /// פרופיל חינמי - מידע בסיסי בלבד (5.1)
    /// </summary>
    Free = 0,

    /// <summary>
    /// פרופיל עם מנוי פעיל - כל התכונות (6)
    /// </summary>
    Subscribed = 1
}
```

---

### 3. Subscription (עדכון)
```csharp
public class Subscription
{
    public int Id { get; set; }
    public int UserId { get; set; }

    // Plan
    public SubscriptionPlan Plan { get; set; }
    public SubscriptionStatus Status { get; set; }

    // Trial
    public bool IsTrial { get; set; }
    public DateTime? TrialEndDate { get; set; }  // +3 months

    // Dates
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public DateTime? RenewalDate { get; set; }

    // Payment
    public bool IsAutoRenew { get; set; } = true;
    public string? ExternalPaymentId { get; set; }  // מזהה כרטיס אשראי מספק תשלום
    public decimal? Price { get; set; }
    public string Currency { get; set; } = "ILS";
    public string? BillingCycle { get; set; }  // Monthly, Yearly

    // Cancellation
    public DateTime? CancelledAt { get; set; }
    public string? CancellationReason { get; set; }

    // Tracking
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public virtual User User { get; set; }
    public virtual ICollection<MusicServiceProvider> CoveredProfiles { get; set; }  // פרופילים שהמנוי מכסה
}

public enum SubscriptionPlan
{
    /// <summary>
    /// ללא מנוי - פרופיל חינמי
    /// </summary>
    Free = 0,

    /// <summary>
    /// מנוי בסיסי - 49₪/חודש
    /// מכסה 1 פרופיל מלא (מורה או בעל מקצוע)
    /// </summary>
    Basic = 1,

    /// <summary>
    /// מנוי פרימיום - 99₪/חודש (עוגן תמחורי)
    /// מכסה 2 פרופילים מלאים (מורה + בעל מקצוע)
    /// </summary>
    Premium = 2,

    /// <summary>
    /// תוספת פרופיל - מחיר נוסף
    /// כל פרופיל נוסף מעבר למכסת המנוי
    /// </summary>
    ExtraProfile = 3
}
```

---

### 4. 🆕 Boost (חדש!)
```csharp
public class Boost
{
    public int Id { get; set; }
    public int ServiceProviderId { get; set; }

    // Payment
    public decimal Price { get; set; }  // 10₪
    public string? ExternalPaymentId { get; set; }

    // Boost details
    public BoostType Type { get; set; }
    public DateTime PurchaseDate { get; set; }
    public DateTime? StartDate { get; set; }     // מתי התחיל להיות פעיל
    public DateTime? ExpiryDate { get; set; }    // null = עד שמישהו דוחף
    public bool IsActive { get; set; }

    // Navigation
    public virtual MusicServiceProvider ServiceProvider { get; set; }
}

public enum BoostType
{
    /// <summary>
    /// מקפיץ לראש רשימת המומלצים
    /// </summary>
    TopOfRecommended = 0,

    /// <summary>
    /// באנר בדף הבית
    /// </summary>
    HomepageBanner = 1
}
```

---

## 🔄 תרחישי שימוש (User Flows)

### תרחיש 1: רישום כמורה עם ניסיון 3 חודשים

1. **משתמש נרשם** → User נוצר
2. **בוחר "אני מורה"** → הצעה: "קבל 3 חודשים חינם!"
3. **מזין כרטיס אשראי** → ExternalPaymentId נשמר
4. **יוצר פרופיל מורה**:
   ```
   ServiceProvider נוצר:
   - UserId = [user.id]
   - IsTeacher = true
   - Tier = Subscribed  ✅ (כי יש ניסיון)
   - SubscriptionId = [subscription.id]

   Teacher נוצר (extension):
   - Id = ServiceProvider.Id

   Subscription נוצר:
   - Plan = Basic
   - IsTrial = true
   - TrialEndDate = +3 months
   - Status = Trial
   - IsAutoRenew = true
   ```

5. **בתום 3 חודשים**:
   - רץ Background Job
   - בודק אם `TrialEndDate` עבר
   - אם `IsAutoRenew = true`:
     - מבצע חיוב דרך ספק התשלום
     - `Status = Active`
     - `IsTrial = false`
   - אם המשתמש ביטל לפני:
     - `Status = Expired`
     - `ServiceProvider.Tier = Free`  ⬇️ (ירידה לחינמי)
     - **אזהרה למשתמש**: גלריה, וידאו, המלצות יוסרו

---

### תרחיש 2: רכישת מנוי רגיל (49₪) ללא ניסיון

1. משתמש קיים עם פרופיל חינמי
2. לוחץ "שדרג לפרימיום"
3. בוחר Basic (49₪/חודש)
4. מזין כרטיס אשראי → תשלום מיידי
5. Subscription נוצר:
   ```
   - Plan = Basic
   - IsTrial = false
   - Status = Active
   - Price = 49
   ```
6. ServiceProvider מתעדכן:
   ```
   - Tier = Subscribed
   - SubscriptionId = [subscription.id]
   ```

---

### תרחיש 3: שדרוג ל-Premium (מורה + בעל מקצוע)

1. משתמש עם מנוי Basic (מורה)
2. רוצה גם פרופיל בעל מקצוע (אולפן)
3. לוחץ "הוסף פרופיל נוסף"
4. מוצע לו:
   - Option A: שדרג ל-Premium (99₪) → 2 פרופילים
   - Option B: הוסף תוספת (ExtraProfile) → Basic + תשלום נוסף
5. בוחר Premium
6. Subscription מתעדכן:
   ```
   - Plan = Premium
   - Price = 99
   ```
7. ServiceProvider נוסף נוצר:
   ```
   - UserId = [same user]
   - IsTeacher = false
   - Tier = Subscribed
   - SubscriptionId = [same subscription]
   ```

---

### תרחיש 4: רכישת Boost (10₪)

1. משתמש עם פרופיל (חינמי או בתשלום)
2. לוחץ "קפוץ לראש הרשימה"
3. משלם 10₪ (חד-פעמי)
4. Boost נוצר:
   ```
   - ServiceProviderId = [profile.id]
   - Type = TopOfRecommended
   - Price = 10
   - IsActive = true
   - ExpiryDate = null  (עד שמישהו דוחף)
   ```
5. הפרופיל מוצג בראש רשימת המומלצים
6. כשמישהו אחר קונה Boost:
   - Boost הקודם: `IsActive = false`, `ExpiryDate = now`
   - Boost החדש: `IsActive = true`

---

## 🎯 סיכום - איך זה עונה על כל הדרישות?

| דרישה | פתרון בארכיטקטורה |
|-------|-------------------|
| **5.1 - פרופיל חינמי** | `ServiceProvider.Tier = Free` |
| **5.2 - ניסיון 3 חודשים** | `Subscription.IsTrial = true` + `TrialEndDate` |
| **6 - מנוי רגיל 49₪** | `Subscription.Plan = Basic` + `ServiceProvider.Tier = Subscribed` |
| **6 - מנוי פרימיום 99₪** | `Subscription.Plan = Premium` + 2 ServiceProviders |
| **7 - Boost חד-פעמי** | `Boost` entity חדש |
| **8 - תוספים** | `ServiceProvider` נוסף + `Subscription.Plan = ExtraProfile` או שדרוג ל-Premium |

---

## ✅ מה צריך לעשות עכשיו?

1. **למחוק** `ProfessionalRole` enum
2. **לעדכן** User: `ServiceProviderProfile` → `ServiceProviderProfiles` (1:Many)
3. **להוסיף** ל-ServiceProvider:
   - `ProfileTier Tier`
   - `int? SubscriptionId`
4. **לעדכן** Subscription:
   - `ExternalPaymentId`
   - Navigation: `CoveredProfiles`
5. **ליצור** `Boost` entity חדש
6. **לכתוב** migration

האם זה מסתדר על הדרישות שלך? 🤔
