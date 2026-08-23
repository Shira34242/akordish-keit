# דוח בדיקת עלויות ותשתיות — אקורדישקייט

תאריך בדיקה: 18.08.2026  
אופי הבדיקה: קריאה בלבד. לא בוצע שינוי בקוד, ב-Azure, במסד הנתונים, בחבילות, בחיוב או בהגדרות.

## מקרא רמת ודאות

- **Actual** — נתון שנמדד בפועל בפורטל או בקוד הפעיל.
- **Calculated** — חישוב ישיר מנתוני Actual.
- **Estimate** — הערכה לצורך תכנון; אינה נתון חיוב ודאי.
- **Unknown** — אין כרגע נתון מספיק לקביעה.

המרת מטבע בדוח: **₪3.06 לדולר — Estimate**, שער תכנון מעוגל המבוסס על שערי בנק ישראל הזמינים סמוך למועד הבדיקה. כל החיוב בפורטל Azure מוצג בדולר. השער היציג משתנה ואינו שער החיוב של חברת האשראי. מקור: [בנק ישראל — שערי חליפין](https://www.boi.org.il/roles/markets/exchangerates/).

## תקציר מנהלים

1. עלות Azure בחודש המלא האחרון, יולי 2026, הייתה **$21.32 / כ-₪65.24 לחודש — Actual/Calculated**.
2. העלויות המרכזיות הן App Service בסך **$14.73 / כ-₪45.07 — Actual/Calculated** ו-SQL Database בסך **$6.59 / כ-₪20.17 — Actual/Calculated**.
3. נוצר עותק SQL נוסף ב-18.08.2026. אם יישאר חודש שלם באותו מסלול, בסיס העלות צפוי לעלות לכ-**$27.91 / כ-₪85.40 לחודש — Estimate**, לפני שירותים חיצוניים.
4. משתמש רשום שאינו פעיל כמעט שאינו מייצר עלות שוטפת נוספת. העלות שלו היא בעיקר כמה קילובייטים במסד — **Estimate** — ולכן גם אלפי נרשמים נוספים עשויים לעלות בפועל **כמעט $0 נוסף — Estimate**, כל עוד נשארים במדרגות הקיימות.
5. המשתנה החשוב הוא פעילות, לא הרשמה: ביממה שנבדקה היו **1.21 מיליון בקשות API — Actual** ו-**5.5GB תעבורה יוצאת — Actual**.
6. כ-**99% מהבקשות ביממה — Calculated** היו שתי פעולות סביב אזור התוכן הוויראלי: בקשת CORS מסוג OPTIONS והקריאה שמחזירה את התוכן. זה נראה כמו לולאת טעינה, בוט או דפוס תעבורה חריג; הסיבה המדויקת **Unknown**.
7. השרת עדיין מגיב מהר ברוב הפעולות, אך הזיכרון הממוצע בתוכנית השרת היה **80.38% — Actual** ומסד הנתונים הגיע ל-**100% DTU בשיא — Actual**. אלו צווארי הבקבוק הראשונים, לפני נפח האחסון.
8. מסד הייצור משתמש רק ב-**123.69MB מתוך 2GB — Actual**. יש כ-**1.88GB פנויים — Actual**, ולכן אחסון SQL אינו מגבלה קרובה.
9. ב-Blob נשמרים **4.89 אלף קבצים בנפח 2.16GiB — Actual**; ממוצע מחושב הוא כ-**463KiB לקובץ — Calculated**. עלות האחסון בפועל הייתה רק **$0.02 ביולי — Actual**.
10. מבחינה עסקית אין כרגע הצדקה להגביל הרשמה, אמנים, כתבות או שירים בגלל אחסון בלבד. כדאי לתמחר פעילות יקרה: תפוצה במייל, קידום ממומן, העלאת גלריות גדולות, ודפוסי שימוש שמייצרים הרבה קריאות או תעבורה.

## המצב הקיים

| רכיב | תפקיד | מסלול/מצב | נתון עלות |
|---|---|---|---:|
| Azure App Service `akordishkayt-api` | API ב-.NET 9 | Linux B1, מופע אחד — **Actual** | כלול בתוכנית App Service |
| App Service Plan `ASP-akordishkaytrg-8ee1` | מעבד וזיכרון ל-API | B1, עד שלושה מופעים — **Actual** | $14.73 ביולי — **Actual** |
| Azure SQL `AkordishKeitDB` | מסד הייצור | Basic, 5 DTU, עד 2GB — **Actual** | $6.59 ביולי ברמת שרת SQL — **Actual** |
| Azure SQL `AkordishKeitDB_Copy` | עותק מסד נוסף | Basic, נוצר ב-18.08.2026 — **Actual** | חודש מלא נוסף: כ-$6.59 — **Estimate** |
| Storage `akordishkaytmedia` | תמונות וקבצי מדיה | GPv2, Hot, LRS, Israel Central — **Actual** | $0.02 ביולי — **Actual** |
| Static Web App `akordishkayt-frontend` | אפליקציית Angular וקבצים סטטיים | Free, הפצה גלובלית — **Actual** | $0 — **Actual** |
| Application Insights | טלמטריה, שגיאות וביצועים | מחובר ל-API — **Actual** | $0 בחיוב שנבדק — **Actual** |
| Log Analytics | שמירת לוגים ושאילתות | Pay-as-you-go, Israel Central — **Actual** | $0 בחיוב שנבדק — **Actual** |
| Cloudflare | DNS/Proxy ועיבוד תמונות `/cdn-cgi/image` | המסלול בחשבון — **Unknown** | החיוב בפועל — **Unknown** |
| Brevo | מיילים שיווקיים וטרנזקציוניים | המסלול בחשבון — **Unknown** | החיוב בפועל — **Unknown** |
| YouTube API | מידע/ייבוא מ-YouTube | שימוש בקוד — **Actual** | עלות או חריגה בפועל — **Unknown** |
| Cardcom | תשלומים | אינטגרציה בקוד — **Actual** | עמלה חוזית בפועל — **Unknown** |

לא נמצאו בתשתית הפעילה Redis, Azure Functions, Azure Front Door, Cloudinary או שירות AI בתשלום — **Actual לפי מיפוי הקוד והמשאבים שנבדקו**. המטמון הוא בזיכרון של מופע ה-API היחיד — **Actual**; אם יהיו כמה מופעים, כל אחד יחזיק מטמון נפרד.

## עלויות Azure

### חודש מלא אחרון — יולי 2026

| שירות/משאב | דולר | ש"ח לפי ₪3.06 | סוג |
|---|---:|---:|---|
| App Service Plan | $14.73 | ₪45.07 | Actual/Calculated |
| SQL Database | $6.59 | ₪20.17 | Actual/Calculated |
| Storage | $0.02 | ₪0.06 | Actual/Calculated |
| Bandwidth | $0.00 | ₪0.00 | Actual |
| Log Analytics | $0.00 | ₪0.00 | Actual |
| התאמות חיוב | -$0.02 | -₪0.06 | Actual/Calculated |
| **סה"כ** | **$21.32** | **₪65.24** | **Actual/Calculated** |

### אוגוסט 2026 עד מועד הבדיקה

- חיוב מצטבר: **$11.95 / כ-₪36.57 — Actual/Calculated**.
- תחזית Azure לחודש: **$21.44 / כ-₪65.61 — Actual/Calculated**.
- התחזית עדיין אינה מייצגת חודש מלא של עותק ה-SQL שנוצר באותו יום — **Calculated**.
- בסיס חודשי משוער אם שני מסדי Basic נשארים פעילים: **$27.91 / כ-₪85.40 — Estimate**.

### מה קבוע ומה משתנה

- App Service ו-SQL Basic הם כמעט כל העלות הקבועה — **Actual**.
- מספר בקשות אינו מחויב ישירות בתוכנית B1; הוא מגדיל CPU, זיכרון ותעבורה ועלול לחייב קפיצת מדרגה — **Actual/Estimate**.
- אחסון Blob ופעולות Blob משתנים לפי נפח, פעולות ותעבורה — **Actual**.
- תעבורה ולוגים הופיעו ב-$0 בתקופה שנבדקה — **Actual**; אין להסיק מכך שתמיד יהיו חינם.
- Static Web Apps Free כולל עד **100GB תעבורה חודשית**, עד **250MB לסביבה יחידה** ועד **500MB לכל הסביבות — Actual לפי תיעוד Microsoft**. חריגה בתעבורה אינה זמינה במסלול Free, ולכן זו מגבלת שירות ולא חיוב הדרגתי. מקור: [Microsoft — Static Web Apps quotas](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas).

## שימוש, עומסים וצווארי בקבוק

### App Service

| חלון מדידה | בקשות | נכנס | יוצא | שגיאות 5xx | זמן תגובה ממוצע |
|---|---:|---:|---:|---:|---:|
| שעה אחרונה | 104.05K | 402.5MB | 290.1MB | 6 | 16.20ms |
| 24 שעות | 1.21M | 2.6GB | 5.5GB | 69 | 10.51ms |
| 7 ימים | 1.62M | 4.7GB | 31.9GB | 765 | 39.06ms |

כל הערכים בטבלה הם **Actual**. יחס 5xx הוא כ-**0.006% ביממה — Calculated** וכ-**0.047% בשבוע — Calculated**.

במופע B1 נמדדו CPU ממוצע **36.35% — Actual** וזיכרון ממוצע **80.38% — Actual**, בחלון ברירת המחדל שהוצג בפורטל; אורך החלון המדויק **Unknown**. אם קצב היממה החריגה יימשך חודש שלם, מדובר בכ-**36.3 מיליון בקשות וכ-165GB יציאת API בחודש — Calculated**, אך אין בסיס לקבוע שזה קצב רגיל.

### הפעולות הכבדות/המרובות ב-24 שעות

| פעולה | קריאות | ממוצע | p95 | סוג |
|---|---:|---:|---:|---|
| `OPTIONS /api/Articles/home-viral-banners` | 600,829 | 1.27ms | 5.58ms | Actual |
| `GET Articles/GetHomeViralBanners` | 597,716 | 4.14ms | 13.56ms | Actual |
| `GET AdCampaigns/GetAdForSpot` | 2,992 | 62.83ms | 228.60ms | Actual |
| `POST Analytics/TrackPageView` | 2,604 | 35.32ms | לא נמדד בדוח | Actual/Unknown |
| `GET Songs/GetApprovedSongs` | 1,854 | 300.63ms | 1,440.63ms | Actual |
| `GET Notifications/GetUnreadCount` | 1,895 | 30.19ms | לא נמדד בדוח | Actual/Unknown |

שתי פעולות התוכן הוויראלי יחד הן **1,198,545 קריאות — Calculated**, כ-**99% מסך בקשות היממה — Calculated**. ב-Frontend קיימים IntersectionObserver גם לאזור וגם לסמן הטעינה, וה-observer נבנה מחדש לאחר הוספת עמוד; קיימת הגנת `loading` ופג'ינציה, אך עדיין אפשר לייצר רצף בקשות. ב-Backend יש מטמון זיכרון ל-5 דקות לכל שילוב limit/offset. המסקנה: מקור החריגה עשוי להיות לולאת לקוח, זחלן או בוט, אך זהות המקור **Unknown**.

`GetApprovedSongs` הוא מועמד שני לבדיקה: p95 של **1.44 שניות — Actual** ו-p99 של **2.54 שניות — Actual**, גבוה משמעותית משאר הפעולות.

### SQL

- נפח ייצור: **123.69MB מוקצים מתוך 128MB — Actual**; מגבלת המסלול היא **2GB — Actual**; פנוי כ-**1.88GB — Actual**.
- DTU ממוצע בשבעה ימים: **3.16% — Actual**.
- DTU שיא בשעה, ביממה ובשבוע: עד **93% / 100% / 100% — Actual**.
- מסקנה: אין לחץ אחסון, אבל יש שאילתות/התפרצויות שמגיעות לתקרת 5 DTU — **Calculated**.
- Basic מאפשר עד **2GB**, כולל **5 DTU** ושמירת גיבוי נקודתית של עד **7 ימים — Actual לפי תיעוד Microsoft**. מקור: [Microsoft — DTU service tiers](https://learn.microsoft.com/en-us/azure/azure-sql/database/service-tiers-dtu?view=azuresql).

### Blob Storage

- נפח נוכחי: **2.16GiB — Actual**.
- מספר קבצים: **4.89K — Actual**.
- גודל ממוצע לקובץ: **כ-463KiB — Calculated**.
- ממוצע 14 יום: **1.76GiB ו-4.31K קבצים — Actual**.
- פעולות ב-14 יום: **94,870 — Actual**, מהן **92.11K GetBlob — Actual**.
- תעבורה ב-14 יום: **798.09MiB נכנסת ו-73.37GiB יוצאת — Actual**.
- קצב חודשי אם חלון זה מייצג: **כ-157GiB תעבורה יוצאת — Calculated**.
- מחיקה רכה של Blob ושל Container מוגדרת ל-**7 ימים — Actual**; versioning כבוי — **Actual**.

עלות האחסון זניחה כרגע, אך תעבורת המקור גבוהה ביחס לנפח. סביר שחלקה קשור למשיכת תמונות ועיבוד דרך Cloudflare — **Estimate**. הנתון דורש אימות ב-Cloudflare.

## שירותים חיצוניים

### Cloudflare

הקוד משתמש ב-`/cdn-cgi/image` כדי לשנות גודל ופורמט לתמונות שמקורן ב-Blob — **Actual**. מסלול החשבון, כמות transformations, cache hit ratio, תעבורה וחיוב בפועל הם **Unknown** עד להשלמת הכניסה לחשבון.

לפי [תמחור Cloudflare Images](https://developers.cloudflare.com/images/pricing/), מסלול Free כולל **5,000 transformations ייחודיים בחודש — Actual לפי התיעוד**. לאחר מכן צריך מסלול Paid; העלות היא **$0.50 לכל 1,000 transformations ייחודיים מעל המכסה — Actual לפי התיעוד**. צפיות חוזרות באותו עיבוד באותו חודש אינן נספרות מחדש.

דוגמת תכנון: **4.89K תמונות × 3 גדלים = 14.67K transformations — Calculated**. מעל המכסה מדובר בכ-**$4.84 לחודש — Calculated**, אם כל התמונות אכן נצפות בשלושת הגדלים ואם המסלול Paid פעיל. אלו הנחות **Estimate**, לא נתוני החשבון.

### Brevo

המערכת שולחת מיילים שיווקיים וטרנזקציוניים דרך Brevo — **Actual לפי הקוד**. מסלול, מספר אנשי קשר, מכסת שליחה ושימוש בחודש הם **Unknown** עד להשלמת הכניסה.

לפי [Brevo — plans](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans): Free הוא **$0 עם עד 300 שליחות ביום — Actual לפי התיעוד**; Starter מתחיל ב-**$9 לחודש — Actual לפי התיעוד**; Standard מתחיל ב-**$18 לחודש — Actual לפי התיעוד**. העלות גדלה בעיקר לפי נפח המיילים והמסלול, לא בגלל עצם קיום משתמש ב-SQL.

### שירותים נוספים

- YouTube API: נמצא שימוש בקוד — **Actual**; מכסה/חיוב בפועל **Unknown**.
- Cardcom: נמצא שימוש בקוד — **Actual**; עלות חודשית ועמלות עסקה **Unknown**.
- GitHub Actions לפריסת Static Web App: קיים חיבור לענף `master` — **Actual**; שימוש וחיוב GitHub **Unknown**.

## ניתוח מסד הנתונים

ב-DbContext נמצאו למעלה מ-70 קבוצות ישויות — **Actual**. הקבוצות העסקיות המרכזיות:

- משתמשים, פרופילים, הרשאות, כלים, אקורדים ידועים, מועדפים, דירוגים, לייקים ורשימות השמעה.
- שירים, אמנים, אלבומים, סרטונים, גלריות, קישורים, ז'אנרים, תגיות ואקורדים.
- כתבות, קטגוריות, תגיות, גלריות, צפיות ומשוב.
- אירועים, פודקאסטים, פרקים, חדשות ותוכן נבחר.
- נותני שירות, סוכנויות, מורים, סניפים, קטגוריות, גלריות, רשתות חברתיות והמלצות.
- פרסום: מיקומי מודעה, קמפיינים, צפיות וקליקים.
- שיווק: קמפיינים, אירועים, קבוצות מייל, נרשמים והסרות.
- קידומים, מנויים, הפניות, ארנק תגמולים, התראות וקבוצות.
- טבלאות פעילות: צפיות בשירים, כתבות, אירועים ופודקאסטים; קליקים, בדיקות AdBlock ואירועי קמפיין.

הטבלאות שצפויות לגדול לפי פעילות ולא לפי מספר משתמשים הן טבלאות הצפיות, הקליקים והאנליטיקה — **Actual לפי המבנה**. בחלקן נשמרים UserAgent וכתובת IP, ולכן רשומת פעילות עשויה להיות גדולה משמעותית מקשר רגיל — **Actual/Estimate**.

לא ניתן היה להפיק בבטחה ספירת שורות, Data size, Index size וגודל ממוצע לפי טבלה, משום ש-Azure Query Editor דורש SQL Authentication והחשבון המחובר אינו מוגדר ל-Entra authentication — **Actual**. לכן הנתונים הבאים הם במפורש הערכות תכנון בלבד.

## עלות אחסון לפי סוג ישות

| ישות | ספירה נוכחית | DB ממוצע לישות | Blob ממוצע לישות | סך אחסון משוער |
|---|---:|---:|---:|---:|
| משתמש רשום בסיסי | Unknown | 2–15KB — Estimate | 0–463KiB — Estimate | 2KB–478KiB — Estimate |
| נותן שירות מלא | Unknown | 5–30KB — Estimate | 1–6 קבצים, 0.45–2.71GiB לאלף — Estimate/Calculated | 0.45–2.74GiB לאלף — Estimate |
| אמן | Unknown | 5–25KB — Estimate | 1–3 קבצים, 0.45–1.36GiB לאלף — Estimate/Calculated | 0.46–1.39GiB לאלף — Estimate |
| כתבה | Unknown | 10–80KB — Estimate | 1–3 קבצים, 0.45–1.36GiB לאלף — Estimate/Calculated | 0.46–1.44GiB לאלף — Estimate |
| שיר/אקורדים | Unknown | 2–30KB — Estimate | לרוב 0; תלוי תמונה — Estimate | 2–30MB לאלף ללא תמונות — Estimate |
| אירוע/פודקאסט/פרק | Unknown | 5–50KB — Estimate | 1–3 קבצים — Estimate | 0.45–1.41GiB לאלף — Estimate |
| צפייה/אירוע Analytics | Unknown | 0.2–1.5KB — Estimate | 0 | 0.2–1.5GB למיליון רשומות — Calculated |

הערה: השורה האחרונה מדגישה שטבלאות פעילות יכולות לעבור את גודל התוכן עצמו. הטווח רחב בגלל שדות טקסט כמו UserAgent ומדיניות אינדקסים **Unknown**.

### עלות אחסון שולית

העלות שנמדדה, **$0.02 עבור סדר גודל של 2GiB — Actual**, נותנת פרוקסי מחושב של כ-**$0.009 לכל GiB-חודש — Calculated**, אך זה אינו מחירון Azure מחייב.

| תוספת | נפח משוער | עלות אחסון חודשית נוספת |
|---|---:|---:|
| 1,000 משתמשים ללא תמונה | 2–15MB — Estimate | פחות מ-$0.01 — Estimate |
| 10,000 משתמשים ללא תמונה | 20–150MB — Estimate | פחות מ-$0.01 — Estimate |
| 100,000 משתמשים ללא תמונה | 0.2–1.5GB — Estimate | כ-$0.00–$0.02 — Estimate |
| 1,000 קבצי תמונה ממוצעים | 0.45GiB — Calculated | כ-$0.004 — Estimate |
| 1,000 נותני שירות, 6 תמונות לאחד | 2.71GiB — Calculated | כ-$0.03 — Estimate |
| 1,000 כתבות, 2 תמונות לאחת | 0.90GiB — Calculated | כ-$0.01 — Estimate |
| 1,000 שירים ללא תמונות | 2–30MB — Estimate | פחות מ-$0.01 — Estimate |

המסקנה: אחסון התוכן עצמו אינו מניע עלות משמעותי כרגע. תעבורה, עיבוד תמונות, מיילים וקריאות DB בזמן פעילות חשובים יותר.

## משתמש רשום לעומת משתמש פעיל

| סוג | מה הוא יוצר | השפעה צפויה |
|---|---|---|
| משתמש רשום לא פעיל | שורת User, קשרים ולעיתים תמונת פרופיל | כמעט $0 שולי בתוך המסלולים הקיימים — Estimate |
| משתמש פעיל נמוך | כ-100 קריאות API בחודש — Estimate | בדרך כלל ללא שינוי מדרגה |
| משתמש פעיל בינוני | כ-500 קריאות API בחודש — Estimate | עומס DB/API ותעבורה מתחילים להיות מדידים |
| משתמש פעיל גבוה | כ-2,000 קריאות API בחודש — Estimate | עלול לקדם קפיצת מדרגה, בעיקר בזמן שיא |

הפעולות שמייצרות עומס: פתיחת דף הבית, טעינת רשימות ותמונות, חיפוש, פתיחת שיר/כתבה/אירוע, רישום צפייה, בדיקת מודעה, מועדפים והתראות — **Actual לפי הקוד**. בגלל הפרדת הדומיין בין Frontend ל-API, חלק מהקריאות גוררות גם CORS preflight מסוג OPTIONS — **Actual**.

## מודל עלות לפי גודל

אי אפשר להסיק עלות ממספר משתמשים רשומים בלבד. הטבלה היא מדרגות תכנון לפי שילוב של רשומים, שיעור פעילות ודפוס שימוש. היא כוללת Azure בסיסי בלבד ואינה כוללת Brevo, Cardcom או Cloudflare לא ידועים.

| קנה מידה | תשתית סבירה | עלות חודשית Azure | סוג |
|---|---|---:|---|
| Current, ללא עותק DB מלא-חודש | B1 אחד + SQL Basic אחד | $21.32 / ₪65.24 | Actual/Calculated |
| Current, עם עותק DB מלא-חודש | B1 אחד + שני SQL Basic | $27.91 / ₪85.40 | Estimate |
| 1K רשומים, פעילות נמוכה/בינונית | אותה תשתית | $28–$35 / ₪86–₪107 | Estimate |
| 10K רשומים, עד כ-2K פעילים בינוניים | אותה תשתית, אחרי טיפול בתעבורה החריגה | $28–$45 / ₪86–₪138 | Estimate |
| 50K רשומים, כ-5K–15K פעילים | 1–2 מופעי App + מדרגת SQL מעל Basic לפי שיאים | $50–$120 / ₪153–₪367 | Estimate |
| 100K רשומים, כ-10K–30K פעילים | 2 מופעי App או tier גבוה יותר + SQL מוגדל | $90–$250 / ₪275–₪765 | Estimate |
| 500K רשומים, כ-50K–150K פעילים | App רב-מופעי, cache משותף, SQL מוגדל, ניטור/תעבורה | $250–$800 / ₪765–₪2,448 | Estimate |
| 1M רשומים, כ-100K–300K פעילים | ארכיטקטורת scale-out, cache, DB ו-CDN מתוכננים | $500–$1,500 / ₪1,530–₪4,590 | Estimate |

הטווחים אינם ליניאריים. העלות נשארת כמעט קבועה עד שתקרת זיכרון/DTU/רוחב פס נחצית, ואז קופצת למדרגה חדשה. המערכת הנוכחית כבר הראתה **80.38% זיכרון ממוצע ו-100% DTU בשיא — Actual**, ולכן קפיצת המדרגה יכולה לקרות בגלל בוט או לולאה גם עם מספר קטן של משתמשים.

### תרחישי תנועה למשתמש פעיל

| פעילות | קריאות API למשתמש/חודש | 10K פעילים | 100K פעילים | פירוש |
|---|---:|---:|---:|---|
| נמוכה | 100 — Estimate | 1M — Calculated | 10M — Calculated | לרוב בתוך תשתית קטנה אם מפוזר בזמן |
| בינונית | 500 — Estimate | 5M — Calculated | 50M — Calculated | דורש מעקב DTU, cache ותעבורה |
| גבוהה | 2,000 — Estimate | 20M — Calculated | 200M — Calculated | צפויה מדרגת App/DB ותעבורה גבוהה יותר |

להשוואה, המערכת יצרה **1.21M קריאות ביום אחד — Actual**; זה שקול ליותר מתרחיש חודשי של 10K פעילים נמוכים בתוך כיממה — **Calculated**.

## מסקנות עסקיות

- אפשר לאפשר הרשמה חינמית רחבה: משתמש לא פעיל כמעט שאינו עולה כסף — **Estimate**.
- אין כרגע סיבה כלכלית להגביל מספר אמנים, כתבות או שירים בגלל SQL או Blob בלבד — **Calculated/Estimate**.
- נותני שירות עם גלריות גדולות יקרים יותר מישות טקסטואלית, אך גם שם אחסון המדיה הוא סנטים לאלף ישויות בסדרי הגודל שנמדדו — **Estimate**. העלות האמיתית היא הפצה ועיבוד תמונות.
- נכון יותר לקשור מסלול בתשלום לחשיפה, קידום, שליחת מיילים, נפח גלריה או שימוש עסקי מתקדם — לא לעצם הרישום.
- חשבון Brevo עשוי להפוך לעלות מדרגתית לפני SQL אם כל משתמש מקבל מיילים תכופים — **Estimate**.
- Cloudflare Images עשוי לדרוש Paid כשמספר צמדי תמונה×גודל ייחודיים עובר 5,000 בחודש — **Actual לפי התיעוד**.
- צוואר הבקבוק הראשון הוא התנהגות הבקשות בזמן אמת. לפני רכישת שרת גדול יותר, צריך לזהות את מקור כ-1.2M קריאות התוכן הוויראלי — **Calculated/Recommendation**.

## המלצות טכניות להמשך — ללא ביצוע

| דחיפות | בעיה | עלות/סיכון | שינוי אפשרי | חיסכון/תוצאה צפויה |
|---|---|---|---|---|
| קריטי | כ-99% מבקשות היממה סביב home viral banners | זיכרון גבוה, DTU בשיא, תעבורה והכרח לשדרג מוקדם | לבדוק Client loop, bot, CDN/WAF, preflight ו-telemetry לפי IP/UserAgent | עשוי למנוע שדרוג App/DB ולהקטין עשרות מיליוני קריאות — Estimate |
| מומלץ | `GetApprovedSongs` איטי ב-p95/p99 | חוויית משתמש ועומס DB | Query plan, pagination, projections ואינדקסים | זמן תגובה ועומס נמוכים יותר — Estimate |
| מומלץ | עותק SQL נוסף במסלול Basic | כ-$6.59/₪20.17 לחודש מלא | להחליט אם הוא גיבוי נחוץ ומה מדיניות מחזור החיים | עד כ-$6.59 לחודש — Estimate; אין למחוק ללא החלטה |
| מומלץ | זיכרון B1 סביב 80% | סיכון restart/latency בשיא | profiling, cache bounds, בדיקת logs/background services | דחיית scale-up — Estimate |
| כדאי בהמשך | מטמון זיכרון מקומי בלבד | כפילות DB בעת scale-out | cache משותף רק כאשר עוברים למספר מופעים | יעילות ועקביות ב-scale-out — Estimate |
| כדאי בהמשך | נפח יציאה גבוה מ-Blob | עלות עתידית וביצועים | לבדוק Cloudflare cache hit, TTL וגרסאות URL | הפחתת origin egress — Estimate |
| כדאי בהמשך | טבלאות View/Click גדלות ללא גבול ידוע | לחץ אחסון ואינדקסים עתידי | retention/aggregation/partitioning לאחר מדידה | דחיית מעבר SQL tier — Estimate |
| לא נדרש כרגע | מעבר Static Web App מ-Free | אין חיוב והאתר סטטי | להישאר עד שמגבלת 100GB/250MB או SLA נדרשת | $0 נשמר — Actual/Recommendation |

## Overprovisioning

- App Service אינו נראה גדול מדי: הזיכרון גבוה ולכן אין ראיה שהוא overprovisioned — **Actual/Calculated**.
- SQL בנפח גדול בהרבה מהשימוש, אך Basic הוא כבר מסלול הכניסה; אין מסלול קטן יותר רלוונטי בבדיקה — **Actual**.
- `AkordishKeitDB_Copy` הוא הכפילות הברורה היחידה ועלול להכפיל את עלות SQL — **Actual/Estimate**.
- Application Insights ו-Log Analytics עולים כרגע $0 — **Actual**; אין ראיה לעלות מיותרת.
- Blob בנפח קטן ובעלות זניחה — **Actual**; לא נראה overprovisioned.

## נתונים שלא ניתן היה לקבוע בוודאות

1. ספירת שורות, נפח Data/Index וגודל ממוצע בכל טבלה — **Unknown**; דורש התחברות SQL Authentication לקריאה בלבד.
2. שיוך 4.89K קבצי Blob לישות עסקית: משתמש/אמן/כתבה/נותן שירות — **Unknown**; דורש הצלבת URL מול DB.
3. מסלול Cloudflare, cache hit ratio, analytics, transformations וחיוב — **Unknown**; Google דורש השלמת סיסמה/אימות בחשבון `akordishkayt@gmail.com`.
4. מסלול Brevo, אנשי קשר, שליחות וחיוב — **Unknown**; דורש השלמת כניסה לחשבון.
5. עמלות Cardcom, שימוש YouTube ו-GitHub Actions — **Unknown**.
6. מספר משתמשים רשומים, פעילים חודשיים ומספר sessions — **Unknown**; אין להמיר בקשות API למשתמשים ללא analytics מהימן.
7. הסיבה המדויקת לגל כ-1.2M קריאות ויראליות — **Unknown**; נדרשת פילוח לפי IP/UserAgent/Session.

## מקורות הבדיקה

- Azure Portal: Cost Management, App Service, SQL Database, Storage, Static Web Apps, Application Insights ו-Log Analytics — נתוני Actual.
- קוד הפרויקט: `Program.cs`, `AkordishKeitDbContext.cs`, `ArticlesController.cs`, `ArticleService.cs`, `home-page.component.ts` וקבצי הקונפיגורציה — קריאה בלבד.
- [Microsoft — Azure SQL DTU tiers](https://learn.microsoft.com/en-us/azure/azure-sql/database/service-tiers-dtu?view=azuresql)
- [Microsoft — Azure App Service limits](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/azure-subscription-service-limits)
- [Microsoft — Static Web Apps quotas](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas)
- [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/)
- [Brevo pricing plans](https://help.brevo.com/hc/en-us/articles/208589409-About-Brevo-s-pricing-plans)
- [בנק ישראל — שערי חליפין](https://www.boi.org.il/roles/markets/exchangerates/)
