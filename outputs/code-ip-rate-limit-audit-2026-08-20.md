# דוח אבחון קוד: זיהוי IP ו־Rate Limiting

תאריך: 20.08.2026  
היקף: קוד וקונפיגורציה במאגר בלבד. לא נבדקו דפדפן, Azure, Cloudflare או DNS. לא בוצע שינוי בקוד או בתשתית.

## ממצא מרכזי

האתר אינו מבטיח כיום זיהוי נכון של המשתמש המקורי לצורכי Rate Limiting.

אין בקוד UseForwardedHeaders, אין ForwardedHeadersOptions, ואין KnownProxies או KnownNetworks. לכן HttpContext.Connection.RemoteIpAddress מייצג את הצד שפתח את חיבור ה־TCP ל־ASP.NET. מאחורי Proxy זה בדרך כלל ה־hop האחרון לפני האפליקציה, ולא בהכרח הגולש.

נמצא גם ממצא חמור יותר מהחשש המקורי:

- analytics-tracking מחולק לפי RemoteIpAddress, ולכן אם הכתובת היא Proxy משתמשים רבים עלולים לחלוק bucket.
- autocomplete ו־songs אינם מחולקים לפי IP בכלל. AddFixedWindowLimiter יוצר limiter יחיד לכל policy בכל מופע של האפליקציה. כל הגולשים באותו מופע חולקים מכסה של 40 או 60 בקשות בדקה.

כלומר, ההערה ב־Program.cs שלפיה שני ה־limiters הם “per IP” אינה תואמת את המימוש.

## אימות התיקונים שכבר בוצעו

| תיקון | מצב בקוד העדכני |
|---|---|
| מניעת טעינה אוטומטית של עד 26 עמודי ויראלי | קיים: viralLoadArmed מאפשר trigger חדש רק לאחר שה־sentinel יצא מהטווח ונכנס שוב |
| IntersectionObserver יחיד | קיים: initViralObserver מחזיר מיד אם observer כבר קיים |
| הגנת בקשות כפולות | קיימת: loadingViralArticles |
| פג'ינציה | קיימת: page size 8, offset עד 200 בצד השרת |
| שיקום גלילה | עדיין יכול לטעון ברצף עד ה־offset השמור; זו פעולה מכוונת ולא הלולאה הישנה |
| שיפור שאילתת צפיות | קיים GroupJoin מול ArticleViews; אין N+1 ברמת כל כתבה |
| מטמון ויראלי | קיים מטמון זיכרון של 5 דקות לכל limit/offset |
| CORS preflight cache | קיים SetPreflightMaxAge של 24 שעות |
| Rate Limit לוויראלי | אינו קיים כרגע, בהתאם להסרה שתוארה |

## צינור ה־HTTP הנוכחי

הסדר המדויק ב־Program.cs:

1. Swagger ו־Swagger UI — רק Development.
2. ExceptionMiddleware.
3. UseSerilogRequestLogging.
4. UseHttpsRedirection.
5. UseCors עם AllowAngular.
6. UseStaticFiles.
7. UseRateLimiter.
8. UseAuthentication.
9. UseAuthorization.
10. MapControllers.

UseForwardedHeaders אינו קיים בשום מקום במאגר.

השלכות הסדר:

- Scheme ו־IP אינם מנורמלים לפני HTTPS redirection, logging או rate limiting.
- ה־rate limiter רץ לפני authentication, ולכן policy עתידי אינו יכול להעדיף User ID מאומת בלי לשנות סדר.
- CORS נמצא לפני ה־rate limiter. בקשות preflight שנחתכות ב־CORS אינן אמורות לצרוך את מכסות ה־controller.

## מצב ה־policies הקיימות

| Policy | Limit | Window | Partition בפועל | Endpoints | תקין מאחורי Proxy? | סיכון |
|---|---:|---:|---|---|---|---|
| analytics-tracking | 240 | דקה | RemoteIpAddress, או unknown | ארבע פעולות Analytics, ביקור קמפיין ופתיחת קישור קמפיין | לא מובטח | גבוה עסקית |
| autocomplete | 40 | דקה | bucket גלובלי יחיד לכל מופע | ארבע פעולות autocomplete | לא; כלל אינו per-IP | גבוה |
| songs | 60 | דקה | bucket גלובלי יחיד לכל מופע | GET /api/Songs | לא; כלל אינו per-IP | גבוה |
| ויראלי | אין | — | — | GET /api/Articles/home-viral-banners | — | אין הגנה ברמת endpoint |

בכל ה־policies התור הוא 0, ולכן הבקשה הראשונה מעל המכסה מקבלת 429 מיד.

