# PROJECT_ARCHITECTURE

## Architecture Overview

הפרויקט מחולק לשני חלקים ראשיים:

- `Frontend/admin-app` - אפליקציית Angular אחת שמשרתת גם את האתר הציבורי וגם את ממשק הניהול.
- `Backend/AdminTest` - שרת ASP.NET Core עם REST API, לוגיקה עסקית, Entity Framework Core וחיבור ל-SQL Server.

המערכת בנויה כאתר תוכן ומדיה עם כמה תחומים מרכזיים:

- שירים ואקורדים
- אמנים
- כתבות וחדשות
- מורים ובעלי מקצוע
- פלייליסטים
- מנויים
- פרסום
- ניהול מערכת

הזרימה הכללית היא:

Frontend Components -> Angular Services -> HTTP API -> Controllers -> Services -> DbContext -> SQL Server

## Frontend Structure

המבנה הראשי של צד הלקוח:

- `Frontend/admin-app/src/app/app.routes.ts`
  מגדיר את כל ה-routes הציבוריים והניהוליים.

- `Frontend/admin-app/src/app/components/layout`
  שלד האתר הציבורי: header, footer, FAB, מודלים גלובליים ו-`router-outlet`.

- `Frontend/admin-app/src/app/components/shared`
  רכיבים משותפים שחוזרים בהרבה מקומות, כמו:
  - `song-card`
  - `article-card`
  - `news-banner`
  - `pagination`
  - `carousel`
  - `artist-circle`

- `Frontend/admin-app/src/app/components`
  דפי האתר הציבוריים והדפים המיוחדים, כמו:
  - `home-page`
  - `song-page`
  - `chords-page`
  - `artist-detail`
  - `news/article-view`
  - `news/blog-post-view`
  - `playlists-page`
  - `public/*`

- `Frontend/admin-app/src/app/components/admin`
  כל אזור הניהול:
  - משתמשים
  - מורים
  - אמנים
  - תוכן
  - פרסום
  - טבלאות מערכת

- `Frontend/admin-app/src/app/services`
  שכבת חיבור לשרת ושירותי מצב משותף.

- `Frontend/admin-app/src/app/models`
  מודלים ו-DTOs לתצוגה ולעבודה מול ה-API.

- `Frontend/admin-app/src/styles.css`
  משתני עיצוב גלובליים: טיפוגרפיה, ריווח ובסיס ויזואלי.

מאפיינים טכניים עיקריים ב-Frontend:

- Angular 20
- `standalone components`
- `provideRouter`
- `provideHttpClient` עם interceptors
- שימוש ב-RxJS דרך `BehaviorSubject`, `Subject`, `Observable`
- אין store מרכזי כמו NgRx

## Backend Structure

המבנה הראשי של צד השרת:

- `Backend/AdminTest/Program.cs`
  הגדרת השרת, Authentication, Authorization, CORS, Swagger, DI ו-static files.

- `Backend/AdminTest/Controllers`
  שכבת ה-API לפי תחום, למשל:
  - `SongsController`
  - `ArticlesController`
  - `ArtistsController`
  - `AuthController`
  - `TeachersController`
  - `MusicServiceProvidersController`
  - `PlaylistsController`
  - `SubscriptionsController`
  - `AdCampaignsController`
  - `AdSpotsController`

- `Backend/AdminTest/Services`
  הלוגיקה העסקית הראשית. ה-services מחזיקים חלק גדול מהחוקים בפועל.

- `Backend/AdminTest/Data/AkordishKeitDbContext.cs`
  מרכז את ה-DbSets והקונפיגורציה של EF Core.

- `Backend/AdminTest/Data/Configurations`
  מיפוי ישויות לטבלאות ויחסים.

- `Backend/AdminTest/Models/Entities`
  הישויות העסקיות של המערכת.

- `Backend/AdminTest/Models/DTOs`
  מבני נתונים להחזרת תגובות ולקבלת בקשות.

- `Backend/AdminTest/Migrations`
  היסטוריית שינויים למסד הנתונים.

- `Backend/AdminTest/wwwroot/uploads`
  אחסון קבצי מדיה שהמערכת מגישה.

מאפיינים טכניים עיקריים ב-Backend:

- ASP.NET Core Web API
- Entity Framework Core
- SQL Server
- JWT Authentication
- Cookies + CSRF
- Hosted background service (`CleanupService`)

## UI Patterns

דפוסי הממשק המרכזיים שחוזרים במערכת:

