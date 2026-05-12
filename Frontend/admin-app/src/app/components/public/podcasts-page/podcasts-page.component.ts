import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Podcast, PodcastEpisode } from '../../../models/podcast.model';
import { PodcastService } from '../../../services/podcast.service';
import { PodcastEpisodeCardComponent } from '../../shared/podcast-episode-card/podcast-episode-card.component';

@Component({
  selector: 'app-podcasts-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PodcastEpisodeCardComponent],
  templateUrl: './podcasts-page.component.html',
  styleUrls: ['./podcasts-page.component.css']
})
export class PodcastsPageComponent implements OnInit {
  private readonly podcastService = inject(PodcastService);

  loading = true;
  loadingMore = false;
  episodes: PodcastEpisode[] = [];
  podcasts: Podcast[] = [];
  searchTerm = '';
  selectedPodcastId?: number;
  currentPage = 1;
  pageSize = 12;
  totalItems = 0;
  totalPages = 0;

  ngOnInit(): void {
    this.loadPodcasts();
    this.loadEpisodes(true);
  }

  loadEpisodes(reset = false): void {
    if (reset) {
      this.currentPage = 1;
      this.episodes = [];
      this.loading = true;
    } else {
      this.loadingMore = true;
    }

    this.podcastService.getPublicEpisodes(
      this.currentPage,
      this.pageSize,
      this.selectedPodcastId,
      this.searchTerm.trim() || undefined
    ).subscribe({
      next: result => {
        this.episodes = reset ? result.items : [...this.episodes, ...result.items];
        this.totalItems = result.totalCount;
        this.totalPages = result.totalPages;
        this.loading = false;
        this.loadingMore = false;
      },
      error: () => {
        this.loading = false;
        this.loadingMore = false;
      }
    });
  }

  private loadPodcasts(): void {
    this.podcastService.getPublicPodcasts().subscribe({
      next: podcasts => {
        this.podcasts = podcasts;
      }
    });
  }

  applyFilters(): void {
    this.loadEpisodes(true);
  }

  selectPodcast(podcastId?: number): void {
    this.selectedPodcastId = podcastId;
    this.loadEpisodes(true);
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedPodcastId = undefined;
    this.loadEpisodes(true);
  }

  loadMore(): void {
    if (this.currentPage >= this.totalPages || this.loadingMore) return;
    this.currentPage += 1;
    this.loadEpisodes(false);
  }

  get activePodcast(): Podcast | undefined {
    return this.podcasts.find(podcast => podcast.id === this.selectedPodcastId);
  }

  trackById(_index: number, item: { id: number }): number {
    return item.id;
  }
}
