import {
  Component, Input, Output, EventEmitter, OnInit, AfterViewInit, OnDestroy,
  OnChanges, HostListener, ViewChild, ElementRef, ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
import { LanguageService } from '../../../services/language.service';
import { AgencyBadgeDto, AgencyContactMode } from '../../../models/agency.model';
import { AgencyService } from '../../../services/agency.service';
import { SeoService } from '../../../services/seo.service';
import { SongCardComponent } from '../../shared/song-card/song-card.component';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';
import { Article, ArticleContentType, ArticleStatus } from '../../../models/article.model';
import { CloudflareImagePipe } from '../../../pipes/cloudflare-image.pipe';
import { getSocialPlatformIconSvg, normalizeExternalLinkUrl, normalizeSocialPlatform } from '../../../utils/social-platform-icons';

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
  imports: [CommonModule, RouterModule, ImgFallbackDirective, SongCardComponent, NewsBannerComponent, CloudflareImagePipe],
  templateUrl: './professional-profile-modal.component.html',
  styleUrls: ['./professional-profile-modal.component.css']
})
export class ProfessionalProfileModalComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {

  @Input() professionalId: number | null = null;
  @Output() close = new EventEmitter<void>();

  @ViewChild('professionalHeroBg') professionalHeroBg?: ElementRef<HTMLDivElement>;
  @ViewChild('testimonialsScroller') testimonialsScrollerRef?: ElementRef<HTMLDivElement>;

  private readonly analytics = inject(AnalyticsService);
  private readonly langService = inject(LanguageService);
  private readonly seo = inject(SeoService);

  professional: MusicServiceProviderDto | null = null;
  agencyBadge: AgencyBadgeDto | null = null;
  AgencyContactMode = AgencyContactMode;
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

  songs: any[] = [];
  articles: Article[] = [];
  loadingSongs = false;
  loadingArticles = false;
  songsExpanded = false;
  articlesExpanded = false;
  defaultSongsCount = 6;

  private fullHeroHeight = 0;
  private rafPending = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private professionalService: MusicServiceProviderService,
    private citiesService: CitiesService,
    private agencyService: AgencyService,
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

