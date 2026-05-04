import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalService } from '../../../../services/modal.service';
import { SongService } from '../../../../services/song.service';
import { ImportedSongDraft, ImportSongFromUrlResponse } from '../../../../models/song.model';

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

  importUrl = '';
  importState: 'idle' | 'loading' | 'ready' | 'invalid' | 'error' = 'idle';
  importResult: ImportSongFromUrlResponse | null = null;
  errorMessage = '';

  prepareChordImport(): void {
    const url = this.importUrl.trim();

    if (!this.isValidUrl(url)) {
      this.importState = 'invalid';
      return;
    }

    this.importState = 'loading';
    this.errorMessage = '';
    this.importResult = null;

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

  openSongEditor(): void {
    this.modalService.openAddSongModal();
  }

  openDraftEditor(): void {
    const draft = this.importResult?.draft;
    if (!draft) return;

    this.modalService.openPrefilledAddSongModal(this.normalizeDraftForForm(draft));
  }

  addArticle(): void {
    this.router.navigate(['/admin/content/articles/new'], { queryParams: { type: 'news' } });
  }

  addEvent(): void {
    this.router.navigate(['/admin/content/events/new']);
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

  private normalizeDraftForForm(draft: ImportedSongDraft): ImportedSongDraft {
    return {
      ...draft,
      artists: draft.artists?.length ? draft.artists : [{ name: '' }],
      tags: draft.tags || []
    };
  }
}
