import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, take } from 'rxjs';
import { AnalyticsService } from './analytics.service';

@Injectable({ providedIn: 'root' })
export class AdBlockDetectionService {
  private readonly analytics = inject(AnalyticsService);
  private readonly router = inject(Router);
  private readonly storageKeyPrefix = 'ak_adblock_check_';
  private started = false;

  start(): void {
    if (this.started || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    this.started = true;
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        take(1)
      )
      .subscribe(event => {
        const pagePath = event.urlAfterRedirects.split('#')[0] || '/';
        if (pagePath.startsWith('/admin')) {
          return;
        }

        this.runOncePerDay(pagePath);
      });

    if (this.router.url && this.router.url !== '/') {
      const pagePath = this.router.url.split('#')[0] || '/';
      if (!pagePath.startsWith('/admin')) {
        this.runOncePerDay(pagePath);
      }
    }
  }

  private runOncePerDay(pagePath: string): void {
    const today = new Date().toISOString().slice(0, 10);
    const key = `${this.storageKeyPrefix}${today}`;

    try {
      if (localStorage.getItem(key) === '1') {
        return;
      }
      localStorage.setItem(key, '1');
    } catch {
      if (sessionStorage.getItem(key) === '1') {
        return;
      }
      sessionStorage.setItem(key, '1');
    }

    window.setTimeout(async () => {
      const detected = await this.detect();
      this.analytics.trackAdBlockCheck(detected, pagePath, this.getDeviceType());
    }, 1200);
  }

  private async detect(): Promise<boolean> {
    const bait = document.createElement('div');
    bait.className = 'adsbox ad-banner ad-unit pub_300x250 text-ad sponsored-links';
    bait.setAttribute('aria-hidden', 'true');
    bait.style.cssText = 'position:absolute;left:-10000px;top:-10000px;width:1px;height:1px;';
    document.body.appendChild(bait);

    await new Promise(resolve => window.setTimeout(resolve, 120));

    const style = window.getComputedStyle(bait);
    const blocked = style.display === 'none'
      || style.visibility === 'hidden'
      || bait.offsetHeight === 0
      || bait.clientHeight === 0;

    bait.remove();
    return blocked;
  }

  private getDeviceType(): string {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1100) return 'tablet';
    return 'desktop';
  }
}
