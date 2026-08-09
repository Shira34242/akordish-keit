import { CanDeactivateFn } from '@angular/router';

interface UnsavedEmailAwareComponent {
  canDeactivate(): boolean | Promise<boolean>;
}

export const unsavedEmailChangesGuard: CanDeactivateFn<UnsavedEmailAwareComponent> = (
  component,
): boolean | Promise<boolean> => component.canDeactivate();
