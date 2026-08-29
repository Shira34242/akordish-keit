import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { forkJoin, switchMap } from 'rxjs';
import { Podcast, PodcastEpisode, CreatePodcastEpisodeDto } from '../../../../models/podcast.model';
import { PagedResult } from '../../../../models/pagination.model';
import { PodcastService } from '../../../../services/podcast.service';
import { SiteAlertService } from '../../../../services/site-alert.service';
import { ContentPromotionModalComponent } from '../../../shared/content-promotion-modal/content-promotion-modal.component';
import {
  ContentPromotionDto,
  ContentPromotionPlacement,
  ContentPromotionService,
  ContentPromotionTargetType
} from '../../../../services/content-promotion.service';

@Component({
  selector: 'app-podcasts-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ContentPromotionModalComponent],
  templateUrl: './podcasts-list.component.html',
  styleUrls: ['./podcasts-list.component.css']
})
export class PodcastsListComponent implements OnInit {
  private readonly podcastService = inject(PodcastService);
  private readonly contentPromotionService = inject(ContentPromotionService);
  private readonly router = inject(Router);
  private readonly siteAlerts = inject(SiteAlertService);

  podcasts: Podcast[] = [];
  episodes: PodcastEpisode[] = [];
  automationDraftEpisodes: PodcastEpisode[] = [];
  automationDraftTotal = 0;
  selectedSeriesEpisodes: PodcastEpisode[] = [];
  loading = true;
  automationDraftsLoading = true;
  showAllAutomationDrafts = false;
  seriesEpisodesLoading = false;
  bulkActionLoading = false;
  savingEpisodeId: number | null = null;
  savingPodcastId: number | null = null;
  selectedEpisodeIds = new Set<number>();
  selectedPodcastIds = new Set<number>();
  selectedSeriesPodcast: Podcast | null = null;
  promotionModalOpen = false;
  promotionTargetType = ContentPromotionTargetType.PodcastEpisode;
  promotionTargetIds: number[] = [];
  promotionTitle = 'קידום פרקי פודקאסט';
  activePodcastPromotions = new Map<number, ContentPromotionDto[]>();
  activeEpisodePromotions = new Map<number, ContentPromotionDto[]>();
  searchTerm = '';
  statusFilter: 'all' | 'active' | 'draft' = 'all';
  selectedPodcastId?: number;
  dateFrom = '';
  dateTo = '';
  sortBy = 'date';
  activeTab: 'podcasts' | 'episodes' = 'episodes';
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-podcasts-view') as 'list' | 'grid') || 'list';
  seriesEpisodeViewMode: 'grid' | 'list' =
    (localStorage.getItem('admin-podcast-series-episodes-view') as 'grid' | 'list') || 'grid';

  currentPage = 1;
  pageSize = 5;
  totalItems = 0;
  totalPages = 0;

  ngOnInit(): void {
    this.loadPodcasts();
    this.loadEpisodes();
    this.loadAutomationDrafts();
    this.loadPromotionState();
  }

  get visibleAutomationDraftEpisodes(): PodcastEpisode[] {
    return this.showAllAutomationDrafts
      ? this.automationDraftEpisodes
      : this.automationDraftEpisodes.slice(0, 4);
  }

  loadAutomationDrafts(): void {
    this.automationDraftsLoading = true;
    this.podcastService.getEpisodes(1, 5, undefined, undefined, false, undefined, undefined, 'date', true).subscribe({
      next: result => {
        this.automationDraftEpisodes = result.items.filter(episode => this.isYouTubeEpisode(episode));
        this.automationDraftTotal = result.totalCount;
        this.automationDraftsLoading = false;
      },
      error: () => {
        this.automationDraftEpisodes = [];
        this.automationDraftTotal = 0;
        this.automationDraftsLoading = false;
      }
    });
  }

  toggleAutomationDrafts(): void {
    this.showAllAutomationDrafts = !this.showAllAutomationDrafts;
    if (this.showAllAutomationDrafts && this.automationDraftEpisodes.length < this.automationDraftTotal) {
      this.podcastService.getEpisodes(1, 100, undefined, undefined, false, undefined, undefined, 'date', true).subscribe(result => {
        this.automationDraftEpisodes = result.items.filter(episode => this.isYouTubeEpisode(episode));
      });
    }
  }

