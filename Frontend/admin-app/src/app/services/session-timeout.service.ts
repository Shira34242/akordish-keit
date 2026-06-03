import { Injectable, NgZone } from '@angular/core';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { fromEvent, merge, Subject } from 'rxjs';
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
  private readonly IDLE_TIME = 30 * 60 * 1000;

  private idleTimer: any;
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
    let listenersActive = false;
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.setupIdleTimer();
        if (!listenersActive) {
          listenersActive = true;
          this.setupActivityListeners();
        }
      } else {
        listenersActive = false;
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

    this.ngZone.runOutsideAngular(() => {
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
  }

  /**
   * מקשיב לפעילות משתמש (עכבר, קליקים, הקלדה)
   */
  private setupActivityListeners() {
    this.ngZone.runOutsideAngular(() => {
      const events = [
        fromEvent(document, 'mousemove'),
        fromEvent(document, 'mousedown'),
        fromEvent(document, 'keypress'),
        fromEvent(document, 'touchstart'),
        fromEvent(document, 'scroll')
      ];

      merge(...events)
        .pipe(
          debounceTime(1000),
          takeUntil(this.destroy$)
        )
        .subscribe(() => {
          this.resetIdleTimer();
        });
    });
  }

  private logout() {
    sessionStorage.setItem('session_expired', '1');
    this.authService.logout();
    this.router.navigate(['/']);
    this.stopWatching();
  }

  /**
   * מאפשר למשתמש להאריך את ה-session באופן ידני
   * (אפשר לקרוא למתודה הזו מכפתור בממשק)
   */
  extendSession() {
    this.resetIdleTimer();
  }
}
