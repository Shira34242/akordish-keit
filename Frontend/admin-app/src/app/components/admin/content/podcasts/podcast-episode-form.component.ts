import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Podcast, CreatePodcastEpisodeDto, UpdatePodcastEpisodeDto } from '../../../../models/podcast.model';
import { PodcastService } from '../../../../services/podcast.service';

@Component({
  selector: 'app-podcast-episode-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './podcast-episode-form.component.html',
  styleUrls: ['./podcast-form.component.css']
})
export class PodcastEpisodeFormComponent implements OnInit {
  private readonly podcastService = inject(PodcastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  podcasts: Podcast[] = [];
  isEditMode = false;
  episodeId?: number;
  loading = false;
  saving = false;

  episode: CreatePodcastEpisodeDto | UpdatePodcastEpisodeDto = {
    podcastId: 0,
    title: '',
    slug: '',
    description: '',
    episodeNumber: 0,
    sourceUrl: '',
    embedUrl: '',
    thumbnailUrl: '',
    platform: '',
    publishedAt: this.formatDateForInput(new Date().toISOString()),
    displayOrder: 0,
    isActive: true
  };

  ngOnInit(): void {
    this.loadPodcasts();
    const id = this.route.snapshot.paramMap.get('id');
    const duplicateId = this.route.snapshot.queryParamMap.get('duplicate');

    if (!id && duplicateId) {
      this.loadDuplicate(+duplicateId);
      return;
    }

    if (!id) return;

    this.isEditMode = true;
    this.episodeId = +id;
    this.loading = true;
    this.podcastService.getEpisode(this.episodeId).subscribe({
      next: episode => {
        this.episode = {
          podcastId: episode.podcastId,
          title: episode.title,
          slug: episode.slug,
          description: episode.description,
          episodeNumber: episode.episodeNumber,
          sourceUrl: episode.sourceUrl,
          embedUrl: episode.embedUrl,
          thumbnailUrl: episode.thumbnailUrl,
          platform: episode.platform,
          publishedAt: this.formatDateForInput(episode.publishedAt),
          displayOrder: episode.displayOrder,
          isActive: episode.isActive
        };
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.goBack();
      }
    });
  }

  private loadDuplicate(id: number): void {
    this.loading = true;
    this.podcastService.getEpisode(id).subscribe({
      next: episode => {
        this.episode = {
          podcastId: episode.podcastId,
          title: `${episode.title} (עותק)`,
          slug: '',
          description: episode.description,
          episodeNumber: episode.episodeNumber + 1,
          sourceUrl: episode.sourceUrl,
          embedUrl: '',
          thumbnailUrl: '',
          platform: episode.platform,
          publishedAt: this.formatDateForInput(new Date().toISOString()),
          displayOrder: episode.displayOrder,
          isActive: false
        };
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  loadPodcasts(): void {
    this.podcastService.getPodcasts(1, 200).subscribe(result => {
      this.podcasts = result.items;
      if (!this.episode.podcastId && this.podcasts.length > 0) {
        this.episode.podcastId = this.podcasts[0].id;
      }
    });
  }

  onSubmit(): void {
    if (!this.episode.podcastId) {
      alert('נא לבחור סדרת פודקאסט');
      return;
    }
    if (!this.episode.title.trim()) {
      alert('נא להזין שם פרק');
      return;
    }
    if (!this.episode.sourceUrl.trim()) {
      alert('נא להזין קישור לפרק');
      return;
    }

    this.saving = true;
    const payload = {
      ...this.episode,
      title: this.episode.title.trim(),
      slug: this.episode.slug?.trim() || undefined,
      description: this.episode.description?.trim() || undefined,
      sourceUrl: this.episode.sourceUrl.trim(),
      embedUrl: this.episode.embedUrl?.trim() || undefined,
      thumbnailUrl: this.episode.thumbnailUrl?.trim() || undefined,
      platform: this.episode.platform?.trim() || undefined
    };

    const request = this.isEditMode && this.episodeId
      ? this.podcastService.updateEpisode(this.episodeId, payload)
      : this.podcastService.createEpisode(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.goBack();
      },
      error: () => {
        this.saving = false;
        alert('שמירת הפרק נכשלה');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/content/podcasts']);
  }

  get detectedPlatform(): string {
    const url = this.episode.sourceUrl || '';
    if (/youtu\.be|youtube\.com/i.test(url)) return 'YouTube';
    if (/open\.spotify\.com/i.test(url)) return 'Spotify';
    if (/podcasts\.apple\.com/i.test(url)) return 'Apple Podcasts';
    return url.trim() ? 'קישור חיצוני' : 'עדיין אין קישור';
  }

  get previewThumbnailUrl(): string | undefined {
    if (this.episode.thumbnailUrl?.trim()) return this.episode.thumbnailUrl.trim();
    const youtubeId = this.extractYouTubeId(this.episode.sourceUrl || '');
    return youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : undefined;
  }

  private formatDateForInput(dateString: string): string {
    return new Date(dateString).toISOString().slice(0, 16);
  }

  private extractYouTubeId(url: string): string | undefined {
    const patterns = [
      /youtu\.be\/([A-Za-z0-9_-]{6,})/i,
      /youtube\.com\/watch\?.*v=([A-Za-z0-9_-]{6,})/i,
      /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/i,
      /youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/i
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match?.[1]) return match[1];
    }

    return undefined;
  }
}