  loadPodcasts(): void {
    this.podcastService.getPodcasts(1, 5, undefined, undefined, true).subscribe({
      next: result => {
        this.podcasts = [...result.items].sort((a, b) => this.compareDatesDescending(a.createdAt, b.createdAt));
        this.selectedPodcastIds.clear();
        if (!this.selectedSeriesPodcast && this.podcasts.length > 0) {
          this.selectSeries(this.podcasts[0]);
        }
        if (result.totalCount > result.items.length) {
          setTimeout(() => this.podcastService.getPodcasts(1, 100, undefined, undefined, true).subscribe(all => {
            this.podcasts = [...all.items].sort((a, b) => this.compareDatesDescending(a.createdAt, b.createdAt));
          }), 0);
        }
      }
    });
  }

  loadEpisodes(): void {
    this.loading = true;
    this.podcastService.getEpisodes(
      this.currentPage,
      this.pageSize,
      this.selectedPodcastId,
      this.searchTerm || undefined,
      this.getActiveFilter(),
      this.dateFrom || undefined,
      this.dateTo || undefined,
      this.sortBy,
      true
    ).subscribe({
      next: (result: PagedResult<PodcastEpisode>) => {
        this.episodes = result.items;
        this.totalItems = result.totalCount;
        this.totalPages = result.totalPages;
        this.selectedEpisodeIds.clear();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadEpisodes();
  }

  switchTab(tab: 'podcasts' | 'episodes'): void {
    this.activeTab = tab;
    this.clearSelection();
  }

  setView(mode: 'list' | 'grid'): void {
    this.viewMode = mode;
    localStorage.setItem('admin-podcasts-view', mode);
  }

  setSeriesEpisodeView(mode: 'grid' | 'list'): void {
    this.seriesEpisodeViewMode = mode;
    localStorage.setItem('admin-podcast-series-episodes-view', mode);
  }

  get selectedCount(): number {
    return this.activeTab === 'episodes' ? this.selectedEpisodeIds.size : this.selectedPodcastIds.size;
  }

  get hasSelection(): boolean {
    return this.selectedCount > 0;
  }

  get allCurrentEpisodesSelected(): boolean {
    return this.episodes.length > 0 && this.episodes.every(episode => this.selectedEpisodeIds.has(episode.id));
  }

  get allCurrentPodcastsSelected(): boolean {
    return this.podcasts.length > 0 && this.podcasts.every(podcast => this.selectedPodcastIds.has(podcast.id));
  }

  isEpisodeSelected(episodeId: number): boolean {
    return this.selectedEpisodeIds.has(episodeId);
  }

  isPodcastSelected(podcastId: number): boolean {
    return this.selectedPodcastIds.has(podcastId);
  }

  toggleEpisodeSelection(episodeId: number, event?: Event): void {
    event?.stopPropagation();
    if (this.selectedEpisodeIds.has(episodeId)) {
      this.selectedEpisodeIds.delete(episodeId);
      return;
    }

    this.selectedEpisodeIds.add(episodeId);
  }

  togglePodcastSelection(podcastId: number, event?: Event): void {
    event?.stopPropagation();
    if (this.selectedPodcastIds.has(podcastId)) {
      this.selectedPodcastIds.delete(podcastId);
      return;
    }

    this.selectedPodcastIds.add(podcastId);
  }

  toggleSelectCurrentEpisodes(): void {
    if (this.allCurrentEpisodesSelected) {
      this.episodes.forEach(episode => this.selectedEpisodeIds.delete(episode.id));
      return;
    }

    this.episodes.forEach(episode => this.selectedEpisodeIds.add(episode.id));
  }

  toggleSelectCurrentPodcasts(): void {
    if (this.allCurrentPodcastsSelected) {
      this.podcasts.forEach(podcast => this.selectedPodcastIds.delete(podcast.id));
      return;
    }

    this.podcasts.forEach(podcast => this.selectedPodcastIds.add(podcast.id));
  }

  selectAllCurrentEpisodesPage(): void {
    this.selectedSeriesEpisodes.forEach(episode => this.selectedEpisodeIds.add(episode.id));
  }

  selectAllCurrentPodcastsPage(): void {
    this.podcasts.forEach(podcast => this.selectedPodcastIds.add(podcast.id));
  }

  get allCurrentSeriesEpisodesSelected(): boolean {
    return this.selectedSeriesEpisodes.length > 0
      && this.selectedSeriesEpisodes.every(episode => this.selectedEpisodeIds.has(episode.id));
  }

  toggleSelectCurrentSeriesEpisodes(): void {
    if (this.allCurrentSeriesEpisodesSelected) {
      this.selectedSeriesEpisodes.forEach(episode => this.selectedEpisodeIds.delete(episode.id));
      return;
    }

    this.selectedSeriesEpisodes.forEach(episode => this.selectedEpisodeIds.add(episode.id));
  }

  clearSelection(): void {
    this.selectedEpisodeIds.clear();
    this.selectedPodcastIds.clear();
  }

  openPodcastPromotionModal(): void {
    this.promotionTargetIds = Array.from(this.selectedPodcastIds);
    if (this.promotionTargetIds.length === 0) {
      return;
    }

    this.promotionTargetType = ContentPromotionTargetType.Podcast;
    this.promotionTitle = 'קידום סדרות פודקאסט';
    this.promotionModalOpen = true;
  }

  openSinglePodcastPromotion(podcast: Podcast): void {
    this.promotionTargetIds = [podcast.id];
    this.promotionTargetType = ContentPromotionTargetType.Podcast;
    this.promotionTitle = `קידום הסדרה: ${podcast.name}`;
    this.promotionModalOpen = true;
  }

  openEpisodePromotionModal(): void {
    this.promotionTargetIds = Array.from(this.selectedEpisodeIds);
    if (this.promotionTargetIds.length === 0) {
      return;
    }

    this.promotionTargetType = ContentPromotionTargetType.PodcastEpisode;
    this.promotionTitle = 'קידום פרקי פודקאסט';
    this.promotionModalOpen = true;
  }

  openSingleEpisodePromotion(episode: PodcastEpisode, event?: Event): void {
    event?.stopPropagation();
    this.promotionTargetIds = [episode.id];
    this.promotionTargetType = ContentPromotionTargetType.PodcastEpisode;
    this.promotionTitle = `קידום הפרק: ${episode.title}`;
    this.promotionModalOpen = true;
  }

  onPromoted(): void {
    this.promotionModalOpen = false;
    this.clearSelection();
    this.loadPodcasts();
    this.loadEpisodes();
    if (this.selectedSeriesPodcast) {
      this.loadSelectedSeriesEpisodes();
    }
    this.loadPromotionState();
  }

  hasActivePodcastPromotion(podcastId: number): boolean {
    return this.activePodcastPromotions.has(podcastId);
  }

  hasActiveEpisodePromotion(episodeId: number): boolean {
    return this.activeEpisodePromotions.has(episodeId);
  }

  getPodcastPromotionSummary(podcastId: number): string {
    return this.getPromotionSummary(this.activePodcastPromotions.get(podcastId));
  }

  getEpisodePromotionSummary(episodeId: number): string {
    return this.getPromotionSummary(this.activeEpisodePromotions.get(episodeId));
  }

  cancelPodcastPromotion(podcast: Podcast, event?: Event): void {
    event?.stopPropagation();
    this.cancelPromotions(
      this.activePodcastPromotions.get(podcast.id),
      `לבטל את הקידום הפעיל של הסדרה "${podcast.name}"?`
    );
  }

  cancelEpisodePromotion(episode: PodcastEpisode, event?: Event): void {
    event?.stopPropagation();
    this.cancelPromotions(
      this.activeEpisodePromotions.get(episode.id),
      `לבטל את הקידום הפעיל של הפרק "${episode.title}"?`
    );
  }

  private loadPromotionState(): void {
    forkJoin({
      podcasts: this.contentPromotionService.getPromotions(ContentPromotionTargetType.Podcast),
      episodes: this.contentPromotionService.getPromotions(ContentPromotionTargetType.PodcastEpisode)
    }).subscribe({
      next: ({ podcasts, episodes }) => {
        this.activePodcastPromotions = this.groupActivePromotions(podcasts);
        this.activeEpisodePromotions = this.groupActivePromotions(episodes);
      },
      error: error => console.error('Error loading podcast promotion state:', error)
    });
  }

  private groupActivePromotions(promotions: ContentPromotionDto[]): Map<number, ContentPromotionDto[]> {
    const grouped = new Map<number, ContentPromotionDto[]>();
    promotions.filter(promotion => promotion.isCurrentlyActive).forEach(promotion => {
      const current = grouped.get(promotion.targetId) || [];
      current.push(promotion);
      grouped.set(promotion.targetId, current);
    });
    return grouped;
  }

  private getPromotionSummary(promotions?: ContentPromotionDto[]): string {
    if (!promotions?.length) return '';

    const placementLabels: Record<ContentPromotionPlacement, string> = {
      [ContentPromotionPlacement.General]: 'כללי',
      [ContentPromotionPlacement.Home]: 'דף הבית',
      [ContentPromotionPlacement.Index]: 'אינדקס',
      [ContentPromotionPlacement.Featured]: 'מומלצים'
    };
    const placements = promotions.map(promotion => placementLabels[promotion.placement]).join(', ');
    return `קידום פעיל: ${placements}`;
  }

  private async cancelPromotions(promotions: ContentPromotionDto[] | undefined, message: string): Promise<void> {
    if (!promotions?.length || !await this.siteAlerts.confirm(message)) return;

    this.bulkActionLoading = true;
    forkJoin(promotions.map(promotion => this.contentPromotionService.deactivate(
      promotion.targetType,
      promotion.targetId,
      promotion.placement
    ))).subscribe({
      next: () => {
        this.bulkActionLoading = false;
        this.loadPromotionState();
      },
      error: error => {
        console.error('Error cancelling podcast promotion:', error);
        this.bulkActionLoading = false;
        alert('שגיאה בביטול הקידום');
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadEpisodes();
  }

  createPodcast(): void {
    this.router.navigate(['/admin/content/podcasts/new']);
  }

  createEpisode(): void {
    this.router.navigate(['/admin/content/podcasts/episodes/new']);
  }

  createEpisodeForSeries(podcast: Podcast): void {
    this.router.navigate(['/admin/content/podcasts/episodes/new'], { queryParams: { podcastId: podcast.id } });
  }

  selectSeries(podcast: Podcast): void {
    this.selectedSeriesPodcast = podcast;
    this.selectedPodcastId = podcast.id;
    this.currentPage = 1;
    this.loadSelectedSeriesEpisodes();
  }

  isSeriesSelected(podcast: Podcast): boolean {
    return this.selectedSeriesPodcast?.id === podcast.id;
  }

  loadSelectedSeriesEpisodes(): void {
    if (!this.selectedSeriesPodcast) {
      this.selectedSeriesEpisodes = [];
      return;
    }

    this.seriesEpisodesLoading = true;
    this.podcastService.getEpisodes(1, 5, this.selectedSeriesPodcast.id, undefined, undefined, undefined, undefined, 'date', true).subscribe({
      next: result => {
        this.selectedSeriesEpisodes = result.items;
        this.seriesEpisodesLoading = false;
        if (result.totalCount > result.items.length) {
          const podcastId = this.selectedSeriesPodcast?.id;
          setTimeout(() => this.podcastService.getEpisodes(1, 100, podcastId, undefined, undefined, undefined, undefined, 'date', true).subscribe(all => {
            if (this.selectedSeriesPodcast?.id === podcastId) {
              this.selectedSeriesEpisodes = all.items;
            }
          }), 0);
        }
      },
      error: () => {
        this.selectedSeriesEpisodes = [];
        this.seriesEpisodesLoading = false;
      }
    });
  }

  editPodcast(podcast: Podcast): void {
    this.router.navigate(['/admin/content/podcasts/edit', podcast.id]);
  }

  private compareDatesDescending(first: string, second: string): number {
    return new Date(second).getTime() - new Date(first).getTime();
  }

  editEpisode(episode: PodcastEpisode): void {
    this.router.navigate(['/admin/content/podcasts/episodes/edit', episode.id]);
  }

  duplicateEpisode(episode: PodcastEpisode): void {
    this.router.navigate(['/admin/content/podcasts/episodes/new'], { queryParams: { duplicate: episode.id } });
  }

  setEpisodeStatus(episode: PodcastEpisode, isActive: boolean): void {
    if (episode.isActive === isActive || this.savingEpisodeId === episode.id) return;

    this.savingEpisodeId = episode.id;
    this.updateEpisodeStatus(episode.id, isActive).subscribe({
      next: updated => {
        episode.isActive = updated.isActive;
        if (updated.isActive) {
          this.automationDraftEpisodes = this.automationDraftEpisodes.filter(item => item.id !== updated.id);
          this.automationDraftTotal = Math.max(0, this.automationDraftTotal - 1);
        }
        this.savingEpisodeId = null;
      },
      error: () => {
        this.savingEpisodeId = null;
        alert('עדכון סטטוס הפרק נכשל');
      }
    });
  }

  setPodcastStatus(podcast: Podcast, isActive: boolean): void {
    if (podcast.isActive === isActive || this.savingPodcastId === podcast.id) return;

    this.savingPodcastId = podcast.id;
    this.updatePodcastStatus(podcast.id, isActive).subscribe({
      next: updated => {
        podcast.isActive = updated.isActive;
        this.savingPodcastId = null;
      },
      error: () => {
        this.savingPodcastId = null;
        alert('עדכון סטטוס הפודקאסט נכשל');
      }
    });
  }

  async deletePodcast(podcast: Podcast): Promise<void> {
    if (!await this.siteAlerts.confirm(`למחוק את הפודקאסט "${podcast.name}" ואת כל הפרקים שלו?`)) return;
    this.podcastService.deletePodcast(podcast.id).subscribe(() => {
      if (this.selectedSeriesPodcast?.id === podcast.id) {
        this.selectedSeriesPodcast = null;
        this.selectedSeriesEpisodes = [];
      }
      this.loadPodcasts();
      this.loadEpisodes();
    });
  }

  async deleteEpisode(episode: PodcastEpisode): Promise<void> {
    if (!await this.siteAlerts.confirm(`למחוק את הפרק "${episode.title}"?`)) return;
    this.podcastService.deleteEpisode(episode.id).subscribe(() => {
      this.loadEpisodes();
      if (this.selectedSeriesPodcast?.id === episode.podcastId) {
        this.loadSelectedSeriesEpisodes();
      }
    });
  }

  async bulkDeleteEpisodes(): Promise<void> {
    const ids = Array.from(this.selectedEpisodeIds);
    if (ids.length === 0) return;

    if (!await this.siteAlerts.confirm(`למחוק ${ids.length} פרקים שנבחרו?`)) return;

    this.bulkActionLoading = true;
    forkJoin(ids.map(id => this.podcastService.deleteEpisode(id))).subscribe({
      next: () => {
        this.bulkActionLoading = false;
        this.loadEpisodes();
      },
      error: (error) => {
        console.error('Error deleting selected episodes:', error);
        alert('שגיאה במחיקת הפרקים');
        this.bulkActionLoading = false;
      }
    });
  }

  async bulkSetEpisodeStatus(isActive: boolean): Promise<void> {
    const allEpisodes = [...this.episodes, ...this.selectedSeriesEpisodes];
    const selectedEpisodes = allEpisodes.filter(episode => this.selectedEpisodeIds.has(episode.id));
    if (selectedEpisodes.length === 0) return;

    const action = isActive ? 'להציג באתר' : 'להעביר לטיוטה';
    if (!await this.siteAlerts.confirm(`${action} ${selectedEpisodes.length} פרקים שנבחרו?`)) return;

    this.bulkActionLoading = true;
    forkJoin(selectedEpisodes.map(episode => this.updateEpisodeStatus(episode.id, isActive))).subscribe({
      next: () => {
        this.bulkActionLoading = false;
        this.loadEpisodes();
      },
      error: (error) => {
        console.error('Error updating selected episodes:', error);
        alert('שגיאה בעדכון הפרקים');
        this.bulkActionLoading = false;
      }
    });
  }

  async bulkDuplicateEpisodes(): Promise<void> {
    const ids = Array.from(this.selectedEpisodeIds);
    if (ids.length === 0) return;

    if (!await this.siteAlerts.confirm(`לשכפל ${ids.length} פרקים שנבחרו?`)) return;

    this.bulkActionLoading = true;
    forkJoin(ids.map(id => this.podcastService.getEpisode(id))).pipe(
      switchMap(episodes => {
        const createRequests = episodes.map(episode => {
          const dto: CreatePodcastEpisodeDto = {
            podcastId: episode.podcastId,
            title: episode.title + ' (עותק)',
            description: episode.description,
            episodeNumber: episode.episodeNumber,
            sourceUrl: episode.sourceUrl,
            embedUrl: episode.embedUrl,
            thumbnailUrl: episode.thumbnailUrl,
            platform: episode.platform,
            publishedAt: episode.publishedAt,
            displayOrder: episode.displayOrder,
            isActive: false,
          };
          return this.podcastService.createEpisode(dto);
        });
        return forkJoin(createRequests);
      })
    ).subscribe({
      next: () => {
        this.clearSelection();
        this.bulkActionLoading = false;
        this.loadEpisodes();
        if (this.selectedSeriesPodcast) {
          this.loadSelectedSeriesEpisodes();
        }
      },
      error: (error) => {
        console.error('Error duplicating episodes:', error);
        alert('שגיאה בשכפול הפרקים');
        this.bulkActionLoading = false;
      }
    });
  }

  async bulkDeletePodcasts(): Promise<void> {
    const ids = Array.from(this.selectedPodcastIds);
    if (ids.length === 0) return;

    if (!await this.siteAlerts.confirm(`למחוק ${ids.length} סדרות שנבחרו ואת כל הפרקים שלהן?`)) return;

    this.bulkActionLoading = true;
    forkJoin(ids.map(id => this.podcastService.deletePodcast(id))).subscribe({
      next: () => {
        this.bulkActionLoading = false;
        this.loadPodcasts();
        this.loadEpisodes();
      },
      error: (error) => {
        console.error('Error deleting selected podcasts:', error);
        alert('שגיאה במחיקת הסדרות');
        this.bulkActionLoading = false;
      }
    });
  }

  async bulkSetPodcastStatus(isActive: boolean): Promise<void> {
    const selectedPodcasts = this.podcasts.filter(podcast => this.selectedPodcastIds.has(podcast.id));
    if (selectedPodcasts.length === 0) return;

    const action = isActive ? 'להציג באתר' : 'להעביר לטיוטה';
    if (!await this.siteAlerts.confirm(`${action} ${selectedPodcasts.length} סדרות שנבחרו?`)) return;

    this.bulkActionLoading = true;
    forkJoin(selectedPodcasts.map(podcast => this.updatePodcastStatus(podcast.id, isActive))).subscribe({
      next: () => {
        this.bulkActionLoading = false;
        this.loadPodcasts();
      },
      error: (error) => {
        console.error('Error updating selected podcasts:', error);
        alert('שגיאה בעדכון הסדרות');
        this.bulkActionLoading = false;
      }
    });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getStatusLabel(isActive: boolean): string {
    return isActive ? 'מוצג באתר' : 'טיוטה';
  }

  private updateEpisodeStatus(episodeId: number, isActive: boolean) {
    return this.podcastService.getEpisode(episodeId).pipe(
      switchMap(episode => this.podcastService.updateEpisode(episode.id, {
        podcastId: episode.podcastId,
        title: episode.title,
        slug: episode.slug,
        description: episode.description,
        episodeNumber: episode.episodeNumber,
        sourceUrl: episode.sourceUrl,
        embedUrl: episode.embedUrl,
        thumbnailUrl: episode.thumbnailUrl,
        platform: episode.platform,
        publishedAt: episode.publishedAt,
        displayOrder: episode.displayOrder,
        isActive
      }))
    );
  }

  private updatePodcastStatus(podcastId: number, isActive: boolean) {
    return this.podcastService.getPodcast(podcastId).pipe(
      switchMap(podcast => this.podcastService.updatePodcast(podcast.id, {
        name: podcast.name,
        slug: podcast.slug,
        description: podcast.description,
        imageUrl: podcast.imageUrl,
        displayOrder: podcast.displayOrder,
        isActive
      }))
    );
  }

  private isYouTubeEpisode(episode: PodcastEpisode): boolean {
    const platform = episode.platform?.toLowerCase() ?? '';
    const sourceUrl = episode.sourceUrl?.toLowerCase() ?? '';
    return platform.includes('youtube')
      || sourceUrl.includes('youtube.com/')
      || sourceUrl.includes('youtu.be/');
  }

  private getActiveFilter(): boolean | undefined {
    if (this.statusFilter === 'active') return true;
    if (this.statusFilter === 'draft') return false;
    return undefined;
  }
}
