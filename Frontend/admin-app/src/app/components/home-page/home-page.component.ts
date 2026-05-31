import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef, DestroyRef, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, take, finalize } from 'rxjs';
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
import { NewsTickerComponent } from '../shared/news-ticker/news-ticker.component';
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
import { songSlug } from '../../utils/slug';
import { getArticleRoute } from '../../utils/article-route.utils';
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
    NewsTickerComponent,
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

  recentSongs: any[] = [];
  popularSongs: any[] = [];
  topArtists: any[] = [];
  featuredArtists: any[] = [];
  newsArticles: Article[] = [];
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

  private heroCtx?: CanvasRenderingContext2D | null;
  private heroParticles: HeroParticle[] = [];
  private particleAnimId?: number;
  private heroMouseHandler?: (e: MouseEvent) => void;
  private viralObserver?: IntersectionObserver;
  private articleCategorySectionById = new Map<number, ArticleContentType>();
  private articleCategorySectionByName = new Map<string, ArticleContentType>();
  private allPublishedArticles: Article[] = [];

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
      this.initParticleEffect();
      this.initViralObserver();
    }, 0);
  }

  ngOnDestroy(): void {
    HomePageComponent.savedScrollY = window.scrollY;
    if (this.particleAnimId) cancelAnimationFrame(this.particleAnimId);
    if (this.heroMouseHandler) window.removeEventListener('mousemove', this.heroMouseHandler);
    this.viralObserver?.disconnect();
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
    this.isMobile = window.innerWidth <= 768;
    this.initHeroHeight();
  }

  private initHeroHeight(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg) return;
    this.fullHeroHeight = window.innerHeight - 16; /* top: 8px + bottom: 8px */
    bg.style.height = this.fullHeroHeight + 'px';
    this.shrinkHero();
  }

  private shrinkHero(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg || this.fullHeroHeight === 0) return;
    const minHeight = 56; /* header 56px — hero מתכווץ לגובה שורת הכותרת */
    const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
    bg.style.height = newHeight + 'px';

    const progress = Math.min(1, window.scrollY / 160);
    const overlay = bg.querySelector('.hero-overlay') as HTMLElement | null;
    if (overlay) overlay.style.opacity = String(Math.max(0, 1 - progress));

    const collapseOverlay = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
    if (collapseOverlay) {
      const collapseRange = this.fullHeroHeight - minHeight;
      const collapseProgress = collapseRange > 0
        ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
        : 0;
      collapseOverlay.style.opacity = String(collapseProgress);
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
    this.pendingContentLoads += 9;

    const onDone = () => {
      this.pendingContentLoads--;
      this.checkAllContentLoaded();
    };

    this.songService.getSongs(undefined, 1, 8).pipe(takeUntilDestroyed(this.destroyRef), finalize(onDone)).subscribe({
      next: (res: any) => { this.recentSongs = res.songs || []; },
      error: (err) => console.error('loadContent: songs', err)
    });

    this.songService.getPopularSongs(8).pipe(takeUntilDestroyed(this.destroyRef), finalize(onDone)).subscribe({
      next: (songs: any[]) => { this.popularSongs = songs; },
      error: (err) => console.error('loadContent: popular songs', err)
    });

    this.artistService.getTopArtists(12).pipe(takeUntilDestroyed(this.destroyRef), finalize(onDone)).subscribe({
      next: (artists: any[]) => { this.topArtists = artists; },
      error: (err) => console.error('loadContent: top artists', err)
    });

    this.eventService.getUpcomingEvents(6).pipe(takeUntilDestroyed(this.destroyRef), finalize(onDone)).subscribe({
      next: (events: UpcomingEventDto[]) => { this.upcomingEvents = events; },
      error: (err) => console.error('loadContent: events', err)
    });

    this.teacherService.getTeachers(undefined, undefined, 1, undefined, 1, 12).pipe(takeUntilDestroyed(this.destroyRef), finalize(onDone)).subscribe({
      next: (res: any) => { this.featuredTeachers = res.items || []; },
      error: (err) => console.error('loadContent: teachers', err)
    });

    this.providerService.getServiceProviders(undefined, undefined, undefined, 1, undefined, false, 1, 12).pipe(takeUntilDestroyed(this.destroyRef), finalize(onDone)).subscribe({
      next: (res: any) => { this.featuredProviders = res.items || []; },
      error: (err) => console.error('loadContent: providers', err)
    });

    this.podcastService.getLatestEpisodes(8).pipe(takeUntilDestroyed(this.destroyRef), finalize(onDone)).subscribe({
      next: episodes => { this.latestPodcastEpisodes = episodes; },
      error: err => console.error('loadContent: podcasts', err)
    });

    this.podcastService.getPublicPodcasts().pipe(takeUntilDestroyed(this.destroyRef), finalize(onDone)).subscribe({
      next: podcasts => { this.homePodcasts = podcasts.slice(0, 6); },
      error: err => console.error('loadContent: podcast series', err)
    });

    this.podcastService.getPopularEpisodes(8).pipe(takeUntilDestroyed(this.destroyRef), finalize(onDone)).subscribe({
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
          this.router.navigate([getArticleRoute(article), article.slug]);
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
    return this.splitForRows(this.newsArticles).top;
  }

  get newsArticlesSecondRow(): Article[] {
    return this.splitForRows(this.newsArticles).bottom;
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

  private loadViralArticles(): void {
    if (this.viralArticlesLoaded || this.loadingViralArticles) return;

    this.loadingViralArticles = true;
    if (this.allPublishedArticles.length > 0) {
      this.setViralArticles(this.allPublishedArticles);
      return;
    }

    this.articleService.getArticles(1, 200, undefined, undefined, undefined, ArticleStatus.Published)
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
    this.articleService.getArticles(1, 200, undefined, undefined, undefined, ArticleStatus.Published)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
        this.pendingContentLoads--;
        this.checkAllContentLoaded();
      })).subscribe({
        next: (res: any) => {
          this.allPublishedArticles = this.uniqueArticles(res.items || []);
          this.newsArticles = this.allPublishedArticles
            .filter(article => this.isMusicNewsArticle(article))
            .map(article => this.withContentType(article, ArticleContentType.News))
            .slice(0, 12);
          this.blogArticles = this.allPublishedArticles
            .filter(article => !this.isMusicNewsArticle(article))
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

    const canvas = this.heroCanvas?.nativeElement;
    const heroBg = this.heroBg?.nativeElement;
    if (!canvas || !heroBg) return;

    this.heroCtx = canvas.getContext('2d');
    canvas.width = heroBg.clientWidth;
    canvas.height = heroBg.clientHeight;

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
    const count = Math.min(10, 4 + Math.floor(moveSpeed * 0.3));

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
    if (this.heroParticles.length > 400) this.heroParticles.splice(0, this.heroParticles.length - 400);

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
      const h = heroBg.clientHeight;
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
