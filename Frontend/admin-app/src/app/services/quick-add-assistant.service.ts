import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export type QuickAddEntryPoint = 'root' | 'index';

@Injectable({
  providedIn: 'root'
})
export class QuickAddAssistantService {
  private readonly openRequests = new Subject<QuickAddEntryPoint>();

  readonly openRequests$ = this.openRequests.asObservable();

  requestOpen(entryPoint: QuickAddEntryPoint = 'root'): void {
    this.openRequests.next(entryPoint);
  }
}
