import {
  Component, Input, Output, EventEmitter, OnInit, AfterViewInit, OnDestroy,
  OnChanges, HostListener, ViewChild, ElementRef, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AnalyticsService } from '../../../services/analytics.service';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';
import {
  MusicServiceProviderDto,
  ServiceProviderParkingType,
  ServiceProviderBranchDto,
  SocialLinkDto,
  SocialPlatform
} from '../../../models/music-service-provider.model';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';
import { CitiesService, City } from '../../../services/cities.service';

type GalleryMediaItem = {
  type: 'image' | 'video';
  imageUrl?: string;
  videoUrl?: string;
  caption?: string;
};

type ProviderDisplayTestimonial = {
  text: string;
  clientName: string;
  order: number;
};

@Component({
  selector: 'app-professional-profile-modal',
  standalone: true,
  imports: [CommonModule, ImgFallbackDirective],
  templateUrl: './professional-profile-modal.component.html',
  styleUrls: ['./professional-profile-modal.component.css']
})
export class ProfessionalProfileModalComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {

  @Input() professionalId: number | null = null;
  @Output() close = new EventEmitter<void>();

  @ViewChild('professionalHeroBg') professionalHeroBg?: ElementRef<HTMLDivElement>;
  @ViewChild('testimonialsScroller') testimonialsScrollerRef?: ElementRef<HTMLDivElement>;

  private readonly analytics = inject(AnalyticsService);

  professional: MusicServiceProviderDto | null = null;
  cities: City[] = [];
  loading = true;
  error: string | null = null;
  SocialPlatform = SocialPlatform;
  ServiceProviderParkingType = ServiceProviderParkingType;

  contactOpen = false;
  canScrollTestimonialsPrev = false;
  canScrollTestimonialsNext = false;
  activeTestimonialIndex = 0;
  mediaLightboxIndex: number | null = null;
  galleryMediaItems: GalleryMediaItem[] = [];
  activeMedia: GalleryMediaItem | null = null;
  activeVideoUrl: SafeResourceUrl | null = null;
  branches: ServiceProviderBranchDto[] = [];