- Header קבוע עם RTL, ניווט pill, אזור משתמש ותפריט נייד.
- Hero גדול עם התכווצות בגלילה, במיוחד בדף הבית ובדף שיר.
- כרטיסים אפורים מעוגלים עם hierarchy ברור של תמונה, כותרת וטקסט משני.
- כפתורי pill וכפתורי אייקון עגולים.
- באנרי חדשות עם תמונת רקע מלאה וטקסט על שכבת כהות.
- FAB קבוע לפעולות יצירה והוספת תוכן.
- מודלים קצרים לפעולות כמו התחברות, דיווח, יצירה ועריכה.
- דפי תוכן בנויים מ-stacks של sections עם ריווח קבוע.

רכיבים משותפים עיקריים:

- `components/shared/song-card`
- `components/shared/article-card`
- `components/shared/news-banner`
- `components/shared/pagination`
- `components/shared/carousel`
- `components/shared/artist-circle`

## Design System

יש מערכת עיצוב מוגדרת במסמכים וגם מיושמת חלקית בקוד.

עקרונות העיצוב המרכזיים:

- RTL בכל מקום
- פלטת צבעים מצומצמת:
  - `#ffffff`
  - `#000000`
  - `#ddff53`
  - `#F2F2F2`
  - `#404040`
- פינות מעוגלות
- כפתורי pill
- טיפוגרפיה דרך משתני `--font-*`
- ריווחים דרך משתני `--space-*`

מיקום בפועל:

- `Frontend/admin-app/src/styles.css`
  מחזיק את משתני הטיפוגרפיה והריווח.

חשוב:

- יש התאמה טובה יחסית לשפת העיצוב בחלקים המרכזיים.
- יש גם חריגות בקבצים מסוימים, למשל שימוש בגרדיאנטים וחזרות ידניות של צבעים וריווחים.
- המערכת היא לא design system כ-library סגור, אלא סט חוקים ומשתנים גלובליים עם CSS מקומי בכל רכיב.

## Routing

הניתוב מרוכז ב:

- `Frontend/admin-app/src/app/app.routes.ts`

העץ הראשי מחולק כך:

- Public routes תחת `LayoutComponent`
- Admin routes תחת `AdminLayoutComponent`

דוגמאות ל-routes ציבוריים:

- `/`
- `/song/:id`
- `/chords`
- `/music-news`
- `/articles`
- `/news/:slug`
- `/blog/:slug`
- `/artists`
- `/artist/:id`
- `/professionals`
- `/teacher/:id`
- `/playlist/:id`

דוגמאות ל-routes ניהוליים:

- `/admin/users`
- `/admin/teachers`
- `/admin/artists`
- `/admin/content/articles`
- `/admin/content/songs`
- `/admin/content/events`
- `/admin/advertising`
- `/admin/system`

מאפייני ניתוב:

- שימוש ב-`loadComponent` בחלק מהמסכים
- `authGuard` לכניסה למסכים שמצריכים משתמש מחובר
- `adminGuard` לכניסה למסכי ניהול

## State Management

אין במערכת store מרכזי כמו NgRx.

הגישה בפועל:

- מצב מקומי בתוך כל component
- מצב משותף קטן דרך services עם `BehaviorSubject` ו-`Subject`
- שמירה ב-`localStorage` לזרימות מסוימות

שירותי מצב עיקריים:

- `auth.service.ts`
  מצב משתמש מחובר, בקשת login, returnUrl ו-CSRF.

- `modal.service.ts`
  מצב פתיחה/סגירה של מודל הוספת שיר ו-notify לעדכונים.

- `artist-page.service.ts`
  בעלות על דף אמן ו-trigger לעריכה.

- `content-page.service.ts`
  שמירת מזהה כתבה נוכחית.

שימושים ב-`localStorage`:

- `currentUser`
- `csrf-token`
- בחירת מנוי
- `pendingProfessionalType`
- recently viewed songs
- מעקב אחרי פרסומות שנצפו ונלחצו

מסקנה:

- המצב פשוט וישיר.
- אין שכבה אחידה אחת לכל מצב האפליקציה.
- שינויים לוגיים בזרימות התחברות, מנוי או יצירת פרופיל עלולים להשפיע על כמה מסכים יחד.

## API Communication

ה-Frontend מתקשר לשרת דרך Angular services עם `HttpClient`.

דפוס העבודה:

- לכל תחום יש service משלו
- ה-service מחזיק `apiUrl`
- ה-component צורך Observable ומרנדר תוצאה

שירותי API בולטים:

- `song.service.ts`
- `artist.service.ts`
- `teacher.service.ts`
- `music-service-provider.service.ts`
- `playlist.service.ts`
- `subscription.service.ts`
- `search.service.ts`
- `services/admin/*`

אבטחה ותקשורת:

- JWT נשמר ב-cookie `httpOnly`
- ה-Frontend שולח `withCredentials: true`
- CSRF token נשמר גם ב-`localStorage`
- `auth-interceptor` מוסיף cookie credentials ו-header ל-CSRF
- `error.interceptor` מטפל בשגיאות, logout ו-login flow

