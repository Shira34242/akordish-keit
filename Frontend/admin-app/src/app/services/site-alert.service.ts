import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface SiteAlert {
  id: number;
  message: string;
}

export interface SiteConfirm {
  id: number;
  message: string;
  resolve: (confirmed: boolean) => void;
}

@Injectable({
  providedIn: 'root'
})
export class SiteAlertService {
  private nextId = 1;
  private nextConfirmId = 1;
  private isPatched = false;
  private readonly alertsSubject = new Subject<SiteAlert>();
  private readonly confirmsSubject = new Subject<SiteConfirm>();

  readonly alerts$ = this.alertsSubject.asObservable();
  readonly confirms$ = this.confirmsSubject.asObservable();

  show(message: unknown): void {
    this.alertsSubject.next({
      id: this.nextId++,
      message: String(message ?? '')
    });
  }

  confirm(message: unknown): Promise<boolean> {
    return new Promise(resolve => {
      this.confirmsSubject.next({
        id: this.nextConfirmId++,
        message: String(message ?? ''),
        resolve
      });
    });
  }

  patchBrowserAlerts(): void {
    if (this.isPatched || typeof window === 'undefined') {
      return;
    }

    this.isPatched = true;
    window.alert = (message?: unknown): void => {
      this.show(message);
    };
  }
}
