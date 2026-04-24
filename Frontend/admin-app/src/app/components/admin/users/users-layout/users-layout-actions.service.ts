import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminUsersLayoutActionsService {
  private readonly addArtistRequestSubject = new Subject<void>();
  readonly addArtistRequest$ = this.addArtistRequestSubject.asObservable();

  requestAddArtist(): void {
    this.addArtistRequestSubject.next();
  }
}