הערה חשובה:

- כתובות ה-API ב-Frontend קשיחות ל-`https://localhost:44395`
- כרגע אין שכבת environment מסודרת לכל השירותים

## Protected Areas

לפי כללי הפרויקט, האזורים המוגנים הם:

- דף אמן
- דף שיר בתצוגת אקורדים
- דף כתבה / חדשות
- ה-header העליון

וגם כל הדפוסים שנגזרים מהם:

- Hero behavior
- Song cards
- News banner cards
- Gallery patterns
- Button system
- Layout behavior

אזורים וקבצים רגישים במיוחד:

- `Frontend/admin-app/src/app/components/layout/*`
- `Frontend/admin-app/src/app/components/song-page/*`
- `Frontend/admin-app/src/app/components/artist-detail/*`
- `Frontend/admin-app/src/app/components/news/article-view/*`
- `Frontend/admin-app/src/app/components/news/blog-post-view/*`
- `Frontend/admin-app/src/app/components/shared/song-card/*`
- `Frontend/admin-app/src/app/components/shared/news-banner/*`

כלל עבודה:

- אין לשנות להם את מבנה הדסקטופ בלי אישור.
- מותר רק יישור לכללים, ניקוי קוד ושיפורי responsive דרך media queries.

## Rebuild Areas

כל שאר המערכת נחשבת אזור `Rebuild`, כלומר מותרת בנייה מחדש לפי כללי העיצוב, כל עוד נשמר RTL ומשתמשים בדפוסים הקיימים.

בפועל זה כולל בדרך כלל:

- דף הבית
- רשימות אמנים
- רשימות כתבות
- עמודי אינדקס ותוצאות
- מורים ובעלי מקצוע
- פלייליסטים
- רוב דפי הניהול
- טפסי יצירה והגשה
- אזורי פרסום וניהול מערכת

כלל עבודה:

- בונים קודם דסקטופ נכון
- אחר כך מתאימים לטאבלט
- אחר כך לנייד
- לא ממציאים שפה חדשה, אלא נשענים על הכרטיסים, הכפתורים והמבנה שכבר קיימים

## Risks

### 1. Risk To Protected UI

הסיכון הכי גדול הוא לפגוע באזורים המוגנים:

- header
- song page
- artist page
- article/news pages

גם שינוי קטן ב-layout, היררכיה או spacing שם יכול לשבור מסך reference.

### 2. CSS Consistency Risk

מערכת העיצוב קיימת, אבל לא נאכפת ממקום אחד בלבד.

בפועל יש:

- משתנים גלובליים
- CSS מקומי בכל רכיב
- חזרות ידניות של צבעים וריווחים

כלומר שינוי עיצובי עלול להיראות נכון במסך אחד ולא אחיד במסך אחר.

### 3. Hardcoded API URLs

רוב שירותי ה-Frontend משתמשים בכתובת קשיחה:

- `https://localhost:44395`

זה מגדיל סיכון בשינוי סביבה, פורט או deployment.

### 4. State Flow Risk

זרימות רבות נשענות על:

- `BehaviorSubject`
- `localStorage`
- state מקומי במסכים

שינוי לוגי ב-auth, subscription או profile creation עלול להשפיע על כמה שלבים באותה שרשרת.

### 5. Service Layer Complexity

ב-Backend חלק גדול מהלוגיקה יושב ב-services ארוכים יחסית.

שינוי DTO, entity או כלל עסקי אחד עלול להשפיע על:

- Controller
- Service
- Frontend model
- כמה מסכים ב-UI

### 6. Security / Secrets Risk

בקובץ `Backend/AdminTest/appsettings.json` קיימים ערכים רגישים כמו:

- JWT key
- YouTube API key
- Cloudinary credentials

זה סיכון תפעולי ואבטחתי חשוב.

### 7. Mixed Visual Compliance

למרות חוקי העיצוב, יש אזורים במערכת עם חריגות:

- גרדיאנטים
- סגנונות פחות אחידים
- שימוש חלקי בלבד במשתנים

לכן בכל שינוי ויזואלי צריך לבדוק גם:

- התאמה למסמך הכללים
- התאמה למסכים המוגנים
- התאמה לדפוסים הקיימים בפועל

## Final Notes

זהו מסמך מיפוי ארכיטקטוני ברמת עבודה.

הוא מתאים במיוחד ל:

- התמצאות מהירה בפרויקט
- זיהוי אזורים רגישים לפני שינוי
- הבחנה בין Protected ל-Rebuild
- הבנת מבנה Frontend / Backend / API

המסמך לא משנה קוד ולא משנה התנהגות מערכת.
