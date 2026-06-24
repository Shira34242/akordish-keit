import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';
import type { ArticleFormComponent } from '../components/admin/content/articles/article-form.component';

export const pendingArticleDraftGuard: CanDeactivateFn<ArticleFormComponent> = (
  component
): boolean | Observable<boolean> => component.canDeactivate();
