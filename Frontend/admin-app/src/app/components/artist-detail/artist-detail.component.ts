import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ArtistService } from '../../services/artist.service';
import { Artist, SocialPlatform } from '../../models/artist.model';
import { SongDto } from '../../models/song.model';
import { Article } from '../../models/article.model';
import { UpcomingEventDto } from '../../models/event.model';

@Component({
  selector: 'app-artist-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './artist-detail.component.html',
  styleUrls: ['./artist-detail.component.css']
})
export class ArtistDetailComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('artistHeroBg') artistHeroBg?: ElementRef<HTMLDivElement>;
  @ViewChild('galleryCarousel') galleryCarousel?: ElementRef<HTMLDivElement>;

  artist: Artist | null = null;
  songs: SongDto[] = [];
  articles: Article[] = [];
  events: UpcomingEventDto[] = [];

  loading = true;
  loadingSongs = false;
  loadingArticles = false;
  loadingEvents = false;

  songsPage = 1;
  articlesPage = 1;
  totalSongs = 0;
  totalArticles = 0;

  SocialPlatform = SocialPlatform;

  expandedGalleryIndex = -1;
  activeVideoIndex = -1;
  carouselPaused = false;

  private fullHeroHeight = 0;
  private rafPending = false;
  private carouselRafId = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private artistService: ArtistService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    window.scrollTo(0, 0);
    this.route.params.subscribe(params => {
      const id = +params['id'];
      if (id) {
        this.loadArtist(id);
      }
    });
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    if (this.carouselRafId) cancelAnimationFrame(this.carouselRafId);
  }

  loadArtist(id: number): void {
    this.loading = true;
    this.artistService.getArtistById(id).subscribe({
      next: (artist) => {
        this.artist = artist;
        this.loading = false;
        this.loadSongs(id);
        this.loadArticles(id);
        this.loadEvents(id);
        setTimeout(() => {
          this.initHeroHeight();
          this.startCarousel();
        }, 0);
      },
      error: () => {
        this.loading = false;
        this.router.navigate(['/']);
      }
    });
  }

  private initHeroHeight(): void {
    const bg = this.artistHeroBg?.nativeElement;
    if (!bg) return;

    const top = window.innerHeight * 0.02;
    this.fullHeroHeight = Math.round(window.innerHeight - top - 16);
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
  }

  private shrinkHero(): void {
    const bg = this.artistHeroBg?.nativeElement;
    if (!bg || this.fullHeroHeight === 0) return;
    const minHeight = Math.round(window.innerHeight * 0.02 + 60);
    const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY * 1);
    bg.style.height = newHeight + 'px';

    // fade out all inner content in the first 160px of scroll
    const progress = Math.min(1, window.scrollY / 160);
    const opacity = String(Math.max(0, 1 - progress));
    const infoSide = bg.querySelector('.hero-info-side') as HTMLElement | null;
    const socialSide = bg.querySelector('.hero-social') as HTMLElement | null;
    const overlay = bg.querySelector('.hero-overlay-right') as HTMLElement | null;
    if (infoSide) infoSide.style.opacity = opacity;
    if (socialSide) socialSide.style.opacity = opacity;
    if (overlay) overlay.style.opacity = opacity;

    // overlay אפור כהה — מתגבר ככל שהתיבה מתכווצת
    const collapseOverlay = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
    if (collapseOverlay) {
      const collapseRange = this.fullHeroHeight - minHeight;
      const collapseProgress = collapseRange > 0
        ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
        : 0;
      collapseOverlay.style.opacity = String(collapseProgress);
    }
  }

  private carouselDir = 1; // כיוון גלילה: 1 קדימה, -1 אחורה

  private startCarousel(): void {
    const carousel = this.galleryCarousel?.nativeElement;
    if (!carousel || this.galleryItems.length === 0) return;
    if (this.carouselRafId) cancelAnimationFrame(this.carouselRafId);

    const scroll = () => {
      if (!this.carouselPaused) {
        carousel.scrollLeft += 0.7 * this.carouselDir;
        const maxScroll = carousel.scrollWidth - carousel.clientWidth;
        if (carousel.scrollLeft >= maxScroll - 1) this.carouselDir = -1;
        else if (carousel.scrollLeft <= 0) this.carouselDir = 1;
      }
      this.carouselRafId = requestAnimationFrame(scroll);
    };
    this.carouselRafId = requestAnimationFrame(scroll);
  }

  pauseCarousel(): void {
    this.carouselPaused = true;
  }

  resumeCarousel(): void {
    this.expandedGalleryIndex = -1;
    if (this.activeVideoIndex === -1) {
      this.carouselPaused = false;
    }
  }

  toggleVideo(index: number): void {
    if (this.activeVideoIndex === index) {
      this.activeVideoIndex = -1;
      this.carouselPaused = false;
    } else {
      this.activeVideoIndex = index;
      this.carouselPaused = true;
    }
  }

  loadSongs(artistId: number, page: number = 1): void {
    this.loadingSongs = true;
    this.artistService.getArtistSongs(artistId, page, 6).subscribe({
      next: (result) => {
        this.songs = result.items;
        this.totalSongs = result.totalCount;
        this.songsPage = page;
        this.loadingSongs = false;
      },
      error: () => { this.loadingSongs = false; }
    });
  }

  loadArticles(artistId: number, page: number = 1): void {
    this.loadingArticles = true;
    this.artistService.getArtistArticles(artistId, page, 6).subscribe({
      next: (result) => {
        this.articles = result.items;
        this.totalArticles = result.totalCount;
        this.articlesPage = page;
        this.loadingArticles = false;
      },
      error: () => { this.loadingArticles = false; }
    });
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

  get heroBannerSrc(): string {
    if (!this.artist) return '';
    if (this.artist.isPremium && this.artist.bannerGifUrl) return this.artist.bannerGifUrl;
    return this.artist.bannerImageUrl || '';
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
      [SocialPlatform.Website]: 'אתר'
    };
    return names[platform] || 'קישור';
  }

  getSocialIconSvg(platform: SocialPlatform): SafeHtml {
    const icons: { [key: number]: string } = {
      [SocialPlatform.Facebook]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
      [SocialPlatform.Instagram]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke-width="3"/></svg>`,
      [SocialPlatform.YouTube]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75,15.02 15.5,12 9.75,8.98" fill="white"/></svg>`,
      [SocialPlatform.Twitter]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
      [SocialPlatform.TikTok]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.77a8.18 8.18 0 0 0 4.79 1.53V6.86a4.85 4.85 0 0 1-1.02-.17z"/></svg>`,
      [SocialPlatform.Spotify]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`,
      [SocialPlatform.Website]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`
    };
    const svg = icons[platform] ?? icons[SocialPlatform.Website];
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  getYouTubeEmbedUrl(videoUrl: string): SafeResourceUrl {
    const videoId = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1];
    const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : videoUrl;
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  setExpandedGallery(index: number): void {
    this.expandedGalleryIndex = index;
  }

  get galleryDisplayItems(): Array<{ type: 'image' | 'video' | 'placeholder'; imageUrl?: string; videoUrl?: string; caption?: string; title?: string }> {
    const items = this.galleryItems as Array<{ type: 'image' | 'video' | 'placeholder'; imageUrl?: string; videoUrl?: string; caption?: string; title?: string }>;
    const result = [...items];
    const MIN_ITEMS = 10;
    while (result.length < MIN_ITEMS) {
      result.push({ type: 'placeholder' });
    }
    return result;
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

  navigateToSong(songId: number): void {
    this.router.navigate(['/song', songId]);
  }

  navigateToArticle(slug: string): void {
    this.router.navigate(['/news', slug]);
  }
}
