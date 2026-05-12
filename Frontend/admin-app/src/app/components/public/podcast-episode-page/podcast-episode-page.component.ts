import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PodcastEpisode, PodcastEpisodeDetail } from '../../../models/podcast.model';
import { PodcastService } from '../../../services/podcast.service';

@Component({
  selector: 'app-podcast-episode-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './podcast-episode-page.component.html',
  styleUrls: ['./podcast-episode-page.component.css']
})
export class PodcastEpisodePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly podcastService = inject(PodcastService);
  private readonly sanitizer = inject(DomSanitizer);

  episode: PodcastEpisodeDetail | null = null;
  safeEmbedUrl: SafeResourceUrl | null = null;
  loading = true;

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const podcastSlug = params.get('podcastSlug');
      const episodeSlug = params.get('episodeSlug');
      if (!podcastSlug || !episodeSlug) return;

      this.loading = true;
      this.podcastService.getEpisodeBySlug(podcastSlug, episodeSlug).subscribe({
        next: episode => {
          this.episode = episode;
          this.safeEmbedUrl = this.canEmbed(episode.embedUrl)
            ? this.sanitizer.bypassSecurityTrustResourceUrl(episode.embedUrl)
            : null;
          this.loading = false;
        },
        error: () => {
          this.episode = null;
          this.safeEmbedUrl = null;
          this.loading = false;
        }
      });
    });
  }

  trackById(_index: number, item: PodcastEpisode): number {
    return item.id;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  private canEmbed(url: string): boolean {
    return /youtube\.com\/embed\//i.test(url) || /open\.spotify\.com\/embed\//i.test(url);
  }
}
