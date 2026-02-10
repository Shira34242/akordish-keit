# 📢 מדריך שילוב פרסומות באתר

## סקירה כללית

מערכת הפרסומות שלך כוללת:
- ✅ ממשק ניהול (Angular Admin Panel)
- ✅ API ציבורי להצגת פרסומות
- ✅ מערכת רוטציה חכמה לפי עדיפויות (1-5)
- ✅ מעקב אוטומטי אחר צפיות וקליקים

---

## 🎯 שלוש דרכים להציג פרסומות

### אפשרות 1: JavaScript Widget (לכל סוג אתר)

**מתאים ל:** HTML, PHP, WordPress, וכל אתר שתומך ב-JavaScript

#### התקנה:
```html
<!-- הוסף את הקובץ JavaScript -->
<script src="https://your-domain.com/ad-widget.js"></script>

<!-- צור div להצגת הפרסומת -->
<div id="my-ad"></div>

<!-- אתחל את הווידג'ט -->
<script>
  new AdWidget({
    containerId: 'my-ad',
    spotTechnicalId: 'header-banner',
    apiUrl: 'https://your-api.com/api/AdCampaigns',
    rotationInterval: 45000
  });
</script>
```

#### דוגמה מלאה:
ראה קובץ: `ad-widget-example.html`

---

### אפשרות 2: Angular Component

**מתאים ל:** אתרים שבנויים ב-Angular

#### התקנה:
```typescript
// app.component.ts
import { AdDisplayComponent } from './components/public/ad-display/ad-display.component';

@Component({
  selector: 'app-root',
  imports: [AdDisplayComponent],
  template: `
    <app-ad-display
      spotTechnicalId="header-banner"
      [rotationInterval]="45000"
      [isMobile]="false">
    </app-ad-display>
  `
})
```

#### מיקום הקומפוננטה:
`src/app/components/public/ad-display/ad-display.component.ts`

---

### אפשרות 3: קריאות API ישירות

**מתאים ל:** מפתחים שרוצים שליטה מלאה

#### API Endpoints זמינים:

**1. קבלת כל הפרסומות לשטח:**
```
GET /api/AdCampaigns/Public/GetAd?spotTechnicalId={technicalId}
```

תגובה:
```json
{
  "spotId": 1,
  "spotName": "באנר עליון",
  "spotTechnicalId": "header-banner",
  "totalCampaigns": 3,
  "campaigns": [
    {
      "id": 5,
      "name": "קמפיין A",
      "mediaUrl": "https://.../banner.jpg",
      "mobileMediaUrl": "https://.../mobile-banner.jpg",
      "knownUrl": "https://client-website.com",
      "priority": 1,
      "clientName": "לקוח א'"
    },
    // ... עוד קמפיינים ממוינים לפי priority
  ]
}
```

**2. קבלת פרסומת ספציפית לפי עדיפות:**
```
GET /api/AdCampaigns/Public/GetAdByPriority?spotTechnicalId={technicalId}&priority=1
```

**3. מעקב צפייה:**
```
POST /api/AdCampaigns/{campaignId}/track-view
```

**4. מעקב קליק:**
```
POST /api/AdCampaigns/{campaignId}/track-click
```

---

## 📋 הגדרת שטחי פרסום (Ad Spots)

לפני שאתה יכול להציג פרסומות, צריך להגדיר **שטחי פרסום** בממשק הניהול:

1. היכנס לממשק הניהול
2. עבור ל**שטחי פרסום** → **+ שטח חדש**
3. מלא את הפרטים:
   - **שם**: "באנר עליון"
   - **מזהה טכני**: `header-banner` (זה מה שתשתמש בקוד!)
   - **סוג מדיה**: תמונה/וידאו/GIF
   - **מידות**: 728x90
   - **סטטוס**: פעיל ✓

4. צור קמפיין חדש:
   - בחר שטח פרסום
   - העלה תמונה/וידאו
   - בחר **עדיפות** (1-5, כאשר 1 הכי גבוה)
   - הגדר תאריכי התחלה וסיום
   - סטטוס: **פעיל**

---

## 🔄 איך עובדת מערכת הרוטציה?

### מודל היברידי:

