import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

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
  imports: [CommonModule],
  template: `
    <div class="ad-container" *ngIf="currentAd" [style.max-width]="maxWidth" [style.max-height]="maxHeight">
      <a
        [href]="currentAd.knownUrl"
        target="_blank"
        (click)="trackClick()"
        class="ad-link">
        <!-- Desktop Media -->
        <img
          *ngIf="!isMobile && getMediaType(currentAd.mediaUrl) === 'image'"
          [src]="currentAd.mediaUrl"
          [alt]="currentAd.name"
          class="ad-image"
          [style.max-width]="maxWidth"
          [style.max-height]="maxHeight"
          (load)="trackView()"
        />
        <video
          *ngIf="!isMobile && getMediaType(currentAd.mediaUrl) === 'video'"
          [src]="currentAd.mediaUrl"
          class="ad-video"
          [style.max-width]="maxWidth"
          [style.max-height]="maxHeight"
          [autoplay]="true"
          [loop]="true"
          [muted]="true"
          [playsInline]="true"
          (loadeddata)="trackView()"
        ></video>
        <!-- Mobile Media -->
        <img
          *ngIf="isMobile && currentAd.mobileMediaUrl && getMediaType(currentAd.mobileMediaUrl) === 'image'"
          [src]="currentAd.mobileMediaUrl"
          [alt]="currentAd.name"
          class="ad-image"
          [style.max-width]="maxWidth"
          [style.max-height]="maxHeight"
          (load)="trackView()"
        />
        <video
          *ngIf="isMobile && currentAd.mobileMediaUrl && getMediaType(currentAd.mobileMediaUrl) === 'video'"
          [src]="currentAd.mobileMediaUrl"
          class="ad-video"
          [style.max-width]="maxWidth"
          [style.max-height]="maxHeight"
          [autoplay]="true"
          [loop]="true"
          [muted]="true"
          [playsInline]="true"
          (loadeddata)="trackView()"
        ></video>
      </a>
    </div>
    <div class="ad-loading" *ngIf="loading">
      <span>טוען פרסומת...</span>
    </div>
    <div class="ad-error" *ngIf="error && !loading">
      <span>{{ error }}</span>
    </div>
  `,
  styles: [`
    .ad-container {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      margin: 0 auto;
    }

    .ad-link {
      display: block;
      width: 100%;
      text-decoration: none;
    }

    .ad-image {
      width: 100%;
      height: auto;
      display: block;
      transition: opacity 0.3s ease;
      object-fit: cover;
    }

    .ad-video {
      width: 100%;
      height: auto;
      display: block;
      transition: opacity 0.3s ease;
      object-fit: cover;
    }

    .ad-loading, .ad-error {
      padding: 1rem;
      text-align: center;
      color: #6c757d;
    }

    .ad-error {
      color: #dc3545;
    }
  `]
})
export class AdDisplayComponent implements OnInit, OnDestroy {
  @Input() spotTechnicalId!: string;
  @Input() isMobile: boolean = false;

  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly apiUrl = 'https://localhost:44395/api/AdCampaigns';

  campaigns: AdCampaign[] = [];
  currentAd: AdCampaign | null = null;
  loading = false;
  error: string | null = null;
  currentIndex = 0;
  hasTrackedView = false;
  maxWidth: string | null = null;
  maxHeight: string | null = null;
  rotationInterval: number = 45000; // Default 45 seconds, will be overridden from server

  private rotationSubscription?: Subscription;
  private routerSubscription?: Subscription;
  private readonly VIEWED_ADS_KEY = 'viewedAds';
  private readonly CLICKED_ADS_KEY = 'clickedAds';

  ngOnInit() {
    this.loadAds();
    this.setupRouteChangeListener();
  }

  ngOnDestroy() {
    this.rotationSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
  }

  loadAds() {
    if (!this.spotTechnicalId) {
      this.error = 'Spot technical ID is required';
      return;
    }

    this.loading = true;
    this.error = null;

    this.http.get<AdSpotResponse>(`${this.apiUrl}/Public/GetAd?spotTechnicalId=${this.spotTechnicalId}`)
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.campaigns = response.campaigns;

          // Set rotation interval from server response
          if (response.rotationIntervalMs) {
            this.rotationInterval = response.rotationIntervalMs;
          }

          // Parse dimensions (format: "970x250")
          if (response.dimensions) {
            const dimensionParts = response.dimensions.split('*');
            if (dimensionParts.length === 2) {
              this.maxWidth = dimensionParts[0] + 'px';
              this.maxHeight = dimensionParts[1] + 'px';
            }
          }

          if (this.campaigns.length > 0) {
            // Start with priority 1 (highest priority)
            this.currentIndex = 0;
            this.currentAd = this.campaigns[0];
            this.hasTrackedView = false;

            // Setup rotation with interval from server
            this.setupRotation();
          } else {
            this.error = 'No active campaigns available';
          }
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Failed to load advertisements';
          console.error('Error loading ads:', error);
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

  private hasViewedAd(adId: number): boolean {
    const viewedAds = this.getViewedAds();
    return viewedAds.includes(adId);
  }

  private markAdAsViewed(adId: number): void {
    const viewedAds = this.getViewedAds();
    if (!viewedAds.includes(adId)) {
      viewedAds.push(adId);
      localStorage.setItem(this.VIEWED_ADS_KEY, JSON.stringify(viewedAds));
    }
  }

  private getViewedAds(): number[] {
    const stored = localStorage.getItem(this.VIEWED_ADS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  private hasClickedAd(adId: number): boolean {
    const clickedAds = this.getClickedAds();
    return clickedAds.includes(adId);
  }

  private markAdAsClicked(adId: number): void {
    const clickedAds = this.getClickedAds();
    if (!clickedAds.includes(adId)) {
      clickedAds.push(adId);
      localStorage.setItem(this.CLICKED_ADS_KEY, JSON.stringify(clickedAds));
    }
  }

  private getClickedAds(): number[] {
    const stored = localStorage.getItem(this.CLICKED_ADS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  trackView() {
    // Only track view once per ad per user session
    if (!this.hasTrackedView && this.currentAd) {
      if (!this.hasViewedAd(this.currentAd.id)) {
        this.hasTrackedView = true;
        this.markAdAsViewed(this.currentAd.id);
        this.http.post(`${this.apiUrl}/${this.currentAd.id}/track-view`, {})
          .subscribe({
            next: () => console.log(`📊 צפייה נספרה לפרסומת ${this.currentAd?.id}`),
            error: (error) => console.error('Error tracking view:', error)
          });
      } else {
      }
    }
  }

  trackClick() {
    if (this.currentAd) {
      if (!this.hasClickedAd(this.currentAd.id)) {
        this.markAdAsClicked(this.currentAd.id);
        this.http.post(`${this.apiUrl}/${this.currentAd.id}/track-click`, {})
          .subscribe({
            next: () => console.log(`📊 קליק נספר לפרסומת ${this.currentAd?.id}`),
            error: (error) => console.error('Error tracking click:', error)
          });
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
