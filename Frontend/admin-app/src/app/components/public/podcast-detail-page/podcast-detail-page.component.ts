import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-podcast-detail-page',
  standalone: true,
  template: ''
})
export class PodcastDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    this.router.navigate(['/podcasts'], {
      queryParams: slug ? { series: slug } : undefined,
      replaceUrl: true
    });
  }
}
