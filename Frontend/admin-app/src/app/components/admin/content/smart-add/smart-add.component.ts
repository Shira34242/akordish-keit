import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalService } from '../../../../services/modal.service';
import { SongService } from '../../../../services/song.service';
import { SmartContentService } from '../../../../services/admin/smart-content.service';
import { ImportedSongDraft, ImportSongFromUrlResponse } from '../../../../models/song.model';
import { ImportContentFromUrlResponse, SmartContentType } from '../../../../models/smart-content.model';

@Component({
  selector: 'app-smart-add',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './smart-add.component.html',
  styleUrls: ['./smart-add.component.css']
})
export class SmartAddComponent {
  private readonly router = inject(Router);
  private readonly modalService = inject(ModalService);
  private readonly songService = inject(SongService);
  private readonly smartContentService = inject(SmartContentService);

  importUrl = '';
  selectedContentType: SmartContentType = 'song';
  importState: 'idle' | 'loading' | 'ready' | 'invalid' | 'error' = 'idle';
  importResult: ImportSongFromUrlResponse | null = null;
  contentImportResult: ImportContentFromUrlResponse | null = null;
  errorMessage = '';

  readonly contentTypes: { value: SmartContentType; label: string; hint: string; icon: string }[] = [
    { value: 'song', label: 'אקורדים', hint: 'שליפת שיר ואקורדים לעריכת שיר', icon: 'library_music' },
    { value: 'article', label: 'כתבה', hint: 'כותרת, תקציר ותמונה לטופס כתבה', icon: 'article' },
    { value: 'music-news', label: 'חדשות מוזיקה', hint: 'ידיעה קצרה לאזור חדשות המוזיקה', icon: 'newspaper' },
    { value: 'event', label: 'הופעה', hint: 'שם, תמונה, תיאור וקישור לכרטיסים', icon: 'event' },
    { value: 'podcast', label: 'פודקאסט', hint: 'פרק פודקאסט עם מקור ותמונה', icon: 'podcasts' }
  ];

  prepareSmartImport(): void {
    const url = this.importUrl.trim();

    if (!this.isValidUrl(url)) {
      this.importState = 'invalid';
      return;
    }

    this.importState = 'loading';
    this.errorMessage = '';
    this.importResult = null;
    this.contentImportResult = null;

    if (this.selectedContentType !== 'song') {
      this.prepareContentImport(url, this.selectedContentType);
      return;
    }

    this.songService.importSongFromUrl(url).subscribe({
      next: (result) => {
        this.importResult = result;

        if (result.songId) {
          this.openImportedSong(result.songId);
          return;
        }

        this.importState = 'ready';
      },
      error: (error) => {
        const result = error.error as ImportSongFromUrlResponse | undefined;
        this.importResult = result ?? null;
        this.importState = result?.draft ? 'ready' : 'error';
        this.errorMessage = result?.message || 'לא הצלחנו לייבא מהקישור הזה.';
      }
    });
  }

  onContentTypeChange(type: SmartContentType): void {
    this.selectedContentType = type;
    this.importState = 'idle';
    this.importResult = null;
    this.contentImportResult = null;
    this.errorMessage = '';
  }

  openSongEditor(): void {
    this.modalService.openAddSongModal({ flowMode: 'legacy' });
  }

  openDraftEditor(): void {
    if (this.selectedContentType !== 'song') {
      this.openContentDraftEditor();
      return;
    }

    const draft = this.importResult?.draft;
    if (!draft) return;

    this.modalService.openPrefilledAddSongModal(this.normalizeDraftForForm(draft));
  }

  addArticle(): void {
    this.router.navigate(['/admin/content/articles/new'], { queryParams: { type: 'blog' } });
  }

  addMusicNews(): void {
    this.router.navigate(['/admin/content/articles/new'], { queryParams: { type: 'news' } });
  }

  addEvent(): void {
    this.router.navigate(['/admin/content/events/new']);
  }

  addPodcast(): void {
    this.router.navigate(['/admin/content/podcasts/episodes/new']);
  }

  get selectedTypeLabel(): string {
    return this.contentTypes.find(type => type.value === this.selectedContentType)?.label || 'תוכן';
  }

  get resultMessage(): string {
    return this.selectedContentType === 'song'
      ? this.importResult?.message || ''
      : this.contentImportResult?.message || '';
  }

  get missingFields(): string[] {
    return this.selectedContentType === 'song'
      ? this.importResult?.missingFields || []
      : this.contentImportResult?.missingFields || [];
  }

  private isValidUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private openImportedSong(songId: number): void {
    this.songService.getSongByIdForAdmin(songId).subscribe({
      next: (song) => {
        this.importState = 'ready';
        this.modalService.openEditSongModal(song);
      },
      error: () => {
        this.importState = 'ready';
        this.router.navigate(['/admin/content/songs']);
      }
    });
  }

  private prepareContentImport(url: string, contentType: Exclude<SmartContentType, 'song'>): void {
    this.smartContentService.importFromUrl(url, contentType).subscribe({
      next: (result) => {
        this.contentImportResult = result;
        this.importState = result.draft ? 'ready' : 'error';
        this.errorMessage = result.message || '';
      },
      error: (error) => {
        const result = error.error as ImportContentFromUrlResponse | undefined;
        this.contentImportResult = result ?? null;
        this.importState = result?.draft ? 'ready' : 'error';
        this.errorMessage = result?.message || 'לא הצלחנו לשלוף תוכן מהקישור הזה.';
      }
    });
  }

  private openContentDraftEditor(): void {
    const draft = this.contentImportResult?.draft;
    if (!draft) return;

    const draftKey = this.smartContentService.storeDraft({
      ...draft,
      storedAt: Date.now()
    });

    if (draft.contentType === 'event') {
      this.router.navigate(['/admin/content/events/new'], { queryParams: { smartDraft: draftKey } });
      return;
    }

    if (draft.contentType === 'podcast') {
      this.router.navigate(['/admin/content/podcasts/episodes/new'], { queryParams: { smartDraft: draftKey } });
      return;
    }

    this.router.navigate(['/admin/content/articles/new'], {
      queryParams: {
        type: draft.contentType === 'music-news' ? 'news' : 'blog',
        smartDraft: draftKey
      }
    });
  }

  private normalizeDraftForForm(draft: ImportedSongDraft): ImportedSongDraft {
    return {
      ...draft,
      artists: draft.artists?.length ? draft.artists : [{ name: '' }],
      tags: draft.tags || []
    };
  }
}
