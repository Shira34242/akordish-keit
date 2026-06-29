import { Component, ElementRef, HostBinding, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { CloudflareImagePipe, CloudflareImageSrcsetPipe } from '../../../pipes/cloudflare-image.pipe';

interface AdCampaign {
  id: number;
  name: string;
  mediaUrl: string;
  mobileMediaUrl: string;
  knownUrl: string;
  priority: number;
  clientName: string;
}

interface AdSpotResponse {
  spotId: number;
  spotName: string;
  spotTechnicalId: string;
  dimensions: string;
  rotationIntervalMs: number;
  campaigns: AdCampaign[];
  totalCampaigns: number;
}

@Component({
  selector: 'app-media-item',
  standalone: true,
  imports: [CloudflareImagePipe, CloudflareImageSrcsetPipe],
  template: `
    @if (currentAd) {
      <div class="media-wrapper" [style.aspect-ratio]="aspectRatio" [style.max-width]="maxWidth">
        <a [attr.href]="currentAd.knownUrl || null" target="_blank" rel="noopener sponsored" (click)="handleAdClick($event)" class="media-link" [class.media-link--disabled]="!currentAd.knownUrl">
          @if (getMediaType(activeMediaUrl) === 'image') {
            <img
              [src]="activeMediaUrl | cfImage:imagePreset"
              [srcset]="activeMediaUrl | cfSrcset:srcsetWidths"
              [sizes]="imageSizes"
              [alt]="currentAd.name"
              class="media-asset"
              loading="lazy"
              decoding="async"
              (load)="trackView()" />
          } @else if (getMediaType(activeMediaUrl) === 'video') {
            <video [src]="activeMediaUrl" class="media-asset"
              autoplay loop muted playsinline preload="metadata" (loadeddata)="trackView()"></video>
          }
        </a>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .media-wrapper {
      width: 100%;
      display: block;
      overflow: hidden;
      margin: 0 auto;
    }

    .media-link {
      display: block;
      width: 100%;
      height: 100%;
      text-decoration: none;
    }

    .media-asset {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center;
    }

    .media-link--disabled {
      cursor: default;
    }
  `]
})
export class AdDisplayComponent implements OnInit, OnDestroy {
  @Input() spotTechnicalId!: string;
  @Input() fallbackSpotTechnicalId?: string;
  @Input() isMobile: boolean = false;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/media`;

  campaigns: AdCampaign[] = [];
  currentAd: AdCampaign | null = null;
  loading = false;
  currentIndex = 0;
  hasTrackedView = false;
  maxWidth: string | null = null;
  aspectRatio: string | null = null;
  rotationInterval: number = 45000;
  readonly srcsetWidths = [360, 600, 1000, 1600];

  private rotationSubscription?: Subscription;
  private routerSubscription?: Subscription;
  private visibilityObserver?: IntersectionObserver;
  private hasStartedLoading = false;
  private readonly VIEWED_ADS_KEY = 'viewedAds';
  private readonly CLICKED_ADS_KEY = 'clickedAds';

  @HostBinding('class.media-item') readonly hostClass = true;
  @HostBinding('class.media-item--ready') get isReady(): boolean {
    return !!this.currentAd;
  }

  ngOnInit() {
    this.setupRouteChangeListener();
    this.setupLazyLoading();
  }

  ngOnDestroy() {
    this.rotationSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
    this.visibilityObserver?.disconnect();
  }

  private setupLazyLoading(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.startLoadingAds();
      return;
    }

    this.visibilityObserver = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        this.visibilityObserver?.disconnect();
        this.startLoadingAds();
      },
      { rootMargin: '520px 0px', threshold: 0.01 }
    );
    this.visibilityObserver.observe(this.host.nativeElement);
  }

  private startLoadingAds(): void {
    if (this.hasStartedLoading) return;
    this.hasStartedLoading = true;
    this.loadAds();
  }

  loadAds(fallbackAttempted = false) {
    if (!this.spotTechnicalId) return;

    this.loading = true;

    const technicalId = fallbackAttempted && this.fallbackSpotTechnicalId
      ? this.fallbackSpotTechnicalId
      : this.spotTechnicalId;
    const params = new HttpParams().set('spotTechnicalId', technicalId);
    this.http.get<AdSpotResponse>(`${this.apiUrl}/item`, { params })
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.campaigns = response.campaigns.filter(campaign => {
            const mediaUrl = this.isMobile && campaign.mobileMediaUrl
              ? campaign.mobileMediaUrl
              : campaign.mediaUrl;
            return !!mediaUrl;
          });

          if (response.rotationIntervalMs) {
            this.rotationInterval = response.rotationIntervalMs;
          }

          if (response.dimensions) {
            const sep = response.dimensions.includes('x') ? 'x' : '*';
            const parts = response.dimensions.split(sep);
            if (parts.length === 2) {
              const w = Number(parts[0].trim());
              const h = Number(parts[1].trim());
              if (w > 0 && h > 0) {
                this.maxWidth = w + 'px';
                this.aspectRatio = `${w} / ${h}`;
              }
            }
          }

          if (this.campaigns.length > 0) {
            this.currentIndex = 0;
            this.currentAd = this.campaigns[0];
            this.hasTrackedView = false;
            this.setupRotation();
            return;
          }

          if (!fallbackAttempted && this.fallbackSpotTechnicalId && this.fallbackSpotTechnicalId !== this.spotTechnicalId) {
            this.loadAds(true);
          }
        },
        error: () => {
          this.loading = false;
          if (!fallbackAttempted && this.fallbackSpotTechnicalId && this.fallbackSpotTechnicalId !== this.spotTechnicalId) {
            this.loadAds(true);
          }
        }
      });
  }

  setupRotation() {
    // Rotate ads based on interval from AdSpot configuration
    this.rotationSubscription?.unsubscribe();
    this.rotationSubscription = interval(this.rotationInterval)
      .subscribe(() => {
        this.rotateToNextAd();
      });
  }

  setupRouteChangeListener() {
    // On route change, show new ad
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        this.rotateToNextAd();
      });
  }

  rotateToNextAd() {
    if (this.campaigns.length <= 1) {
      return; // No need to rotate if only one or no ads
    }

    // Move to next ad
    this.currentIndex = (this.currentIndex + 1) % this.campaigns.length;
    this.currentAd = this.campaigns[this.currentIndex];
    this.hasTrackedView = false;
  }

  get activeMediaUrl(): string {
    if (!this.currentAd) return '';
    return this.isMobile && this.currentAd.mobileMediaUrl
      ? this.currentAd.mobileMediaUrl
      : this.currentAd.mediaUrl;
  }

  get imagePreset(): 'card' | 'hero' {
    return this.isMobile ? 'card' : 'hero';
  }

  get imageSizes(): string {
    return this.maxWidth ? `(max-width: ${this.maxWidth}) 100vw, ${this.maxWidth}` : '100vw';
  }

  private readonly TRACKING_TTL_MS = 24 * 60 * 60 * 1000;

  private getTrackedIds(key: string): Record<number, number> {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private isTrackedWithinTTL(key: string, adId: number): boolean {
    const map = this.getTrackedIds(key);
    const ts = map[adId];
    return ts != null && Date.now() - ts < this.TRACKING_TTL_MS;
  }

  private markTracked(key: string, adId: number): void {
    const map = this.getTrackedIds(key);
    const cutoff = Date.now() - this.TRACKING_TTL_MS;
    // prune expired entries to keep localStorage clean
    for (const id in map) {
      if (map[id] < cutoff) delete map[id];
    }
    map[adId] = Date.now();
    localStorage.setItem(key, JSON.stringify(map));
  }

  private hasViewedAd(adId: number): boolean {
    return this.isTrackedWithinTTL(this.VIEWED_ADS_KEY, adId);
  }

  private markAdAsViewed(adId: number): void {
    this.markTracked(this.VIEWED_ADS_KEY, adId);
  }

  private hasClickedAd(adId: number): boolean {
    return this.isTrackedWithinTTL(this.CLICKED_ADS_KEY, adId);
  }

  private markAdAsClicked(adId: number): void {
    this.markTracked(this.CLICKED_ADS_KEY, adId);
  }

  trackView() {
    // Only track view once per ad per user session
    if (!this.hasTrackedView && this.currentAd) {
      if (!this.hasViewedAd(this.currentAd.id)) {
        this.hasTrackedView = true;
        this.markAdAsViewed(this.currentAd.id);
        this.http.post(`${this.apiUrl}/${this.currentAd.id}/log-view`, {})
          .subscribe({ next: () => {}, error: () => {} });
      } else {
      }
    }
  }

  handleAdClick(event: MouseEvent) {
    if (!this.currentAd?.knownUrl) {
      event.preventDefault();
      return;
    }

    this.trackClick();
  }

  trackClick() {
    if (this.currentAd) {
      if (!this.hasClickedAd(this.currentAd.id)) {
        this.markAdAsClicked(this.currentAd.id);
        this.http.post(`${this.apiUrl}/${this.currentAd.id}/log-click`, {})
          .subscribe({ next: () => {}, error: () => {} });
      } 
    }
  }

  getMediaType(url: string | null | undefined): 'image' | 'video' | null {
    if (!url) return null;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.ogv'];
    const isVideo = videoExtensions.some(ext => url.toLowerCase().includes(ext));
    return isVideo ? 'video' : 'image';
  }
}
