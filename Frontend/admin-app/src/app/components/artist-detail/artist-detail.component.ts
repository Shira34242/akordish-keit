import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef, ChangeDetectorRef, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { ArtistService } from '../../services/artist.service';
import { AuthService } from '../../services/auth.service';
import { ArtistPageService } from '../../services/artist-page.service';
import { Artist, SocialPlatform } from '../../models/artist.model';
import { SongDto } from '../../models/song.model';
import { Article } from '../../models/article.model';
import { Event as EventModel, UpcomingEventDto } from '../../models/event.model';
import { NewsBannerComponent } from '../shared/news-banner/news-banner.component';
import { ArtistEditModalComponent } from '../admin/artists/artist-edit-modal.component';
import { EventCardComponent } from '../shared/event-card/event-card.component';
import { EventModalComponent } from '../shared/event-modal/event-modal.component';
import { LanguageService } from '../../services/language.service';
import { SeoService } from '../../services/seo.service';
import { AgencyBadgeDto, AgencyContactMode } from '../../models/agency.model';
import { AgencyService } from '../../services/agency.service';
import { songSlug } from '../../utils/slug';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-artist-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, NewsBannerComponent, ArtistEditModalComponent, EventCardComponent, EventModalComponent],
  templateUrl: './artist-detail.component.html',
  styleUrls: ['./artist-detail.component.css']
})
export class ArtistDetailComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('artistHeroBg') artistHeroBg?: ElementRef<HTMLDivElement>;
  @ViewChild('g3dWrapper') g3dWrapperRef?: ElementRef<HTMLDivElement>;
  @ViewChild('g3dSection') g3dSectionRef?: ElementRef<HTMLDivElement>;
  @ViewChild('g3dCardsEl') g3dCardsElRef?: ElementRef<HTMLDivElement>;
  @ViewChild('bioTextEl') bioTextEl?: ElementRef<HTMLParagraphElement>;
  @ViewChild('songsGridEl') songsGridEl?: ElementRef<HTMLDivElement>;

  artist: Artist | null = null;
  agencyBadge: AgencyBadgeDto | null = null;
  songs: SongDto[] = [];
  articles: Article[] = [];
  events: UpcomingEventDto[] = [];
  selectedEvent: UpcomingEventDto | null = null;

  loading = true;
  loadingSongs = false;
  loadingArticles = false;
  loadingEvents = false;

  songsPage = 1;
  articlesPage = 1;
  totalSongs = 0;
  totalArticles = 0;
  songsExpanded = false;
  articlesExpanded = false;
  defaultSongsCount = 6;
  bioExpanded = false;
  bioOverflows = false;

  SocialPlatform = SocialPlatform;

  private readonly langService = inject(LanguageService);
  private readonly seo = inject(SeoService);

  // עריכת דף אמן
  showEditModal = false;
  private editSub?: Subscription;

  // וידאו ב-lightbox
  videoLightboxUrl: string | null = null;

  // תמונה ב-lightbox
  imageLightboxUrl: string | null = null;
  imageLightboxCaption: string | null = null;

  // ========== Hero ==========
  private fullHeroHeight = 0;
  private rafPending = false;

  // ========== 3D Gallery ==========
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private artistService: ArtistService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private artistPageService: ArtistPageService,
    private agencyService: AgencyService,
    private analytics: AnalyticsService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      if (id) this.loadArtist(id);
    });

    this.editSub = this.artistPageService.editTrigger$.subscribe(() => {
      if (this.canEdit) {
        this.showEditModal = true;
      }
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    const section = this.g3dSectionRef?.nativeElement;
    if (section) {
      section.removeEventListener('wheel', this.g3dOnWheel);
      section.removeEventListener('touchstart', this.g3dOnTouchStart);
      section.removeEventListener('touchmove', this.g3dOnTouchMove);
    }
    this.editSub?.unsubscribe();
    this.artistPageService.setOwnerId(null);
  }

  get canEdit(): boolean {
    const user = this.authService.currentUserValue;
    if (!user) return false;
    if (user.role === 'Admin' || user.role === 4) return true;
    return !!(this.artist?.userId && user.id === this.artist.userId);
  }

  openEditModal(): void {
    this.showEditModal = true;
  }

  onEditModalClose(): void {
    this.showEditModal = false;
  }

  onEditModalSaved(): void {
    this.showEditModal = false;
    if (this.artist) this.loadArtist(this.artist.id);
  }

  loadArtist(id: number): void {
    this.loading = true;
    this.artistService.getArtistById(id).subscribe({
      next: (artist) => {
        this.artist = artist;
        this.loadAgencyBadge(id);
        this.loading = false;
        this.applySeo(artist);
        this.artistPageService.setOwnerId(artist.userId ?? null);
        this.loadSongs(id);
        this.loadArticles(id);
        this.loadEvents(id);
        this.updateDefaultSongsCount();
        setTimeout(() => {
          this.cdr.detectChanges();
          this.initHeroHeight();
          this.initGallery3D();
          this.checkBioOverflow();
        }, 0);
      },
      error: () => {
        this.loading = false;
        this.router.navigate(['/404']);
      }
    });
  }

  private loadAgencyBadge(profileId: number): void {
    this.agencyBadge = null;
    this.agencyService.getProfileBadge('artist', profileId).subscribe({
      next: badge => this.agencyBadge = badge?.showBadge ? badge : null,
      error: () => this.agencyBadge = null
    });
  }

  AgencyContactMode = AgencyContactMode;
  contactOpen = false;

  goToAgency(): void {
    if (!this.agencyBadge || !this.artist) return;
    this.analytics.trackInteraction('agency_profile_click', this.agencyBadge.agencyId, `${this.agencyBadge.agencyName} | artist | ${this.artist.name}`);
    this.router.navigate(['/agency', this.agencyBadge.agencySlug]);
  }

  toggleContact(): void {
    this.contactOpen = !this.contactOpen;
    if (this.contactOpen && this.agencyBadge && this.artist) {
      this.analytics.trackButtonClick('contact', this.agencyBadge.agencyId, `${this.agencyBadge.agencyName} | ${this.artist.name}`);
    }
  }

  trackAgencyContact(type: string): void {
    if (!this.agencyBadge || !this.artist) return;
    this.analytics.trackInteraction(`agency_contact_${type}`, this.agencyBadge.agencyId, `${this.agencyBadge.agencyName} | ${this.artist.name}`);
  }

  getWhatsAppUrl(phoneNumber: string): string {
    const digits = phoneNumber.replace(/\D/g, '');
    return `https://wa.me/${digits}`;
  }

  getSongLink(song: SongDto): (string | number)[] {
    const slug = songSlug(song);
    return slug ? ['/song', song.id, slug] : ['/song', song.id];
  }

  get showAgencyContact(): boolean {
    return !!this.agencyBadge &&
      (this.agencyBadge.contactMode === AgencyContactMode.Agency ||
       this.agencyBadge.contactMode === AgencyContactMode.Both);
  }

  get hasAgencyContactDetails(): boolean {
    return this.showAgencyContact && !!(
      this.agencyBadge?.phoneNumber ||
      this.agencyBadge?.whatsAppNumber ||
      this.agencyBadge?.email ||
      this.agencyBadge?.websiteUrl
    );
  }

  get agencyContactItems(): Array<{ label: string; value: string; href: string; type: string }> {
    const items: Array<{ label: string; value: string; href: string; type: string }> = [];
    if (!this.agencyBadge) return items;
    const b = this.agencyBadge;
    if (b.phoneNumber) {
      items.push({ label: 'טלפון', value: b.phoneNumber, href: 'tel:' + b.phoneNumber, type: 'phone' });
    }
    if (b.whatsAppNumber) {
      items.push({ label: 'ווטסאפ', value: b.whatsAppNumber, href: this.getWhatsAppUrl(b.whatsAppNumber), type: 'whatsapp' });
    }
    if (b.email) {
      items.push({ label: 'אימייל', value: b.email, href: 'mailto:' + b.email, type: 'email' });
    }
    if (b.websiteUrl) {
      items.push({ label: 'אתר', value: this.getShortUrl(b.websiteUrl), href: b.websiteUrl, type: 'website' });
    }
    return items;
  }

  private applySeo(artist: Artist): void {
    const path = `/artist/${artist.id}`;
    const descFallback = `${this.langService.translate('artist.seo_desc_pre')}${artist.name}${this.langService.translate('artist.seo_desc_suf')}`;
    const rawDescription = artist.shortBio || artist.biography || descFallback;
    const description = rawDescription.replace(/\s+/g, ' ').trim().slice(0, 160);

    this.seo.set({
      title: `${artist.name}${this.langService.translate('artist.seo_title_suf')}`,
      description,
      path,
      imageUrl: artist.imageUrl || artist.bannerImageUrl,
      type: 'profile',
      structuredData: [
        this.seo.organizationSchema(),
        this.seo.breadcrumbSchema([
          { name: this.langService.translate('nav.home_label'), path: '/' },
          { name: this.langService.translate('nav.artists_label'), path: '/artists' },
          { name: artist.name, path }
        ]),
        {
          '@context': 'https://schema.org',
          '@type': 'MusicGroup',
          name: artist.name,
          alternateName: artist.englishName || undefined,
          description,
          image: artist.imageUrl ? this.seo.absoluteUrl(artist.imageUrl) : undefined,
          url: this.seo.absoluteUrl(path),
          sameAs: artist.socialLinks?.map(link => link.url).filter(Boolean)
        }
      ]
    });
  }

  // ============================================================
  // Hero
  // ============================================================

  private initHeroHeight(): void {
    const bg = this.artistHeroBg?.nativeElement;
    if (!bg) return;
    this.fullHeroHeight = window.innerHeight - 16; /* top: 8px + bottom: 8px */
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
    this.g3dHandleResize();
    this.updateDefaultSongsCount();
  }

  private shrinkHero(): void {
    const bg = this.artistHeroBg?.nativeElement;
    if (!bg || this.fullHeroHeight === 0) return;
    const minHeight = 56; /* header 56px — hero מתכווץ לגובה שורת הכותרת */
    const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
    bg.style.height = newHeight + 'px';

    const progress = Math.min(1, window.scrollY / 160);
    const opacity = String(Math.max(0, 1 - progress));
    const infoSide = bg.querySelector('.hero-info-side') as HTMLElement | null;
    const socialSide = bg.querySelector('.hero-social') as HTMLElement | null;
    const overlay = bg.querySelector('.hero-overlay-right') as HTMLElement | null;
    if (infoSide) infoSide.style.opacity = opacity;
    if (socialSide) socialSide.style.opacity = opacity;
    if (overlay) overlay.style.opacity = opacity;

    const collapseOverlay = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
    if (collapseOverlay) {
      const collapseRange = this.fullHeroHeight - minHeight;
      const collapseProgress = collapseRange > 0
        ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
        : 0;
      collapseOverlay.style.opacity = String(collapseProgress);
    }
  }

  // ============================================================
  // 3D Gallery — scroll-driven
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
    const wrapper = this.g3dWrapperRef?.nativeElement;
    const section = this.g3dSectionRef?.nativeElement;
    const cardsEl = this.g3dCardsElRef?.nativeElement;
    if (!wrapper || !section || !cardsEl) return;

    // נקה listener-ים ישנים לפני הוספת חדשים
    section.removeEventListener('wheel', this.g3dOnWheel);
    section.removeEventListener('touchstart', this.g3dOnTouchStart);
    section.removeEventListener('touchmove', this.g3dOnTouchMove);

    const baseItems = this.galleryItems;
    if (baseItems.length < this.GALLERY_MIN_ITEMS) return;
    this.g3dBaseCount = baseItems.length;
    this.g3dActiveIndex = 0;

    // לפחות 6 פריטים על ידי כפל
    let items = [...baseItems];
    while (items.length < 6) items = [...items, ...baseItems];

    // יצירת כרטיסים
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
        // thumbnail מ-YouTube
        const thumbnailUrl = this.getYouTubeThumbnail(item.videoUrl);
        if (thumbnailUrl) {
          const img = document.createElement('img');
          img.src = thumbnailUrl;
          img.alt = item.title || '';
          img.draggable = false;
          card.appendChild(img);
        }
        // overlay עם כפתור הפעלה
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

      // hover — מסיר טשטוש
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

    // רישום אירועי wheel ו-touch
    section.addEventListener('wheel', this.g3dOnWheel, { passive: false });
    section.addEventListener('touchstart', this.g3dOnTouchStart, { passive: true });
    section.addEventListener('touchmove', this.g3dOnTouchMove, { passive: false });

    // מדידה ורנדור ראשוני — setTimeout לוודא שה-layout הסתיים לפני המדידה
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

  // ============================================================
  // Gallery Arrows
  // ============================================================

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

  get g3dDots(): number[] {
    return this.g3dBaseCount > 0 ? Array(this.g3dBaseCount).fill(0) : [];
  }

  private getYouTubeThumbnail(videoUrl: string): string {
    const videoId = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
  }

  // ============================================================
  // Image Lightbox
  // ============================================================

  openImageLightbox(imageUrl: string, caption: string | null): void {
    this.imageLightboxUrl = imageUrl;
    this.imageLightboxCaption = caption;
  }

  closeImageLightbox(): void {
    this.imageLightboxUrl = null;
    this.imageLightboxCaption = null;
  }

  // ============================================================
  // Video Lightbox
  // ============================================================

  openVideoLightbox(videoUrl: string): void {
    this.videoLightboxUrl = videoUrl;
  }

  closeVideoLightbox(): void {
    this.videoLightboxUrl = null;
  }

  getYouTubeEmbedUrl(videoUrl: string): SafeResourceUrl {
    const videoId = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : videoUrl;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  // ============================================================
  // Data loading
  // ============================================================

  loadSongs(artistId: number, page: number = 1): void {
    this.loadingSongs = true;
    this.artistService.getArtistSongs(artistId, page, 50).subscribe({
      next: (result) => {
        this.songs = result.items;
        this.totalSongs = result.totalCount;
        this.songsPage = page;
        this.loadingSongs = false;
        this.updateDefaultSongsCount();
      },
      error: () => { this.loadingSongs = false; }
    });
  }

  private updateDefaultSongsCount(): void {
    const vw = window.innerWidth;
    let cols: number;
    if (vw <= 600) {
      cols = 1; // media query: grid-template-columns: 1fr
    } else {
      const hPad = vw <= 900 ? 24 : 32;
      const containerWidth = Math.min(vw - hPad, 1200);
      cols = Math.max(1, Math.floor((containerWidth + 10) / (260 + 10)));
    }
    const newCount = cols * 2;
    if (newCount !== this.defaultSongsCount) {
      this.defaultSongsCount = newCount;
      this.cdr.detectChanges();
    }
  }

  get visibleSongs(): SongDto[] {
    return this.songsExpanded ? this.songs : this.songs.slice(0, this.defaultSongsCount);
  }

  toggleSongsExpanded(): void {
    this.songsExpanded = !this.songsExpanded;
  }

  get visibleArticles(): Article[] {
    return this.articlesExpanded ? this.articles : this.articles.slice(0, 6);
  }

  toggleArticlesExpanded(): void {
    this.articlesExpanded = !this.articlesExpanded;
  }

  loadArticles(artistId: number, page: number = 1): void {
    this.loadingArticles = true;
    this.artistService.getArtistArticles(artistId, page, 50).subscribe({
      next: (result) => {
        this.articles = result.items;
        this.totalArticles = result.totalCount;
        this.articlesPage = page;
        this.loadingArticles = false;
      },
      error: () => { this.loadingArticles = false; }
    });
  }

  openEventModal(event: UpcomingEventDto): void {
    this.selectedEvent = event;
  }

  closeEventModal(): void {
    this.selectedEvent = null;
  }

  trackEventById(_index: number, event: UpcomingEventDto): number {
    return event.id;
  }

  loadEvents(artistId: number): void {
    this.loadingEvents = true;
    this.artistService.getArtistEvents(artistId).subscribe({
      next: (events) => {
        this.events = events;
        this.loadingEvents = false;
      },
      error: () => { this.loadingEvents = false; }
    });
  }

  // ============================================================
  // Getters & Helpers
  // ============================================================

  checkBioOverflow(): void {
    const el = this.bioTextEl?.nativeElement;
    if (el) {
      this.bioOverflows = el.scrollHeight > el.clientHeight;
      this.cdr.detectChanges();
    }
  }

  toggleBioExpanded(): void {
    this.bioExpanded = !this.bioExpanded;
    setTimeout(() => this.checkBioOverflow(), 0);
  }

  readonly GALLERY_MIN_ITEMS = 5;

  get heroBannerSrc(): string {
    if (!this.artist) return '';
    const type = this.artist.bannerMediaType;
    if (type === 'gif' || type === 'video') return this.artist.bannerGifUrl || '';
    if (type === 'image') return this.artist.bannerImageUrl || '';
    // fallback לתאימות אחורה: אם אין סוג, ננסה לזהות
    if (this.artist.isPremium && this.artist.bannerGifUrl) return this.artist.bannerGifUrl;
    return this.artist.bannerImageUrl || '';
  }

  get heroBannerIsVideo(): boolean {
    if (!this.artist) return false;
    if (this.artist.bannerMediaType === 'video') return true;
    const url = this.heroBannerSrc;
    return /\.(mp4|webm|ogg)(\?|#|$)/i.test(url);
  }

  get heroBannerBlur(): number {
    return Math.max(0, Math.min(20, this.artist?.bannerBlur ?? 0));
  }

  get galleryShouldShow(): boolean {
    return this.galleryItems.length >= this.GALLERY_MIN_ITEMS;
  }

  get performanceBannerImage(): string | null {
    if (!this.artist) return null;
    if (!this.artist.performanceIsActive) return null;
    const ev = this.artist.performanceEvent;
    if (ev?.bannerImageUrl) return ev.bannerImageUrl;
    if (ev?.imageUrl) return ev.imageUrl;
    // legacy
    return this.artist.performanceImageUrl || null;
  }

  get performanceBannerLink(): string {
    if (!this.artist) return '#';
    return this.artist.performanceEvent?.ticketUrl || this.artist.performanceTicketUrl || '#';
  }

  get galleryItems(): Array<{ type: 'image' | 'video'; imageUrl?: string; videoUrl?: string; caption?: string; title?: string }> {
    if (!this.artist) return [];
    return [
      ...this.artist.galleryImages.map(img => ({
        type: 'image' as const,
        imageUrl: img.imageUrl,
        caption: img.caption
      })),
      ...this.artist.videos.map(vid => ({
        type: 'video' as const,
        videoUrl: vid.videoUrl,
        title: vid.title
      }))
    ];
  }

  getShortUrl(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  getSocialPlatformName(platform: SocialPlatform): string {
    const names: { [key: number]: string } = {
      [SocialPlatform.Facebook]: 'Facebook',
      [SocialPlatform.Instagram]: 'Instagram',
      [SocialPlatform.YouTube]: 'YouTube',
      [SocialPlatform.Twitter]: 'Twitter / X',
      [SocialPlatform.TikTok]: 'TikTok',
      [SocialPlatform.Spotify]: 'Spotify',
      [SocialPlatform.Website]: this.langService.translate('teacher.social_website'),
      [SocialPlatform.Zing]: 'Zing',
      [SocialPlatform.Jewzik]: "ג'וזיק",
      [SocialPlatform.TwentyFourSix]: '24Six',
      [SocialPlatform.AppleMusic]: 'Apple Music'
    };
    return names[platform] || this.langService.translate('teacher.social_link');
  }

  getSocialIconSvg(platform: SocialPlatform): SafeHtml {
    const icons: { [key: number]: string } = {
      [SocialPlatform.Facebook]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
      [SocialPlatform.Instagram]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke-width="3"/></svg>`,
      [SocialPlatform.YouTube]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z M9.75 8.98 L15.5 12 L9.75 15.02 Z"/></svg>`,
      [SocialPlatform.Twitter]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
      [SocialPlatform.TikTok]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.77a8.18 8.18 0 0 0 4.79 1.53V6.86a4.85 4.85 0 0 1-1.02-.17z"/></svg>`,
      [SocialPlatform.Spotify]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`,
      [SocialPlatform.Website]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
      [SocialPlatform.Zing]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/><path d="M8 10.5L16 7v2.5L8 13.5z"/></svg>`,
      [SocialPlatform.AppleMusic]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M19.5 4a2.5 2.5 0 0 1 2.5 2.5v11A4.5 4.5 0 0 1 17.5 22h-11A4.5 4.5 0 0 1 2 17.5v-11A2.5 2.5 0 0 1 4.5 4h15zm-3.05 3.5a.75.75 0 0 0-.92-.04l-6.5 1.7a.75.75 0 0 0-.53.72v6.34a2.25 2.25 0 1 0 1.5 2.12V11.6l5-1.31v3.83a2.25 2.25 0 1 0 1.5 2.13V8a.75.75 0 0 0-.05-.5z"/></svg>`,
      [SocialPlatform.Jewzik]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
      [SocialPlatform.TwentyFourSix]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M3 18V6h2v5.59L9.59 7H12L7 12l5 5H9.59L5 12.41V17H3v1zm9-1l3-9h2l-3 9h-2zm5 1V6h4l-2 4 2 7h-2l-2-7v7h-0z"/></svg>`
    };
    const svg = icons[platform] ?? icons[SocialPlatform.Website];
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  navigateToSong(songId: number): void {
    const song = this.visibleSongs?.find((s: any) => s.id === songId);
    const slug = song ? songSlug(song) : '';
    this.router.navigate(slug ? ['/song', songId, slug] : ['/song', songId]);
  }

  navigateToArticle(slug: string): void {
    this.router.navigate(['/news', slug]);
  }
}
