import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Podcast, CreatePodcastEpisodeDto, UpdatePodcastEpisodeDto } from '../../../../models/podcast.model';
import { PodcastService } from '../../../../services/podcast.service';
import { UserService } from '../../../../services/user.service';
import { UserWithProfileDto } from '../../../../models/user.model';
import { SmartContentService } from '../../../../services/admin/smart-content.service';
import { StoredSmartDraft } from '../../../../models/smart-content.model';

@Component({
  selector: 'app-podcast-episode-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './podcast-episode-form.component.html',
  styleUrls: ['./podcast-form.component.css']
})
export class PodcastEpisodeFormComponent implements OnInit {
  private readonly podcastService = inject(PodcastService);
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly smartContentService = inject(SmartContentService);

  podcasts: Podcast[] = [];
  isEditMode = false;
  episodeId?: number;
  loading = false;
  saving = false;

  // Uploader profile
  selectedProfile: UserWithProfileDto | null = null;
  profileSearchQuery = '';
  profileSearchResults: UserWithProfileDto[] = [];
  profileSearchLoading = false;
  showProfileDropdown = false;
  profileTypeFilter: 'all' | 'teacher' | 'serviceProvider' | 'artist' | 'user' = 'all';
  private readonly profileSearch$ = new Subject<string>();

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
    this.initProfileSearch();
    const id = this.route.snapshot.paramMap.get('id');
    const duplicateId = this.route.snapshot.queryParamMap.get('duplicate');

    if (!id && duplicateId) {
      this.loadDuplicate(+duplicateId);
      return;
    }

    if (!id) {
      this.applySmartDraftFromRoute();
      return;
    }

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
          isActive: episode.isActive,
          uploaderUserId: episode.uploaderUserId,
          uploaderProfileType: episode.uploaderProfileType,
          uploaderProfileId: episode.uploaderProfileId
        };

        if (episode.uploaderProfile) {
          this.selectedProfile = {
            userId: episode.uploaderUserId,
            displayName: episode.uploaderProfile.name,
            imageUrl: episode.uploaderProfile.imageUrl,
            profileType: episode.uploaderProfile.type,
            profileId: episode.uploaderProfileId ?? episode.uploaderProfile.profileId,
            profileUrl: episode.uploaderProfile.profileUrl,
            isTeacher: false,
            status: 'None',
            categories: []
          };
          this.profileSearchQuery = episode.uploaderProfile.name;
        }

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

  private applySmartDraftFromRoute(): void {
    const draft = this.smartContentService.consumeDraft(this.route.snapshot.queryParamMap.get('smartDraft'));
    if (!draft) return;

    this.episode = {
      ...this.episode,
      title: draft.title || this.episode.title,
      description: draft.description || this.episode.description,
      sourceUrl: draft.sourceUrl || this.episode.sourceUrl,
      thumbnailUrl: draft.imageUrl || this.episode.thumbnailUrl,
      platform: draft.platform || this.episode.platform,
      publishedAt: draft.publishedAt ? this.formatDateForInput(draft.publishedAt) : this.episode.publishedAt
    };
  }

  loadPodcasts(): void {
    this.podcastService.getPodcasts(1, 200).subscribe(result => {
      this.podcasts = result.items;
      if (!this.episode.podcastId && this.podcasts.length > 0) {
        this.episode.podcastId = this.podcasts[0].id;
      }
    });
  }

  initProfileSearch(): void {
    this.profileSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        if (!q.trim()) {
          this.profileSearchLoading = false;
          return of([]);
        }
        this.profileSearchLoading = true;
        return this.userService.searchUsersWithProfiles(q, 100, this.profileTypeFilter === 'all' ? undefined : this.profileTypeFilter);
      })
    ).subscribe({
      next: (results) => {
        this.profileSearchResults = results;
        this.profileSearchLoading = false;
        this.showProfileDropdown = true;
      },
      error: () => { this.profileSearchLoading = false; }
    });
  }

  onProfileSearchInput(): void {
    this.profileSearch$.next(this.profileSearchQuery);
  }

  onProfileFilterChange(): void {
    this.profileSearchQuery = '';
    this.selectedProfile = null;
    this.episode.uploaderUserId = undefined;
    this.episode.uploaderProfileType = undefined;
    this.episode.uploaderProfileId = undefined;
    this.profileSearchResults = [];
    this.showProfileDropdown = false;
  }

  selectProfile(profile: UserWithProfileDto): void {
    this.selectedProfile = profile;
    this.episode.uploaderUserId = profile.userId;
    this.episode.uploaderProfileType = profile.profileType;
    this.episode.uploaderProfileId = profile.profileId;
    this.profileSearchQuery = profile.displayName;
    this.showProfileDropdown = false;
    this.profileSearchResults = [];
  }

  clearProfile(): void {
    this.selectedProfile = null;
    this.episode.uploaderUserId = undefined;
    this.episode.uploaderProfileType = undefined;
    this.episode.uploaderProfileId = undefined;
    this.profileSearchQuery = '';
    this.profileSearchResults = [];
    this.showProfileDropdown = false;
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
