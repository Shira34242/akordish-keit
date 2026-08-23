import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService, User } from './auth.service';

export type ReminderKind = 'profile';

export interface ReminderRequest {
  kind: ReminderKind;
  user: User;
}

const DAYS_BEFORE_FIRST_REMINDER = 7;
const COOLDOWN_DAYS = 21;
const MAX_DISMISSALS = 3;

/**
 * שירות תזכורת רך — בודק האם להציג חלון "עוד כמה פרטים להשלמת החוויה באתר".
 * טופס אחד מאוחד לטלפון, עיר, כתובת, חודש+שנת לידה.
 * מופעל לאחר התחברות למשתמשים ותיקים שעדיין חסרים להם פרטים.
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

    if (daysSinceRegister === null) return null;
    if (daysSinceLastReminder !== null && daysSinceLastReminder < COOLDOWN_DAYS) return null;

    const missingAny = !user.phone?.trim() || !user.cityId || !user.address?.trim() || !user.birthDate;

    if (missingAny && daysSinceRegister >= DAYS_BEFORE_FIRST_REMINDER) {
      return 'profile';
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
