import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ArtistPageService {
  private ownerIdSubject = new BehaviorSubject<number | null>(null);
  ownerId$ = this.ownerIdSubject.asObservable();

  private editTriggerSubject = new Subject<void>();
  editTrigger$ = this.editTriggerSubject.asObservable();

  setOwnerId(userId: number | null): void {
    this.ownerIdSubject.next(userId);
  }

  triggerEdit(): void {
    this.editTriggerSubject.next();
  }
}
