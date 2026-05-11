import {
  Component, OnInit, OnDestroy,
  HostListener, ViewChild, ElementRef,
  ChangeDetectorRef, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AgencyProfileCardDto, AgencyPublicDto, AgencyGalleryImageDto, AgencySocialLinkDto } from '../../../models/agency.model';
import { Article } from '../../../models/article.model';
import { SongDto } from '../../../models/song.model';
import { AgencyService } from '../../../services/agency.service';
import { AnalyticsService } from '../../../services/analytics.service';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';
import { SongCardComponent } from '../../shared/song-card/song-card.component';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';
import { SocialIconsService } from '../../../services/social-icons.service';
import { DomSanitizer, SafeResourceUrl, SafeHtml } from '@angular/platform-browser';
import { SocialPlatform } from '../../../models/artist.model';

@Component({
  selector: 'app-agency-page',
  standalone: true,
  imports: [CommonModule, RouterModule, SongCardComponent, NewsBannerComponent, ImgFallbackDirective],
  templateUrl: './agency-page.component.html',
  styleUrls: ['./agency-page.component.css']
})
export class AgencyPageComponent implements OnInit, OnDestroy {

  @ViewChild('agencyHeroBg') agencyHeroBg?: ElementRef<HTMLDivElement>;
  @ViewChild('g3dWrapper') g3dWrapperRef?: ElementRef<HTMLDivElement>;
  @ViewChild('g3dSection') g3dSectionRef?: ElementRef<HTMLDivElement>;
  @ViewChild('g3dCardsEl') g3dCardsElRef?: ElementRef<HTMLDivElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly agencyService = inject(AgencyService);
  private readonly analytics = inject(AnalyticsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly socialIcons = inject(SocialIconsService);
  private readonly sanitizer = inject(DomSanitizer);

  agency: AgencyPublicDto | null = null;
  loading = true;
  error: string | null = null;

  contactOpen = false;
  imageLightboxUrl: string | null = null;
  imageLightboxCaption: string | null = null;
  videoLightboxUrl: string | null = null;
  contactItems: Array<{ type: string; label: string; value: string; href: string }> = [];

  private fullHeroHeight = 0;
  private rafPending = false;
  private scrollListener: (() => void) | null = null;

  readonly GALLERY_MIN_ITEMS = 5;

  private g3dItems: { el: HTMLElement }[] = [];
  private g3dScrollX = 0;
  private g3dCardW = 290;
  private g3dStep = 298;
  private g3dTrack = 0;
  private g3dVwHalf = 0;
  private g3dTouchStartX = 0;
  g3dBaseCount = 0;
  g3dActiveIndex = 0;

  private g3dOnWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    this.g3dScrollX = this.g3dMod(this.g3dScrollX + delta * 0.7, this.g3dTrack);
    this.g3dUpdateTransforms();
  };

  private g3dOnTouchStart = (e: TouchEvent): void => {
    this.g3dTouchStartX = e.touches[0].clientX;
  };

