import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, of, switchMap, takeUntil } from 'rxjs';
import { Podcast, PodcastDetail, PodcastEpisode, PodcastEpisodeDetail } from '../../../models/podcast.model';
import { PodcastService } from '../../../services/podcast.service';
import { SeoService } from '../../../services/seo.service';
import { PodcastEpisodeBannerComponent } from '../../shared/podcast-episode-banner/podcast-episode-banner.component';
import { ContentUploaderBadgeComponent } from '../../shared/content-uploader-badge/content-uploader-badge.component';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';
import { SystemSettingsService } from '../../../services/system-settings.service';
import { cloudflareBackgroundImage } from '../../../pipes/cloudflare-image.pipe';

@Component({
  selector: 'app-podcasts-page',
  standalone: true,
  imports: [CommonModule, PodcastEpisodeBannerComponent, ContentUploaderBadgeComponent, ImgFallbackDirective],
  templateUrl: './podcasts-page.component.html',
  styleUrls: ['./podcasts-page.component.css']
})
export class PodcastsPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('heroBg') heroBg?: ElementRef<HTMLElement>;
  @ViewChild('collapseOverlay') private collapseOverlayRef?: ElementRef<HTMLElement>;

  private readonly podcastService = inject(PodcastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly seo = inject(SeoService);
  private readonly systemSettings = inject(SystemSettingsService);

  loading = true;
  seriesLoading = false;
  episodeLoading = false;
  podcasts: Podcast[] = [];
  latestEpisodes: PodcastEpisode[] = [];
  popularEpisodes: PodcastEpisode[] = [];
  recommendedEpisodes: PodcastEpisode[] = [];
  selectedPodcast: PodcastDetail | null = null;
  selectedEpisode: PodcastEpisodeDetail | null = null;
  episodePlayableUrl: string | null = null;
  safeEmbedUrl: SafeResourceUrl | null = null;
  isEpisodeVideoActive = false;
  seriesDescriptionExpanded = false;
  searchQuery = '';
  searchEpisodes: PodcastEpisode[] = [];
  searchPodcasts: Podcast[] = [];
  searchLoading = false;
  heroImage = '';
  bannerImagesLoaded = false;

  get heroBackgroundImage(): string | null {
    return cloudflareBackgroundImage(this.heroImage, 'hero');
  }

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private readonly dateCache = new Map<string, string>();
  private fullHeroHeight = 0;
  private rafPending = false;
  private episodeRequestId = 0;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;

  private skipNextQuerySync = false;

  ngOnInit(): void {
    this.systemSettings.getPublicBannerImages().subscribe({
      next: images => {
        this.heroImage = images['banner_podcasts_hero_image'] || '';
        this.bannerImagesLoaded = true;
      },
      error: () => this.bannerImagesLoaded = true
    });
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
    if (this.resizeTimer !== null) clearTimeout(this.resizeTimer);
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
    if (this.resizeTimer !== null) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.initHeroHeight(), 150);
  }

  get isViewingSeries(): boolean {
    return this.selectedPodcast !== null;
  }

  get seriesEpisodes(): PodcastEpisode[] {
    return this.selectedPodcast?.episodes ?? this.selectedEpisode?.seriesEpisodes ?? [];
  }

  get agencyBanner() {
    return this.selectedPodcast?.agencyBanner ?? null;
  }

  get agencyBannerVars(): Record<string, string> {
    const banner = this.agencyBanner;
    return {
      '--podcast-agency-primary': banner?.brandPrimaryColor || '#ddff53',
      '--podcast-agency-text': banner?.brandTextColor || '#000000'
    };
  }

  get showSearchResults(): boolean {
    return this.searchQuery.trim().length >= 2;
  }

  selectPodcast(podcast: Podcast): void {
    this.selectPodcastBySlug(podcast.slug, true);
  }

  openEpisode(episode: PodcastEpisode): void {
    this.openEpisodeBySlugs(episode.podcastSlug, episode.slug, true, episode);
  }

  activateEpisodeVideo(): void {
    if (!this.episodePlayableUrl || this.isEpisodeVideoActive) return;

    this.safeEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.episodePlayableUrl);
    this.isEpisodeVideoActive = true;
  }

  resetViewer(updateUrl = true): void {
    this.episodeRequestId += 1;
    this.selectedPodcast = null;
    this.selectedEpisode = null;
    this.resetEpisodeVideo();
    this.seriesDescriptionExpanded = false;
    this.seriesLoading = false;
    this.episodeLoading = false;
    this.applySeoDefault();
    if (updateUrl) this.updateUrl();
  }

  closeEpisode(): void {
    this.episodeRequestId += 1;
    this.selectedEpisode = null;
    this.resetEpisodeVideo();
    this.episodeLoading = false;
    this.seriesDescriptionExpanded = false;
    if (this.selectedPodcast) this.applySeoForSeries(this.selectedPodcast);
    if (this.selectedPodcast) {
      this.updateUrl(this.selectedPodcast.slug);
    }
  }

  goToAgency(): void {
    const slug = this.agencyBanner?.slug;
    if (slug) this.router.navigate(['/agency', slug]);
  }

  trackById(_index: number, item: { id: number }): number {
    return item.id;
  }

  formatDate(dateString: string): string {
    let formatted = this.dateCache.get(dateString);
    if (!formatted) {
      formatted = new Date(dateString).toLocaleDateString('he-IL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      this.dateCache.set(dateString, formatted);
    }
    return formatted;
  }

  getEpisodeThumbnail(episode: PodcastEpisode): string | null {
    return episode.thumbnailUrl || this.buildYouTubeThumbnail(episode.sourceUrl) || this.buildYouTubeThumbnail(episode.embedUrl);
  }

  shouldShowDescriptionToggle(description: string | null | undefined): boolean {
    return (description || '').trim().length > 260;
  }

  toggleSeriesDescription(): void {
    this.seriesDescriptionExpanded = !this.seriesDescriptionExpanded;
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery = value;
    this.searchSubject.next(value);
    this.updateSearchPodcasts(value);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchEpisodes = [];
    this.searchPodcasts = [];
    this.searchLoading = false;
    this.searchSubject.next('');
  }

  private loadPageData(): void {
    this.loading = true;
    forkJoin({
      podcasts: this.podcastService.getPublicPodcasts(),
      latest: this.podcastService.getLatestEpisodes(10),
      popular: this.podcastService.getPopularEpisodes(22)
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ podcasts, latest, popular }) => {
        this.podcasts = podcasts;
        this.latestEpisodes = latest;
        this.popularEpisodes = popular.slice(0, 10);
        this.recommendedEpisodes = popular.slice(10);
        this.loading = false;
      },
      error: () => {
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
        this.seriesDescriptionExpanded = false;
        this.seriesLoading = false;
        this.applySeoForSeries(podcast);
        if (updateUrl) this.updateUrl(podcast.slug);
        this.scrollToViewer();
      },
      error: () => {
        this.selectedPodcast = null;
        this.seriesLoading = false;
      }
    });
  }

  private openEpisodeBySlugs(
    seriesSlug: string,
    episodeSlug: string,
    updateUrl: boolean,
    previewEpisode?: PodcastEpisode
  ): void {
    const requestId = ++this.episodeRequestId;
    this.resetEpisodeVideo();
    this.episodeLoading = !previewEpisode;

    if (previewEpisode) {
      this.showEpisodeImmediately(previewEpisode);
      if (updateUrl) this.updateUrl(previewEpisode.podcastSlug, previewEpisode.slug);
      this.scrollToViewer(false);
    }

    this.podcastService.getEpisodeBySlug(seriesSlug, episodeSlug).subscribe({
      next: episode => {
        if (requestId !== this.episodeRequestId) return;

        this.selectedEpisode = episode;
        this.applySeoForEpisode(episode);
        const playableUrl = this.buildPlayableUrl(episode.embedUrl, episode.sourceUrl, episode.thumbnailUrl);
        this.episodePlayableUrl = playableUrl;
        this.episodeLoading = false;

        if (
          !this.selectedPodcast ||
          this.selectedPodcast.slug !== episode.podcastSlug ||
          this.selectedPodcast.episodes.length <= 1
        ) {
          this.loadSelectedPodcastForEpisode(episode);
        }

        if (updateUrl) this.updateUrl(episode.podcastSlug, episode.slug);
        if (!previewEpisode) this.scrollToViewer();
      },
      error: () => {
        if (requestId !== this.episodeRequestId) return;

        if (previewEpisode) {
          this.episodeLoading = false;
          return;
        }

        this.selectedEpisode = null;
        this.resetEpisodeVideo();
        this.episodeLoading = false;
      }
    });
  }

  private showEpisodeImmediately(episode: PodcastEpisode): void {
    this.selectedEpisode = this.createEpisodePreview(episode);
    this.ensurePodcastShellForEpisode(episode);

    const playableUrl = this.buildPlayableUrl(episode.embedUrl, episode.sourceUrl, episode.thumbnailUrl);
    this.episodePlayableUrl = playableUrl;
    this.episodeLoading = false;
  }

  private resetEpisodeVideo(): void {
    this.episodePlayableUrl = null;
    this.safeEmbedUrl = null;
    this.isEpisodeVideoActive = false;
  }

  private createEpisodePreview(episode: PodcastEpisode): PodcastEpisodeDetail {
    const seriesEpisodes = this.getCachedSeriesEpisodes(episode);

    return {
      ...episode,
      seriesEpisodes
    };
  }

  private ensurePodcastShellForEpisode(episode: PodcastEpisode): void {
    if (this.selectedPodcast?.slug === episode.podcastSlug) return;

    const cachedPodcast = this.podcasts.find(podcast => podcast.slug === episode.podcastSlug);
    const seriesEpisodes = this.getCachedSeriesEpisodes(episode);

    this.selectedPodcast = {
      id: episode.podcastId,
      name: episode.podcastName,
      slug: episode.podcastSlug,
      description: cachedPodcast?.description,
      imageUrl: cachedPodcast?.imageUrl,
      displayOrder: cachedPodcast?.displayOrder ?? 0,
      isActive: cachedPodcast?.isActive ?? true,
      createdAt: cachedPodcast?.createdAt ?? episode.createdAt,
      updatedAt: cachedPodcast?.updatedAt,
      episodeCount: cachedPodcast?.episodeCount ?? seriesEpisodes.length,
      latestEpisode: cachedPodcast?.latestEpisode,
      episodes: seriesEpisodes
    };
  }

  private getCachedSeriesEpisodes(episode: PodcastEpisode): PodcastEpisode[] {
    if (this.selectedPodcast?.slug === episode.podcastSlug && this.selectedPodcast.episodes.length > 0) {
      return this.selectedPodcast.episodes;
    }

    if (this.selectedEpisode?.podcastSlug === episode.podcastSlug && this.selectedEpisode.seriesEpisodes.length > 0) {
      return this.selectedEpisode.seriesEpisodes;
    }

    return [episode];
  }

  private loadSelectedPodcastForEpisode(episode: PodcastEpisodeDetail): void {
    this.seriesLoading = true;
    this.podcastService.getPodcastBySlug(episode.podcastSlug).subscribe({
      next: podcast => {
        this.selectedPodcast = podcast;
        this.seriesDescriptionExpanded = false;
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

  private scrollToViewer(smooth = true): void {
    setTimeout(() => {
      document.querySelector('.podcasts-viewer')?.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
        block: 'start'
      });
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

    const collapseOverlay = this.collapseOverlayRef?.nativeElement;
    if (collapseOverlay) {
      const collapseRange = this.fullHeroHeight - minHeight;
      const collapseProgress = collapseRange > 0
        ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
        : 0;
      collapseOverlay.style.opacity = String(collapseProgress);
    }
  }

  private updateSearchPodcasts(query: string): void {
    const normalized = this.normalizeSearch(query);
    if (normalized.length < 2) {
      this.searchPodcasts = [];
      return;
    }
    this.searchPodcasts = this.podcasts.filter(podcast =>
      this.normalizeSearch(`${podcast.name} ${podcast.description || ''}`).includes(normalized)
    );
  }

  private normalizeSearch(value: string): string {
    return value.trim().toLowerCase();
  }

  private buildPlayableUrl(...urls: Array<string | null | undefined>): string | null {
    for (const url of urls) {
      if (!url || !/^https?:\/\//i.test(url)) continue;

      if (/youtube\.com\/embed\//i.test(url)) {
        return this.withoutAutoplay(url);
      }

      const youtubeId = this.extractYouTubeId(url);
      if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}?rel=0`;
    }

    return null;
  }

  private withoutAutoplay(url: string): string {
    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.delete('autoplay');
      parsedUrl.searchParams.set('rel', '0');
      return parsedUrl.toString();
    } catch {
      return url;
    }
  }

  private buildYouTubeThumbnail(url: string): string | null {
    const youtubeId = this.extractYouTubeId(url);
    return youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null;
  }

  private extractYouTubeId(url: string): string | null {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|img\.youtube\.com\/vi\/)([A-Za-z0-9_-]{6,})/i);
    return match?.[1] ?? null;
  }

  private applySeoForSeries(podcast: PodcastDetail): void {
    const title = `${podcast.name} - פודקאסט | אקורדישקייט`;
    const description = podcast.description
      ? this.stripHtml(podcast.description).replace(/\s+/g, ' ').trim().slice(0, 160)
      : `${podcast.name} – פודקאסט. ${podcast.episodeCount ? `${podcast.episodeCount} פרקים. ` : ''}האזינו באקורדישקייט.`;

    this.seo.set({
      title,
      description,
      path: `/podcasts?series=${podcast.slug}`,
      imageUrl: podcast.imageUrl
    });
  }

  private applySeoForEpisode(episode: PodcastEpisodeDetail): void {
    const seriesName = this.selectedPodcast?.name || episode.podcastName;
    const title = `${episode.title} - ${seriesName} | אקורדישקייט`;
    const description = episode.description
      ? this.stripHtml(episode.description).replace(/\s+/g, ' ').trim().slice(0, 160)
      : `${episode.title} – פרק בפודקאסט ${seriesName}. האזינו באקורדישקייט.`;

    this.seo.set({
      title,
      description,
      path: `/podcasts?series=${episode.podcastSlug}&episode=${episode.slug}`,
      imageUrl: episode.thumbnailUrl,
      structuredData: [
        this.seo.organizationSchema()
      ]
    });
  }

  private applySeoDefault(): void {
    this.seo.set({
      title: 'פודקאסטים - אקורדישקייט',
      description: 'פודקאסטים בנושא מוזיקה יהודית, ראיונות עם אמנים, תוכן מוזיקלי והפקות. האזינו ישירות באקורדישקייט.'
    });
  }

  private stripHtml(value: string): string {
    return value.replace(/<[^>]*>/g, ' ');
  }
}
