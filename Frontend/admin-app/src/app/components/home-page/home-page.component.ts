import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, HostBinding, ViewChild, ElementRef, DestroyRef, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SongService } from '../../services/song.service';
import { ArtistService } from '../../services/artist.service';
import { ArticleService } from '../../services/admin/article.service';
import { EventService } from '../../services/admin/event.service';
import { TeacherService } from '../../services/teacher.service';
import { MusicServiceProviderService } from '../../services/music-service-provider.service';
import { QuickAddAssistantService } from '../../services/quick-add-assistant.service';
import { SearchService, SearchResults, SearchItem } from '../../services/search.service';
import { SongCardComponent } from '../shared/song-card/song-card.component';
import { ArtistCircleComponent } from '../shared/artist-circle/artist-circle.component';
import { NewsBannerComponent } from '../shared/news-banner/news-banner.component';
import { NewsTickerComponent } from '../shared/news-ticker/news-ticker.component';
import { EventCardComponent } from '../shared/event-card/event-card.component';
import { EventModalComponent } from '../shared/event-modal/event-modal.component';
import { Article, ArticleStatus, ArticleContentType } from '../../models/article.model';
import { UpcomingEventDto } from '../../models/event.model';
import { EventCardData } from '../../utils/event.utils';
import { TeacherListDto } from '../../models/teacher.model';
import { MusicServiceProviderListDto } from '../../models/music-service-provider.model';
import { TranslatePipe } from '../../pipes/translate.pipe';

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
    NewsTickerComponent,
    EventCardComponent,
    EventModalComponent,
    TranslatePipe
  ],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('heroBg') heroBg?: ElementRef<HTMLDivElement>;
  @ViewChild('heroCanvas') heroCanvas?: ElementRef<HTMLCanvasElement>;

  @HostBinding('class.is-scrolling') isScrolling = false;
  private scrollEndTimer?: number;

  searchQuery = '';
  searchResults: SearchResults | null = null;
  lyricsMatches: SearchItem[] = [];
  isSearchingDeep = false;
  showSearchResults = false;
  private searchSubject = new Subject<string>();
  private readonly destroyRef = inject(DestroyRef);

  recentSongs: any[] = [];
  popularSongs: any[] = [];
  topArtists: any[] = [];
  featuredArtists: any[] = [];
  newsArticles: Article[] = [];
  blogArticles: Article[] = [];
  upcomingEvents: UpcomingEventDto[] = [];
  selectedEventModal: EventCardData | null = null;
  featuredTeachers: TeacherListDto[] = [];
  featuredProviders: MusicServiceProviderListDto[] = [];

  readonly newsBannerRowSize = 6;

  private fullHeroHeight = 0;
  private rafPending = false;

  private heroCtx?: CanvasRenderingContext2D | null;
  private heroParticles: HeroParticle[] = [];
  private particleAnimId?: number;
  private heroMouseHandler?: (e: MouseEvent) => void;

  constructor(
    private router: Router,
    private songService: SongService,
    private artistService: ArtistService,
    private articleService: ArticleService,
    private eventService: EventService,
    private teacherService: TeacherService,
    private providerService: MusicServiceProviderService,
    private quickAddAssistantService: QuickAddAssistantService,
    private searchService: SearchService
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
    }, 0);
  }

  ngOnDestroy(): void {
    if (this.particleAnimId) cancelAnimationFrame(this.particleAnimId);
    if (this.heroMouseHandler) window.removeEventListener('mousemove', this.heroMouseHandler);
    if (this.scrollEndTimer) window.clearTimeout(this.scrollEndTimer);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.isScrolling = true;
    if (this.scrollEndTimer) window.clearTimeout(this.scrollEndTimer);
    this.scrollEndTimer = window.setTimeout(() => {
      this.isScrolling = false;
    }, 180);

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

  loadContent() {
    this.songService.getSongs(undefined, 1, 8).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => { this.recentSongs = res.songs || []; },
      error: (err) => console.error('loadContent: songs', err)
    });

    this.songService.getPopularSongs(8).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (songs: any[]) => { this.popularSongs = songs; },
      error: (err) => console.error('loadContent: popular songs', err)
    });

    this.artistService.getTopArtists(12).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (artists: any[]) => { this.topArtists = artists; },
      error: (err) => console.error('loadContent: top artists', err)
    });

    this.artistService.getFeaturedArtists(12).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (artists: any[]) => { this.featuredArtists = artists; },
      error: (err) => console.error('loadContent: featured artists', err)
    });

    this.articleService.getArticles(1, 12, undefined, undefined, ArticleContentType.News, ArticleStatus.Published)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res: any) => { this.newsArticles = res.items || []; },
        error: (err) => console.error('loadContent: news articles', err)
      });

    this.articleService.getArticles(1, 8, undefined, undefined, ArticleContentType.Blog, ArticleStatus.Published)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res: any) => { this.blogArticles = res.items || []; },
        error: (err) => console.error('loadContent: blog articles', err)
      });

    this.eventService.getUpcomingEvents(6).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (events: UpcomingEventDto[]) => { this.upcomingEvents = events; },
      error: (err) => console.error('loadContent: events', err)
    });

    this.teacherService.getTeachers(undefined, undefined, 1, undefined, 1, 12).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => { this.featuredTeachers = res.items || []; },
      error: (err) => console.error('loadContent: teachers', err)
    });

    this.providerService.getServiceProviders(undefined, undefined, undefined, 1, undefined, false, 1, 12).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => { this.featuredProviders = res.items || []; },
      error: (err) => console.error('loadContent: providers', err)
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
          const route = article.contentType === ArticleContentType.News ? '/news' : '/blog';
          this.router.navigate([route, article.slug]);
        },
        error: () => {
          alert('לא ניתן לפתוח את הכתבה כרגע. אנא נסה שנית.');
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
    if (base) this.router.navigate([base, item.id]);
  }

  trackById(_index: number, item: { id: number | string }): number | string {
    return item.id;
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

  get newsArticlesFirstRow(): Article[] {
    return this.newsArticles.slice(0, this.newsBannerRowSize);
  }

  get newsArticlesSecondRow(): Article[] {
    return this.newsArticles.slice(this.newsBannerRowSize, this.newsBannerRowSize * 2);
  }

  get useScrollingNewsBanner(): boolean {
    return this.newsArticles.length >= 2;
  }

  get loopedUpcomingEvents(): UpcomingEventDto[] {
    if (this.upcomingEvents.length === 0) return [];
    return Array.from({ length: 6 }).flatMap(() => this.upcomingEvents);
  }

  trackByLoopId(index: number, item: { id: number | string }): string {
    return `${item.id}-${index}`;
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
    this.animateHeroParticles();
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
  }

  private animateHeroParticles(): void {
    const ctx = this.heroCtx;
    const canvas = this.heroCanvas?.nativeElement;
    const heroBg = this.heroBg?.nativeElement;
    if (!ctx || !canvas) return;

    // Sync canvas pixel size to current hero-bg size
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

    this.particleAnimId = requestAnimationFrame(() => this.animateHeroParticles());
  }
}
