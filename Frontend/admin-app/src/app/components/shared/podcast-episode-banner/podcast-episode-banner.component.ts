import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PodcastEpisode } from '../../../models/podcast.model';
import { CloudflareImagePipe, CloudflareImageSrcsetPipe } from '../../../pipes/cloudflare-image.pipe';

@Component({
  selector: 'app-podcast-episode-banner',
  standalone: true,
  imports: [CommonModule, RouterModule, CloudflareImagePipe, CloudflareImageSrcsetPipe],
  templateUrl: './podcast-episode-banner.component.html',
  styleUrls: ['./podcast-episode-banner.component.css']
})
export class PodcastEpisodeBannerComponent {
  @Input() episode!: PodcastEpisode;
  @Input() showDescription = true;
}
