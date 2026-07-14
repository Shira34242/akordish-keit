import { Injectable } from '@angular/core';
import { cloudflareImageUrl } from '../pipes/cloudflare-image.pipe';

@Injectable({
  providedIn: 'root'
})
export class CloudflareImageOptimizerService {
  private started = false;
  private observer?: MutationObserver;
  private pendingElements = new Set<HTMLImageElement | HTMLSourceElement>();
  private idleHandle: number | null = null;

  start(): void {
    if (this.started || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    this.started = true;
    this.scheduleOptimizeRoot(document.documentElement);

    this.observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          (mutation.target instanceof HTMLImageElement || mutation.target instanceof HTMLSourceElement)
        ) {
          this.scheduleOptimizeElement(mutation.target);
          continue;
        }

        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) {
            this.scheduleOptimizeRoot(node);
          }
        });
      }
    });

    this.observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['src', 'srcset']
    });
  }

  private scheduleOptimizeRoot(root: Element): void {
    this.scheduleOptimizeElement(root);
    root.querySelectorAll('img, source').forEach(element => {
      this.scheduleOptimizeElement(element);
    });
  }

  private scheduleOptimizeElement(element: Element): void {
    if (!(element instanceof HTMLImageElement || element instanceof HTMLSourceElement)) {
      return;
    }

    this.pendingElements.add(element);
    if (this.idleHandle !== null) {
      return;
    }

    this.idleHandle = this.requestIdle(() => {
      const elements = Array.from(this.pendingElements);
      this.pendingElements.clear();
      this.idleHandle = null;

      elements.forEach(item => {
        if (item.isConnected) {
          this.optimizeMediaElement(item);
        }
      });
    });
  }

  private optimizeMediaElement(element: HTMLImageElement | HTMLSourceElement): void {
    const src = element.getAttribute('src');
    const optimizedSrc = this.optimizeUrl(src, element instanceof HTMLImageElement ? this.presetForImage(element) : 'content');
    if (optimizedSrc && optimizedSrc !== src) {
      element.setAttribute('src', optimizedSrc);
    }

    const srcset = element.getAttribute('srcset');
    const optimizedSrcset = this.optimizeSrcset(srcset);
    if (optimizedSrcset && optimizedSrcset !== srcset) {
      element.setAttribute('srcset', optimizedSrcset);
    }
  }

  private optimizeSrcset(srcset: string | null): string | null {
    if (!srcset) return srcset;

    return srcset
      .split(',')
      .map(part => {
        const trimmed = part.trim();
        if (!trimmed) return trimmed;

        const [url, ...descriptor] = trimmed.split(/\s+/);
        const optimizedUrl = this.optimizeUrl(url, 'content');
        return [optimizedUrl || url, ...descriptor].join(' ');
      })
      .join(', ');
  }

  private optimizeUrl(url: string | null, preset: 'thumb' | 'card' | 'profile' | 'content' | 'hero' | 'lightbox'): string | null {
    const rawUrl = (url || '').trim();
    if (!rawUrl || this.isBrowserLocalUrl(rawUrl)) {
      return url;
    }

    return cloudflareImageUrl(rawUrl, preset);
  }

  private presetForImage(image: HTMLImageElement): 'thumb' | 'card' | 'profile' | 'content' | 'hero' | 'lightbox' {
    const className = image.className.toString().toLowerCase();

    if (className.includes('hero') || className.includes('banner')) return 'hero';
    if (className.includes('avatar') || className.includes('profile') || className.includes('logo')) return 'profile';
    if (className.includes('thumb') || className.includes('thumbnail')) return 'thumb';
    if (className.includes('lightbox')) return 'lightbox';
    return 'card';
  }

  private isBrowserLocalUrl(url: string): boolean {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url);
  }

  private requestIdle(callback: () => void): number {
    const requestIdleCallback = window.requestIdleCallback ?? ((handler: IdleRequestCallback) => {
      return window.setTimeout(() => handler({ didTimeout: false, timeRemaining: () => 0 }), 1);
    });

    return requestIdleCallback(callback, { timeout: 500 });
  }
}
