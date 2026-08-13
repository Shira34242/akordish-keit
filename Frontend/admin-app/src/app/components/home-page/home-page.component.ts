import { Component, OnInit, AfterViewInit, AfterViewChecked, OnDestroy, ViewChild, ElementRef, DestroyRef, NgZone, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, take, finalize, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SongService } from '../../services/song.service';
import { ArtistService } from '../../services/artist.service';
import { ArticleService } from '../../services/admin/article.service';
import { EventService } from '../../services/admin/event.service';
import { MusicServiceProviderService } from '../../services/music-service-provider.service';
import { PodcastService } from '../../services/podcast.service';
import { QuickAddAssistantService } from '../../services/quick-add-assistant.service';
import { SearchService, SearchResults, SearchItem } from '../../services/search.service';
import { SongCardComponent } from '../shared/song-card/song-card.component';
import { ArtistCircleComponent } from '../shared/artist-circle/artist-circle.component';
import { NewsBannerComponent } from '../shared/news-banner/news-banner.component';
import { PodcastEpisodeBannerComponent } from '../shared/podcast-episode-banner/podcast-episode-banner.component';
import { EventCardComponent } from '../shared/event-card/event-card.component';
import { EventModalComponent } from '../shared/event-modal/event-modal.component';
import { ProfileAvatarComponent } from '../shared/profile-avatar/profile-avatar.component';
import { AutoScrollDirective } from '../../directives/auto-scroll.directive';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { ArticleBanner } from '../../models/article.model';
import { UpcomingEventDto } from '../../models/event.model';
import { EventCardData } from '../../utils/event.utils';
import { HomeShowcaseProfile } from '../../models/music-service-provider.model';
import { PodcastEpisodeBanner, PodcastHomeCard } from '../../models/podcast.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { AdDisplayComponent } from '../public/ad-display/ad-display.component';
import { artistRoute, songSlug } from '../../utils/slug';
import { getArticleLink } from '../../utils/article-route.utils';
import { CloudflareImagePipe, CloudflareImageSrcsetPipe, cloudflareBackgroundImage } from '../../pipes/cloudflare-image.pipe';
import { SystemSettingsService } from '../../services/system-settings.service';

interface HeroParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
}

