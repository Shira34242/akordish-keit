import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PodcastEpisodeBanner } from '../../../models/podcast.model';
import { CloudflareImagePipe } from '../../../pipes/cloudflare-image.pipe';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';

@Component({
  selector: 'app-podcast-episode-banner',
  standalone: true,
  imports: [CommonModule, RouterModule, CloudflareImagePipe, ImgFallbackDirective],
  templateUrl: './podcast-episode-banner.component.html',
  styleUrls: ['./podcast-episode-banner.component.css']
})
export class PodcastEpisodeBannerComponent {
  @Input() episode!: PodcastEpisodeBanner;
  @Input() showDescription = true;
}
