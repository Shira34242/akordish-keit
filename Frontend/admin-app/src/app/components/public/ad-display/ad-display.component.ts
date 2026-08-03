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
        @for (campaign of campaigns; track campaign.id) {
          <div class="media-wrapper" [style.aspect-ratio]="aspectRatio" [style.max-width]="maxWidth">
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
  loading = false;
  hasLoaded = false;
  maxWidth: string | null = null;
  aspectRatio: string | null = null;
  readonly srcsetWidths = [360, 600, 1000, 1600];

  private visibilityObserver?: IntersectionObserver;
  private adViewObserver?: IntersectionObserver;
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
