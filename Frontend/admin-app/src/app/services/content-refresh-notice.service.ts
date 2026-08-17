import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ContentRefreshNoticeService {
  readonly message$ = new BehaviorSubject<string | null>(null);

  show(): void {
    this.message$.next('יש תוכן חדש שמחכה לכם. אפשר לרענן כדי לראות אותו.');
  }

  dismiss(): void {
    this.message$.next(null);
  }
}
