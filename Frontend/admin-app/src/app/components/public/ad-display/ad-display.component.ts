import { Component, ElementRef, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { CloudflareImagePipe } from '../../../pipes/cloudflare-image.pipe';

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
  selector: 'app-ad-display',
  standalone: true,
  imports: [CloudflareImagePipe],
  template: `
    @if (currentAd) {
      <div class="ad-container" [style.aspect-ratio]="aspectRatio" [style.max-width]="maxWidth">
        <a [href]="currentAd.knownUrl" target="_blank" (click)="trackClick()" class="ad-link">
          @if (!isMobile) {
            @if (getMediaType(currentAd.mediaUrl) === 'image') {
              <img [src]="currentAd.mediaUrl | cfImage:'hero'" [alt]="currentAd.name" class="ad-media" loading="lazy" decoding="async" (load)="trackView()" />
            } @else if (getMediaType(currentAd.mediaUrl) === 'video') {
              <video [src]="currentAd.mediaUrl" class="ad-media"
                autoplay loop muted playsinline preload="metadata" (loadeddata)="trackView()"></video>
            }
          } @else if (currentAd.mobileMediaUrl) {
            @if (getMediaType(currentAd.mobileMediaUrl) === 'image') {
              <img [src]="currentAd.mobileMediaUrl | cfImage:'card'" [alt]="currentAd.name" class="ad-media" loading="lazy" decoding="async" (load)="trackView()" />
            } @else if (getMediaType(currentAd.mobileMediaUrl) === 'video') {
              <video [src]="currentAd.mobileMediaUrl" class="ad-media"
                autoplay loop muted playsinline preload="metadata" (loadeddata)="trackView()"></video>
            }
          }
        </a>
      </div>
    }
  `,
  styles: [`
    .ad-container {
      width: 100%;
      display: block;
      overflow: hidden;
      margin: 0 auto;
    }

    .ad-link {
      display: block;
      width: 100%;
      height: 100%;
      text-decoration: none;
    }

    .ad-media {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `]
})
export class AdDisplayComponent implements OnInit, OnDestroy {
  @Input() spotTechnicalId!: string;
  @Input() isMobile: boolean = false;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/AdCampaigns`;

  campaigns: AdCampaign[] = [];
  currentAd: AdCampaign | null = null;
  loading = false;
  currentIndex = 0;
  hasTrackedView = false;
  maxWidth: string | null = null;
  aspectRatio: string | null = null;
  rotationInterval: number = 45000;

  private rotationSubscription?: Subscription;
  private routerSubscription?: Subscription;
  private visibilityObserver?: IntersectionObserver;
  private hasStartedLoading = false;
  private readonly VIEWED_ADS_KEY = 'viewedAds';
  private readonly CLICKED_ADS_KEY = 'clickedAds';

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

  loadAds() {
    if (!this.spotTechnicalId) return;

    this.loading = true;

    const params = new HttpParams().set('spotTechnicalId', this.spotTechnicalId);
    this.http.get<AdSpotResponse>(`${this.apiUrl}/Public/GetAd`, { params })
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.campaigns = response.campaigns;

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
                // cap: אם הרוחב גדול מ-5x הגובה — הצג כ-5:1 כדי לא להיות שטוח מדי
                const ratio = w / h;
                this.aspectRatio = ratio > 5 ? `5 / 1` : `${w} / ${h}`;
              }
            }
          }

          if (this.campaigns.length > 0) {
            this.currentIndex = 0;
            this.currentAd = this.campaigns[0];
            this.hasTrackedView = false;
            this.setupRotation();
          }
        },
        error: () => {
          this.loading = false;
        }
      });
  }

  setupRotation() {
    // Rotate ads based on interval from AdSpot configuration
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
        this.http.post(`${this.apiUrl}/${this.currentAd.id}/track-view`, {})
          .subscribe({ next: () => {}, error: () => {} });
      } else {
      }
    }
  }

  trackClick() {
    if (this.currentAd) {
      if (!this.hasClickedAd(this.currentAd.id)) {
        this.markAdAsClicked(this.currentAd.id);
        this.http.post(`${this.apiUrl}/${this.currentAd.id}/track-click`, {})
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
