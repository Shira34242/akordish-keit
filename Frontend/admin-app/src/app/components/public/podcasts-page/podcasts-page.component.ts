import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap, takeUntil } from 'rxjs';
import { Podcast, PodcastDetail, PodcastEpisode, PodcastEpisodeDetail } from '../../../models/podcast.model';
import { PodcastService } from '../../../services/podcast.service';

@Component({
  selector: 'app-podcasts-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './podcasts-page.component.html',
  styleUrls: ['./podcasts-page.component.css']
})
export class PodcastsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('heroBg') heroBg?: ElementRef<HTMLElement>;

  private readonly podcastService = inject(PodcastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  loading = true;
  seriesLoading = false;
  episodeLoading = false;
  podcasts: Podcast[] = [];
  latestEpisodes: PodcastEpisode[] = [];
  popularEpisodes: PodcastEpisode[] = [];
  selectedPodcast: PodcastDetail | null = null;
  selectedEpisode: PodcastEpisodeDetail | null = null;
  safeEmbedUrl: SafeResourceUrl | null = null;
  searchQuery = '';
  searchEpisodes: PodcastEpisode[] = [];
  searchLoading = false;

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private fullHeroHeight = 0;
  private rafPending = false;

  private skipNextQuerySync = false;

  ngOnInit(): void {
    this.loadPageData();
    this.searchSubject.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(query => {
        const cleanQuery = query.trim();
        if (cleanQuery.length < 2) {
          this.searchLoading = false;
          return of({ items: [] });
        }

        this.searchLoading = true;
        return this.podcastService.getPublicEpisodes(1, 24, undefined, cleanQuery);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: result => {
        this.searchEpisodes = result.items || [];
        this.searchLoading = false;
      },
      error: () => {
        this.searchEpisodes = [];
        this.searchLoading = false;
      }
    });

    this.route.queryParamMap.subscribe(params => {
      if (this.skipNextQuerySync) return;

      const seriesSlug = params.get('series');
      const episodeSlug = params.get('episode');

      if (!seriesSlug) {
        this.resetViewer(false);
        return;
      }

      if (episodeSlug) {
        this.openEpisodeBySlugs(seriesSlug, episodeSlug, false);
        return;
      }

      this.selectPodcastBySlug(seriesSlug, false);
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initHeroHeight(), 50);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  get isViewingSeries(): boolean {
    return this.selectedPodcast !== null;
  }

  get seriesEpisodes(): PodcastEpisode[] {
    return this.selectedPodcast?.episodes ?? this.selectedEpisode?.seriesEpisodes ?? [];
  }

  get searchPodcasts(): Podcast[] {
    const query = this.normalizeSearch(this.searchQuery);
    if (query.length < 2) return [];
    return this.podcasts.filter(podcast =>
      this.normalizeSearch(`${podcast.name} ${podcast.description || ''}`).includes(query)
    );
  }

  get showSearchResults(): boolean {
    return this.searchQuery.trim().length >= 2;
  }

  selectPodcast(podcast: Podcast): void {
    this.selectPodcastBySlug(podcast.slug, true);
  }

  openEpisode(episode: PodcastEpisode): void {
    this.openEpisodeBySlugs(episode.podcastSlug, episode.slug, true);
  }

  resetViewer(updateUrl = true): void {
    this.selectedPodcast = null;
    this.selectedEpisode = null;
    this.safeEmbedUrl = null;
    this.seriesLoading = false;
    this.episodeLoading = false;
    if (updateUrl) this.updateUrl();
  }

  closeEpisode(): void {
    this.selectedEpisode = null;
    this.safeEmbedUrl = null;
    this.episodeLoading = false;
    if (this.selectedPodcast) {
      this.updateUrl(this.selectedPodcast.slug);
    }
  }

  trackById(_index: number, item: { id: number }): number {
    return item.id;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  getEpisodeThumbnail(episode: PodcastEpisode): string | null {
    return episode.thumbnailUrl || this.buildYouTubeThumbnail(episode.sourceUrl) || this.buildYouTubeThumbnail(episode.embedUrl);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery = value;
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchEpisodes = [];
    this.searchLoading = false;
    this.searchSubject.next('');
  }

  private loadPageData(): void {
    this.loading = true;
    this.podcastService.getPublicPodcasts().subscribe({
      next: podcasts => {
        this.podcasts = podcasts;
        this.loadLatestEpisodes();
      },
      error: () => {
        this.podcasts = [];
        this.loadLatestEpisodes();
      }
    });
  }

  private loadLatestEpisodes(): void {
    this.podcastService.getLatestEpisodes(10).subscribe({
      next: episodes => {
        this.latestEpisodes = episodes;
        this.loadPopularEpisodes();
      },
      error: () => {
        this.latestEpisodes = [];
        this.loadPopularEpisodes();
      }
    });
  }

  private loadPopularEpisodes(): void {
    this.podcastService.getPopularEpisodes(10).subscribe({
      next: episodes => {
        this.popularEpisodes = episodes;
        this.loading = false;
      },
      error: () => {
        this.popularEpisodes = [];
        this.loading = false;
      }
    });
  }

  private selectPodcastBySlug(slug: string, updateUrl: boolean): void {
    if (this.selectedPodcast?.slug === slug && !this.selectedEpisode) {
      if (updateUrl) this.updateUrl(slug);
      return;
    }

    this.seriesLoading = true;
    this.selectedEpisode = null;
    this.safeEmbedUrl = null;

    this.podcastService.getPodcastBySlug(slug).subscribe({
      next: podcast => {
        this.selectedPodcast = podcast;
        this.seriesLoading = false;
        if (updateUrl) this.updateUrl(podcast.slug);
        this.scrollToViewer();
      },
      error: () => {
        this.selectedPodcast = null;
        this.seriesLoading = false;
      }
    });
  }

  private openEpisodeBySlugs(seriesSlug: string, episodeSlug: string, updateUrl: boolean): void {
    this.episodeLoading = true;

    this.podcastService.getEpisodeBySlug(seriesSlug, episodeSlug).subscribe({
      next: episode => {
        this.selectedEpisode = episode;
        const playableUrl = this.buildPlayableUrl(episode.embedUrl, episode.sourceUrl, episode.thumbnailUrl);
        this.safeEmbedUrl = playableUrl
          ? this.sanitizer.bypassSecurityTrustResourceUrl(playableUrl)
          : null;
        this.episodeLoading = false;

        if (!this.selectedPodcast || this.selectedPodcast.slug !== episode.podcastSlug) {
          this.loadSelectedPodcastForEpisode(episode);
        }

        if (updateUrl) this.updateUrl(episode.podcastSlug, episode.slug);
        this.scrollToViewer();
      },
      error: () => {
        this.selectedEpisode = null;
        this.safeEmbedUrl = null;
        this.episodeLoading = false;
      }
    });
  }

  private loadSelectedPodcastForEpisode(episode: PodcastEpisodeDetail): void {
    this.seriesLoading = true;
    this.podcastService.getPodcastBySlug(episode.podcastSlug).subscribe({
      next: podcast => {
        this.selectedPodcast = podcast;
        this.seriesLoading = false;
      },
      error: () => {
        this.selectedPodcast = {
          id: episode.podcastId,
          name: episode.podcastName,
          slug: episode.podcastSlug,
          displayOrder: 0,
          isActive: true,
          createdAt: episode.createdAt,
          episodeCount: episode.seriesEpisodes.length,
          episodes: episode.seriesEpisodes
        };
        this.seriesLoading = false;
      }
    });
  }

  private updateUrl(series?: string, episode?: string): void {
    this.skipNextQuerySync = true;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        series: series ?? null,
        episode: episode ?? null
      },
      queryParamsHandling: 'merge'
    }).finally(() => {
      setTimeout(() => {
        this.skipNextQuerySync = false;
      }, 0);
    });
  }

  private scrollToViewer(): void {
    setTimeout(() => {
      document.querySelector('.podcasts-viewer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  private initHeroHeight(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg) return;
    this.fullHeroHeight = Math.round(window.innerHeight * 0.6);
    bg.style.height = `${this.fullHeroHeight}px`;
    this.shrinkHero();
  }

  private shrinkHero(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg || this.fullHeroHeight === 0) return;

    const minHeight = 56;
    const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
    bg.style.height = `${newHeight}px`;

    const collapseOverlay = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
    if (collapseOverlay) {
      const collapseRange = this.fullHeroHeight - minHeight;
      const collapseProgress = collapseRange > 0
        ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
        : 0;
      collapseOverlay.style.opacity = String(collapseProgress);
    }
  }

  private normalizeSearch(value: string): string {
    return value.trim().toLowerCase();
  }

  private buildPlayableUrl(...urls: Array<string | null | undefined>): string | null {
    for (const url of urls) {
      if (!url || !/^https?:\/\//i.test(url)) continue;

      if (/youtube\.com\/embed\//i.test(url)) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}autoplay=1&rel=0`;
      }

      const youtubeId = this.extractYouTubeId(url);
      if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`;
    }

    return null;
  }

  private buildYouTubeThumbnail(url: string): string | null {
    const youtubeId = this.extractYouTubeId(url);
    return youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null;
  }

  private extractYouTubeId(url: string): string | null {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|img\.youtube\.com\/vi\/)([A-Za-z0-9_-]{6,})/i);
    return match?.[1] ?? null;
  }
}