### analytics-tracking

ה־policy חל במשותף על:

- POST /api/Analytics/event-view
- POST /api/Analytics/button-click
- POST /api/Analytics/browser-check
- POST /api/Analytics/page-view
- POST /api/MarketingCampaigns/track
- GET /api/MarketingCampaigns/open/{code}

כל הפעולות של אותה partition חולקות את אותן 240 הרשאות. אם RemoteIpAddress הוא כתובת Azure או Cloudflare משותפת, אירועי analytics של גולשים רבים יכולים לצרוך את המכסה ואף לגרום ל־429 בקישור שיווקי שאמור לבצע redirect. לכן קיימת גם פגיעה עסקית אפשרית בקמפיינים.

### autocomplete

ארבעת ה־endpoints חולקים יחד 40 בקשות בדקה בכל מופע. הקלדה של משתמשים שונים יכולה לצרוך את אותו חלון. זה יכול לגרום כבר כיום ל־429 לגולשים לגיטימיים.

חומרה: גבוהה מאוד. מומלץ לתקן בהקדם.

### songs

כל קריאות GET /api/Songs, כולל עמודים, חיפוש וסינון, חולקות 60 בקשות בדקה בכל מופע. תנועה רגילה או מספר גולשים במקביל יכולה לגרום 429.

חומרה: גבוהה מאוד. המטמון מפחית עומס DB בחלק מהשאילתות, אך אינו משנה את המכסה המשותפת.

### מגבלת צפייה יומית בשירים

קיים חישוב לפי User ID, ובמשתמש אנונימי לפי IP. עם זאת DailyViewLimitEnabled מוגדר כרגע false, ולכן הוא אוסף נתונים אך אינו חוסם. IP שגוי עדיין מעוות את הסטטיסטיקה, אך אינו גורם כרגע 429 מהמנגנון הזה.

## מסלול ה־IP

מהקוד ניתן להסיק:

    Browser
      → https://akordishkayt.com
      → https://api.akordishkayt.com
      → ASP.NET Core

הקוד משתמש ב־Cloudflare Image Resizing תחת /cdn-cgi/image, ולכן Cloudflare משמש לפחות עבור דומיין האתר ועיבוד תמונות. הקוד לבדו אינו מוכיח ש־api.akordishkayt.com מסומן כ־Proxied ב־Cloudflare.

אם ה־API אכן עובר כך:

    Browser → Cloudflare → Azure Front End → ASP.NET Core

אז Cloudflare רואה את IP הגולש, Azure מקבל חיבור מ־Cloudflare, ו־ASP.NET מקבל חיבור מה־hop האחרון של Azure. ללא middleware מהימן שמעבד forwarded headers, RemoteIpAddress נשאר כתובת ה־hop האחרון ולא IP הגולש.

סביבת הייצור יכולה להפעיל forwarded headers דרך הגדרת platform או environment שאינה נמצאת במאגר. לכן התשובה המדויקת לפי קוד בלבד היא:

RemoteIpAddress תלוי ב־topology ובהגדרות Azure. הקוד עצמו אינו מבטיח שהוא IP הגולש; בברירת המחדל של הקוד הוא כתובת החיבור הישיר, כלומר Proxy אם יש Proxy.

## כל השימושים ב־IP

### Rate limiting

- Program.cs: partition של analytics-tracking.

### Analytics וזיהוי מבקר

- AnalyticsController: page view, event view, button click ו־AdBlock check.
- MarketingCampaignsController: ביקור, הרשמה ולחיצה חיצונית.
- AdCampaignsController: צפייה ולחיצה במודעה.
- ArticlesController ו־ArticleService: צפיות ומשוב אנונימי.
- SongController ו־SongService: צפיות, סטטיסטיקה ומגבלה יומית כבויה.
- PodcastsController ו־PodcastService: צפייה בפרק.
- AuthController ו־ReferralService: שיוך הרשמה להפניה או קמפיין.

IP של Proxy במקומות אלה עלול לקבץ אורחים שונים, לשבש unique visitors ו־deduplication.

### Logging, audit ואבטחה תפעולית

- AuthController: לוגים של התחברות, הרשמה ואיפוס סיסמה.
- PaymentsController: לוגי התחלה, callback וחתימת תשלום.
- MediaController: לוגי העלאה ומחיקה.
- ReportsController: שמירת IP בדיווח תוכן ולוג audit.
- ClientErrorsController: לוג שגיאות Frontend.

