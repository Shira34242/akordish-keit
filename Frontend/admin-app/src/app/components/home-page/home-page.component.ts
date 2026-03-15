import { Component, OnInit, AfterViewInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { SongService } from '../../services/song.service';
import { ArtistService } from '../../services/artist.service';
import { ArticleService } from '../../services/admin/article.service';
import { EventService } from '../../services/admin/event.service';
import { Article, ArticleContentType, ArticleStatus } from '../../models/article.model';
import { UpcomingEventDto } from '../../models/event.model';
import { SongCardComponent } from '../shared/song-card/song-card.component';
import { ArtistCircleComponent } from '../shared/artist-circle/artist-circle.component';
import { CarouselComponent } from '../shared/carousel/carousel.component';
import { AdDisplayComponent } from '../public/ad-display/ad-display.component';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    SongCardComponent,
    ArtistCircleComponent,
    CarouselComponent,
    AdDisplayComponent
  ],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent implements OnInit, AfterViewInit {

  @ViewChild('heroBg') heroBg?: ElementRef<HTMLDivElement>;

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

  private fullHeroHeight = 0;
  private rafPending = false;

  constructor(
    private router: Router,
    private songService: SongService,
    private artistService: ArtistService,
    private articleService: ArticleService,
    private eventService: EventService
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
    setTimeout(() => this.initHeroHeight(), 0);
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
    const top = window.innerHeight * 0.02;
    this.fullHeroHeight = Math.round(window.innerHeight - top - 16);
    bg.style.height = this.fullHeroHeight + 'px';
    this.shrinkHero();
  }

  private shrinkHero(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg || this.fullHeroHeight === 0) return;
    const minHeight = Math.round(window.innerHeight * 0.02 + 72);
    const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
    bg.style.height = newHeight + 'px';

    const overlay = bg.querySelector('.hero-overlay') as HTMLElement | null;
    if (overlay) {
      const fadeEnd = this.fullHeroHeight * 0.45;
      const progress = Math.min(1, window.scrollY / fadeEnd);
      overlay.style.opacity = String(1 - progress);
    }
  }

  loadContent() {
    // Recent Songs
    this.songService.getSongs(undefined, 1, 10).subscribe((res: any) => {
      this.recentSongs = res.songs || [];
    });

    // Popular Songs
    this.songService.getPopularSongs(10).subscribe((songs: any[]) => {
      this.popularSongs = songs;
    });

    // Top Artists (legacy)
    this.artistService.getTopArtists(10).subscribe((artists: any[]) => {
      this.topArtists = artists;
    });

    // Featured Artists (Premium + Boost)
    this.artistService.getFeaturedArtists(10).subscribe((artists: any[]) => {
      this.featuredArtists = artists;
    });

    // News Articles
    this.articleService.getArticles(1, 10, undefined, undefined, ArticleContentType.News, ArticleStatus.Published)
      .subscribe((result) => {
        this.newsArticles = result.items;
      });

    // Blog Articles
    this.articleService.getArticles(1, 10, undefined, undefined, ArticleContentType.Blog, ArticleStatus.Published)
      .subscribe((result) => {
        this.blogArticles = result.items;
      });

    // Upcoming Events - sort by date, exclude past
    this.eventService.getUpcomingEvents(12).subscribe((events) => {
      this.upcomingEvents = events
        .filter(e => e.eventStatus !== 'אירוע שחלף')
        .sort((a, b) => a.daysUntilEvent - b.daysUntilEvent);
    });
  }

  navigateToArticle(article: Article): void {
    const route = article.contentType === ArticleContentType.News ? '/news' : '/blog';
    this.router.navigate([route, article.slug]);
  }

  openEventTicket(event: UpcomingEventDto): void {
    window.open(event.ticketUrl, '_blank');
  }

  onSearchInput(query: string) {
    this.searchSubject.next(query);
  }

  selectSong(song: any) {
    this.router.navigate(['/song', song.id]);
  }

  onSearchBlur() {
    // Delay to allow click on results
    setTimeout(() => {
      this.showSearchResults = false;
    }, 200);
  }
}
