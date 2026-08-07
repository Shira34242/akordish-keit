import { Injectable, inject, ApplicationRef, EnvironmentInjector, createComponent } from '@angular/core';
import { ContentItem, ArticleSelectionResult, ContentSelectionResult, ContentSelectorConfig } from './types';
import { ContentSelectorDialogComponent } from './content-selector-dialog.component';
import { ContentApiService } from './content-api.service';

let _bridge: ContentSelectorBridgeService | null = null;

export function openArticleSelector(existingItems: unknown[] = []): Promise<ArticleSelectionResult | null> {
  if (!_bridge) {
    console.error('[ContentSelectorBridge] Bridge not initialized');
    return Promise.resolve(null);
  }
  return _bridge.selectArticles(existingItems as ContentItem[]);
}

export function openChordsSelector(existingItems: unknown[] = []): Promise<ContentSelectionResult | null> {
  if (!_bridge) {
    console.error('[ContentSelectorBridge] Bridge not initialized');
    return Promise.resolve(null);
  }
  return _bridge.selectContentByType('chords', existingItems as ContentItem[]);
}

export function openPodcastsSelector(existingItems: unknown[] = []): Promise<ContentSelectionResult | null> {
  if (!_bridge) {
    console.error('[ContentSelectorBridge] Bridge not initialized');
    return Promise.resolve(null);
  }
  return _bridge.selectContentByType('podcasts', existingItems as ContentItem[]);
}

export function openEventsSelector(existingItems: unknown[] = []): Promise<ContentSelectionResult | null> {
  if (!_bridge) {
    console.error('[ContentSelectorBridge] Bridge not initialized');
    return Promise.resolve(null);
  }
  return _bridge.selectContentByType('events', existingItems as ContentItem[]);
}

export function openProfilesSelector(existingItems: unknown[] = []): Promise<ContentSelectionResult | null> {
  if (!_bridge) {
    console.error('[ContentSelectorBridge] Bridge not initialized');
    return Promise.resolve(null);
  }
  return _bridge.selectContentByType('profiles', existingItems as ContentItem[]);
}

export function openContentSelector(
  config: ContentSelectorConfig,
  existingItems: unknown[] = []
): Promise<ContentSelectionResult | null> {
  if (!_bridge) {
    console.error('[ContentSelectorBridge] Bridge not initialized');
    return Promise.resolve(null);
  }
  return _bridge.selectContent(config, existingItems as ContentItem[]);
}

@Injectable({ providedIn: 'root' })
export class ContentSelectorBridgeService {
  private readonly appRef = inject(ApplicationRef);
  private readonly envInjector = inject(EnvironmentInjector);
  private readonly apiService = inject(ContentApiService);
  private dialogRef: { component: ContentSelectorDialogComponent } | null = null;

  constructor() {
    _bridge = this;
    console.log('[ContentSelectorBridge] Initialized');
  }

  selectArticles(existingItems: ContentItem[]): Promise<ArticleSelectionResult | null> {
    console.log('[ContentSelectorBridge] Opening article selector dialog...');
    return new Promise((resolve) => {
      if (this.dialogRef) {
        this.destroyDialog();
      }

      const hostElement = document.createElement('div');
      hostElement.id = 'akd-content-selector-host';
      document.body.appendChild(hostElement);

      const componentRef = createComponent(ContentSelectorDialogComponent, {
        environmentInjector: this.envInjector,
        hostElement,
      });

      const component = componentRef.instance;
      component.config = {
        type: 'articles',
        title: 'בחירת כתבות למייל',
        searchPlaceholder: 'חיפוש כתבות...',
        maxItems: 8,
        searchFn: (search, page, pageSize) => this.apiService.searchArticles(search, page, pageSize),
      };
      component.existingItems = existingItems;

      component.confirmed.subscribe((result: ArticleSelectionResult) => {
        resolve(result);
        this.destroyDialog();
      });

      component.closed.subscribe(() => {
        resolve(null);
        this.destroyDialog();
      });

      this.appRef.attachView(componentRef.hostView);
      this.dialogRef = { component };
    });
  }

