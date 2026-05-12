import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PodcastService } from '../../../../services/podcast.service';
import { CreatePodcastDto, UpdatePodcastDto } from '../../../../models/podcast.model';

@Component({
  selector: 'app-podcast-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './podcast-form.component.html',
  styleUrls: ['./podcast-form.component.css']
})
export class PodcastFormComponent implements OnInit {
  private readonly podcastService = inject(PodcastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  isEditMode = false;
  podcastId?: number;
  loading = false;
  saving = false;

  podcast: CreatePodcastDto | UpdatePodcastDto = {
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    displayOrder: 0,
    isActive: true
  };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.isEditMode = true;
    this.podcastId = +id;
    this.loading = true;
    this.podcastService.getPodcast(this.podcastId).subscribe({
      next: podcast => {
        this.podcast = {
          name: podcast.name,
          slug: podcast.slug,
          description: podcast.description,
          imageUrl: podcast.imageUrl,
          displayOrder: podcast.displayOrder,
          isActive: podcast.isActive
        };
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.goBack();
      }
    });
  }

  onSubmit(): void {
    if (!this.podcast.name.trim()) {
      alert('נא להזין שם פודקאסט');
      return;
    }

    this.saving = true;
    const payload = {
      ...this.podcast,
      name: this.podcast.name.trim(),
      slug: this.podcast.slug?.trim() || undefined,
      description: this.podcast.description?.trim() || undefined,
      imageUrl: this.podcast.imageUrl?.trim() || undefined
    };

    const request = this.isEditMode && this.podcastId
      ? this.podcastService.updatePodcast(this.podcastId, payload)
      : this.podcastService.createPodcast(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.goBack();
      },
      error: () => {
        this.saving = false;
        alert('שמירת הפודקאסט נכשלה');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/content/podcasts']);
  }
}
