import { Component, ElementRef, HostBinding, HostListener, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
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
  mobileDimensions?: string;
  displayMode?: 'Stacked' | 'Rotation';
  rotationIntervalMs: number;
  campaigns: AdCampaign[];
  totalCampaigns: number;
}

@Component({
  selector: 'app-media-item',
  standalone: true,
  imports: [CloudflareImagePipe, CloudflareImageSrcsetPipe],
  template: `
    @if (campaigns.length) {
      <div class="media-stack">
        @for (campaign of displayedCampaigns; track campaign.id) {
          <div class="media-entry" [style.max-width]="maxWidth">
            <span class="ad-label">מקודם</span>
            <div class="media-wrapper" [style.aspect-ratio]="aspectRatio">
              <a [attr.href]="campaign.knownUrl || null" target="_blank" rel="noopener sponsored" (click)="handleAdClick($event, campaign)" class="media-link" [class.media-link--disabled]="!campaign.knownUrl">
                @if (getMediaType(getActiveMediaUrl(campaign)) === 'image') {
                  <img
                    [src]="getActiveMediaUrl(campaign) | cfImage:imagePreset"
                    [srcset]="getActiveMediaUrl(campaign) | cfSrcset:srcsetWidths"
                    [sizes]="imageSizes"
                    [alt]="campaign.name"
                    class="media-asset"
                    loading="lazy"
                    decoding="async"
                    (load)="trackView(campaign, $event)" />
                } @else if (getMediaType(getActiveMediaUrl(campaign)) === 'video') {
                  <video [src]="getActiveMediaUrl(campaign)" class="media-asset"
                    autoplay loop muted playsinline preload="metadata" (loadeddata)="trackView(campaign, $event)"></video>
                }
              </a>
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .media-stack {
      display: flex;
      flex-direction: column;
      gap: var(--space-md, 10px);
      width: 100%;
    }

    .media-wrapper {
      width: 100%;
      display: block;
      position: relative;
      overflow: hidden;
    }

    .media-entry {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs, 4px);
      width: 100%;
      margin: 0 auto;
    }

    .ad-label {
      display: inline-flex;
      align-items: center;
      align-self: flex-end;
      gap: var(--space-xs, 4px);
      margin-inline-end: var(--space-sm, 6px);
      color: rgba(0,0,0,0.48);
      font-family: 'Open Sans', sans-serif;
      font-size: var(--font-xs, 12px);
      font-weight: 300;
      line-height: 1.5;
      pointer-events: none;
    }

    .ad-label::before {
      content: '';
      width: var(--space-lg, 20px);
      height: 1px;
      background: rgba(0,0,0,0.18);
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
  @Input() isMobile?: boolean;

  private _isMobileAuto = typeof window !== 'undefined' && window.innerWidth <= 768;

  get effectiveMobile(): boolean {
    return this.isMobile !== undefined ? this.isMobile : this._isMobileAuto;
  }

  @HostListener('window:resize')
  onResize(): void {
    this._isMobileAuto = window.innerWidth <= 768;
  }

  private readonly http = inject(HttpClient);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly apiUrl = `${environment.apiBaseUrl}/api/media`;

  campaigns: AdCampaign[] = [];
  displayMode: 'Stacked' | 'Rotation' = 'Stacked';
  currentCampaignIndex = 0;
  loading = false;
  hasLoaded = false;
  maxWidth: string | null = null;
  aspectRatio: string | null = null;
  private readonly mobileSrcsetWidths = [600, 1200];
  private readonly desktopSrcsetWidths = [1000, 1600];

  get srcsetWidths(): number[] {
    return this.effectiveMobile ? this.mobileSrcsetWidths : this.desktopSrcsetWidths;
  }

  private visibilityObserver?: IntersectionObserver;
  private adViewObserver?: IntersectionObserver;
  private rotationVisibilityObserver?: IntersectionObserver;
  private rotationTimer?: ReturnType<typeof setInterval>;
  private rotationIntervalMs = 30000;
  private isHostVisible = true;
  private hasStartedLoading = false;
  private readonly observedAdElements = new WeakSet<HTMLElement>();
  private readonly visibleAdElements = new WeakSet<HTMLElement>();
  private readonly campaignsByElement = new WeakMap<HTMLElement, AdCampaign>();

  @HostBinding('class.media-item') readonly hostClass = true;
  @HostBinding('class.media-item--ready') get isReady(): boolean {
    return this.campaigns.length > 0;
  }
  @HostBinding('class.media-item--loaded') get isLoaded(): boolean {
    return this.hasLoaded;
  }

  ngOnInit() {
    this.setupLazyLoading();
  }

  ngOnDestroy() {
    this.visibilityObserver?.disconnect();
    this.adViewObserver?.disconnect();
    this.rotationVisibilityObserver?.disconnect();
    this.stopRotation();
  }

  @HostListener('document:visibilitychange')
  onDocumentVisibilityChange(): void {
    if (document.hidden) {
      this.stopRotation();
      return;
    }

    this.startRotation();
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

    this.stopRotation();
    this.loading = true;
    this.hasLoaded = false;

    const technicalId = fallbackAttempted && this.fallbackSpotTechnicalId
      ? this.fallbackSpotTechnicalId
      : this.spotTechnicalId;
    const params = new HttpParams().set('spotTechnicalId', technicalId);
    this.http.get<AdSpotResponse>(`${this.apiUrl}/item`, { params })
      .subscribe({
        next: (response) => {
          this.loading = false;
          this.campaigns = response.campaigns.filter(campaign => {
            const mediaUrl = this.effectiveMobile && campaign.mobileMediaUrl
              ? campaign.mobileMediaUrl
              : campaign.mediaUrl;
            return !!mediaUrl;
          });
          this.displayMode = response.displayMode ?? 'Stacked';
          this.rotationIntervalMs = Math.min(300000, Math.max(5000, response.rotationIntervalMs || 30000));
          this.currentCampaignIndex = 0;

          const dimensions = this.effectiveMobile && response.mobileDimensions
            ? response.mobileDimensions
            : response.dimensions;
          if (dimensions) {
            const sep = dimensions.includes('x') ? 'x' : '*';
            const parts = dimensions.split(sep);
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
            this.hasLoaded = true;
            this.setupRotationVisibility();
            return;
          }

          if (!fallbackAttempted && this.fallbackSpotTechnicalId && this.fallbackSpotTechnicalId !== this.spotTechnicalId) {
            this.loadAds(true);
            return;
          }

          this.hasLoaded = true;
        },
        error: () => {
          this.loading = false;
          if (!fallbackAttempted && this.fallbackSpotTechnicalId && this.fallbackSpotTechnicalId !== this.spotTechnicalId) {
            this.loadAds(true);
            return;
          }

          this.hasLoaded = true;
        }
      });
  }

  getActiveMediaUrl(campaign: AdCampaign): string {
    return this.effectiveMobile && campaign.mobileMediaUrl
      ? campaign.mobileMediaUrl
      : campaign.mediaUrl;
  }

  get displayedCampaigns(): AdCampaign[] {
    if (this.displayMode !== 'Rotation' || this.campaigns.length <= 1) {
      return this.campaigns;
    }

    const campaign = this.campaigns[this.currentCampaignIndex];
    return campaign ? [campaign] : [];
  }

  private setupRotationVisibility(): void {
    this.rotationVisibilityObserver?.disconnect();

    if (this.displayMode !== 'Rotation' || this.campaigns.length <= 1) return;

    if (typeof IntersectionObserver === 'undefined') {
      this.isHostVisible = true;
      this.startRotation();
      return;
    }

    this.isHostVisible = false;
    this.rotationVisibilityObserver = new IntersectionObserver(entries => {
      this.isHostVisible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.01);
      if (this.isHostVisible) {
        this.startRotation();
      } else {
        this.stopRotation();
      }
    }, { threshold: [0, 0.01] });
    this.rotationVisibilityObserver.observe(this.host.nativeElement);
  }

  private startRotation(): void {
    if (
      this.rotationTimer ||
      this.displayMode !== 'Rotation' ||
      this.campaigns.length <= 1 ||
      !this.isHostVisible ||
      (typeof document !== 'undefined' && document.hidden)
    ) return;

    this.rotationTimer = setInterval(() => {
      this.currentCampaignIndex = (this.currentCampaignIndex + 1) % this.campaigns.length;
    }, this.rotationIntervalMs);
  }

  private stopRotation(): void {
    if (!this.rotationTimer) return;
    clearInterval(this.rotationTimer);
    this.rotationTimer = undefined;
  }

  get imagePreset(): 'card' | 'hero' {
    return this.effectiveMobile ? 'card' : 'hero';
  }

  get imageSizes(): string {
    return this.maxWidth ? `(max-width: ${this.maxWidth}) 100vw, ${this.maxWidth}` : '100vw';
  }

  trackView(campaign: AdCampaign, event: Event) {
    const mediaElement = event.currentTarget as HTMLElement | null;
    const adElement = mediaElement?.closest<HTMLElement>('.media-wrapper');

    if (!adElement || typeof IntersectionObserver === 'undefined') {
      this.sendView(campaign);
      return;
    }

    this.campaignsByElement.set(adElement, campaign);
    if (this.observedAdElements.has(adElement)) return;

    this.observedAdElements.add(adElement);
    this.getAdViewObserver().observe(adElement);
  }

  private getAdViewObserver(): IntersectionObserver {
    if (!this.adViewObserver) {
      this.adViewObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const adElement = entry.target as HTMLElement;
          const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.01;

          if (!isVisible) {
            this.visibleAdElements.delete(adElement);
            continue;
          }

          if (this.visibleAdElements.has(adElement)) continue;

          const campaign = this.campaignsByElement.get(adElement);
          if (!campaign) continue;

          this.visibleAdElements.add(adElement);
          this.sendView(campaign);
        }
      }, { threshold: [0, 0.01] });
    }

    return this.adViewObserver;
  }

  private sendView(campaign: AdCampaign): void {
    this.http.post(`${this.apiUrl}/${campaign.id}/log-view`, {})
      .subscribe({ next: () => {}, error: () => {} });
  }

  handleAdClick(event: MouseEvent, campaign: AdCampaign) {
    if (!campaign.knownUrl) {
      event.preventDefault();
      return;
    }

    this.trackClick(campaign);
  }

  trackClick(campaign: AdCampaign) {
    this.http.post(`${this.apiUrl}/${campaign.id}/log-click`, {})
      .subscribe({ next: () => {}, error: () => {} });
  }

  getMediaType(url: string | null | undefined): 'image' | 'video' | null {
    if (!url) return null;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.ogv'];
    const isVideo = videoExtensions.some(ext => url.toLowerCase().includes(ext));
    return isVideo ? 'video' : 'image';
  }
}
