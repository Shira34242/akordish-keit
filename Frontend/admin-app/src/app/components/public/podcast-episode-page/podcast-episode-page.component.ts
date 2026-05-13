import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-podcast-episode-page',
  standalone: true,
  template: ''
})
export class PodcastEpisodePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const series = this.route.snapshot.paramMap.get('podcastSlug');
    const episode = this.route.snapshot.paramMap.get('episodeSlug');
    this.router.navigate(['/podcasts'], {
      queryParams: series && episode ? { series, episode } : undefined,
      replaceUrl: true
    });
  }
}