  private fullHeroHeight = 0;
  private rafPending = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private professionalService: MusicServiceProviderService,
    private citiesService: CitiesService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      if (id) this.loadProfessional(id);
    });

    this.citiesService.getCities().subscribe({
      next: cities => this.cities = cities,
      error: () => {}
    });
  }

  ngOnChanges(): void {
    if (this.professionalId) this.loadProfessional(this.professionalId);
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {}

  loadProfessional(id?: number): void {
    const professionalId = id ?? +this.route.snapshot.params['id'];
    if (!professionalId) return;

    this.loading = true;
    this.error = null;
    this.contactOpen = false;
    window.scrollTo(0, 0);

    this.professionalService.getServiceProviderById(professionalId).subscribe({
      next: professional => {
        this.professional = professional;
        this.branches = professional.branches ?? [];
        this.rebuildGalleryMedia();
        this.loading = false;
        setTimeout(() => {
          this.cdr.detectChanges();
          this.initHeroHeight();
          this.updateTestimonialsNav();
        }, 0);
      },
      error: () => {
        this.loading = false;
        this.error = 'שגיאה בטעינת פרטי נותן השירות';
      }
    });
  }

  private initHeroHeight(): void {
    const bg = this.professionalHeroBg?.nativeElement;
    if (!bg) return;
    this.fullHeroHeight = window.innerWidth <= 768 ? 340 : 380;
    bg.style.height = this.fullHeroHeight + 'px';
    this.shrinkHero();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.shrinkHero();
      this.rafPending = false;
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.initHeroHeight();
    this.updateTestimonialsNav();
  }

  scrollTestimonials(direction: 'prev' | 'next'): void {
    const el = this.testimonialsScrollerRef?.nativeElement;
    if (!el) return;
    const amount = Math.round(el.clientWidth * 0.8);
    el.scrollBy({
      left: direction === 'next' ? -amount : amount,
      behavior: 'smooth'
    });
    window.setTimeout(() => this.updateTestimonialsNav(), 260);
  }

  updateTestimonialsNav(): void {
    const el = this.testimonialsScrollerRef?.nativeElement;
    if (!el) {
      this.canScrollTestimonialsPrev = false;
      this.canScrollTestimonialsNext = false;
      this.activeTestimonialIndex = 0;
      return;
    }

    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 2) {
      this.canScrollTestimonialsPrev = false;
      this.canScrollTestimonialsNext = false;
      this.activeTestimonialIndex = 0;
      return;
    }

    const current = Math.abs(el.scrollLeft);
    this.canScrollTestimonialsNext = current < maxScroll - 2;
    this.canScrollTestimonialsPrev = current > 2;
    this.activeTestimonialIndex = Math.max(
      0,
      Math.min(
        this.customerTestimonials.length - 1,
        Math.round((current / maxScroll) * (this.customerTestimonials.length - 1))
      )
    );
  }

  scrollToTestimonial(index: number): void {
    const el = this.testimonialsScrollerRef?.nativeElement;
    if (!el) return;
    const cards = Array.from(el.querySelectorAll<HTMLElement>('.testimonial-card'));
    const card = cards[index];
    if (!card) return;
    this.activeTestimonialIndex = index;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    window.setTimeout(() => this.updateTestimonialsNav(), 260);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (this.mediaLightboxIndex === null) return;
    if (e.key === 'ArrowLeft') this.mediaLightboxStep(1);
    if (e.key === 'ArrowRight') this.mediaLightboxStep(-1);
    if (e.key === 'Escape') this.closeMediaLightbox();
  }

  private shrinkHero(): void {
    const bg = this.professionalHeroBg?.nativeElement;
    if (!bg || this.fullHeroHeight === 0) return;

    const minHeight = 63;
    const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
    bg.style.height = newHeight + 'px';

    const progress = Math.min(1, window.scrollY / 160);
    const opacity = String(Math.max(0, 1 - progress));
    const heroContent = bg.querySelector('.hero-content') as HTMLElement | null;
    if (heroContent) heroContent.style.opacity = opacity;

    const collapseOverlay = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
    if (collapseOverlay) {
      const collapseRange = this.fullHeroHeight - minHeight;
      const collapseProgress = collapseRange > 0
        ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
        : 0;
      collapseOverlay.style.opacity = String(collapseProgress);
    }
  }

  toggleContact(): void {
    this.contactOpen = !this.contactOpen;
    if (this.contactOpen && this.professional) {
      this.analytics.trackButtonClick('contact', this.professional.id, this.professional.displayName);
    }
  }

  closePage(): void {
    if (this.professionalId) {
      this.close.emit();
      return;
    }
    this.router.navigate(['/professionals']);
  }

  retryLoad(): void {
    this.loadProfessional();
  }

  get heroBannerSrc(): string {
    return this.readString('bannerImageUrl', 'BannerImageUrl');
  }

  get profileImageSrc(): string {
    return this.readString('profileImageUrl', 'ProfileImageUrl') || '/default-user.svg';
  }

  get heroBackgroundSrc(): string {
    return this.heroBannerSrc || this.profileImageSrc;
  }

  get heroRole(): string {
    const categories = this.getCategoriesDisplay();
    return categories || 'נותן שירות בעולם המוזיקה';
  }

  get heroLocationLine(): string {
    if (!this.professional) return '';
    return this.getCityName(this.professional.cityId) || this.professional.cityName || '';
  }

  get detailsLine(): string {
    if (!this.professional) return '';
    const parts: string[] = [];
    if (this.professional.shortBio) parts.push(this.professional.shortBio);
    if (this.professional.yearsOfExperience) parts.push(`מעל ${this.professional.yearsOfExperience} שנות ניסיון`);
    if (this.getCategoriesDisplay()) parts.push(this.getCategoriesDisplay());
    if (this.getLocationLine()) parts.push(this.getLocationLine());
    return parts.join(', ');
  }

  get scheduleLine(): string {
    return '';
  }

  get socialLinks(): SocialLinkDto[] {
    return this.readArray<SocialLinkDto>('socialLinks', 'SocialLinks').filter(link => !!link?.url);
  }

  get featureTags(): string[] {
    if (!this.professional) return [];

    const tags: string[] = [];
    const parkingType = this.professional.parkingType ?? ServiceProviderParkingType.None;

    if (parkingType === ServiceProviderParkingType.ParkingAvailable) {
      tags.push('חניה במקום');
    }

    if (parkingType === ServiceProviderParkingType.FreeParking) {
      tags.push('חניה חינם במקום');
    }

    if (this.professional.hasAccessibleEntrance) {
      tags.push('כניסה נגישה');
    }

    if (this.professional.isAnash) {
      tags.push('מאנ"ש');
    }

    return tags;
  }

  get galleryItems(): Array<{ imageUrl: string; caption?: string }> {
    const galleryImages = this.readArray<any>('galleryImages', 'GalleryImages');
    if (!galleryImages.length) return [];

    return [...galleryImages]
      .filter(img => !!(img?.imageUrl || img?.ImageUrl))
      .sort((a, b) => this.toNumber(a?.order ?? a?.Order) - this.toNumber(b?.order ?? b?.Order))
      .map(img => ({
        imageUrl: img.imageUrl || img.ImageUrl,
        caption: img.caption || img.Caption
      }));
  }

  get hasNavigationTarget(): boolean {
    return !!this.getLocationLine();
  }

  get wazeNavigationUrl(): string {
    const location = this.getLocationLine();
    return `https://waze.com/ul?q=${encodeURIComponent(location)}&navigate=yes`;
  }

  get customerTestimonials(): ProviderDisplayTestimonial[] {
    return this.readArray<any>(
      'testimonials',
      'Testimonials',
      'recommendations',
      'Recommendations',
      'customerTestimonials',
      'CustomerTestimonials'
    )
      .map(item => ({
        text: item?.text || item?.Text || item?.content || item?.Content || '',
        clientName: item?.clientName || item?.ClientName || item?.studentName || item?.StudentName || item?.name || item?.Name || '',
        order: this.toNumber(item?.order ?? item?.Order)
      }))
      .filter(item => !!item.text)
      .sort((a, b) => a.order - b.order);
  }

  get testimonialDots(): number[] {
    return this.customerTestimonials.map((_, index) => index);
  }

  private rebuildGalleryMedia(): void {
    const media: GalleryMediaItem[] = [];
    const videoUrl = this.readString('videoUrl', 'VideoUrl');

    if (videoUrl) {
      media.push({
        type: 'video',
        videoUrl,
        imageUrl: this.getVideoThumbnailUrl(videoUrl) || this.heroBannerSrc || this.profileImageSrc,
        caption: 'סרטון היכרות'
      });
    }

    this.galleryItems.forEach(item => media.push({ type: 'image', ...item }));
    this.galleryMediaItems = media;
  }

  openMediaLightbox(index: number): void {
    if (index < 0 || index >= this.galleryMediaItems.length) return;
    this.mediaLightboxIndex = index;
    this.setActiveMedia();
  }

  closeMediaLightbox(): void {
    this.mediaLightboxIndex = null;
    this.activeMedia = null;
    this.activeVideoUrl = null;
  }

  mediaLightboxStep(delta: number): void {
    if (this.mediaLightboxIndex === null || this.galleryMediaItems.length === 0) return;
    const n = this.galleryMediaItems.length;
    this.mediaLightboxIndex = ((this.mediaLightboxIndex + delta) % n + n) % n;
    this.setActiveMedia();
  }

  private setActiveMedia(): void {
    if (this.mediaLightboxIndex === null) {
      this.activeMedia = null;
      this.activeVideoUrl = null;
      return;
    }

    const media = this.galleryMediaItems[this.mediaLightboxIndex] || null;
    this.activeMedia = media;
    this.activeVideoUrl = media?.type === 'video' && media.videoUrl
      ? this.getSafeVideoUrl(media.videoUrl)
      : null;
  }

  getCityName(cityId?: number | null): string {
    if (!cityId) return '';
    return this.cities.find(c => c.id === cityId)?.name || '';
  }

  getLocationLine(): string {
    if (!this.professional) return '';
    const city = this.getCityName(this.professional.cityId) || this.professional.cityName || '';
    return [city, this.professional.location].filter(Boolean).join(' · ');
  }

  getCategoriesDisplay(): string {
    if (!this.professional?.categories?.length) return '';
    return this.professional.categories
      .map(category => [category.categoryName, category.subCategory].filter(Boolean).join(' · '))
      .filter(Boolean)
      .join(', ');
  }

  encodeUri(value: string): string {
    return encodeURIComponent(value);
  }

  getShortUrl(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  getWhatsAppUrl(phoneNumber: string): string {
    const normalizedNumber = this.normalizeWhatsAppNumber(phoneNumber);
    const message = encodeURIComponent('היי, הגעתי דרך אתר אקורדישקייט');
    return `https://wa.me/${normalizedNumber}?text=${message}`;
  }

  private normalizeWhatsAppNumber(phoneNumber: string): string {
    let digits = phoneNumber.replace(/\D/g, '');

    if (digits.startsWith('00')) {
      digits = digits.slice(2);
    }

    if (digits.startsWith('0')) {
      return `972${digits.slice(1)}`;
    }

    return digits;
  }

  private getVideoThumbnailUrl(url: string): string {
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
  }

  getSafeVideoUrl(url: string): SafeResourceUrl {
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  private readString(...keys: string[]): string {
    const source = this.professional as unknown as Record<string, unknown> | null;
    if (!source) return '';

    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }

    return '';
  }

  private readArray<T>(...keys: string[]): T[] {
    const source = this.professional as unknown as Record<string, unknown> | null;
    if (!source) return [];

    for (const key of keys) {
      const value = source[key];
      if (Array.isArray(value)) return value as T[];
    }

    return [];
  }

  private toNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  getSocialPlatformName(platform: SocialPlatform): string {
    const names: Record<number, string> = {
      [SocialPlatform.Facebook]: 'Facebook',
      [SocialPlatform.Instagram]: 'Instagram',
      [SocialPlatform.YouTube]: 'YouTube',
      [SocialPlatform.Twitter]: 'Twitter / X',
      [SocialPlatform.TikTok]: 'TikTok',
      [SocialPlatform.Spotify]: 'Spotify',
      [SocialPlatform.Website]: 'אתר',
      [SocialPlatform.Zing]: 'Zing'
    };

    return names[platform] || 'קישור';
  }

  getSocialIconSvg(platform: SocialPlatform): SafeHtml {
    const icons: Record<number, string> = {
      [SocialPlatform.Facebook]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
      [SocialPlatform.Instagram]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke-width="3"/></svg>`,
      [SocialPlatform.YouTube]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75,15.02 15.5,12 9.75,8.98" fill="white"/></svg>`,
      [SocialPlatform.Twitter]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
      [SocialPlatform.TikTok]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.77a8.18 8.18 0 0 0 4.79 1.53V6.86a4.85 4.85 0 0 1-1.02-.17z"/></svg>`,
      [SocialPlatform.Spotify]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`,
      [SocialPlatform.Website]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
      [SocialPlatform.Zing]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/><path d="M8 10.5L16 7v2.5L8 13.5z"/></svg>`
    };

    return this.sanitizer.bypassSecurityTrustHtml(icons[platform] ?? icons[SocialPlatform.Website]);
  }
}
