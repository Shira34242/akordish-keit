import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RouteReuseEventsService {
  readonly attached$ = new Subject<string>();

  notifyAttached(key: string): void {
    this.attached$.next(key);
  }
}
