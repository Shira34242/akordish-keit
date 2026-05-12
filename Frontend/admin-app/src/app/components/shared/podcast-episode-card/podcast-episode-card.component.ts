import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PodcastEpisode } from '../../../models/podcast.model';

@Component({
  selector: 'app-podcast-episode-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './podcast-episode-card.component.html',
  styleUrls: ['./podcast-episode-card.component.css']
})
export class PodcastEpisodeCardComponent {
  @Input({ required: true }) episode!: PodcastEpisode;
  @Input() compact = false;

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('he-IL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}