ה־IP אינו קובע את אימות הסיסמה או את מספר ניסיונות קוד האיפוס; מנגנון האיפוס מחלק לפי כתובת המייל. לכן IP שגוי פוגע באיכות audit, אך אינו עוקף את בדיקת הסיסמה בקוד שנבדק.

## X-Akordish-Visitor-Id

ה־Frontend יוצר UUID באמצעות crypto.randomUUID, שומר אותו ב־localStorage, ומוסיף אותו לכל בקשת HTTP דרך auth-interceptor.ts.

בשרת AnalyticsIdentity.GetVisitorKey:

- מקבל כל UUID תקין שנשלח ב־header.
- מחזיר visitor:uuid.
- אם אין UUID תקין, נופל ל־User-Agent עד 500 תווים.

ה־ID אינו חתום, אינו מונפק על ידי השרת, ניתן לשינוי, וניתן לייצר ממנו מספר בלתי מוגבל. לכן הוא מתאים ל־analytics משוער, אך אינו זהות אבטחתית ואינו partition key בטוח בפני עצמו.

אפשר בעתיד להשתמש בו רק כשכבה משנית לשיפור הוגנות מאחורי NAT, לצד תקרה לפי IP מהימן ותקרה גלובלית. אין להחליף IP ב־Visitor ID בלבד.

## בעיית unknown

ב־analytics-tracking כל בקשה שבה RemoteIpAddress הוא null נכנסת לאותו bucket בשם unknown. זה מגן על השרת אך עלול לחסום יחד את כל הבקשות חסרות ה־IP.

בפועל, בחיבור TCP רגיל RemoteIpAddress בדרך כלל אינו null; הסיכון המרכזי הוא כתובת Proxy חוקית שמשותפת למשתמשים רבים.

Connection.Id ניתן לעקיפה באמצעות חיבורים חדשים, ו־Visitor ID ניתן לעקיפה באמצעות UUID חדש. ההמלצה היא fallback מפורש עם warning ומכסה שמרנית. בפעולות analytics ניתן להשמיט אירוע במקום לפגוע בפעולה עסקית. redirect שיווקי לא צריך לחלוק bucket עם telemetry.

## הפתרון המומלץ

### עיקרון

לנרמל את כתובת הלקוח לפני logging, HTTPS redirection, authentication ו־rate limiting, ורק על בסיס proxies שהמערכת נותנת בהם אמון.

אסור לנקות KnownNetworks ו־KnownProxies ואז לסמוך על כל X-Forwarded-For. אם ניתן לפנות ישירות ל־origin, לקוח יוכל לזייף IP.

### קבצים שיידרשו לשינוי

1. Program.cs — ForwardedHeadersOptions, שינוי policies וסדר middleware.
2. appsettings או environment configuration — רשתות ו־proxies מהימנים ו־ForwardLimit.
3. מומלץ helper מרכזי, למשל ClientIpResolver, כדי שכל controllers ישתמשו בזהות מנורמלת אחת.
4. בדיקות integration לשרשרת תקינה, header מזויף, IP חסר ו־IPv4-mapped IPv6.

### Forwarded Headers

- לעבד X-Forwarded-For.
- לעבד X-Forwarded-Proto.
- לא לעבד X-Forwarded-Host אם אין צורך.
- להגדיר KnownProxies ו־KnownNetworks רק ל־hops שיכולים להגיע ל־origin.
- להגדיר ForwardLimit למספר ה־hops האמיתי. Cloudflare ועוד Azure עשויים להיות שני hops, אך אין לקבע 2 לפני דגימת header אמיתי.
- לא להגדיר ForwardLimit ללא גבול.
- להשאיר RequireHeaderSymmetry כבוי עד שמוודאים שהשרשרת מוסיפה מספר סימטרי של ערכי X-Forwarded-For ו־X-Forwarded-Proto.

### סדר middleware מומלץ

    UseForwardedHeaders
    → אימות או נרמול Cloudflare, אם נדרש
    → ExceptionMiddleware
    → SerilogRequestLogging
    → UseHttpsRedirection
    → UseStaticFiles
    → UseRouting
    → UseCors
    → UseAuthentication
    → UseRateLimiter
    → UseAuthorization
    → MapControllers

העברת UseRateLimiter לאחר authentication מאפשרת partition לפי User ID מאומת כאשר יש משתמש מחובר, ו־IP מהימן כאשר אין.

### מבנה partition מומלץ

1. אם קיים User ID מאומת: user:id.
2. אחרת, אם קיים IP מנורמל ומהימן: ip:address.
3. אחרת: fallback מפורש עם logging ומכסה שמרנית.

יש לנרמל IPv4-mapped IPv6 כדי שאותו לקוח לא יקבל שתי partitions שונות.

