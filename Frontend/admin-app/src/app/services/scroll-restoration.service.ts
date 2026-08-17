import { Injectable, OnDestroy } from '@angular/core';
import { NavigationStart, Scroll, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NavigationIntentService } from './navigation-intent.service';
import { RouteReuseEventsService } from './route-reuse-events.service';

type ScrollPosition = [number, number];

/**
 * Extends Angular's native back/forward restoration. Angular owns history and
 * the original scroll position; pages only tell this service when their async
 * content is tall enough to restore that position accurately.
 */
@Injectable({ providedIn: 'root' })
export class ScrollRestorationService implements OnDestroy {
  private readonly viewStateKey = '__akordishViewState';
  private pending: { url: string; position: ScrollPosition } | null = null;
  private restoreFrame?: number;
  private restoreAfterAttach = false;
  private readonly subscription: Subscription;

  constructor(
    private readonly router: Router,
    private readonly navigationIntent: NavigationIntentService,
    routeReuseEvents: RouteReuseEventsService
  ) {
    // Prevent the browser and Angular from showing an early, incomplete restore.
    // RouterScroller still emits the saved position, which we restore once the
    // destination page has rendered its required content.
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    routeReuseEvents.attached$.subscribe(() => this.restoreAfterAttach = true);

    this.subscription = this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.navigationIntent.setTrigger(event.navigationTrigger);
        return;
      }
      if (!(event instanceof Scroll)) return;
      this.stopPendingRestore();
      if (event.position) {
        this.pending = { url: this.router.url, position: event.position };
        if (this.restoreAfterAttach) {
          this.restoreAfterAttach = false;
          this.restoreAttachedView();
        }
        return;
      }

      this.pending = null;
      this.restoreAfterAttach = false;
      // Preserve the familiar behavior for a newly opened page.
      this.restoreFrame = requestAnimationFrame(() => {
        this.restoreFrame = undefined;
        window.scrollTo({ left: 0, top: 0, behavior: 'auto' });
      });
    });
  }

  saveViewState<T>(page: string, state: T): void {
    const historyState = window.history.state ?? {};
    const allStates = (historyState[this.viewStateKey] ?? {}) as Record<string, unknown>;
    window.history.replaceState({
      ...historyState,
      [this.viewStateKey]: { ...allStates, [page]: state }
    }, '');
  }

  getViewState<T>(page: string): T | null {
    const historyState = window.history.state as Record<string, unknown> | null;
    const allStates = historyState?.[this.viewStateKey] as Record<string, T> | undefined;
    return allStates?.[page] ?? null;
  }

  goBackOr(fallbackUrl: string): void {
    const navigationId = Number((window.history.state as { navigationId?: number } | null)?.navigationId ?? 0);
    if (navigationId > 1) {
      window.history.back();
      return;
    }
    this.router.navigateByUrl(fallbackUrl);
  }

  restoreWhenReady(): void {
    if (!this.pending || this.pending.url !== this.router.url) return;

    const target = this.pending.position;
    // Consume the position before scrolling. A page may resize while restoring
    // (especially the home hero), but it must never pull the user back again.
    this.pending = null;
    this.restoreFrame = requestAnimationFrame(() => {
      this.restoreFrame = requestAnimationFrame(() => {
        this.restoreFrame = undefined;
        window.scrollTo({ left: target[0], top: target[1], behavior: 'auto' });
      });
    });
  }

  private restoreAttachedView(): void {
    if (!this.pending || this.pending.url !== this.router.url) return;

    const target = this.pending.position;
    this.pending = null;
    // The destination DOM already exists because the route was reattached.
    // Restore in the same navigation turn, before the browser paints it.
    window.scrollTo({ left: target[0], top: target[1], behavior: 'auto' });
  }

  ngOnDestroy(): void {
    this.stopPendingRestore();
    this.subscription.unsubscribe();
  }

  private stopPendingRestore(): void {
    if (this.restoreFrame !== undefined) cancelAnimationFrame(this.restoreFrame);
    this.restoreFrame = undefined;
  }
}
