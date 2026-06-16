import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';
import type { ArtistCreateComponent } from '../components/artist-create/artist-create.component';

export const pendingArtistDraftGuard: CanDeactivateFn<ArtistCreateComponent> = (
  component
): boolean | Observable<boolean> => component.canDeactivate();