interface ViralRow {
  articles: ArticleBanner[];
  gridCols: string;
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    SongCardComponent,
    ArtistCircleComponent,
    NewsBannerComponent,
    PodcastEpisodeBannerComponent,
    EventCardComponent,
    EventModalComponent,
    ProfileAvatarComponent,
    TranslatePipe,
    AutoScrollDirective,
    ImgFallbackDirective,
    CloudflareImagePipe,
    CloudflareImageSrcsetPipe,
    AdDisplayComponent
  ],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent implements OnInit, AfterViewInit, AfterViewChecked, OnDestroy {

  @ViewChild('heroBg') heroBg?: ElementRef<HTMLDivElement>;
  @ViewChild('heroCanvas') heroCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('heroScrollIndicator') heroScrollIndicator?: ElementRef<HTMLDivElement>;
  @ViewChild('viralSection') viralSection?: ElementRef<HTMLElement>;
  @ViewChild('viralSentinel') viralSentinel?: ElementRef<HTMLDivElement>;

  searchQuery = '';
  readonly searchPlaceholders = [
    'אקורדים לשירים',
    'חדשות מוזיקה',
    'מורים למוזיקה',
    'נותני שירות למוזיקה',
    'פודקאסטים',
    'הופעות ואירועים'
  ];
  currentSearchPlaceholderIndex = 0;
  displayedSearchPlaceholder = '';
  isSearchInputFocused = false;
  searchResults: SearchResults | null = null;
  lyricsMatches: SearchItem[] = [];
  isSearchingDeep = false;
  showSearchResults = false;
  isHomeAutoScrollPaused = false;
  private searchSubject = new Subject<string>();
  private readonly destroyRef = inject(DestroyRef);
  private readonly langService = inject(LanguageService);
  private readonly ngZone = inject(NgZone);

  recentSongs: any[] = [];
  popularSongs: any[] = [];
  topArtists: any[] = [];
  featuredArtists: any[] = [];
  newsArticles: ArticleBanner[] = [];
  featuredNewsArticles: ArticleBanner[] = [];
  regularNewsArticles: ArticleBanner[] = [];
  mobileNewsRows: ArticleBanner[][] = [];
  mobileBlogRows: ArticleBanner[][] = [];
  mobileArtistRows: any[][] = [];
  blogArticles: ArticleBanner[] = [];
  blogArticlesLoaded = false;
  homeCategoryArticles: ArticleBanner[] = [];
  homeCategoryName = '';
  homeCategoryArticlesLoaded = false;
  viralArticles: ArticleBanner[] = [];
  visibleViralArticles: ArticleBanner[] = [];
  viralRows: ViralRow[] = [];
  visibleViralCount = 4;
  loadingViralArticles = false;
  viralArticlesLoaded = false;
  viralArticlesHasMore = true;
  upcomingEvents: UpcomingEventDto[] = [];
  selectedEventModal: EventCardData | null = null;
  featuredProfiles: HomeShowcaseProfile[] = [];
  homePodcasts: PodcastHomeCard[] = [];
  popularPodcastEpisodes: PodcastEpisodeBanner[] = [];
  homeHeroImage = '';
  homeChordsImage = '';
  homeIndexImage = '';
  homePodcastsImage = '';
  bannerImageSettings: Record<string, string> = {};
  bannerImagesLoaded = false;


  isMobile = window.innerWidth <= 768;

  private fullHeroHeight = 0;
  private rafPending = false;
  private lastViewportWidth = window.innerWidth;
  private lastViewportHeight = window.innerHeight;
  private lastHeroVisibleHeight = -1;

  private heroCtx?: CanvasRenderingContext2D | null;
  private heroParticles: HeroParticle[] = [];
  private particleAnimId?: number;
  private heroMouseHandler?: (e: MouseEvent) => void;
  private heroScrollHandler?: () => void;
  private heroResizeHandler?: () => void;
  private heroSurfaceEl?: HTMLElement | null;
  private heroOverlayEl?: HTMLElement | null;
  private viralObserver?: IntersectionObserver;
  private viralOffset = 0;
  private readonly viralPageSize = 8;
  private readonly initialViralVisibleCount = 4;
  private readonly viralRevealStep = 4;
  private viralRowsViewport: 'mobile' | 'desktop' = window.innerWidth <= 640 ? 'mobile' : 'desktop';
  newsContentFinished = false;
  restContentStarted = false;
  topAdStarted = false;
  promoChordsStarted = false;
  chordsSectionStarted = false;
  artistsSectionStarted = false;
  midAdStarted = false;
  promoIndexStarted = false;
  featuredSectionStarted = false;
  eventsSectionStarted = false;
  promoPodcastsStarted = false;
  podcastsSectionStarted = false;
  bottomAdStarted = false;
  blogSectionStarted = false;
  viralSectionStarted = false;
  private chordsContentStarted = false;
  private nextHomeStage = 0;
  private homeStageTimer?: number;
  private searchPlaceholderTimer?: number;
  private searchPlaceholderCharIndex = 0;
  private isDeletingSearchPlaceholder = false;
  private carouselState: Record<string, { left: boolean; right: boolean }> = {};
  private carouselStateRefreshPending = false;
  private readonly carouselSelectors = [
    '.recent-songs-row',
    '.popular-songs-row',
    '.index-showcase-row',
    '.events-scroll-row',
    '.podcast-episodes-row',
    '.home-category-banners-row'
  ];

  constructor(
    private router: Router,
    private songService: SongService,
    private artistService: ArtistService,
    private articleService: ArticleService,
    private eventService: EventService,
    private providerService: MusicServiceProviderService,
    private podcastService: PodcastService,
    private quickAddAssistantService: QuickAddAssistantService,
    private searchService: SearchService,
    private systemSettingsService: SystemSettingsService,
  ) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        // איפוס תוצאות השלב העמוק בכל חיפוש חדש
        this.lyricsMatches = [];
        this.isSearchingDeep = false;
        if (!query || query.length < 2) {
          return of(null);
        }
        return this.searchService.search(query);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(results => {
      this.searchResults = results;
      this.showSearchResults = this.searchQuery.length >= 2;

      // שלב 2 — חיפוש עמוק לפי מילות שיר (מופעל אחרי שהשלב הראשון חזר)
      if (results && this.searchQuery.length >= 2) {
        const queryAtLaunch = this.searchQuery;
        this.isSearchingDeep = true;
        this.searchService.searchDeep(queryAtLaunch).pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe(deepResults => {
          // לא מעדכנים אם המשתמש כבר החליף את החיפוש
          if (this.searchQuery !== queryAtLaunch) return;
          this.isSearchingDeep = false;
          this.lyricsMatches = deepResults?.songs ?? [];
        });
      }
    });
  }

  openEventModal(event: EventCardData): void {
    this.selectedEventModal = event;
  }

  handleRandomSongClick(): void {
    this.songService.getRandomSong().pipe(take(1)).subscribe({
      next: (song: any) => {
        if (song?.id) {
          this.router.navigate(['/song', song.id]);
        }
      },
      error: (err: any) => console.error('Failed to get random song', err)
    });
  }

  handleJoinIndexClick(): void {
    this.quickAddAssistantService.requestOpen('index');
  }

  navigatePromoOnMobile(route: string, event: Event): void {
    if (!this.isMobile) return;

    event.preventDefault();
    this.router.navigate([route]);
  }

  navigatePromo(route: string, event: Event): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('a, button')) return;

    event.preventDefault();
    this.router.navigate([route]);
  }

  scrollCarousel(target: HTMLElement | Array<HTMLElement | undefined>, direction: 'left' | 'right'): void {
    const targets = Array.isArray(target) ? target : [target];
    const sign = direction === 'left' ? -1 : 1;

    targets.filter(Boolean).forEach(element => {
      const distance = Math.max(element!.clientWidth * 0.72, 180);
      element!.scrollBy({ left: sign * distance, behavior: 'smooth' });
    });
  }

  scrollCarouselBySelector(selector: string, direction: 'left' | 'right'): void {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    this.scrollCarousel(elements, direction);
    requestAnimationFrame(() => this.refreshCarouselControls(selector));
  }

  canScrollBySelector(selector: string, direction: 'left' | 'right'): boolean {
    return this.carouselState[selector]?.[direction] ?? false;
  }

  refreshCarouselControls(selector?: string): void {
    if (selector) {
      this.updateCarouselState(selector);
      return;
    }
    this.updateAllCarouselStates();
  }

  ngAfterViewChecked(): void {
    this.scheduleCarouselStateRefresh();
  }

  private scheduleCarouselStateRefresh(): void {
    if (this.carouselStateRefreshPending) return;
    this.carouselStateRefreshPending = true;
    requestAnimationFrame(() => {
      this.carouselStateRefreshPending = false;
      this.updateAllCarouselStates();
    });
  }

  private updateAllCarouselStates(): void {
    this.carouselSelectors.forEach(selector => this.updateCarouselState(selector));
  }

  private updateCarouselState(selector: string): void {
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const next = {
      left: elements.some(element => this.canScrollElement(element, 'left')),
      right: elements.some(element => this.canScrollElement(element, 'right'))
    };
    const current = this.carouselState[selector];
    if (current?.left === next.left && current?.right === next.right) return;

    this.ngZone.run(() => {
      this.carouselState = {
        ...this.carouselState,
        [selector]: next
      };
    });
  }

  private canScrollElement(element: HTMLElement, direction: 'left' | 'right'): boolean {
    const maxScroll = element.scrollWidth - element.clientWidth;
    if (maxScroll <= 2) return false;

    const isRtl = getComputedStyle(element).direction === 'rtl';
    const scrollLeft = element.scrollLeft;

    if (!isRtl) {
      return direction === 'left'
        ? scrollLeft > 2
        : scrollLeft < maxScroll - 2;
    }

    return direction === 'left'
      ? Math.abs(scrollLeft) < maxScroll - 2
      : scrollLeft < -2;
  }

  ngOnInit() {
    this.initSearchPlaceholderRotation();
    this.systemSettingsService.getPublicBannerImages().pipe(take(1)).subscribe({
      next: images => {
        this.bannerImageSettings = images;
        this.homeHeroImage = images['banner_home_hero_image'] || '';
        this.homeChordsImage = images['banner_home_chords_image'] || '';
        this.homeIndexImage = images['banner_home_index_image'] || '';
        this.homePodcastsImage = images['banner_home_podcasts_image'] || '';
        this.bannerImagesLoaded = true;
        this.loadContent();
      },
      error: () => {
        this.bannerImagesLoaded = true;
        this.loadContent();
      }
    });
  }

  bannerBackground(imageUrl: string): string | null {
    return cloudflareBackgroundImage(imageUrl, 'hero');
  }

  bannerSize(key: string): string | null {
    const zoom = this.bannerZoom(key);
    const mode = this.bannerImageSettings[`${key}_display_mode`] || 'cover';
    return mode === 'height' ? `auto ${zoom}%` : 'cover';
  }

  bannerPosition(key: string): string {
    return `${this.bannerImageSettings[`${key}_position`] || 'center'} center`;
  }

  promoBannerPosition(): string {
    return 'left center';
  }

  promoBannerScale(key: string): string {
    const mode = this.bannerImageSettings[`${key}_display_mode`] || 'cover';
    return mode === 'cover' ? `scale(${this.bannerZoom(key) / 100})` : 'none';
  }

  bannerZoom(key: string): number {
    const suffix = this.isMobile ? 'mobile_zoom' : 'desktop_zoom';
    return Math.max(100, Math.min(200, Number(this.bannerImageSettings[`${key}_${suffix}`]) || 100));
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initHeroHeight();
      this.initHeroScrollListeners();
      this.initParticleEffect();
      this.initViralObserver();
    }, 0);
  }

  ngOnDestroy(): void {
    HomePageComponent.savedScrollY = window.scrollY;
    if (this.particleAnimId) cancelAnimationFrame(this.particleAnimId);
    if (this.heroMouseHandler) window.removeEventListener('mousemove', this.heroMouseHandler);
    if (this.heroScrollHandler) window.removeEventListener('scroll', this.heroScrollHandler);
    if (this.heroResizeHandler) window.removeEventListener('resize', this.heroResizeHandler);
    if (this.homeStageTimer) window.clearTimeout(this.homeStageTimer);
    if (this.searchPlaceholderTimer) window.clearTimeout(this.searchPlaceholderTimer);
    this.viralObserver?.disconnect();
  }

  get currentSearchPlaceholder(): string {
    return this.searchPlaceholders[this.currentSearchPlaceholderIndex] || this.searchPlaceholders[0];
  }

  private initSearchPlaceholderRotation(): void {
    this.displayedSearchPlaceholder = '';
    this.searchPlaceholderCharIndex = 0;
    this.isDeletingSearchPlaceholder = false;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.displayedSearchPlaceholder = `${this.currentSearchPlaceholder}...`;
      return;
    }

    this.scheduleSearchPlaceholderTyping(180);
  }

  private scheduleSearchPlaceholderTyping(delay: number): void {
    if (this.searchPlaceholderTimer) window.clearTimeout(this.searchPlaceholderTimer);
    this.ngZone.runOutsideAngular(() => {
      this.searchPlaceholderTimer = window.setTimeout(() => this.ngZone.run(() => {
        this.tickSearchPlaceholderTyping();
      }), delay);
    });
  }

  private tickSearchPlaceholderTyping(): void {
    const fullText = `${this.currentSearchPlaceholder}...`;

    if (!this.isDeletingSearchPlaceholder) {
      this.searchPlaceholderCharIndex = Math.min(fullText.length, this.searchPlaceholderCharIndex + 1);
      this.displayedSearchPlaceholder = fullText.slice(0, this.searchPlaceholderCharIndex);

      if (this.searchPlaceholderCharIndex === fullText.length) {
        this.isDeletingSearchPlaceholder = true;
        this.scheduleSearchPlaceholderTyping(760);
      } else {
        this.scheduleSearchPlaceholderTyping(58);
      }
      return;
    }

    this.searchPlaceholderCharIndex = Math.max(0, this.searchPlaceholderCharIndex - 1);
    this.displayedSearchPlaceholder = fullText.slice(0, this.searchPlaceholderCharIndex);

    if (this.searchPlaceholderCharIndex === 0) {
      this.isDeletingSearchPlaceholder = false;
      this.currentSearchPlaceholderIndex = (this.currentSearchPlaceholderIndex + 1) % this.searchPlaceholders.length;
      this.scheduleSearchPlaceholderTyping(140);
    } else {
      this.scheduleSearchPlaceholderTyping(34);
    }
  }

  private initHeroScrollListeners(): void {
    if (this.heroScrollHandler || this.heroResizeHandler) return;

    this.ngZone.runOutsideAngular(() => {
      this.heroScrollHandler = () => this.requestHeroFrame();
      this.heroResizeHandler = () => this.handleHeroResize();
      window.addEventListener('scroll', this.heroScrollHandler, { passive: true });
      window.addEventListener('resize', this.heroResizeHandler, { passive: true });
    });
  }

  private handleHeroResize(): void {
    const nextWidth = window.innerWidth;
    const widthChanged = Math.abs(nextWidth - this.lastViewportWidth) > 1;
    const nextIsMobile = nextWidth <= 768;
    if (nextIsMobile !== this.isMobile) {
      this.ngZone.run(() => {
        this.isMobile = nextIsMobile;
      });
    } else {
      this.isMobile = nextIsMobile;
    }

    // Mobile browsers fire resize while the address bar hides/shows during scroll.
    // Keeping the hero baseline stable there prevents visible jumps.
    if (!widthChanged && nextIsMobile) {
      return;
    }

    this.updateViralRowsIfViewportChanged();
    this.initHeroHeight();
  }

  private requestHeroFrame(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.shrinkHero();
      this.rafPending = false;
    });
  }

  private initHeroHeight(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg) return;
    this.heroSurfaceEl = bg.querySelector('.hero-surface') as HTMLElement | null;
    this.heroOverlayEl = bg.querySelector('.hero-overlay') as HTMLElement | null;
    this.lastHeroVisibleHeight = -1;
    this.lastViewportWidth = window.innerWidth;
    this.lastViewportHeight = window.innerHeight;

    if (window.innerWidth <= 768) {
      this.fullHeroHeight = Math.round(bg.clientWidth * 3 / 4);
      bg.style.setProperty('--hero-full-height', this.fullHeroHeight + 'px');
      bg.style.height = this.fullHeroHeight + 'px';
      this.resizeHeroCanvas();
      return;
    }

    this.fullHeroHeight = Math.max(0, this.lastViewportHeight - 16); /* top: 8px + bottom: 8px */
    bg.style.setProperty('--hero-full-height', this.fullHeroHeight + 'px');
    bg.style.height = this.fullHeroHeight + 'px';
    this.resizeHeroCanvas();
    this.shrinkHero();
  }

  private shrinkHero(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg || this.fullHeroHeight === 0) return;
    if (window.innerWidth <= 768) return;
    const minHeight = 56; /* header 56px — hero מתכווץ לגובה שורת הכותרת */
    const scrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    const newHeight = Math.max(minHeight, this.fullHeroHeight - scrollY);
    const visibleHeight = Math.round(newHeight);
    if (Math.abs(visibleHeight - this.lastHeroVisibleHeight) >= 1) {
      bg.style.height = visibleHeight + 'px';
      this.lastHeroVisibleHeight = visibleHeight;
    }

    const progress = Math.min(1, scrollY / 160);
    const opacity = String(Math.max(0, 1 - progress));
    if (this.heroOverlayEl) this.heroOverlayEl.style.opacity = opacity;
    if (this.heroScrollIndicator?.nativeElement) this.heroScrollIndicator.nativeElement.style.opacity = opacity;

    const collapseRange = this.fullHeroHeight - minHeight;
    const collapseProgress = collapseRange > 0
      ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
      : 0;
    this.setHeroSurfaceColor(collapseProgress);
  }

  private setHeroSurfaceColor(progress: number): void {
    if (!this.heroSurfaceEl) return;
    const from = [221, 255, 83];
    const to = [242, 242, 242];
    const rgb = from.map((channel, index) =>
      Math.round(channel + (to[index] - channel) * progress)
    );
    this.heroSurfaceEl.style.backgroundColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  private resizeHeroCanvas(): void {
    const canvas = this.heroCanvas?.nativeElement;
    const heroBg = this.heroBg?.nativeElement;
    if (!canvas || !heroBg || this.fullHeroHeight === 0) return;

    const width = heroBg.clientWidth;
    const height = this.fullHeroHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  private pendingContentLoads = 0;
  private static savedScrollY = 0;

  loadContent() {
    this.pendingContentLoads = 0;
    this.loadHomeNewsArticles();
  }

  private continueAfterNews(): void {
    this.newsContentFinished = true;
    this.restContentStarted = true;
    this.scheduleNextHomeStage(80);
  }

  private scheduleNextHomeStage(delay = 80): void {
    if (this.homeStageTimer) window.clearTimeout(this.homeStageTimer);
    this.homeStageTimer = window.setTimeout(() => {
      this.homeStageTimer = undefined;
      this.runNextHomeStage();
    }, delay);
  }

  private runNextHomeStage(): void {
    const stage = this.nextHomeStage++;

    switch (stage) {
      case 0:
        this.topAdStarted = true;
        this.scheduleNextHomeStage(90);
        break;
      case 1:
        this.promoChordsStarted = true;
        this.scheduleNextHomeStage(90);
        break;
      case 2:
        this.loadChords();
        break;
      case 3:
        this.artistsSectionStarted = true;
        this.loadTopArtists(() => this.scheduleNextHomeStage());
        break;
      case 4:
        this.midAdStarted = true;
        this.scheduleNextHomeStage(90);
        break;
      case 5:
        this.promoIndexStarted = true;
        this.scheduleNextHomeStage(90);
        break;
      case 6:
        this.featuredSectionStarted = true;
        let completedFeaturedStageLoads = 0;
        const completeFeaturedStageLoad = () => {
          completedFeaturedStageLoads++;
          if (completedFeaturedStageLoads === 2) this.scheduleNextHomeStage();
        };
        this.loadFeaturedPeople(completeFeaturedStageLoad);
        this.loadHomeCategoryArticles(completeFeaturedStageLoad);
        break;
      case 7:
        this.eventsSectionStarted = true;
        this.loadUpcomingEvents(() => this.scheduleNextHomeStage());
        break;
      case 8:
        this.promoPodcastsStarted = true;
        this.scheduleNextHomeStage(90);
        break;
      case 9:
        this.podcastsSectionStarted = true;
        this.loadHomePodcasts(() => this.scheduleNextHomeStage());
        break;
      case 10:
        this.bottomAdStarted = true;
        this.scheduleNextHomeStage(90);
        break;
      case 11:
        this.blogSectionStarted = true;
        this.loadBlogArticles(() => this.scheduleNextHomeStage());
        break;
      case 12:
        this.viralSectionStarted = true;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.initViralObserver();
            this.loadViralArticles();
          });
        });
        break;
      default:
        break;
    }
  }

  private loadChords(): void {
    if (this.chordsContentStarted) return;
    this.chordsContentStarted = true;
    this.chordsSectionStarted = true;
    let completedLoads = 0;
    const completeLoad = () => {
      completedLoads++;
      if (completedLoads === 2) this.scheduleNextHomeStage();
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.loadRecentSongs(completeLoad);
        this.loadPopularSongs(completeLoad);
      });
    });
  }

  private trackPendingLoad(): () => void {
    this.pendingContentLoads++;
    let completed = false;
    return () => {
      if (completed) return;
      completed = true;
      this.pendingContentLoads--;
      this.checkAllContentLoaded();
    };
  }

  private loadRecentSongs(afterLoad?: () => void): void {
    const onDone = this.trackPendingLoad();
    this.songService.getSongs(undefined, 1, 8).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      onDone();
      afterLoad?.();
    })).subscribe({
      next: (res: any) => { this.recentSongs = res.songs || []; },
      error: (err) => console.error('loadContent: songs', err)
    });
  }

  private loadPopularSongs(afterLoad?: () => void): void {
    const onDone = this.trackPendingLoad();
    this.songService.getPopularSongs(8).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      onDone();
      afterLoad?.();
    })).subscribe({
      next: (songs: any[]) => { this.popularSongs = songs; },
      error: (err) => console.error('loadContent: popular songs', err)
    });
  }

  private loadTopArtists(afterLoad?: () => void): void {
    const onDone = this.trackPendingLoad();
    const artistLimit = this.isMobile ? 12 : 9;
    this.artistService.getFeaturedArtists(artistLimit).pipe(
      switchMap((artists: any[]) => artists.length > 0 ? of(artists) : this.artistService.getTopArtists(artistLimit)),
      catchError(() => this.artistService.getTopArtists(artistLimit)),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
      onDone();
      afterLoad?.();
    })).subscribe({
      next: (artists: any[]) => {
        this.topArtists = artists;
        this.mobileArtistRows = this.buildMobileArtistRows(artists);
      },
      error: (err) => console.error('loadContent: top artists', err)
    });
  }

  private loadUpcomingEvents(afterLoad?: () => void): void {
    const onDone = this.trackPendingLoad();
    this.eventService.getUpcomingEvents(13).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      onDone();
      afterLoad?.();
    })).subscribe({
      next: (events: UpcomingEventDto[]) => { this.upcomingEvents = events; },
      error: (err) => console.error('loadContent: events', err)
    });
  }

  private loadFeaturedPeople(afterLoad?: () => void): void {
    const onProfilesDone = this.trackPendingLoad();
    this.providerService.getHomeShowcase().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      onProfilesDone();
      afterLoad?.();
    })).subscribe({
      next: (profiles) => { this.featuredProfiles = profiles || []; },
      error: (err) => console.error('loadContent: home showcase', err)
    });
  }

  private loadHomePodcasts(afterLoad?: () => void): void {
    let completedLoads = 0;
    const completeLoad = () => {
      completedLoads++;
      if (completedLoads === 2) afterLoad?.();
    };
    const onSeriesDone = this.trackPendingLoad();
    this.podcastService.getHomePodcastCards(10).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      onSeriesDone();
      completeLoad();
    })).subscribe({
      next: podcasts => { this.homePodcasts = podcasts.slice(0, 10); },
      error: err => console.error('loadContent: podcast series', err)
    });

    const onPopularDone = this.trackPendingLoad();
    this.podcastService.getHomePopularEpisodeBanners().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      onPopularDone();
      completeLoad();
    })).subscribe({
      next: episodes => { this.popularPodcastEpisodes = episodes; },
      error: err => console.error('loadContent: popular episodes', err)
    });
  }

  private onAllContentLoaded(): void {
    this.pendingContentLoads = 0;
    const targetY = HomePageComponent.savedScrollY;
    if (targetY <= 0) return;
    HomePageComponent.savedScrollY = 0;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, targetY);
      });
    });
  }

  onSearchInput(query: string) {
    this.searchSubject.next(query);
  }

  onSearchFocus(): void {
    this.isSearchInputFocused = true;
  }

  submitHomeSearch(): void {
    const query = this.searchQuery.trim();
    this.showSearchResults = false;
    this.router.navigate(['/articles'], query ? { queryParams: { search: query } } : undefined);
  }

  selectSearchResult(event: Event, item: SearchItem): void {
    if (event instanceof MouseEvent && event.button !== 0) return;
    event.preventDefault();
    this.navigateToResult(item);
  }

  toggleHomeAutoScroll(): void {
    this.isHomeAutoScrollPaused = !this.isHomeAutoScrollPaused;
  }

  navigateToResult(item: SearchItem): void {
    this.showSearchResults = false;

    if (item.type === 'article') {
      this.articleService.getArticle(item.id).pipe(take(1)).subscribe({
        next: article => {
          this.router.navigate(getArticleLink(article));
        },
        error: () => {
          alert(this.langService.translate('common.article_open_error'));
        }
      });
      return;
    }

    const routes: Record<string, string> = {
      song: '/song',
      artist: '/artist',
      teacher: '/teacher',
      professional: '/professional',
      playlist: '/playlist',
      event: '/events'
    };

    if (item.type === 'podcast') {
      this.router.navigate(['/podcasts'], item.slug ? { queryParams: { series: item.slug } } : undefined);
      return;
    }

    if (item.type === 'podcastEpisode') {
      this.router.navigate(['/podcasts'], item.parentSlug && item.slug ? { queryParams: { series: item.parentSlug, episode: item.slug } } : undefined);
      return;
    }

    if (item.type === 'agency' && item.slug) {
      this.router.navigate(['/agency', item.slug]);
      return;
    }

    if (item.type === 'event') {
      this.router.navigate(['/events']);
      return;
    }

    const base = routes[item.type];
    if (base) {
      if (item.type === 'song' && item.title) {
        const slug = songSlug({ title: item.title, artistName: item.subtitle || '' });
        this.router.navigate(slug ? ['/song', item.id, slug] : ['/song', item.id]);
      } else if (item.type === 'artist') {
        this.router.navigate(artistRoute({ id: item.id, name: item.title }));
      } else {
        this.router.navigate([base, item.id]);
      }
    }
  }

  trackById(_index: number, item: { id: number | string }): number | string {
    return item.id;
  }

  trackByIndex(index: number): number {
    return index;
  }

  get hasNoResults(): boolean {
    if (this.isSearchingDeep) return false;
    if (this.lyricsMatches.length > 0) return false;
    if (!this.searchResults) return false;
    return this.searchResults.totalCount === 0;
  }

  onSearchBlur() {
    this.isSearchInputFocused = false;
    setTimeout(() => {
      this.showSearchResults = false;
    }, 200);
  }

  private splitForRows<T>(articles: T[]): { top: T[]; bottom: T[] } {
    if (articles.length <= 1) return { top: articles, bottom: [] };
    const half = Math.ceil(articles.length / 2);
    return { top: articles.slice(0, half), bottom: articles.slice(half) };
  }

  get newsArticlesFirstRow(): ArticleBanner[] {
    return this.featuredNewsArticles;
  }

  get newsArticlesSecondRow(): ArticleBanner[] {
    return this.regularNewsArticles;
  }

  private buildMobileNewsRows(articles: ArticleBanner[]): ArticleBanner[][] {
    const visibleArticles = articles.slice(0, 9);
    const rows: ArticleBanner[][] = [];
    for (let index = 0; index < visibleArticles.length; index += 3) {
      rows.push(visibleArticles.slice(index, index + 3));
    }
    return rows;
  }

  private buildMobileArtistRows(artists: any[]): any[][] {
    if (artists.length === 0) return [];

    return Array.from({ length: 2 }, (_, rowIndex) =>
      Array.from({ length: 4 }, (_, artistIndex) => artists[(rowIndex * 4 + artistIndex) % artists.length])
    );
  }

  get useScrollingNewsBanner(): boolean {
    return this.newsArticles.length >= 2;
  }

  get useScrollingBlogBanner(): boolean {
    return this.blogArticles.length >= 2;
  }

  get blogArticlesFirstRow(): ArticleBanner[] {
    return this.splitForRows(this.blogArticles).top;
  }

  get blogArticlesSecondRow(): ArticleBanner[] {
    return this.splitForRows(this.blogArticles).bottom;
  }

  private buildViralRows(): ViralRow[] {
    const articles = this.visibleViralArticles;
    const rows: ViralRow[] = [];
    let i = 0;

    if (this.viralRowsViewport === 'mobile') {
      let rowType = 0;
      while (i < articles.length) {
        const count = rowType % 2 === 0 ? 2 : 1;
        const end = Math.min(i + count, articles.length);
        rows.push({ articles: articles.slice(i, end), gridCols: count === 2 ? '1fr 1fr' : '1fr' });
        i = end;
        rowType++;
      }
    } else {
      const twoColPatterns = ['2fr 1fr', '3fr 2fr', '1fr 2fr', '2fr 3fr'];
      const threeColPatterns = ['2fr 1fr 1fr', '1fr 2fr 1fr', '1fr 1fr 2fr', '3fr 2fr 1fr', '2fr 3fr 1fr', '1fr 3fr 2fr'];

      let twoIdx = 0;
      let threeIdx = 0;
      let rowType = 0;

      while (i < articles.length) {
        const cols = rowType % 2 === 0 ? 2 : 3;
        const end = Math.min(i + cols, articles.length);
        const actualCols = end - i;

        let gridCols: string;
        if (actualCols === 1) {
          gridCols = '1fr';
        } else if (actualCols === 2) {
          gridCols = twoColPatterns[twoIdx % twoColPatterns.length];
          twoIdx++;
        } else {
          gridCols = threeColPatterns[threeIdx % threeColPatterns.length];
          threeIdx++;
        }

        rows.push({ articles: articles.slice(i, end), gridCols });
        i = end;
        rowType++;
      }
    }

    return rows;
  }

  private refreshVisibleViralArticles(): void {
    this.visibleViralArticles = this.viralArticles.slice(0, this.visibleViralCount);
    this.viralRows = this.buildViralRows();
  }

  private updateViralRowsIfViewportChanged(): void {
    const nextViewport = window.innerWidth <= 640 ? 'mobile' : 'desktop';
    if (nextViewport === this.viralRowsViewport) return;
    this.viralRowsViewport = nextViewport;
    this.viralRows = this.buildViralRows();
  }

  get canRevealMoreViralArticles(): boolean {
    return (this.visibleViralCount < this.viralArticles.length || this.viralArticlesHasMore) && !this.loadingViralArticles;
  }

  private initViralObserver(): void {
    if (this.viralObserver) this.viralObserver.disconnect();

    this.viralObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          if (entry.target === this.viralSection?.nativeElement) {
            this.loadViralArticles();
          }

          if (entry.target === this.viralSentinel?.nativeElement) {
            this.revealMoreViralArticles();
          }
        }
      },
      { rootMargin: '360px 0px', threshold: 0.01 }
    );

    if (this.viralSection?.nativeElement) {
      this.viralObserver.observe(this.viralSection.nativeElement);
    }
    if (this.viralSentinel?.nativeElement) {
      this.viralObserver.observe(this.viralSentinel.nativeElement);
    }
  }

  private loadViralArticles(): void {
    if (this.loadingViralArticles || !this.viralArticlesHasMore) return;

    this.loadingViralArticles = true;
    this.articleService.getHomeViralBanners(this.viralPageSize, this.viralOffset)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (articles) => {
          this.appendViralArticles(articles || []);
        },
        error: (err) => {
          console.error('loadContent: viral articles', err);
          this.viralArticlesLoaded = true;
          this.loadingViralArticles = false;
        }
      });
  }

  private loadHomeNewsArticles(): void {
    const onNewsDone = this.trackPendingLoad();
    this.articleService.getHomeNewsBanners()
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
        onNewsDone();
        this.continueAfterNews();
      })).subscribe({
        next: (banners) => {
          this.featuredNewsArticles = this.uniqueArticles(banners.featured || []);
          this.regularNewsArticles = this.uniqueArticles(banners.regular || []);
          this.newsArticles = this.uniqueArticles([
            ...this.featuredNewsArticles,
            ...this.regularNewsArticles
          ]);
          this.mobileNewsRows = this.buildMobileNewsRows(this.newsArticles);
        },
        error: (err) => {
          console.error('loadContent: home news banners', err);
        }
      });
  }

  private loadBlogArticles(afterLoad?: () => void): void {
    const onBlogDone = this.trackPendingLoad();
    this.articleService.getHomeContentBanners(8)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
        this.blogArticlesLoaded = true;
        onBlogDone();
        afterLoad?.();
      })).subscribe({
        next: (blogArticles) => {
          this.blogArticles = this.uniqueArticles(blogArticles || []);
          this.mobileBlogRows = this.buildMobileNewsRows(this.blogArticles);
        },
        error: (err) => console.error('loadContent: home blog articles', err)
      });
  }

  private loadHomeCategoryArticles(afterLoad?: () => void): void {
    this.articleService.getHomeCategoryBanners(8)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
        this.homeCategoryArticlesLoaded = true;
        afterLoad?.();
      })).subscribe({
        next: (result) => {
          this.homeCategoryName = result?.categoryName || '';
          this.homeCategoryArticles = this.uniqueArticles(result?.banners || []);
        },
        error: (err) => console.error('loadContent: home category articles', err)
      });
  }

  private checkAllContentLoaded(): void {
    if (this.pendingContentLoads <= 0) {
      this.onAllContentLoaded();
    }
  }

  private appendViralArticles(articles: ArticleBanner[]): void {
    const previousArticleCount = this.viralArticles.length;
    const wasShowingAllLoadedArticles = this.visibleViralCount >= previousArticleCount;
    const nextArticles = this.uniqueArticles([...this.viralArticles, ...articles]);
    this.viralArticles = nextArticles;
    this.viralOffset += articles.length;
    this.viralArticlesHasMore = articles.length === this.viralPageSize;
    if (previousArticleCount === 0) {
      this.visibleViralCount = Math.min(this.initialViralVisibleCount, this.viralArticles.length);
    } else if (wasShowingAllLoadedArticles) {
      this.visibleViralCount = Math.min(this.visibleViralCount + this.viralRevealStep, this.viralArticles.length);
    }
    this.refreshVisibleViralArticles();
    this.viralArticlesLoaded = true;
    this.loadingViralArticles = false;
    setTimeout(() => this.initViralObserver(), 0);
  }

  private uniqueArticles<T extends { id: number }>(articles: T[]): T[] {
    const seen = new Set<number>();
    return articles.filter(article => {
      if (seen.has(article.id)) return false;
      seen.add(article.id);
      return true;
    });
  }

  private revealMoreViralArticles(): void {
    if (!this.viralArticlesLoaded || !this.canRevealMoreViralArticles) return;
    if (this.visibleViralCount < this.viralArticles.length) {
      this.visibleViralCount = Math.min(this.visibleViralCount + this.viralRevealStep, this.viralArticles.length);
      this.refreshVisibleViralArticles();
      setTimeout(() => this.initViralObserver(), 0);
      return;
    }
    this.loadViralArticles();
  }

  private initParticleEffect(): void {
    if (window.innerWidth < 1025) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = this.heroCanvas?.nativeElement;
    const heroBg = this.heroBg?.nativeElement;
    if (!canvas || !heroBg) return;

    this.heroCtx = canvas.getContext('2d');
    this.resizeHeroCanvas();

    this.heroMouseHandler = (e: MouseEvent) => {
      const rect = heroBg.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right ||
          e.clientY < rect.top || e.clientY > rect.bottom) return;

      // Scale mouse coordinates to canvas pixel space
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      this.spawnHeroParticles(x, y, e.movementX * scaleX, e.movementY * scaleY);
    };
    window.addEventListener('mousemove', this.heroMouseHandler);
  }

  private spawnHeroParticles(x: number, y: number, dx: number, dy: number): void {
    const moveSpeed = Math.sqrt(dx * dx + dy * dy);
      const count = Math.min(8, 3 + Math.floor(moveSpeed * 0.30));

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.5 + 0.4;
      const isBig = Math.random() < 0.25;

      this.heroParticles.push({
        x,
        y,
        vx: Math.cos(angle) * speed + dx * 0.03,
        vy: Math.sin(angle) * speed + dy * 0.03,
        life: 1,
        maxLife: isBig ? 1.8 + Math.random() * 0.8 : 0.9 + Math.random() * 0.7,
        size: isBig ? 8 + Math.random() * 12 : 2 + Math.random() * 3.5
      });
    }
    if (this.heroParticles.length > 180) this.heroParticles.splice(0, this.heroParticles.length - 180);

    if (!this.particleAnimId) {
      this.animateHeroParticles();
    }
  }

  private animateHeroParticles(): void {
    const ctx = this.heroCtx;
    const canvas = this.heroCanvas?.nativeElement;
    const heroBg = this.heroBg?.nativeElement;
    if (!ctx || !canvas) return;

    if (heroBg) {
      const w = heroBg.clientWidth;
      const h = this.fullHeroHeight || heroBg.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dt = 1 / 60;

    this.heroParticles = this.heroParticles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt / p.maxLife;
      if (p.life <= 0) return false;

      const alpha = Math.pow(p.life, 1.6);
      const r = p.size * (0.4 + p.life * 0.6);

      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0,   `rgba(255,255,255,${(alpha * 0.55).toFixed(3)})`);
      g.addColorStop(0.35, `rgba(255,255,255,${(alpha * 0.18).toFixed(3)})`);
      g.addColorStop(1,   'rgba(255,255,255,0)');

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });

    if (this.heroParticles.length > 0) {
      this.particleAnimId = requestAnimationFrame(() => this.animateHeroParticles());
    } else {
      this.particleAnimId = undefined;
    }
  }
}