### Cloudflare: XFF או CF-Connecting-IP

מועדף להשתמש ב־Forwarded Headers הסטנדרטי, בתנאי שניתן להגדיר ולתחזק את שרשרת ה־proxies המהימנה.

CF-Connecting-IP יכול להיות מדויק, אך רק אם ה־origin מקבל תעבורה רק מטווחי Cloudflare, או אם middleware הוכיח שהבקשה עברה דרך Cloudflare מהימן. אסור לקרוא את ה־header ישירות מכל בקשה; אחרת תוקף יכול לזייף אותו.

כאשר Azure הוא ה־hop הישיר ל־Kestrel, ייתכן שיידרש תהליך דו־שלבי:

1. אמון מוגבל ב־proxy של Azure כדי להגיע לכתובת Cloudflare שבשרשרת.
2. אימות שה־hop הוא בטווח Cloudflare, ורק אז שימוש ב־CF-Connecting-IP או המשך עיבוד XFF.

את הבחירה המדויקת אי אפשר לסגור מהקוד בלבד ללא דגימת headers ו־remote address בפועל.

## Rate Limit לוויראלי

לאחר תיקון ובדיקת זיהוי ה־IP ניתן להחזיר limiter ממוקד ל־GET /api/Articles/home-viral-banners.

150 בקשות בדקה לכל IP אמיתי יהיה בטוח לגולש רגיל, אך הוא נדיב מאוד והגנתו מפני loop או bot יחיד חלשה.

לפי הקוד, page size הוא 8, offset מוגבל ל־200, ושיקום גלילה יכול לטעון עד כ־25 עמודים ברצף. לכן ההמלצה היא להתחיל ב־60 בקשות בדקה לכל User ID או IP מהימן, בלי queue, ולנטר 429. המספר 150 אפשרי כ־guardrail עדין, אך פחות אפקטיבי.

מומלצת גם תקרה גלובלית נפרדת להגנת המופע, משום ש־limiter לפי IP אינו עוצר bot מבוזר. אם Cloudflare proxy פעיל עבור ה־API, Rate Limiting ב־Cloudflare עדיף כשכבת קצה, אך אינו מחליף תיקון IP באפליקציה לצורכי analytics ו־audit.

## המלצה לכל policy

| Policy | מצב מומלץ | תיקון נדרש | דחיפות |
|---|---|---|---|
| analytics-tracking | אפשר זמנית, עם סיכון | IP מהימן; להפריד open/{code} מ־telemetry; User ID קודם | גבוהה |
| autocomplete | לא להשאיר לטווח ארוך במבנה הגלובלי | להמיר ל־AddPolicy עם partition אמיתי | גבוהה מאוד |
| songs | לא להשאיר לטווח ארוך במבנה הגלובלי | להמיר ל־AddPolicy עם partition אמיתי | גבוהה מאוד |
| ויראלי | ללא limiter עד תיקון זהות, או שכבת Cloudflare | לאחר תיקון: 60 לדקה מומלץ; 150 הוא guardrail חלש | גבוהה |

## מה דורש מידע חיצוני

1. האם api.akordishkayt.com מסומן Proxied ב־Cloudflare או DNS-only.
2. האם ניתן לפנות ישירות ל־hostname של Azure ולעקוף Cloudflare.
3. האם Azure Access Restrictions מאפשרים רק Cloudflare.
4. מה RemoteIpAddress בפועל ב־Production.
5. הערכים והסדר בפועל של X-Forwarded-For, X-Forwarded-Proto ו־CF-Connecting-IP.
6. האם מוגדר ב־App Service משתנה כמו ASPNETCORE_FORWARDEDHEADERS_ENABLED.
7. כמה hops יש ומה טווחי ה־IP של ה־hop הישיר של Azure.
8. כיצד מתוחזקים טווחי Cloudflare.
9. כמה תגובות 429 כבר נרשמו לכל policy.

## מסקנה מעשית

נדרשים שני תיקונים נפרדים לפני החזרת limiter לוויראלי:

1. לתקן את זהות הלקוח באמצעות שרשרת proxies מהימנה, בלי אמון עיוור ב־headers.
2. לתקן את ה־policies: autocomplete ו־songs גלובליים כיום, ו־analytics-tracking עלול להתאחד לפי כתובת Proxy.

לאחר אימות ה־topology וה־header chain, אפשר לבצע פתרון ממוקד ב־Program.cs, helper מרכזי ובדיקות, ואז להחזיר limiter של 60 לדקה לוויראלי ולנטר 429 לפני הקשחה נוספת.