1. **טעינת עמוד** 📱
   - תמיד מתחיל מהפרסומת בעדיפות 1 (הגבוהה ביותר)

2. **רוטציה אוטומטית** ⏱️
   - כל 45 שניות (ברירת מחדל) עובר לפרסומת הבאה
   - מסתובב בלולאה: 1 → 2 → 3 → 1...

3. **מעבר בין דפים** 🔀
   - ב-SPA (Single Page App): כל route change = פרסומת חדשה
   - באתרים רגילים: כל טעינת דף = פרסומת חדשה

### מקרה לדוגמה:
```
יש לך 3 קמפיינים באותו שטח:
- קמפיין A: עדיxxxxxxxxxxxxxיין B: עדיפות 2
- קמפיין C: עדיפות 3

סדר הצגה:
00:00 → קמפיין A (עדיפות 1)
00:45 → קמפיין B (עדיפות 2)
01:30 → קמפיין C (עדיפות 3)
02:15 → קמפיין A (חזרה להתחלה)
```

---

## ⚙️ התאמה אישית

### שינוי זמן רוטציה:
```javascript
new AdWidget({
  // ...
  rotationInterval: 30000  // 30 שניות
});
```

### זיהוי אוטומטי של מובייל:
הווידג'ט מזהה אוטומטית אם המשתמש במובייל ומציג את `mobileMediaUrl` במקום `mediaUrl`.

### כיבוי רוטציה (הצגת פרסומת אחת בלבד):
```javascript
new AdWidget({
  // ...
  rotationInterval: 0  // או מספר גבוה מאוד
});
```

### הצגת עדיפות ספציפית:
במקום להשתמש בווידג'ט, קרא ישירות ל-API:
```javascript
fetch('https://your-api.com/api/AdCampaigns/Public/GetAdByPriority?spotTechnicalId=header-banner&priority=1')
  .then(res => res.json())
  .then(campaign => {
    // הצג את campaign.mediaUrl
  });
```

---

## 🎨 עיצוב ותצוגה

### CSS בסיסי לפרסומת:
```css
#my-ad {
  max-width: 728px;
  margin: 20px auto;
  text-align: center;
}

#my-ad img {
  width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
```

### פרסומת רספונסיבית:
```css
@media (max-width: 768px) {
  #my-ad {
    max-width: 100%;
    padding: 0 10px;
  }
}
```

---

## 📊 מעקב ואנליטיקה

כל הצגה וקליק נרשמים אוטומטית!

לצפייה בנתונים:
1. כנס לממשק הניהול
2. עבור ל**קמפיינים**
3. ראה עבור כל קמפיין:
   - **צפיות**: ViewCount
   - **קליקים**: ClickCount
   - **CTR**: Click-Through Rate (%)

---

## 🔒 אבטחה

### CORS:
אם האתר שלך בדומיין אחר, הוסף את הדומיין ל-CORS בשרת:

```csharp
// Program.cs או Startup.cs
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowPublicSite", policy =>
    {
        policy.WithOrigins("https://your-website.com")
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

app.UseCors("AllowPublicSite");
```

---

## 🐛 פתרון בעיות נפוצות

### הפרסומת לא מוצגת:
1. ✓ ודא שיש קמפיין **פעיל** בתאריכים הנוכחיים
2. ✓ ודא שהשטח פרסום **פעיל**
3. ✓ בדוק Console בדפדפן לשגיאות
4. ✓ ודא ש-API זמין (נסה לפתוח ישירות את הקישור)

### שגיאת CORS:
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```
→ הוסף את הדומיין שלך ל-CORS (ראה סעיף אבטחה)

### הפרסומת לא מתחלפת:
→ בדוק שיש יותר מקמפיין אחד בשטח הפרסום

---

## 📞 תמיכה

לשאלות ותמיכה, פנה למפתח המערכת.

---

## 🎉 סיכום מהיר

1. **צור שטח פרסום** בממשק ניהול עם `technicalId` ייחודי
2. **צור קמפיינים** עם עדיפויות שונות (1-5)
3. **הוסף קוד** לאתר שלך עם ה-`technicalId`
4. **הפרסומות מוצגות אוטומטית** ומתחלפות לפי עדיפות

**זהו!** 🚀
