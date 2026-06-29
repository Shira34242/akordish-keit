import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, DestroyRef, NgZone, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, take, finalize, catchError } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SongService } from '../../services/song.service';
import { ArtistService } from '../../services/artist.service';
import { ArticleService } from '../../services/admin/article.service';
import { EventService } from '../../services/admin/event.service';
import { TeacherService } from '../../services/teacher.service';
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
import { AutoScrollDirective } from '../../directives/auto-scroll.directive';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { ArticleBanner } from '../../models/article.model';
import { UpcomingEventDto } from '../../models/event.model';
import { EventCardData } from '../../utils/event.utils';
import { TeacherListDto } from '../../models/teacher.model';
import { MusicServiceProviderListDto } from '../../models/music-service-provider.model';
import { PodcastEpisodeBanner, PodcastHomeCard } from '../../models/podcast.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { AdDisplayComponent } from '../public/ad-display/ad-display.component';
import { artistRoute, songSlug } from '../../utils/slug';
import { getArticleLink } from '../../utils/article-route.utils';
import { CloudflareImagePipe } from '../../pipes/cloudflare-image.pipe';

interface HeroParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
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
    TranslatePipe,
    AutoScrollDirective,
    ImgFallbackDirective,
    CloudflareImagePipe,
    AdDisplayComponent
  ],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('heroBg') heroBg?: ElementRef<HTMLDivElement>;
  @ViewChild('heroCanvas') heroCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('viralSection') viralSection?: ElementRef<HTMLElement>;
  @ViewChild('viralSentinel') viralSentinel?: ElementRef<HTMLDivElement>;

  searchQuery = '';
  searchResults: SearchResults | null = null;
  lyricsMatches: SearchItem[] = [];
  isSearchingDeep = false;
  showSearchResults = false;
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
  blogArticles: ArticleBanner[] = [];
  blogArticlesLoaded = false;
  viralArticles: ArticleBanner[] = [];
  visibleViralCount = 4;
  loadingViralArticles = false;
  viralArticlesLoaded = false;
  viralArticlesHasMore = true;
  upcomingEvents: UpcomingEventDto[] = [];
  selectedEventModal: EventCardData | null = null;
  featuredTeachers: TeacherListDto[] = [];
  featuredProviders: MusicServiceProviderListDto[] = [];
  homePodcasts: PodcastHomeCard[] = [];
  popularPodcastEpisodes: PodcastEpisodeBanner[] = [];


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
  private readonly viralPageSize = 10;
  newsContentFinished = false;
  restContentStarted = false;
  private chordsContentStarted = false;

  constructor(
    private router: Router,
    private songService: SongService,
    private artistService: ArtistService,
    private articleService: ArticleService,
    private eventService: EventService,
    private teacherService: TeacherService,
    private providerService: MusicServiceProviderService,
    private podcastService: PodcastService,
    private quickAddAssistantService: QuickAddAssistantService,
    private searchService: SearchService,
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

  ngOnInit() {
    this.loadContent();
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
    this.viralObserver?.disconnect();
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
    this.fullHeroHeight = Math.max(0, this.lastViewportHeight - 16); /* top: 8px + bottom: 8px */
    bg.style.setProperty('--hero-full-height', this.fullHeroHeight + 'px');
    bg.style.height = this.fullHeroHeight + 'px';
    this.resizeHeroCanvas();
    this.shrinkHero();
  }

  private shrinkHero(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg || this.fullHeroHeight === 0) return;
    const minHeight = 56; /* header 56px — hero מתכווץ לגובה שורת הכותרת */
    const scrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    const newHeight = Math.max(minHeight, this.fullHeroHeight - scrollY);
    const visibleHeight = Math.round(newHeight * 100) / 100;
    if (Math.abs(visibleHeight - this.lastHeroVisibleHeight) >= 0.25) {
      bg.style.height = visibleHeight + 'px';
      this.lastHeroVisibleHeight = visibleHeight;
    }

    const progress = Math.min(1, scrollY / 160);
    if (this.heroOverlayEl) this.heroOverlayEl.style.opacity = String(Math.max(0, 1 - progress));

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
    setTimeout(() => this.loadChords(), 80);
    setTimeout(() => this.loadRemainingContent(), 160);
  }

  private loadChords(): void {
    if (this.chordsContentStarted) return;
    this.chordsContentStarted = true;
    this.newsContentFinished = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.loadRecentSongs();
        this.loadPopularSongs();
      });
    });
  }

  private loadRemainingContent(): void {
    if (this.restContentStarted) return;
    this.restContentStarted = true;

    const orderedLoads: Array<() => void> = [
      () => this.loadTopArtists(),
      () => this.loadFeaturedPeople(),
      () => this.loadUpcomingEvents(),
      () => this.loadHomePodcasts(),
      () => this.loadBlogArticles()
    ];

    orderedLoads.forEach((load, index) => {
      setTimeout(load, index * 60);
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.initViralObserver());
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
    this.artistService.getFeaturedArtists(8).pipe(
      switchMap((artists: any[]) => artists.length > 0 ? of(artists) : this.artistService.getTopArtists(8)),
      catchError(() => this.artistService.getTopArtists(8)),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
      onDone();
      afterLoad?.();
    })).subscribe({
      next: (artists: any[]) => { this.topArtists = artists; },
      error: (err) => console.error('loadContent: top artists', err)
    });
  }

  private loadUpcomingEvents(afterLoad?: () => void): void {
    const onDone = this.trackPendingLoad();
    this.eventService.getUpcomingEvents(8).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      onDone();
      afterLoad?.();
    })).subscribe({
      next: (events: UpcomingEventDto[]) => { this.upcomingEvents = events; },
      error: (err) => console.error('loadContent: events', err)
    });
  }

  private loadFeaturedPeople(afterLoad?: () => void): void {
    let completedLoads = 0;
    const completeLoad = () => {
      completedLoads++;
      if (completedLoads === 2) afterLoad?.();
    };
    const onTeachersDone = this.trackPendingLoad();
    this.teacherService.getTeachers(undefined, undefined, 1, undefined, 1, 6).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      onTeachersDone();
      completeLoad();
    })).subscribe({
      next: (res: any) => { this.featuredTeachers = res.items || []; },
      error: (err) => console.error('loadContent: teachers', err)
    });

    const onProvidersDone = this.trackPendingLoad();
    this.providerService.getServiceProviders(undefined, undefined, undefined, 1, undefined, false, 1, 6).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      onProvidersDone();
      completeLoad();
    })).subscribe({
      next: (res: any) => { this.featuredProviders = res.items || []; },
      error: (err) => console.error('loadContent: providers', err)
    });
  }

  private loadHomePodcasts(afterLoad?: () => void): void {
    let completedLoads = 0;
    const completeLoad = () => {
      completedLoads++;
      if (completedLoads === 2) afterLoad?.();
    };
    const onSeriesDone = this.trackPendingLoad();
    this.podcastService.getHomePodcastCards(8).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      onSeriesDone();
      completeLoad();
    })).subscribe({
      next: podcasts => { this.homePodcasts = podcasts.slice(0, 8); },
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

  get visibleViralArticles(): ArticleBanner[] {
    return this.viralArticles.slice(0, this.visibleViralCount);
  }

  getViralRows(): { articles: ArticleBanner[]; gridCols: string }[] {
    const articles = this.visibleViralArticles;
    const rows: { articles: ArticleBanner[]; gridCols: string }[] = [];
    let i = 0;

    if (window.innerWidth <= 640) {
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

  get canRevealMoreViralArticles(): boolean {
    return this.viralArticlesHasMore && !this.loadingViralArticles;
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
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(onNewsDone)).subscribe({
        next: (banners) => {
          this.featuredNewsArticles = this.uniqueArticles(banners.featured || []);
          this.regularNewsArticles = this.uniqueArticles(banners.regular || []);
          this.newsArticles = this.uniqueArticles([
            ...this.featuredNewsArticles,
            ...this.regularNewsArticles
          ]);
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
        },
        error: (err) => console.error('loadContent: home blog articles', err)
      });
  }

  private checkAllContentLoaded(): void {
    if (this.pendingContentLoads <= 0) {
      this.onAllContentLoaded();
    }
  }

  private appendViralArticles(articles: ArticleBanner[]): void {
    const nextArticles = this.uniqueArticles([...this.viralArticles, ...articles]);
    this.viralArticles = nextArticles;
    this.viralOffset += articles.length;
    this.viralArticlesHasMore = articles.length === this.viralPageSize;
    this.visibleViralCount = this.viralArticles.length;
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
    const count = Math.min(6, 3 + Math.floor(moveSpeed * 0.22));

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
