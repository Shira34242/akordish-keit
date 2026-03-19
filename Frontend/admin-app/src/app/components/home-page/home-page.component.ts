import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { SongService } from '../../services/song.service';
import { ArtistService } from '../../services/artist.service';
import { ArticleService } from '../../services/admin/article.service';
import { EventService } from '../../services/admin/event.service';
import { TeacherService } from '../../services/teacher.service';
import { MusicServiceProviderService } from '../../services/music-service-provider.service';
import { SongCardComponent } from '../shared/song-card/song-card.component';
import { ArtistCircleComponent } from '../shared/artist-circle/artist-circle.component';
import { NewsBannerComponent } from '../shared/news-banner/news-banner.component';
import { Article, ArticleStatus, ArticleContentType } from '../../models/article.model';
import { UpcomingEventDto } from '../../models/event.model';
import { TeacherListDto } from '../../models/teacher.model';
import { MusicServiceProviderListDto } from '../../models/music-service-provider.model';

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
    NewsBannerComponent
  ],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('heroBg') heroBg?: ElementRef<HTMLDivElement>;
  @ViewChild('heroCanvas') heroCanvas?: ElementRef<HTMLCanvasElement>;

  searchQuery = '';
  searchResults: any[] = [];
  showSearchResults = false;
  private searchSubject = new Subject<string>();

  recentSongs: any[] = [];
  popularSongs: any[] = [];
  topArtists: any[] = [];
  featuredArtists: any[] = [];
  newsArticles: Article[] = [];
  blogArticles: Article[] = [];
  upcomingEvents: UpcomingEventDto[] = [];
  featuredTeachers: TeacherListDto[] = [];
  featuredProviders: MusicServiceProviderListDto[] = [];

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
    private providerService: MusicServiceProviderService
  ) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query || query.length < 2) {
          return of({ songs: [] });
        }
        return this.songService.getSongs(query, 1, 5);
      })
    ).subscribe((response: any) => {
      this.searchResults = response.songs || [];
      this.showSearchResults = this.searchQuery.length >= 2;
    });
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
    this.songService.getSongs(undefined, 1, 8).subscribe((res: any) => {
      this.recentSongs = res.songs || [];
    });

    this.songService.getPopularSongs(8).subscribe((songs: any[]) => {
      this.popularSongs = songs;
    });

    this.artistService.getTopArtists(12).subscribe((artists: any[]) => {
      this.topArtists = artists;
    });

    this.artistService.getFeaturedArtists(12).subscribe((artists: any[]) => {
      this.featuredArtists = artists;
    });

    this.articleService.getArticles(1, 8, undefined, undefined, ArticleContentType.News, ArticleStatus.Published)
      .subscribe((res: any) => {
        this.newsArticles = res.items || [];
      });

    this.articleService.getArticles(1, 8, undefined, undefined, ArticleContentType.Blog, ArticleStatus.Published)
      .subscribe((res: any) => {
        this.blogArticles = res.items || [];
      });

    this.eventService.getUpcomingEvents(6).subscribe((events: UpcomingEventDto[]) => {
      this.upcomingEvents = events;
    });

    this.teacherService.getTeachers(undefined, undefined, 1, undefined, 1, 12).subscribe((res: any) => {
      this.featuredTeachers = res.items || [];
    });

    this.providerService.getServiceProviders(undefined, undefined, undefined, 1, undefined, false, 1, 12).subscribe((res: any) => {
      this.featuredProviders = res.items || [];
    });
  }

  onSearchInput(query: string) {
    this.searchSubject.next(query);
  }

  selectSong(song: any) {
    this.router.navigate(['/song', song.id]);
  }

  onSearchBlur() {
    setTimeout(() => {
      this.showSearchResults = false;
    }, 200);
  }

  private initParticleEffect(): void {
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
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.spawnHeroParticles(x, y, e.movementX, e.movementY);
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
    if (!ctx || !canvas) return;

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
