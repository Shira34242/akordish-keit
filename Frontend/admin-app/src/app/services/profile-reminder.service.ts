import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService, User } from './auth.service';

export type ReminderKind = 'contact' | 'birthday';

export interface ReminderRequest {
  kind: ReminderKind;
  user: User;
}

const DAYS_BEFORE_FIRST_REMINDER = 3;
const DAYS_BEFORE_BIRTHDAY_REMINDER = 14;
const COOLDOWN_DAYS = 14;
const MAX_DISMISSALS = 3;

/**
 * שירות תזכורת רך — בודק האם להציג חלון "כמה פרטים נוספים".
 * מופעל לאחר התחברות / ניווט בתוך האתר.
 *
 * תזמון:
 * - תזכורת ליצירת קשר (טלפון + עיר): אחרי 3 ימים מהרשמה.
 * - תזכורת ליום הולדת: אחרי 14 ימים מהרשמה (אם תזכורת קודמת כבר ניתנה / הושלמה).
 * - cooldown של 14 יום בין תזכורות.
 * - מקסימום 3 דחיות — אחרי זה לא נציג עוד.
 */
@Injectable({ providedIn: 'root' })
export class ProfileReminderService {
  private requestSubject = new BehaviorSubject<ReminderRequest | null>(null);
  public request$: Observable<ReminderRequest | null> = this.requestSubject.asObservable();

  private hasCheckedThisSession = false;

  constructor(private authService: AuthService) {}

  /** קוראים לזה אחרי login / ניווט. בודק פעם אחת לסשן. */
  checkAndShow(): void {
    if (this.hasCheckedThisSession) return;

    const user = this.authService.currentUserValue;
    if (!user) return;

    const kind = this.computeKindToShow(user);
    if (!kind) return;

    this.hasCheckedThisSession = true;
    this.requestSubject.next({ kind, user });
  }

  /** סגירת המודל בלי לשמור (דחייה) — נספר ב-Backend נפרד דרך AuthService */
  clearRequest(): void {
    this.requestSubject.next(null);
  }

  /** איפוס ידני — שימושי לבדיקות */
  resetSessionFlag(): void {
    this.hasCheckedThisSession = false;
  }

  private computeKindToShow(user: User): ReminderKind | null {
    if ((user.profileReminderDismissCount ?? 0) >= MAX_DISMISSALS) return null;

    const daysSinceRegister = this.daysSince(user.createdAt);
    const daysSinceLastReminder = this.daysSince(user.lastProfileReminderAt);

    // cooldown
    if (daysSinceLastReminder !== null && daysSinceLastReminder < COOLDOWN_DAYS) return null;

    const missingContact = !user.phone || !user.cityId;
    const missingBirthday = !user.birthDate;

    // תזכורת ראשונה (טלפון + עיר) — אחרי 3 ימים מהרשמה
    if (missingContact && (daysSinceRegister === null || daysSinceRegister >= DAYS_BEFORE_FIRST_REMINDER)) {
      return 'contact';
    }

    // תזכורת יום הולדת — אחרי 14 ימים, אם פרטי קשר כבר קיימים
    if (missingBirthday && (daysSinceRegister === null || daysSinceRegister >= DAYS_BEFORE_BIRTHDAY_REMINDER)) {
      return 'birthday';
    }

    return null;
  }

  private daysSince(isoDate: string | null | undefined): number | null {
    if (!isoDate) return null;
    const then = new Date(isoDate).getTime();
    if (Number.isNaN(then)) return null;
    const now = Date.now();
    return Math.floor((now - then) / (1000 * 60 * 60 * 24));
  }
}
