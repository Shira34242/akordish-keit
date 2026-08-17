import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NavigationIntentService {
  private trigger = 'imperative';

  setTrigger(trigger: string | undefined): void {
    this.trigger = trigger ?? 'imperative';
  }

  get isHistoryNavigation(): boolean {
    return this.trigger === 'popstate';
  }
}