  selectContentByType(
    type: string,
    existingItems: ContentItem[]
  ): Promise<ContentSelectionResult | null> {
    const config = this.buildConfigForType(type);
    if (!config) {
      console.error(`[ContentSelectorBridge] Unknown content type: ${type}`);
      return Promise.resolve(null);
    }
    return this.selectContent(config, existingItems);
  }

  selectContent(
    config: ContentSelectorConfig,
    existingItems: ContentItem[]
  ): Promise<ContentSelectionResult | null> {
    console.log(`[ContentSelectorBridge] Opening selector for type: ${config.type}`);
    return new Promise((resolve) => {
      if (this.dialogRef) {
        this.destroyDialog();
      }

      const hostElement = document.createElement('div');
      hostElement.id = 'akd-content-selector-host';
      document.body.appendChild(hostElement);

      const componentRef = createComponent(ContentSelectorDialogComponent, {
        environmentInjector: this.envInjector,
        hostElement,
      });

      const component = componentRef.instance;
      component.config = config;
      component.existingItems = existingItems;

      component.contentConfirmed.subscribe((result: ContentSelectionResult) => {
        resolve(result);
        this.destroyDialog();
      });

      component.closed.subscribe(() => {
        resolve(null);
        this.destroyDialog();
      });

      this.appRef.attachView(componentRef.hostView);
      this.dialogRef = { component };
    });
  }

  private buildConfigForType(type: string): ContentSelectorConfig | null {
    switch (type) {
      case 'chords':
        return {
          type: 'chords',
          title: 'בחירת אקורדים למייל',
          searchPlaceholder: 'חיפוש שיר או אמן...',
          maxItems: 12,
          displayFields: ['artistNames'],
          searchFn: (search, page, pageSize) => this.apiService.searchSongs(search, page, pageSize),
        };
      case 'events':
        return {
          type: 'events',
          title: 'בחירת הופעות למייל',
          searchPlaceholder: 'חיפוש הופעה...',
          maxItems: 10,
          displayFields: ['artistNames', 'location', 'date'],
          searchFn: (search, page, pageSize) => this.apiService.searchEvents(search, page, pageSize),
        };
      case 'podcasts':
        return {
          type: 'podcasts',
          title: 'בחירת פודקאסטים למייל',
          searchPlaceholder: 'חיפוש פרק או סדרה...',
          maxItems: 10,
          displayFields: ['podcastName'],
          searchFn: (search, page, pageSize) => this.apiService.searchPodcastEpisodes(search, page, pageSize),
        };
      case 'artists':
        return {
          type: 'artists',
          title: 'בחירת אמנים למייל',
          searchPlaceholder: 'חיפוש אמן...',
          maxItems: 8,
          searchFn: (search, page, pageSize) => this.apiService.searchArtists(search, page, pageSize),
        };
      case 'providers':
        return {
          type: 'providers',
          title: 'בחירת נותני שירות למייל',
          searchPlaceholder: 'חיפוש נותן שירות...',
          maxItems: 8,
          displayFields: ['cityName'],
          searchFn: (search, page, pageSize) => this.apiService.searchProviders(search, page, pageSize),
        };
      case 'teachers':
        return {
          type: 'teachers',
          title: 'בחירת מורים למייל',
          searchPlaceholder: 'חיפוש מורה...',
          maxItems: 8,
          displayFields: ['cityName'],
          searchFn: (search, page, pageSize) => this.apiService.searchTeachers(search, page, pageSize),
        };
      case 'profiles':
        return {
          type: 'profiles',
          title: 'בחירת פרופילים למייל',
          searchPlaceholder: 'חיפוש פרופיל...',
          maxItems: 8,
          displayFields: ['cityName'],
          sourceOptions: [
            {
              label: 'נותני שירות',
              searchFn: (search, page, pageSize) => this.apiService.searchProviders(search, page, pageSize),
            },
            {
              label: 'מורים',
              searchFn: (search, page, pageSize) => this.apiService.searchTeachers(search, page, pageSize),
            },
          ],
          searchFn: (search, page, pageSize) => this.apiService.searchProviders(search, page, pageSize),
        };
      default:
        return null;
    }
  }

  private destroyDialog(): void {
    const hostElement = document.getElementById('akd-content-selector-host');
    if (hostElement) {
      document.body.removeChild(hostElement);
    }
    this.dialogRef = null;
  }
}
