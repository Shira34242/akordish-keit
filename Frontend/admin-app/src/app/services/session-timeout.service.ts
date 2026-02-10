import { Injectable, NgZone } from '@angular/core';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { fromEvent, merge, Subject, timer } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

/**
 * Session Timeout Service - מנתק משתמשים אוטומטית אחרי חוסר פעילות
 *
 * מה השירות עושה:
 * 1. עוקב אחרי פעילות המשתמש (עכבר, קליקים, הקלדה)
 * 2. אם המשתמש לא פעיל במשך 30 דקות - מנתק אותו אוטומטית
 * 3. 2 דקות לפני הניתוק - מציג אזהרה
 * 4. המשתמש יכול ללחוץ "המשך" להישאר מחובר
 *
 * למה זה חשוב?
 * - אבטחה: למנוע שימוש לא מורשה במחשב משותף
 * - בטיחות: מגן על חשבונות משתמשים במקרים שהם שוכחים להתנתק
 */
@Injectable({
  providedIn: 'root'
})
export class SessionTimeoutService {
  // ⏱️ הגדרות זמן
  private readonly IDLE_TIME = 30 * 60 * 1000; // 30 דקות במילישניות
  private readonly WARNING_TIME = 2 * 60 * 1000; // 2 דקות אזהרה לפני ניתוק

  private idleTimer: any;
  private warningTimer: any;
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private router: Router,
    private ngZone: NgZone
  ) {}

  /**
   * מתחיל לעקוב אחרי פעילות המשתמש
   */
  startWatching() {
    // עוקב רק אם המשתמש מחובר
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.setupIdleTimer();
        this.setupActivityListeners();
      } else {
        this.stopWatching();
      }
    });
  }

  /**
   * מפסיק לעקוב (למשל אחרי logout)
   */
  stopWatching() {
    this.clearTimers();
    this.destroy$.next();
  }

  /**
   * מגדיר את ה-Idle Timer - טיימר שעובד כל הזמן
   */
  private setupIdleTimer() {
    this.resetIdleTimer();
  }

  /**
   * מאפס את הטיימר (קורה כל פעם שהמשתמש פעיל)
   */
  private resetIdleTimer() {
    this.clearTimers();

    // NgZone.runOutsideAngular - מריץ את הטיימרים מחוץ לזיהוי השינויים של Angular
    // כדי לחסוך בביצועים
    this.ngZone.runOutsideAngular(() => {
      // טיימר אזהרה - 28 דקות (30 דקות פחות 2 דקות אזהרה)
      this.warningTimer = setTimeout(() => {
        this.ngZone.run(() => {
          this.showWarning();
        });
      }, this.IDLE_TIME - this.WARNING_TIME);

      // טיימר ניתוק - 30 דקות
      this.idleTimer = setTimeout(() => {
        this.ngZone.run(() => {
          this.logout();
        });
      }, this.IDLE_TIME);
    });
  }

  /**
   * מנקה את כל הטיימרים
   */
  private clearTimers() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
    }
  }

  /**
   * מקשיב לפעילות משתמש (עכבר, קליקים, הקלדה)
   */
  private setupActivityListeners() {
    // מאזינים לכל האירועים שמעידים על פעילות
    const events = [
      fromEvent(document, 'mousemove'),
      fromEvent(document, 'mousedown'),
      fromEvent(document, 'keypress'),
      fromEvent(document, 'touchstart'),
      fromEvent(document, 'scroll')
    ];

    // משתמשים ב-merge כדי לאחד את כל האירועים
    // debounceTime - מחכה 1 שנייה אחרי האירוע האחרון לפני שמאפס
    // (כדי לא לאפס את הטיימר בכל תנועת עכבר קטנה)
    merge(...events)
      .pipe(
        debounceTime(1000),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.resetIdleTimer();
      });
  }

  /**
   * מציג אזהרה למשתמש 2 דקות לפני ניתוק
   */
  private showWarning() {
    const continueSession = confirm(
      '⚠️ אזהרה!\n\n' +
      'בעוד 2 דקות תתנתק אוטומטית בגלל חוסר פעילות.\n\n' +
      'לחץ "אישור" להמשיך להיות מחובר.\n' +
      'לחץ "ביטול" להתנתק עכשיו.'
    );

    if (continueSession) {
      // המשתמש רוצה להישאר - מאפסים את הטיימר
      this.resetIdleTimer();
      console.log('Session extended by user');
    } else {
      // המשתמש בחר להתנתק
      this.logout();
    }
  }

  /**
   * מנתק את המשתמש אוטומטית
   */
  private logout() {
    console.warn('Session timeout - logging out user');

    // הצגת הודעה
    alert('התנתקת אוטומטית בגלל חוסר פעילות.');

    // ניתוק המשתמש
    this.authService.logout();

    // ניתוב לדף הבית
    this.router.navigate(['/']);

    // עצירת המעקב
    this.stopWatching();
  }

  /**
   * מאפשר למשתמש להאריך את ה-session באופן ידני
   * (אפשר לקרוא למתודה הזו מכפתור בממשק)
   */
  extendSession() {
    this.resetIdleTimer();
    console.log('Session manually extended');
  }
}
