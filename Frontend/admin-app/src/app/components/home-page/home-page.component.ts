import { Component, OnInit, AfterViewInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { SongService } from '../../services/song.service';
import { ArtistService } from '../../services/artist.service';
import { ArticleService } from '../../services/admin/article.service';
import { EventService } from '../../services/admin/event.service';
import { SongCardComponent } from '../shared/song-card/song-card.component';
import { ArtistCircleComponent } from '../shared/artist-circle/artist-circle.component';
import { NewsBannerComponent } from '../shared/news-banner/news-banner.component';
import { Article, ArticleStatus, ArticleContentType } from '../../models/article.model';
import { UpcomingEventDto } from '../../models/event.model';

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
    this.fullHeroHeight = Math.round(window.innerHeight * 0.94);
    bg.style.height = this.fullHeroHeight + 'px';
    this.shrinkHero();
  }

  private shrinkHero(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg || this.fullHeroHeight === 0) return;
    const minHeight = Math.round(window.innerHeight * 0.02 + 55);
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
}
