import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router';
import { NavigationIntentService } from '../services/navigation-intent.service';
import { RouteReuseEventsService } from '../services/route-reuse-events.service';

/** Preserves public list screens for browser Back/Forward only. */
@Injectable()
export class PublicListReuseStrategy implements RouteReuseStrategy {
  private readonly handles = new Map<string, DetachedRouteHandle>();

  constructor(
    private readonly navigationIntent: NavigationIntentService,
    private readonly events: RouteReuseEventsService
  ) {}

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    const key = this.key(route);
    return !!key;
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    const key = this.key(route);
    if (!key) return;

    // Angular calls store(route, null) while reattaching a saved route. The
    // handle is still needed by RouterOutlet at that point, so it must not be
    // destroyed or removed here.
    if (!handle) return;

    this.handles.set(key, handle);
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.key(route);
    const shouldAttach = !!key && this.navigationIntent.isHistoryNavigation && this.handles.has(key);
    return shouldAttach;
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.key(route);
    if (!key || !this.navigationIntent.isHistoryNavigation) return null;

    const handle = this.handles.get(key) ?? null;
    if (handle) this.events.notifyAttached(key);
    return handle;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, current: ActivatedRouteSnapshot): boolean {
    return future.routeConfig === current.routeConfig;
  }

  private key(route: ActivatedRouteSnapshot): string | null {
    return (route.data['reuseKey'] as string | undefined) ?? null;
  }

}
