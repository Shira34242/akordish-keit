import { CanDeactivateFn } from '@angular/router';
import { V2DesignStepComponent } from '../components/admin/email-campaign-v2/v2-design-step.component';

export const unsavedDesignChangesGuard: CanDeactivateFn<V2DesignStepComponent> = (
  component,
): boolean | Promise<boolean> => component.canDeactivate();