    this.professionalService.getServiceProviderById(professionalId).subscribe({
      next: professional => {
        this.professional = professional;
        this.applySeo(professional);
        this.loadAgencyBadge(professionalId);
        this.branches = professional.branches ?? [];
        this.rebuildGalleryMedia();
        this.loading = false;
        this.loadServiceProviderSongs(professionalId);
        this.loadServiceProviderArticles(professionalId);
        setTimeout(() => {
          this.cdr.detectChanges();
          this.initHeroHeight();
          this.updateTestimonialsNav();
        }, 0);
      },
      error: () => {
        this.loading = false;
        this.error = this.langService.translate('pro_modal.error_load');
      }
    });
  }

  private loadAgencyBadge(profileId: number): void {
    this.agencyBadge = null;
    this.agencyService.getProfileBadge('serviceProvider', profileId).subscribe({
      next: badge => this.agencyBadge = badge?.showBadge ? badge : null,
      error: () => this.agencyBadge = null
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
    this.updateDefaultSongsCount();
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
      if (this.agencyBadge) {
        this.analytics.trackInteraction('agency_contact_panel', this.agencyBadge.agencyId, `${this.agencyBadge.agencyName} | ${this.professional.displayName}`);
      }
    }
  }

  get hasContent(): boolean {
    return this.songs.length > 0 || this.articles.length > 0;
  }

  get visibleSongs(): any[] {
    return this.songsExpanded ? this.songs : this.songs.slice(0, this.defaultSongsCount);
  }

  get visibleArticles(): Article[] {
    return this.articlesExpanded ? this.articles : this.articles.slice(0, 6);
  }

  toggleSongsExpanded(): void {
    this.songsExpanded = !this.songsExpanded;
  }

  toggleArticlesExpanded(): void {
    this.articlesExpanded = !this.articlesExpanded;
  }

  private loadServiceProviderSongs(id: number): void {
    this.loadingSongs = true;
    this.songs = [];
    this.professionalService.getServiceProviderSongs(id, 24).subscribe({
      next: (songs) => {
        this.songs = songs;
        this.loadingSongs = false;
        this.updateDefaultSongsCount();
      },
      error: () => { this.loadingSongs = false; }
    });
  }

  private loadServiceProviderArticles(id: number): void {
    this.loadingArticles = true;
    this.articles = [];
    this.professionalService.getServiceProviderArticles(id, 24).subscribe({
      next: (rawArticles: any[]) => {
        this.articles = rawArticles.map((a: any) => this.toArticleBannerInput(a));
        this.loadingArticles = false;
      },
      error: () => { this.loadingArticles = false; }
    });
  }

  private toArticleBannerInput(item: any): Article {
    const contentType = item.contentType === 1 ? ArticleContentType.Blog : ArticleContentType.News;
    return {
      id: item.id,
      title: item.title || '',
      subtitle: item.subtitle,
      content: '',
      featuredImageUrl: item.featuredImageUrl || item.imageUrl || 'assets/default-article.png',
      publishDate: '',
      createdAt: item.createdAt || '',
      authorName: item.authorName || '',
      categoryIds: item.categoryIds || [],
      categoryNames: item.categoryNames || [],
      contentType,
      slug: item.slug || '',
      shortDescription: item.shortDescription,
      isFeatured: false,
      displayOrder: 0,
      status: ArticleStatus.Published,
      isPremium: false,
      viewCount: item.viewCount || 0,
      likeCount: item.likeCount || 0,
      tagIds: item.tagIds || [],
      tags: item.tags || [],
      galleryImages: [],
      taggedArtists: item.taggedArtists || []
    };
  }

  private updateDefaultSongsCount(): void {
    const vw = window.innerWidth;
    let cols: number;
    if (vw <= 600) {
      cols = 1;
    } else {
      const containerWidth = Math.min(vw - 32, 760);
      cols = Math.max(1, Math.floor((containerWidth + 10) / (260 + 10)));
    }
    this.defaultSongsCount = cols * 2;
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
    return categories || this.langService.translate('pro_modal.default_role');
  }

  get heroLocationLine(): string {
    if (!this.professional) return '';
    return this.getCityName(this.professional.cityId) || this.professional.cityName || '';
  }

  get detailsLine(): string {
    if (!this.professional) return '';
    const parts: string[] = [];
    if (this.professional.shortBio) parts.push(this.professional.shortBio);
    if (this.professional.yearsOfExperience) parts.push(`${this.langService.translate('pro_modal.years_exp_prefix')} ${this.professional.yearsOfExperience} ${this.langService.translate('pro_modal.years_exp_suffix')}`);
    if (this.getCategoriesDisplay()) parts.push(this.getCategoriesDisplay());
    if (!this.hasBranches && this.getLocationLine()) parts.push(this.getLocationLine());
    return parts.join(', ');
  }

  get scheduleLine(): string {
    return '';
  }

  get socialLinks(): SocialLinkDto[] {
    return this.readArray<SocialLinkDto>('socialLinks', 'SocialLinks')
      .filter(link => !!link?.url?.trim())
      .map(link => ({
        ...link,
        platform: normalizeSocialPlatform(link.platform),
        url: link.url.trim()
      }));
  }

  get featureTags(): string[] {
    if (!this.professional) return [];

    const tags: string[] = [];
    const parkingType = this.professional.parkingType ?? ServiceProviderParkingType.None;

    if (parkingType === ServiceProviderParkingType.ParkingAvailable) {
      tags.push(this.langService.translate('pro_modal.parking'));
    }

    if (parkingType === ServiceProviderParkingType.FreeParking) {
      tags.push(this.langService.translate('pro_modal.free_parking'));
    }

    if (this.professional.hasAccessibleEntrance) {
      tags.push(this.langService.translate('pro_modal.accessible'));
    }

    if (this.professional.isAnash) {
      tags.push(this.langService.translate('pro_modal.anash'));
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
    return !this.hasBranches && !!this.getLocationLine();
  }

  get hasBranches(): boolean {
    return this.branches.length > 0;
  }

  get showDirectContact(): boolean {
    return !this.agencyBadge ||
      this.agencyBadge.contactMode === AgencyContactMode.Direct ||
      this.agencyBadge.contactMode === AgencyContactMode.Both;
  }

  get showAgencyContact(): boolean {
    return !!this.agencyBadge &&
      (this.agencyBadge.contactMode === AgencyContactMode.Agency ||
       this.agencyBadge.contactMode === AgencyContactMode.Both);
  }

  get quickWhatsAppNumber(): string {
    if (this.showAgencyContact && this.agencyBadge?.whatsAppNumber) return this.agencyBadge.whatsAppNumber;
    return this.professional?.whatsAppNumber || '';
  }

  goToAgency(): void {
    if (this.agencyBadge) this.router.navigate(['/agency', this.agencyBadge.agencySlug]);
  }

  trackAgencyContact(type: 'phone' | 'whatsapp' | 'email' | 'website'): void {
    if (!this.agencyBadge || !this.professional) return;
    this.analytics.trackInteraction(`agency_contact_${type}`, this.agencyBadge.agencyId, `${this.agencyBadge.agencyName} | ${this.professional.displayName}`);
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
    const seenVideoUrls = new Set<string>();
    const addVideo = (videoUrl: string, caption = this.langService.translate('pro_modal.intro_video')) => {
      const normalizedUrl = videoUrl.trim();
      if (!normalizedUrl || seenVideoUrls.has(normalizedUrl)) return;

      seenVideoUrls.add(normalizedUrl);
      media.push({
        type: 'video',
        videoUrl: normalizedUrl,
        imageUrl: this.getVideoThumbnailUrl(normalizedUrl) || this.heroBannerSrc || this.profileImageSrc,
        caption
      });
    };

    this.extractVideoLinks(this.readString('videoUrl', 'VideoUrl')).forEach(url => addVideo(url));
    this.galleryItems.forEach(item => {
      if (this.isVideoUrl(item.imageUrl)) {
        addVideo(item.imageUrl, item.caption || this.langService.translate('pro_modal.video'));
        return;
      }

      media.push({ type: 'image', ...item });
    });
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

  getBranchLocationLine(branch: ServiceProviderBranchDto): string {
    return [this.getCityName(branch.cityId), branch.address].filter(Boolean).join(' · ');
  }

  getBranchNavigationUrl(branch: ServiceProviderBranchDto): string {
    return `https://waze.com/ul?q=${encodeURIComponent(this.getBranchLocationLine(branch) || branch.name)}&navigate=yes`;
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
    const message = encodeURIComponent(this.langService.translate('pro_modal.whatsapp_msg'));
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

  private extractVideoLinks(value: string): string[] {
    return value
      .split(/\r?\n|,/)
      .map(url => url.trim())
      .filter(url => this.isVideoUrl(url));
  }

  private isVideoUrl(url?: string): boolean {
    if (!url) return false;
    return /(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(url);
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
    const normalizedPlatform = normalizeSocialPlatform(platform);
    const names: Record<number, string> = {
      [SocialPlatform.Facebook]: 'Facebook',
      [SocialPlatform.Instagram]: 'Instagram',
      [SocialPlatform.YouTube]: 'YouTube',
      [SocialPlatform.Twitter]: 'Twitter / X',
      [SocialPlatform.TikTok]: 'TikTok',
      [SocialPlatform.Spotify]: 'Spotify',
      [SocialPlatform.Website]: this.langService.translate('pro_modal.link'),
      [SocialPlatform.Zing]: 'Zing'
    };

    return names[normalizedPlatform] || this.langService.translate('pro_modal.link');
  }

  getSocialIconSvg(platform: SocialPlatform): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(getSocialPlatformIconSvg(normalizeSocialPlatform(platform)));
  }

  getSocialLinkHref(url: string): string {
    return normalizeExternalLinkUrl(url);
  }

  getExternalLinkHref(url: string | undefined | null): string {
    return normalizeExternalLinkUrl(url);
  }

  private applySeo(professional: MusicServiceProviderDto): void {
    const cityName = this.getCityName(professional.cityId);
    const categories = professional.categories?.length
      ?       professional.categories.map(c => c.categoryName).filter(Boolean).join(', ')
      : 'בעל מקצוע';
    const location = cityName ? ` ב${cityName}` : '';
    const title = `${professional.displayName} - ${categories}${location}`;
    const description = professional.shortBio
      ? professional.shortBio.replace(/\s+/g, ' ').trim().slice(0, 160)
      : `${professional.displayName} – ${categories}${location}. ${professional.yearsOfExperience ? `מעל ${professional.yearsOfExperience} שנות ניסיון. ` : ''}לפרטים היכנסו לאקורדישקייט.`;

    this.seo.set({
      title,
      description,
      path: `/professional/${professional.id}`,
      imageUrl: professional.profileImageUrl || professional.bannerImageUrl,
      type: 'profile',
      structuredData: [
        this.seo.organizationSchema(),
        this.seo.breadcrumbSchema([
          { name: 'בית', path: '/' },
          { name: 'אינדקס עולם המוזיקה', path: '/professionals' },
          { name: professional.displayName, path: `/professional/${professional.id}` }
        ])
      ]
    });
  }
}
