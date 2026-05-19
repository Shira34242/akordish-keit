import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminUsersLayoutActionsService {
  private readonly addArtistRequestSubject = new Subject<void>();
  readonly addArtistRequest$ = this.addArtistRequestSubject.asObservable();

  private readonly addTeacherRequestSubject = new Subject<void>();
  readonly addTeacherRequest$ = this.addTeacherRequestSubject.asObservable();

  private readonly addServiceProviderRequestSubject = new Subject<void>();
  readonly addServiceProviderRequest$ = this.addServiceProviderRequestSubject.asObservable();

  requestAddArtist(): void {
    this.addArtistRequestSubject.next();
  }

  requestAddTeacher(): void {
    this.addTeacherRequestSubject.next();
  }

  requestAddServiceProvider(): void {
    this.addServiceProviderRequestSubject.next();
  }
}
