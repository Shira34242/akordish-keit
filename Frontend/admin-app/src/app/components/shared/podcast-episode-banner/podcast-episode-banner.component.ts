import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PodcastEpisode } from '../../../models/podcast.model';

@Component({
  selector: 'app-podcast-episode-banner',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './podcast-episode-banner.component.html',
  styleUrls: ['./podcast-episode-banner.component.css']
})
export class PodcastEpisodeBannerComponent {
  @Input() episode!: PodcastEpisode;
  @Input() showDescription = true;
}
