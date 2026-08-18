import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RecommendationExposureService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'akordish.recommendation-exposures.v1';
  private readonly maxStoredItems = 200;

  private loaded = false;
  private persistScheduled = false;
  private exposureOrder: string[] = [];
  private exposed = new Set<string>();

  prioritize<T>(items: readonly T[], idSelector: (item: T) => string | number, scope = 'article'): T[] {
    this.ensureLoaded();

    const unique = new Set<string>();
    const unseen: T[] = [];
    const previouslyShown: Array<{ item: T; order: number }> = [];
    const orderByKey = new Map(this.exposureOrder.map((key, index) => [key, index]));

    for (const item of items) {
      const key = this.createKey(scope, idSelector(item));
      if (unique.has(key)) continue;
      unique.add(key);

      if (this.exposed.has(key)) {
        previouslyShown.push({ item, order: orderByKey.get(key) ?? -1 });
      } else {
        unseen.push(item);
      }
    }

    previouslyShown.sort((a, b) => a.order - b.order);
    return [...unseen, ...previouslyShown.map(entry => entry.item)];
  }

  markShown<T>(items: readonly T[], idSelector: (item: T) => string | number, scope = 'article'): void {
    this.ensureLoaded();
    if (items.length === 0) return;

    for (const item of items) {
      const key = this.createKey(scope, idSelector(item));
      if (this.exposed.has(key)) {
        this.exposureOrder = this.exposureOrder.filter(existing => existing !== key);
      }
      this.exposed.add(key);
      this.exposureOrder.push(key);
    }

    if (this.exposureOrder.length > this.maxStoredItems) {
      this.exposureOrder = this.exposureOrder.slice(-this.maxStoredItems);
      this.exposed = new Set(this.exposureOrder);
    }

    this.schedulePersist();
  }

  markId(id: string | number, scope = 'article'): void {
    this.markShown([id], value => value, scope);
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;

    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const stored = sessionStorage.getItem(this.storageKey);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed)) return;

      this.exposureOrder = parsed
        .filter((key): key is string => typeof key === 'string')
        .slice(-this.maxStoredItems);
      this.exposed = new Set(this.exposureOrder);
    } catch {
      this.exposureOrder = [];
      this.exposed.clear();
    }
  }

  private persist(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify(this.exposureOrder));
    } catch {
      // Recommendations still work in memory when browser storage is unavailable.
    }
  }

  private schedulePersist(): void {
    if (this.persistScheduled) return;
    this.persistScheduled = true;

    queueMicrotask(() => {
      this.persistScheduled = false;
      this.persist();
    });
  }

  private createKey(scope: string, id: string | number): string {
    return `${scope}:${String(id)}`;
  }
}
