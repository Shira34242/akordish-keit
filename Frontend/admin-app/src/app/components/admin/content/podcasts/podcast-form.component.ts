import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map, of, switchMap } from 'rxjs';
import { AgencyListDto } from '../../../../models/agency.model';
import { PodcastService } from '../../../../services/podcast.service';
import { AgencyService } from '../../../../services/agency.service';
import { CreatePodcastDto, UpdatePodcastDto } from '../../../../models/podcast.model';
import { FileUploadInputComponent } from '../../../shared/file-upload-input/file-upload-input.component';

@Component({
  selector: 'app-podcast-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadInputComponent],
  templateUrl: './podcast-form.component.html',
  styleUrls: ['./podcast-form.component.css']
})
export class PodcastFormComponent implements OnInit {
  private readonly podcastService = inject(PodcastService);
  private readonly agencyService = inject(AgencyService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  isEditMode = false;
  podcastId?: number;
  loading = false;
  saving = false;
  agencies: AgencyListDto[] = [];
  selectedAgencyId: number | null = null;
  advancedOpen = false;
  private originalAgencyId: number | null = null;

  podcast: CreatePodcastDto | UpdatePodcastDto = {
    name: '',
    slug: '',
    description: '',
    imageUrl: '',
    displayOrder: 0,
    isActive: true
  };

  ngOnInit(): void {
    this.loadAgencies();

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
        this.selectedAgencyId = podcast.agencyBanner?.id ?? null;
        this.originalAgencyId = this.selectedAgencyId;
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
      next: podcast => this.syncAgencyLink(podcast.id),
      error: () => {
        this.saving = false;
        alert('שמירת הפודקאסט נכשלה');
      }
    });
  }

  private loadAgencies(): void {
    this.agencyService.getAgencies(undefined, true, 1, 200).subscribe({
      next: result => this.agencies = result.items || [],
      error: () => this.agencies = []
    });
  }

  private syncAgencyLink(podcastId: number): void {
    this.buildAgencySyncRequest(podcastId).subscribe({
      next: () => {
        this.saving = false;
        this.goBack();
      },
      error: () => {
        this.saving = false;
        alert('הפודקאסט נשמר, אבל שיוך הסוכנות נכשל');
      }
    });
  }

  private buildAgencySyncRequest(podcastId: number) {
    const previousAgencyId = this.originalAgencyId;
    const nextAgencyId = this.selectedAgencyId;

    if (previousAgencyId === nextAgencyId) return of(undefined);

    const removePrevious$ = previousAgencyId
      ? this.agencyService.getAgency(previousAgencyId).pipe(
          switchMap(agency => {
            const link = (agency.contents || []).find(content =>
              content.contentType === 'podcast' && content.contentId === podcastId
            );
            return link
              ? this.agencyService.removeContent(previousAgencyId, link.id)
              : of(undefined);
          })
        )
      : of(undefined);

    return removePrevious$.pipe(
      switchMap(() => nextAgencyId
        ? this.agencyService.addContent(nextAgencyId, {
            contentType: 'podcast',
            contentId: podcastId,
            isFeatured: false,
            displayOrder: 0
          })
        : of(undefined)
      ),
      map(() => undefined)
    );
  }

  goBack(): void {
    this.router.navigate(['/admin/content/podcasts']);
  }

  clearImage(): void {
    this.podcast.imageUrl = '';
  }

  toggleAdvanced(): void {
    this.advancedOpen = !this.advancedOpen;
  }
}
