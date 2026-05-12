import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { PodcastDetail } from '../../../models/podcast.model';
import { PodcastService } from '../../../services/podcast.service';
import { PodcastEpisodeCardComponent } from '../../shared/podcast-episode-card/podcast-episode-card.component';

@Component({
  selector: 'app-podcast-detail-page',
  standalone: true,
  imports: [CommonModule, RouterModule, PodcastEpisodeCardComponent],
  templateUrl: './podcast-detail-page.component.html',
  styleUrls: ['./podcast-detail-page.component.css']
})
export class PodcastDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly podcastService = inject(PodcastService);

  podcast: PodcastDetail | null = null;
  loading = true;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug');
      if (!slug) return;
      this.loading = true;
      this.podcastService.getPodcastBySlug(slug).subscribe({
        next: podcast => {
          this.podcast = podcast;
          this.loading = false;
        },
        error: () => {
          this.podcast = null;
          this.loading = false;
        }
      });
    });
  }

  trackById(_index: number, item: { id: number }): number {
    return item.id;
  }

  get latestEpisode() {
    return this.podcast?.episodes
      ?.slice()
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];
  }
}
