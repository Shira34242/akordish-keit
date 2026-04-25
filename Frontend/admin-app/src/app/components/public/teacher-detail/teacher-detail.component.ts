import {
  Component, OnInit, AfterViewInit, OnDestroy,
  HostListener, ViewChild, ElementRef, ChangeDetectorRef, inject
} from '@angular/core';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';
import { AnalyticsService } from '../../../services/analytics.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { TeacherService } from '../../../services/teacher.service';
import { TeacherDto } from '../../../models/teacher.model';
import { CitiesService, City } from '../../../services/cities.service';
import { SocialLinkDto, SocialPlatform } from '../../../models/music-service-provider.model';
import { TeachingLanguage } from '../../../models/teaching-language.enum';
import { TargetAudience } from '../../../models/target-audience.enum';
import { Article } from '../../../models/article.model';
import { SongDto } from '../../../models/song.model';
import { SongCardComponent } from '../../shared/song-card/song-card.component';
import { NewsBannerComponent } from '../../shared/news-banner/news-banner.component';

@Component({
  selector: 'app-teacher-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, SongCardComponent, NewsBannerComponent, ImgFallbackDirective],
  templateUrl: './teacher-detail.component.html',
  styleUrls: ['./teacher-detail.component.css']
})
export class TeacherDetailComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('teacherHeroBg') teacherHeroBg?: ElementRef<HTMLDivElement>;
  @ViewChild('g3dWrapper')    g3dWrapperRef?: ElementRef<HTMLDivElement>;
  @ViewChild('g3dSection')    g3dSectionRef?: ElementRef<HTMLDivElement>;
  @ViewChild('g3dCardsEl')    g3dCardsElRef?: ElementRef<HTMLDivElement>;
  @ViewChild('testimonialsScroller') testimonialsScrollerRef?: ElementRef<HTMLDivElement>;

  private readonly analytics = inject(AnalyticsService);

  teacher: TeacherDto | null = null;
  cities: City[] = [];
  loading = true;
  SocialPlatform = SocialPlatform;

  // ⚠️ ממתין לחיבור בקאנד: אקורדים שהמורה העלה
  teacherSongs: SongDto[] = [];

  // ⚠️ ממתין לחיבור בקאנד: כתבות שהמורה העלה
  teacherArticles: Article[] = [];

  mediaLightboxIndex: number | null = null;
  galleryMediaItems: Array<{ type: 'image' | 'video'; imageUrl?: string; videoUrl?: string; caption?: string }> = [];
  activeMedia: { type: 'image' | 'video'; imageUrl?: string; videoUrl?: string; caption?: string } | null = null;
  activeVideoUrl: SafeResourceUrl | null = null;

  // Contact panel
  contactOpen = false;
  canScrollTestimonialsPrev = false;
  canScrollTestimonialsNext = false;
  activeTestimonialIndex = 0;

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
    private teacherService: TeacherService,
    private citiesService: CitiesService,
    private sanitizer: DomSanitizer,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = +params['id'];
      if (id) this.loadTeacher(id);
    });
    this.citiesService.getCities().subscribe({
      next: cities => this.cities = cities,
      error: () => {}
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
  }

  loadTeacher(id: number): void {
    this.loading = true;
    window.scrollTo(0, 0);
    this.teacherService.getTeacherById(id).subscribe({
      next: teacher => {
        this.teacher = teacher;
        this.rebuildGalleryMedia();
        this.loadTeacherContent(id);
        this.loading = false;
        setTimeout(() => {
          this.cdr.detectChanges();
          this.initHeroHeight();
          this.updateTestimonialsNav();
        }, 0);
      },
      error: () => {
        this.loading = false;
        this.router.navigate(['/teachers']);
      }
    });
  }

  private loadTeacherContent(id: number): void {
    this.teacherService.getTeacherSongs(id).subscribe({
      next: songs => {
        this.teacherSongs = songs;
        this.cdr.detectChanges();
      },
      error: () => {
        this.teacherSongs = [];
      }
    });

    this.teacherService.getTeacherArticles(id).subscribe({
      next: articles => {
        this.teacherArticles = articles;
        this.cdr.detectChanges();
      },
      error: () => {
        this.teacherArticles = [];
      }
    });
  }

  // ============================================================
  // Hero
  // ============================================================

  private initHeroHeight(): void {
    const bg = this.teacherHeroBg?.nativeElement;
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
        this.teacherTestimonials.length - 1,
        Math.round((current / maxScroll) * (this.teacherTestimonials.length - 1))
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

  private shrinkHero(): void {
    const bg = this.teacherHeroBg?.nativeElement;
    if (!bg || this.fullHeroHeight === 0) return;

    const minHeight = 63;
    const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
    bg.style.height = newHeight + 'px';

    // fade out תוכן hero בגלילה
    const progress = Math.min(1, window.scrollY / 160);
    const opacity = String(Math.max(0, 1 - progress));
    const heroContent = bg.querySelector('.hero-content') as HTMLElement | null;
    if (heroContent) heroContent.style.opacity = opacity;

    // overlay כהייה
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
  // 3D Gallery — זהה לדף אמן, תמונות בלבד
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
    const wrapper  = this.g3dWrapperRef?.nativeElement;
    const section  = this.g3dSectionRef?.nativeElement;
    const cardsEl  = this.g3dCardsElRef?.nativeElement;
    if (!wrapper || !section || !cardsEl) return;

    section.removeEventListener('wheel', this.g3dOnWheel);
    section.removeEventListener('touchstart', this.g3dOnTouchStart);
    section.removeEventListener('touchmove', this.g3dOnTouchMove);

    const baseItems = this.galleryItems;
    if (baseItems.length === 0) return;

    this.g3dBaseCount = baseItems.length;
    this.g3dActiveIndex = 0;

    // לפחות 6 פריטים על ידי כפל
    let items = [...baseItems];
    while (items.length < 6) items = [...items, ...baseItems];

    cardsEl.innerHTML = '';
    this.g3dItems = [];

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'g3d-card';

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

      const itemIndex = baseItems.indexOf(item);
      card.addEventListener('click', () => this.openLightbox(itemIndex % this.g3dBaseCount));
      card.style.cursor = 'pointer';

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

  get g3dDots(): number[] {
    return this.g3dBaseCount > 0 ? Array(this.g3dBaseCount).fill(0) : [];
  }

  get galleryItems(): Array<{ imageUrl: string; caption?: string }> {
    if (!this.teacher?.galleryImages?.length) return [];
    return this.teacher.galleryImages.map(img => ({
      imageUrl: img.imageUrl,
      caption: img.caption
    }));
  }

  get galleryMedia(): Array<{ type: 'image' | 'video'; imageUrl?: string; videoUrl?: string; caption?: string }> {
    return this.galleryMediaItems;
  }

  private rebuildGalleryMedia(): void {
    const media: Array<{ type: 'image' | 'video'; imageUrl?: string; videoUrl?: string; caption?: string }> = [];

    if (this.teacher?.videoUrl) {
      media.push({
        type: 'video',
        videoUrl: this.teacher.videoUrl,
        imageUrl: this.getVideoThumbnailUrl(this.teacher.videoUrl) || this.heroBannerSrc || this.teacher.profileImageUrl || '/logo.png',
        caption: 'סרטון היכרות'
      });
    }

    this.galleryItems.forEach(item => media.push({ type: 'image', ...item }));
    this.galleryMediaItems = media;
  }

  private getVideoThumbnailUrl(url: string): string {
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
  }

  get teacherTestimonials(): Array<{ text: string; studentName?: string }> {
    return (this.teacher?.testimonials || [])
      .filter(item => !!item.text?.trim())
      .sort((a, b) => a.order - b.order)
      .map(item => ({
        text: item.text,
        studentName: item.studentName
      }));
  }

  get testimonialDots(): number[] {
    return this.teacherTestimonials.map((_, index) => index);
  }

  get heroRole(): string {
    if (!this.teacher) return '';
    const instruments = this.getInstrumentNames();
    return instruments ? `מורה ל${instruments}` : 'מורה למוזיקה';
  }

  get infoCards(): Array<{ label: string; value: string }> {
    if (!this.teacher) return [];
    const cards: Array<{ label: string; value: string }> = [];

    if (this.teacher.education) cards.push({ label: 'השכלה', value: this.teacher.education });
    if (this.teacher.lessonTypes) cards.push({ label: 'סוגי שיעורים', value: this.teacher.lessonTypes });
    if (this.teacher.availability) cards.push({ label: 'זמינות', value: this.teacher.availability });
    if (this.teacher.workingHours) cards.push({ label: 'שעות פעילות', value: this.teacher.workingHours });
    if (this.teacher.priceList) cards.push({ label: 'מחירון', value: this.teacher.priceList });
    if (this.teacher.specializations) cards.push({ label: 'התמחויות', value: this.teacher.specializations });

    return cards;
  }

  get tags(): string[] {
    if (!this.teacher) return [];
    return [
      ...this.getTargetAudienceList(this.teacher.targetAudience),
      ...this.getSpecializationsList()
    ];
  }

  toggleContact(): void {
    this.contactOpen = !this.contactOpen;
    if (this.contactOpen && this.teacher) {
      this.analytics.trackButtonClick('contact', this.teacher.id, this.teacher.displayName);
    }
  }

  get detailsLine(): string {
    if (!this.teacher) return '';
    const parts: string[] = [];
    if (this.teacher.shortBio) parts.push(this.teacher.shortBio);
    if (this.teacher.yearsOfExperience) parts.push(`מעל ${this.teacher.yearsOfExperience} שנות ניסיון`);
    if (this.teacher.education) parts.push(this.teacher.education);
    if (this.teacher.languages) parts.push(this.getLanguagesDisplay(this.teacher.languages));
    if (this.teacher.lessonTypes) parts.push(this.teacher.lessonTypes);
    if (this.teacher.availability) parts.push(this.teacher.availability);
    return parts.join(', ');
  }

  get scheduleAndPriceLine(): string {
    if (!this.teacher) return '';
    const parts: string[] = [];
    if (this.teacher.workingHours) parts.push(this.teacher.workingHours);
    if (this.teacher.priceList) parts.push(this.teacher.priceList);
    return parts.join(', ');
  }

  get learningDetailsText(): string {
    return '';
  }

  get heroBannerSrc(): string {
    return this.teacher?.bannerImageUrl || '';
  }

  get socialLinks(): SocialLinkDto[] {
    return (this.teacher?.socialLinks || []).filter(link => !!link?.url);
  }

  // ============================================================
  // Lightbox
  // ============================================================

  openLightbox(index: number): void {
    this.openMediaLightbox(this.teacher?.videoUrl ? index + 1 : index);
  }

  closeLightbox(): void {
    this.closeMediaLightbox();
  }

  lightboxStep(delta: number): void {
    this.mediaLightboxStep(delta);
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

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (this.mediaLightboxIndex === null) return;
    if (e.key === 'ArrowLeft') this.mediaLightboxStep(1);
    if (e.key === 'ArrowRight') this.mediaLightboxStep(-1);
    if (e.key === 'Escape') this.closeMediaLightbox();
  }

  // ============================================================
  // Getters
  // ============================================================

  get hasDetails(): boolean {
    if (!this.teacher) return false;
    return !!(
      this.teacher.yearsOfExperience ||
      this.teacher.education         ||
      this.teacher.languages         ||
      this.teacher.targetAudience    ||
      this.teacher.lessonTypes       ||
      this.teacher.priceList         ||
      this.teacher.availability      ||
      this.teacher.workingHours
    );
  }

  get hasSpecializations(): boolean {
    return !!(this.teacher?.specializations);
  }

  getSpecializationsList(): string[] {
    if (!this.teacher?.specializations) return [];
    return this.teacher.specializations
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s);
  }

  private getInstrumentNames(): string {
    if (!this.teacher?.instruments?.length) return '';
    const primary = this.teacher.instruments.find(i => i.isPrimary);
    const ordered = primary
      ? [primary, ...this.teacher.instruments.filter(i => i.id !== primary.id)]
      : this.teacher.instruments;
    return ordered.map(i => i.instrumentName).filter(Boolean).join(', ');
  }

  // ============================================================
  // Helpers
  // ============================================================

  getCityName(cityId?: number | null): string {
    if (!cityId) return '';
    return this.cities.find(c => c.id === cityId)?.name || '';
  }

  getLocationLine(): string {
    if (!this.teacher) return '';
    const city = this.getCityName(this.teacher.cityId) || this.teacher.cityName || '';
    return [city, this.teacher.location].filter(Boolean).join(' · ');
  }

  get heroLocationLine(): string {
    if (!this.teacher) return '';
    return this.getCityName(this.teacher.cityId) || this.teacher.cityName || '';
  }

  getLanguagesDisplay(languages?: TeachingLanguage): string {
    if (!languages) return '';
    const list: string[] = [];
    if (languages & TeachingLanguage.Hebrew)  list.push('עברית');
    if (languages & TeachingLanguage.English) list.push('אנגלית');
    if (languages & TeachingLanguage.Russian) list.push('רוסית');
    if (languages & TeachingLanguage.French)  list.push('צרפתית');
    if (languages & TeachingLanguage.Spanish) list.push('ספרדית');
    if (languages & TeachingLanguage.Arabic)  list.push('ערבית');
    return list.join(', ');
  }

  getTargetAudienceList(audience?: TargetAudience): string[] {
    if (!audience) return [];
    const list: string[] = [];
    if (audience & TargetAudience.Children)     list.push('ילדים');
    if (audience & TargetAudience.Teenagers)    list.push('נוער');
    if (audience & TargetAudience.Adults)       list.push('מבוגרים');
    if (audience & TargetAudience.Seniors)      list.push('גיל הזהב');
    if (audience & TargetAudience.Beginners)    list.push('מתחילים');
    if (audience & TargetAudience.Intermediate) list.push('בינוניים');
    if (audience & TargetAudience.Advanced)     list.push('מתקדמים');
    if (audience & TargetAudience.Professional) list.push('מקצועיים');
    return list;
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
    const message = encodeURIComponent('הי, הגעתי דרך אתר אקורדישקייט');
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

  getSafeVideoUrl(url: string): SafeResourceUrl {
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }
}
