import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ViewChildren, ElementRef, DestroyRef, NgZone, QueryList, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, take, finalize, forkJoin } from 'rxjs';
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
import { SystemItem, SystemTablesService } from '../../services/system-tables.service';
import { SongCardComponent } from '../shared/song-card/song-card.component';
import { ArtistCircleComponent } from '../shared/artist-circle/artist-circle.component';
import { NewsBannerComponent } from '../shared/news-banner/news-banner.component';
import { PodcastEpisodeBannerComponent } from '../shared/podcast-episode-banner/podcast-episode-banner.component';
import { EventCardComponent } from '../shared/event-card/event-card.component';
import { EventModalComponent } from '../shared/event-modal/event-modal.component';
import { AutoScrollDirective } from '../../directives/auto-scroll.directive';
import { ImgFallbackDirective } from '../../directives/img-fallback.directive';
import { Article, ArticleStatus, ArticleContentType } from '../../models/article.model';
import { UpcomingEventDto } from '../../models/event.model';
import { EventCardData } from '../../utils/event.utils';
import { TeacherListDto } from '../../models/teacher.model';
import { MusicServiceProviderListDto } from '../../models/music-service-provider.model';
import { Podcast, PodcastEpisode } from '../../models/podcast.model';
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

type HomeLazySection = 'featured' | 'events' | 'podcasts';

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
  @ViewChildren('homeLazySentinel') homeLazySentinels?: QueryList<ElementRef<HTMLDivElement>>;

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
  newsArticles: Article[] = [];
  featuredNewsArticles: Article[] = [];
  regularNewsArticles: Article[] = [];
  blogArticles: Article[] = [];
  viralArticles: Article[] = [];
  visibleViralCount = 4;
  loadingViralArticles = false;
  viralArticlesLoaded = false;
  upcomingEvents: UpcomingEventDto[] = [];
  selectedEventModal: EventCardData | null = null;
  featuredTeachers: TeacherListDto[] = [];
  featuredProviders: MusicServiceProviderListDto[] = [];
  homePodcasts: Podcast[] = [];
  latestPodcastEpisodes: PodcastEpisode[] = [];
  popularPodcastEpisodes: PodcastEpisode[] = [];


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
  private homeLazyObserver?: IntersectionObserver;
  private loadedLazySections = new Set<HomeLazySection>();
  private loadingLazySections = new Set<HomeLazySection>();
  private deferredLoadTimers: number[] = [];
  private articleCategorySectionById = new Map<number, ArticleContentType>();
  private articleCategorySectionByName = new Map<string, ArticleContentType>();

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
    private systemTablesService: SystemTablesService
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
      this.initHomeLazySections();
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
    this.homeLazyObserver?.disconnect();
    this.deferredLoadTimers.forEach(id => window.clearTimeout(id));
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
    this.loadHomeArticleCategories();
    this.loadNonCriticalContent();
  }

  private loadNonCriticalContent(): void {
    const loaders: Array<() => void> = [
      () => this.loadRecentSongs(),
      () => this.loadPopularSongs(),
      () => this.loadTopArtists()
    ];

    loaders.forEach((loader, index) => this.scheduleDeferredLoad(loader, 160 * index));
  }

  private scheduleDeferredLoad(loader: () => void, delayMs: number): void {
    const timer = window.setTimeout(() => {
      this.deferredLoadTimers = this.deferredLoadTimers.filter(id => id !== timer);
      loader();
    }, delayMs);
    this.deferredLoadTimers.push(timer);
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

  private loadRecentSongs(): void {
    const onDone = this.trackPendingLoad();
    this.songService.getSongs(undefined, 1, 8).pipe(takeUntilDestroyed(this.destroyRef), finalize(onDone)).subscribe({
      next: (res: any) => { this.recentSongs = res.songs || []; },
      error: (err) => console.error('loadContent: songs', err)
    });
  }

  private loadPopularSongs(): void {
    const onDone = this.trackPendingLoad();
    this.songService.getPopularSongs(8).pipe(takeUntilDestroyed(this.destroyRef), finalize(onDone)).subscribe({
      next: (songs: any[]) => { this.popularSongs = songs; },
      error: (err) => console.error('loadContent: popular songs', err)
    });
  }

  private loadTopArtists(): void {
    const onDone = this.trackPendingLoad();
    this.artistService.getTopArtists(12).pipe(takeUntilDestroyed(this.destroyRef), finalize(onDone)).subscribe({
      next: (artists: any[]) => { this.topArtists = artists; },
      error: (err) => console.error('loadContent: top artists', err)
    });
  }

  private loadUpcomingEvents(): void {
    const onDone = this.trackPendingLoad();
    this.eventService.getUpcomingEvents(6).pipe(takeUntilDestroyed(this.destroyRef), finalize(onDone)).subscribe({
      next: (events: UpcomingEventDto[]) => { this.upcomingEvents = events; },
      error: (err) => console.error('loadContent: events', err)
    });
  }

  private loadFeaturedPeople(): void {
    const onTeachersDone = this.trackPendingLoad();
    this.teacherService.getTeachers(undefined, undefined, 1, undefined, 1, 12).pipe(takeUntilDestroyed(this.destroyRef), finalize(onTeachersDone)).subscribe({
      next: (res: any) => { this.featuredTeachers = res.items || []; },
      error: (err) => console.error('loadContent: teachers', err)
    });

    const onProvidersDone = this.trackPendingLoad();
    this.providerService.getServiceProviders(undefined, undefined, undefined, 1, undefined, false, 1, 12).pipe(takeUntilDestroyed(this.destroyRef), finalize(onProvidersDone)).subscribe({
      next: (res: any) => { this.featuredProviders = res.items || []; },
      error: (err) => console.error('loadContent: providers', err)
    });
  }

  private loadHomePodcasts(): void {
    const onSeriesDone = this.trackPendingLoad();
    this.podcastService.getPublicPodcasts().pipe(takeUntilDestroyed(this.destroyRef), finalize(onSeriesDone)).subscribe({
      next: podcasts => { this.homePodcasts = podcasts.slice(0, 6); },
      error: err => console.error('loadContent: podcast series', err)
    });

    const onPopularDone = this.trackPendingLoad();
    this.podcastService.getPopularEpisodes(8).pipe(takeUntilDestroyed(this.destroyRef), finalize(onPopularDone)).subscribe({
      next: episodes => { this.popularPodcastEpisodes = episodes; },
      error: err => console.error('loadContent: popular episodes', err)
    });
  }

  private loadHomeArticleCategories(): void {
    this.pendingContentLoads += 2;

    this.systemTablesService.getItems('article-categories', 1, 200)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
        this.pendingContentLoads--;
        this.checkAllContentLoaded();
      })).subscribe({
        next: (res: any) => {
          this.setArticleCategorySections(res.items || []);
          this.loadHomeArticles();
        },
        error: (err) => {
          console.error('loadContent: article categories', err);
          this.loadHomeArticles();
        }
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
      playlist: '/playlist'
    };
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

  getPodcastEpisodeThumbnail(episode: PodcastEpisode): string | null {
    return episode.thumbnailUrl || this.buildYouTubeThumbnail(episode.sourceUrl) || this.buildYouTubeThumbnail(episode.embedUrl);
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

  private splitForRows(articles: Article[]): { top: Article[]; bottom: Article[] } {
    if (articles.length <= 1) return { top: articles, bottom: [] };
    const half = Math.ceil(articles.length / 2);
    return { top: articles.slice(0, half), bottom: articles.slice(half) };
  }

  get newsArticlesFirstRow(): Article[] {
    return this.featuredNewsArticles;
  }

  get newsArticlesSecondRow(): Article[] {
    return this.regularNewsArticles;
  }

  get useScrollingNewsBanner(): boolean {
    return this.newsArticles.length >= 2;
  }

  get useScrollingBlogBanner(): boolean {
    return this.blogArticles.length >= 2;
  }

  get blogArticlesFirstRow(): Article[] {
    return this.splitForRows(this.blogArticles).top;
  }

  get blogArticlesSecondRow(): Article[] {
    return this.splitForRows(this.blogArticles).bottom;
  }

  get visibleViralArticles(): Article[] {
    return this.viralArticles.slice(0, this.visibleViralCount);
  }

  get canRevealMoreViralArticles(): boolean {
    return this.visibleViralCount < this.viralArticles.length;
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

  private initHomeLazySections(): void {
    if (this.homeLazyObserver) this.homeLazyObserver.disconnect();

    this.homeLazyObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const section = (entry.target as HTMLElement).dataset['homeLoad'] as HomeLazySection | undefined;
          if (!section) continue;
          this.homeLazyObserver?.unobserve(entry.target);
          this.loadHomeLazySection(section);
        }
      },
      { rootMargin: '520px 0px', threshold: 0.01 }
    );

    this.homeLazySentinels?.forEach(sentinel => {
      this.homeLazyObserver?.observe(sentinel.nativeElement);
    });
  }

  private loadHomeLazySection(section: HomeLazySection): void {
    if (this.loadedLazySections.has(section) || this.loadingLazySections.has(section)) return;
    this.loadingLazySections.add(section);

    switch (section) {
      case 'featured':
        this.loadFeaturedPeople();
        break;
      case 'events':
        this.loadUpcomingEvents();
        break;
      case 'podcasts':
        this.loadHomePodcasts();
        break;
    }

    this.loadingLazySections.delete(section);
    this.loadedLazySections.add(section);
  }

  private loadViralArticles(): void {
    if (this.viralArticlesLoaded || this.loadingViralArticles) return;

    this.loadingViralArticles = true;
    this.articleService.getArticles(1, 80, undefined, undefined, undefined, ArticleStatus.Published, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 'views')
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res: any) => {
          this.setViralArticles(this.uniqueArticles(res.items || []));
        },
        error: (err) => {
          console.error('loadContent: viral articles', err);
          this.viralArticlesLoaded = true;
          this.loadingViralArticles = false;
        }
      });
  }

  private loadHomeArticles(): void {
    forkJoin({
      featuredNews: this.articleService.getArticles(1, 5, undefined, undefined, ArticleContentType.News, ArticleStatus.Published, true),
      allNews: this.articleService.getArticles(1, 12, undefined, undefined, ArticleContentType.News, ArticleStatus.Published),
      blogArticles: this.articleService.getArticles(1, 80, undefined, undefined, ArticleContentType.Blog, ArticleStatus.Published)
    })
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
        this.pendingContentLoads--;
        this.checkAllContentLoaded();
      })).subscribe({
        next: ({ featuredNews, allNews, blogArticles }: any) => {
          this.featuredNewsArticles = this.uniqueArticles(featuredNews.items || [])
            .map(article => this.withContentType(article, ArticleContentType.News));
          const featuredArticleIds = new Set(this.featuredNewsArticles.map(article => article.id));
          this.regularNewsArticles = this.uniqueArticles(allNews.items || [])
            .filter(article => !featuredArticleIds.has(article.id))
            .map(article => this.withContentType(article, ArticleContentType.News))
            .slice(0, 6);
          this.newsArticles = this.uniqueArticles([
            ...this.featuredNewsArticles,
            ...this.regularNewsArticles
          ]);
          this.blogArticles = this.uniqueArticles(blogArticles.items || [])
            .map(article => this.withContentType(article, ArticleContentType.Blog))
            .slice(0, 12);
        },
        error: (err) => console.error('loadContent: home articles', err)
      });
  }

  private checkAllContentLoaded(): void {
    if (this.pendingContentLoads <= 0) {
      this.onAllContentLoaded();
    }
  }

  private setArticleCategorySections(categories: SystemItem[]): void {
    this.articleCategorySectionById = new Map<number, ArticleContentType>();
    this.articleCategorySectionByName = new Map<string, ArticleContentType>();

    for (const category of categories) {
      const type = this.getCategoryTypeFromName(category.name)
        ?? (Number(category['section']) === 1 ? ArticleContentType.Blog : ArticleContentType.News);
      this.articleCategorySectionById.set(category.id, type);
      if (category.name) {
        this.articleCategorySectionByName.set(this.normalizeCategoryName(category.name), type);
      }
    }
  }

  private getViralColumns(): number {
    const w = window.innerWidth;
    if (w <= 480) return 1;
    if (w <= 768) return 2;
    return 4;
  }

  private floorToFullRows(count: number, total: number): number {
    const cols = this.getViralColumns();
    const full = Math.floor(Math.min(count, total) / cols) * cols;
    return Math.max(0, full);
  }

  private setViralArticles(articles: Article[]): void {
    const newsArticles = articles
      .filter(article => this.isMusicNewsArticle(article));

    const popularArticles = newsArticles
      .sort((a: Article, b: Article) => (b.viewCount || 0) - (a.viewCount || 0));

    this.viralArticles = popularArticles.slice(0, 40);
    this.viralArticles = this.viralArticles.map(article => this.withContentType(article, ArticleContentType.News));
    this.visibleViralCount = this.floorToFullRows(4, this.viralArticles.length);
    this.viralArticlesLoaded = true;
    this.loadingViralArticles = false;
    setTimeout(() => this.initViralObserver(), 0);
  }

  private isMusicNewsArticle(article: Article): boolean {
    const categoryType = this.getArticleCategorySection(article);
    if (categoryType !== null) return categoryType === ArticleContentType.News;
    return this.normalizeArticleContentType(article) === ArticleContentType.News;
  }

  private isContentArticle(article: Article): boolean {
    const categoryType = this.getArticleCategorySection(article);
    if (categoryType !== null) return categoryType === ArticleContentType.Blog;
    return this.normalizeArticleContentType(article) === ArticleContentType.Blog;
  }

  private getArticleCategorySection(article: Article): ArticleContentType | null {
    const ids = Array.isArray(article.categoryIds) ? article.categoryIds : [];
    const categoryNames = Array.isArray(article.categoryNames) ? article.categoryNames : [];
    const typeFromNames = this.getArticleCategoryTypeFromNames(categoryNames);
    if (typeFromNames !== null) return typeFromNames;

    const knownCategoryTypes = ids
      .map(id => this.articleCategorySectionById.get(id))
      .filter((type): type is ArticleContentType => type !== undefined);

    if (knownCategoryTypes.includes(ArticleContentType.News)) return ArticleContentType.News;
    if (knownCategoryTypes.includes(ArticleContentType.Blog)) return ArticleContentType.Blog;

    const knownNameTypes = categoryNames
      .map(name => this.articleCategorySectionByName.get(this.normalizeCategoryName(name)))
      .filter((type): type is ArticleContentType => type !== undefined);

    if (knownNameTypes.includes(ArticleContentType.News)) return ArticleContentType.News;
    if (knownNameTypes.includes(ArticleContentType.Blog)) return ArticleContentType.Blog;
    return null;
  }

  private normalizeCategoryName(name: string): string {
    return String(name || '').trim().toLowerCase();
  }

  private getArticleCategoryTypeFromNames(categoryNames: string[]): ArticleContentType | null {
    const types = categoryNames
      .map(name => this.getCategoryTypeFromName(name))
      .filter((type): type is ArticleContentType => type !== null);

    if (types.includes(ArticleContentType.News)) return ArticleContentType.News;
    if (types.includes(ArticleContentType.Blog)) return ArticleContentType.Blog;
    return null;
  }

  private getCategoryTypeFromName(name: string): ArticleContentType | null {
    const text = this.normalizeCategoryName(name);
    if (!text) return null;
    if (text.includes('חדשות') || text.includes('news')) return ArticleContentType.News;
    if (text.includes('תוכן') || text.includes('blog') || text.includes('content')) return ArticleContentType.Blog;
    return null;
  }

  private withContentType(article: Article, contentType: ArticleContentType): Article {
    return { ...article, contentType };
  }

  private uniqueArticles(articles: Article[]): Article[] {
    const seen = new Set<number>();
    return articles.filter(article => {
      if (seen.has(article.id)) return false;
      seen.add(article.id);
      return true;
    });
  }

  private buildYouTubeThumbnail(url: string): string | null {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|img\.youtube\.com\/vi\/)([A-Za-z0-9_-]{6,})/i);
    return match?.[1] ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
  }

  private normalizeArticleContentType(article: Article): ArticleContentType | null {
    const rawType = (article as Article & { contentType?: ArticleContentType | string }).contentType;
    if (rawType === ArticleContentType.News || rawType === ArticleContentType.Blog) return rawType;

    const textType = String(rawType ?? '').trim().toLowerCase();
    if (textType === '0' || textType === 'news' || textType === 'article' || textType.includes('חדשות')) return ArticleContentType.News;
    if (textType === '1' || textType === 'blog' || textType === 'blogpost' || textType === 'content' || textType.includes('תוכן')) return ArticleContentType.Blog;
    return null;
  }

  private revealMoreViralArticles(): void {
    if (!this.viralArticlesLoaded || !this.canRevealMoreViralArticles) return;
    const cols = this.getViralColumns();
    const next = this.visibleViralCount + cols;
    this.visibleViralCount = this.floorToFullRows(next, this.viralArticles.length);
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