  private g3dOnTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    const dx = this.g3dTouchStartX - e.touches[0].clientX;
    this.g3dScrollX = this.g3dMod(this.g3dScrollX + dx * 1.5, this.g3dTrack);
    this.g3dTouchStartX = e.touches[0].clientX;
    this.g3dUpdateTransforms();
  };

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (slug) this.loadAgency(slug);
    });
  }

  ngOnDestroy(): void {
    this.cleanupScrollListener();
    const section = this.g3dSectionRef?.nativeElement;
    if (section) {
      section.removeEventListener('wheel', this.g3dOnWheel);
      section.removeEventListener('touchstart', this.g3dOnTouchStart);
      section.removeEventListener('touchmove', this.g3dOnTouchMove);
    }
  }

  private cleanupScrollListener(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
      this.scrollListener = null;
    }
  }

  loadAgency(slug: string): void {
    this.loading = true;
    this.error = null;
    this.cleanupScrollListener();
    this.agencyService.getAgencyBySlug(slug).subscribe({
      next: agency => {
        this.agency = agency;
        this.contactItems = this.buildContactItems();
        this.analytics.trackInteraction('agency_view', agency.id, agency.name);
        this.loading = false;
        setTimeout(() => {
          this.cdr.detectChanges();
          this.initHeroHeight();
          this.initGallery3D();
        }, 0);
      },
      error: () => {
        this.error = 'לא מצאנו את דף הסוכנות';
        this.loading = false;
      }
    });
  }

  get heroImage(): string {
    return this.agency?.bannerImageUrl || this.agency?.logoUrl || '';
  }

  get logoUrl(): string {
    return this.agency?.logoUrl || '';
  }

  get allProfiles(): AgencyProfileCardDto[] {
    if (!this.agency) return [];
    return [...this.agency.artists, ...this.agency.serviceProviders, ...this.agency.teachers];
  }

  get directSongs(): SongDto[] {
    return this.agency?.directSongs || [];
  }

  get directArticles(): Article[] {
    return this.agency?.directArticles || [];
  }

  get memberSongs(): SongDto[] {
    return this.agency?.memberSongs || [];
  }

  get memberArticles(): Article[] {
    return this.agency?.memberArticles || [];
  }

  get hasDirectContent(): boolean {
    return this.directArticles.length > 0 || this.directSongs.length > 0;
  }

  get hasMemberContent(): boolean {
    return this.memberArticles.length > 0 || this.memberSongs.length > 0;
  }

  get hasProfiles(): boolean {
    return this.allProfiles.length > 0;
  }

  get directContentCount(): number {
    return this.directArticles.length + this.directSongs.length;
  }

  get memberContentCount(): number {
    return this.memberArticles.length + this.memberSongs.length;
  }

  get agencyThemeVars(): Record<string, string> {
    const primary = this.agency?.brandPrimaryColor || '#ddff53';
    const secondary = this.agency?.brandSecondaryColor || '#000000';
    const text = this.agency?.brandTextColor || '#000000';
    return {
      '--agency-primary': primary,
      '--agency-secondary': secondary,
      '--agency-text': text
    };
  }

  goToProfile(profile: AgencyProfileCardDto): void {
    if (this.agency) {
      this.analytics.trackInteraction('agency_profile_click', this.agency.id, `${this.agency.name} | ${profile.profileType} | ${profile.name}`);
    }
    this.router.navigateByUrl(profile.profileUrl);
  }

  goToArticle(article: Article): void {
    if (this.agency) {
      this.analytics.trackInteraction('agency_content_click', this.agency.id, `${this.agency.name} | article | ${article.title}`);
    }
    this.router.navigate(['/news', article.slug]);
  }

  goToSong(song: SongDto): void {
    if (this.agency) {
      this.analytics.trackInteraction('agency_content_click', this.agency.id, `${this.agency.name} | song | ${song.title}`);
    }
    this.router.navigate(['/song', song.id]);
  }

  toggleContact(): void {
    this.contactOpen = !this.contactOpen;
    if (this.contactOpen && this.agency) {
      this.analytics.trackButtonClick('contact', this.agency.id, this.agency.name);
    }
  }

  trackContact(type: string): void {
    if (!this.agency) return;
    this.analytics.trackInteraction(`agency_contact_${type}`, this.agency.id, this.agency.name);
  }

  getWhatsAppUrl(phoneNumber: string): string {
    let digits = phoneNumber.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = `972${digits.slice(1)}`;
    return `https://wa.me/${digits}?text=${encodeURIComponent('היי, הגעתי דרך אקורדישקייט')}`;
  }

  getContactItems(): Array<{ type: string; label: string; value: string; href: string }> {
    return this.contactItems;
  }

  private buildContactItems(): Array<{ type: string; label: string; value: string; href: string }> {
    const items: Array<{ type: string; label: string; value: string; href: string }> = [];
    if (!this.agency) return items;

    if (this.agency.phoneNumber) {
      items.push({
        type: 'phone',
        label: 'טלפון',
        value: this.agency.phoneNumber,
        href: `tel:${this.agency.phoneNumber}`
      });
    }

    if (this.agency.whatsAppNumber) {
      items.push({
        type: 'whatsapp',
        label: 'ווטסאפ',
        value: this.agency.whatsAppNumber,
        href: this.getWhatsAppUrl(this.agency.whatsAppNumber)
      });
    }

    if (this.agency.email) {
      items.push({
        type: 'email',
        label: 'אימייל',
        value: this.agency.email,
        href: `mailto:${this.agency.email}`
      });
    }

    if (this.agency.websiteUrl) {
      items.push({
        type: 'website',
        label: 'אתר',
        value: this.getShortUrl(this.agency.websiteUrl),
        href: this.agency.websiteUrl
      });
    }

    return items;
  }

  get hasContact(): boolean {
    return !!(this.agency?.phoneNumber || this.agency?.whatsAppNumber || this.agency?.email || this.agency?.websiteUrl);
  }

  get galleryImages(): AgencyGalleryImageDto[] {
    return this.agency?.galleryImages || [];
  }

  get galleryItems(): Array<{ type: 'image' | 'video'; imageUrl?: string; videoUrl?: string; caption?: string; title?: string }> {
    if (!this.agency) return [];
    return this.galleryImages.map(img => ({
      type: 'image' as const,
      imageUrl: img.imageUrl,
      caption: img.caption
    }));
  }

  get hasGallery(): boolean {
    return this.galleryItems.length >= this.GALLERY_MIN_ITEMS;
  }

  get galleryShouldShow(): boolean {
    return this.hasGallery;
  }

  get g3dDots(): number[] {
    return this.g3dBaseCount > 0 ? Array(this.g3dBaseCount).fill(0) : [];
  }

  get socialLinks(): AgencySocialLinkDto[] {
    return this.agency?.socialLinks || [];
  }

  get hasSocialLinks(): boolean {
    return this.socialLinks.length > 0;
  }

  get memberArticlesFirstRow(): Article[] {
    return this.splitForRows(this.memberArticles).top;
  }

  get memberArticlesSecondRow(): Article[] {
    return this.splitForRows(this.memberArticles).bottom;
  }

  get useScrollingMemberArticles(): boolean {
    return this.memberArticles.length >= 2;
  }

  get memberSongsFirstRow(): SongDto[] {
    return this.splitForRows(this.memberSongs).top;
  }

  get memberSongsSecondRow(): SongDto[] {
    return this.splitForRows(this.memberSongs).bottom;
  }

  get useScrollingMemberSongs(): boolean {
    return this.memberSongs.length >= 2;
  }

  private splitForRows<T>(items: T[]): { top: T[]; bottom: T[] } {
    if (items.length <= 1) return { top: items, bottom: [] };
    const half = Math.ceil(items.length / 2);
    return { top: items.slice(0, half), bottom: items.slice(half) };
  }

  get quickWhatsAppNumber(): string {
    return this.agency?.whatsAppNumber || '';
  }

  getShortUrl(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  profileTypeLabel(profile: AgencyProfileCardDto): string {
    if (profile.isTeacher) return 'מורה';
    if (profile.profileType === 'artist') return 'אמן';
    return 'נותן שירות';
  }

  // ============================================================
  // Hero scroll shrink
  // ============================================================

  private initHeroHeight(): void {
    const bg = this.agencyHeroBg?.nativeElement;
    if (!bg) return;
    this.fullHeroHeight = window.innerWidth <= 768 ? 340 : 380;
    bg.style.height = this.fullHeroHeight + 'px';
    this.shrinkHero();

    this.cleanupScrollListener();
    this.scrollListener = this.onScroll.bind(this);
    window.addEventListener('scroll', this.scrollListener, { passive: true });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.initHeroHeight();
    this.g3dHandleResize();
  }

  private onScroll(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.shrinkHero();
      this.rafPending = false;
    });
  }

  private shrinkHero(): void {
    const bg = this.agencyHeroBg?.nativeElement;
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.contactOpen) return;
    const target = event.target as HTMLElement | null;
    const wrap = document.querySelector('.contact-action-wrap');
    if (wrap && !wrap.contains(target)) {
      this.contactOpen = false;
      this.cdr.detectChanges();
    }
  }

  // ============================================================
  // 3D Gallery
  // ============================================================

  private g3dMod(n: number, m: number): number {
    return ((n % m) + m) % m;
  }

  private g3dGetTransform(screenX: number): string {
    const norm = Math.max(-1, Math.min(1, screenX / this.g3dVwHalf));
    const invNorm = 1 - Math.abs(norm);
    const ry = -norm * 28;
    const tz = invNorm * 140;
    const scale = 0.82 + invNorm * 0.18;
    return `translate3d(${screenX}px,-50%,${tz}px) rotateY(${ry}deg) scale(${scale})`;
  }

  private g3dUpdateTransforms(): void {
    if (this.g3dTrack === 0 || this.g3dVwHalf === 0) return;
    const half = this.g3dTrack / 2;
    for (let i = 0; i < this.g3dItems.length; i++) {
      let pos = i * this.g3dStep - this.g3dScrollX;
      if (pos < -half) pos += this.g3dTrack;
      if (pos > half) pos -= this.g3dTrack;
      const norm = Math.max(-1, Math.min(1, pos / this.g3dVwHalf));
      const tz = (1 - Math.abs(norm)) * 140;
      this.g3dItems[i].el.style.transform = this.g3dGetTransform(pos);
      this.g3dItems[i].el.style.zIndex = String(1000 + Math.round(tz));
      const blur = Math.abs(norm) < 0.35 ? 0 : Math.pow(Math.abs(norm), 1.2) * 5;
      this.g3dItems[i].el.style.filter = blur > 0 ? `blur(${blur.toFixed(2)}px)` : '';
    }
    if (this.g3dBaseCount > 0) {
      const activeIdx = this.g3dMod(Math.round(this.g3dScrollX / this.g3dStep), this.g3dBaseCount);
      if (activeIdx !== this.g3dActiveIndex) {
        this.g3dActiveIndex = activeIdx;
        this.cdr.detectChanges();
      }
    }
  }

  private g3dHandleResize(): void {
    const section = this.g3dSectionRef?.nativeElement;
    if (section) this.g3dVwHalf = section.clientWidth * 0.5 || window.innerWidth * 0.5;
    const sample = this.g3dItems[0]?.el;
    if (sample) {
      const rect = sample.getBoundingClientRect();
      this.g3dCardW = rect.width || this.g3dCardW;
      this.g3dStep = this.g3dCardW + 8;
      this.g3dTrack = this.g3dItems.length * this.g3dStep;
    }
    this.g3dUpdateTransforms();
  }

  private initGallery3D(): void {
    const section = this.g3dSectionRef?.nativeElement;
    const cardsEl = this.g3dCardsElRef?.nativeElement;
    if (!section || !cardsEl) return;

    section.removeEventListener('wheel', this.g3dOnWheel);
    section.removeEventListener('touchstart', this.g3dOnTouchStart);
    section.removeEventListener('touchmove', this.g3dOnTouchMove);

    const baseItems = this.galleryItems;
    if (baseItems.length < this.GALLERY_MIN_ITEMS) return;
    this.g3dBaseCount = baseItems.length;
    this.g3dActiveIndex = 0;

    let items = [...baseItems];
    while (items.length < 6) items = [...items, ...baseItems];

    cardsEl.innerHTML = '';
    this.g3dItems = [];

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'g3d-card';

      if (item.type === 'image' && item.imageUrl) {
        const img = document.createElement('img');
        img.src = item.imageUrl;
        img.alt = item.caption || '';
        img.draggable = false;
        card.appendChild(img);
        if (item.caption) {
          const cap = document.createElement('div');
          cap.className = 'g3d-card-caption';
          cap.textContent = item.caption;
          card.appendChild(cap);
        }
        const imageUrl = item.imageUrl;
        const caption = item.caption || null;
        card.addEventListener('click', () => this.openImageLightbox(imageUrl, caption));
        card.style.cursor = 'pointer';
      } else if (item.type === 'video' && item.videoUrl) {
        const thumbnailUrl = this.getYouTubeThumbnail(item.videoUrl);
        if (thumbnailUrl) {
          const img = document.createElement('img');
          img.src = thumbnailUrl;
          img.alt = item.title || '';
          img.draggable = false;
          card.appendChild(img);
        }
        const overlay = document.createElement('div');
        overlay.className = 'g3d-card-play-overlay';
        overlay.innerHTML = `
          <div class="g3d-card-play">
            <svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">
              <polygon points="5,3 19,12 5,21"/>
            </svg>
          </div>
          ${item.title ? `<div class="g3d-card-video-title">${item.title}</div>` : ''}
        `;
        card.appendChild(overlay);
        const videoUrl = item.videoUrl;
        card.addEventListener('click', () => this.openVideoLightbox(videoUrl));
        card.style.cursor = 'pointer';
      }

      card.addEventListener('mouseenter', () => {
        card.style.filter = '';
        card.style.zIndex = '2000';
      });
      card.addEventListener('mouseleave', () => {
        this.g3dUpdateTransforms();
      });

      cardsEl.appendChild(card);
      this.g3dItems.push({ el: card });
    });

    section.addEventListener('wheel', this.g3dOnWheel, { passive: false });
    section.addEventListener('touchstart', this.g3dOnTouchStart, { passive: true });
    section.addEventListener('touchmove', this.g3dOnTouchMove, { passive: false });

    const initMeasure = () => {
      const sample = this.g3dItems[0]?.el;
      if (!sample) return;
      const sectionW = section.clientWidth || window.innerWidth;
      this.g3dVwHalf = sectionW * 0.5;
      const rect = sample.getBoundingClientRect();
      this.g3dCardW = rect.width || 290;
      this.g3dStep = this.g3dCardW + 8;
      this.g3dTrack = this.g3dItems.length * this.g3dStep;
      this.g3dScrollX = 0;
      this.g3dUpdateTransforms();
    };
    setTimeout(initMeasure, 150);
  }

  g3dArrowPrev(): void {
    this.g3dScrollX = this.g3dMod(this.g3dScrollX - this.g3dStep, this.g3dTrack);
    this.g3dUpdateTransforms();
  }

  g3dArrowNext(): void {
    this.g3dScrollX = this.g3dMod(this.g3dScrollX + this.g3dStep, this.g3dTrack);
    this.g3dUpdateTransforms();
  }

  g3dGoTo(index: number): void {
    this.g3dScrollX = this.g3dMod(index * this.g3dStep, this.g3dTrack);
    this.g3dUpdateTransforms();
  }

  // ============================================================
  // Image / Video Lightbox
  // ============================================================

  openImageLightbox(imageUrl: string, caption: string | null): void {
    this.imageLightboxUrl = imageUrl;
    this.imageLightboxCaption = caption;
  }

  closeImageLightbox(): void {
    this.imageLightboxUrl = null;
    this.imageLightboxCaption = null;
  }

  openVideoLightbox(videoUrl: string): void {
    this.videoLightboxUrl = videoUrl;
  }

  closeVideoLightbox(): void {
    this.videoLightboxUrl = null;
  }

  getYouTubeThumbnail(videoUrl: string): string {
    const videoId = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
  }

  getYouTubeEmbedUrl(videoUrl: string): SafeResourceUrl {
    const videoId = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : videoUrl;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      if (this.videoLightboxUrl) this.closeVideoLightbox();
      else if (this.imageLightboxUrl) this.closeImageLightbox();
    }
  }

  // ============================================================
  // Social Icons
  // ============================================================

  getSocialIconSvg(platform: SocialPlatform): SafeHtml {
    return this.socialIcons.getIconSvg(platform);
  }
}
