import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ModalService } from '../../../../services/modal.service';
import { SongService } from '../../../../services/song.service';
import { SmartContentService } from '../../../../services/admin/smart-content.service';
import { AddSongRequest, ImportedSongDraft, ImportSongFromUrlResponse } from '../../../../models/song.model';
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

  @Input() compactSongOnly = false;
  @Output() completed = new EventEmitter<void>();

  importUrl = '';
  selectedContentType: SmartContentType = 'song';
  importState: 'idle' | 'loading' | 'ready' | 'invalid' | 'error' = 'idle';
  importResult: ImportSongFromUrlResponse | null = null;
  contentImportResult: ImportContentFromUrlResponse | null = null;
  errorMessage = '';
  successMessage = '';
  activeCompactImports = 0;
  compactImportsSaved = 0;
  compactImportsFailed = 0;
  artistSongChoices: { url: string; title: string; selected: boolean }[] = [];
  showArtistSongSelection = false;

  readonly contentTypes: { value: SmartContentType; label: string; hint: string; icon: string }[] = [
    { value: 'song', label: 'אקורדים', hint: 'שליפת שיר ואקורדים לעריכת שיר', icon: 'library_music' },
    { value: 'article', label: 'כתבה', hint: 'כותרת, תקציר ותמונה לטופס כתבה', icon: 'article' },
    { value: 'music-news', label: 'חדשות מוזיקה', hint: 'ידיעה קצרה לאזור חדשות המוזיקה', icon: 'newspaper' },
    { value: 'event', label: 'הופעה', hint: 'שם, תמונה, תיאור וקישור לכרטיסים', icon: 'event' },
    { value: 'podcast', label: 'פודקאסט', hint: 'פרק פודקאסט עם מקור ותמונה', icon: 'podcasts' }
  ];

  get visibleContentTypes(): { value: SmartContentType; label: string; hint: string; icon: string }[] {
    return this.compactSongOnly
      ? this.contentTypes.filter(type => type.value === 'song')
      : this.contentTypes;
  }

  prepareSmartImport(): void {
    const url = this.importUrl.trim();

    if (this.compactSongOnly) {
      this.selectedContentType = 'song';
      this.prepareCompactSongImport(url);
      return;
    }

    if (!this.isValidUrl(url)) {
      this.importState = 'invalid';
      return;
    }

    this.importState = 'loading';
    this.errorMessage = '';
    this.successMessage = '';
    this.importResult = null;
    this.contentImportResult = null;

    if (this.selectedContentType !== 'song') {
      this.prepareContentImport(url, this.selectedContentType);
      return;
    }

    this.songService.importSongFromUrl(url).subscribe({
      next: (result) => {
        this.importResult = result;

        if (result.isArtistPage) {
          if (result.songUrls?.length) {
            this.openArtistSongSelection(result.songUrls);
          } else {
            this.importState = 'error';
            this.errorMessage = result.message || 'לא זוהו שירים בעמוד האמן.';
          }
          return;
        }

        if (result.songId) {
          this.openImportedSong(result.songId);
          return;
        }

        if (this.compactSongOnly && result.draft) {
          this.importResult = result;
          this.saveImportedSongDraft(result.draft);
          return;
        }

        if (this.compactSongOnly) {
          this.importState = 'error';
          this.errorMessage = result.message || 'לא הצלחנו לשלוף מספיק פרטים לשמירת טיוטה.';
          return;
        }

        this.importState = 'ready';
      },
      error: (error) => {
        const result = error.error as ImportSongFromUrlResponse | undefined;
        this.importResult = result ?? null;

        if (this.compactSongOnly && result?.draft) {
          this.saveImportedSongDraft(result.draft);
          return;
        }

        this.importState = result?.draft ? 'ready' : 'error';
        this.errorMessage = result?.message || 'לא הצלחנו לייבא מהקישור הזה.';
      }
    });
  }

  onImportPaste(): void {
    return;
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
    this.completed.emit();
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
        this.completed.emit();
      },
      error: () => {
        this.importState = 'ready';
        this.router.navigate(['/admin/content/songs']);
      }
    });
  }

  private prepareCompactSongImport(url: string): void {
    if (!this.isValidUrl(url)) {
      this.importState = 'invalid';
      return;
    }

    this.importUrl = '';
    this.importState = 'idle';
    this.errorMessage = '';
    this.successMessage = 'השליפה נשלחה לרקע. אפשר להדביק קישור נוסף.';
    this.importResult = null;
    this.contentImportResult = null;
    this.activeCompactImports += 1;

    this.songService.importSongFromUrl(url).subscribe({
      next: (result) => {
        if (result.isArtistPage) {
          if (result.songUrls?.length) {
            this.activeCompactImports = Math.max(0, this.activeCompactImports - 1);
            this.openArtistSongSelection(result.songUrls);
          } else {
            this.finishCompactImport(false, result.message || 'לא זוהו שירים בעמוד האמן.');
          }
          return;
        }

        if (result.draft) {
          this.saveImportedSongDraft(result.draft, true);
          return;
        }

        this.finishCompactImport(false, result.message || 'לא הצלחנו לשלוף מספיק פרטים לשמירת טיוטה.');
      },
      error: (error) => {
        const result = error.error as ImportSongFromUrlResponse | undefined;

        if (result?.draft) {
          this.saveImportedSongDraft(result.draft, true);
          return;
        }

        this.finishCompactImport(false, result?.message || 'לא הצלחנו לייבא מהקישור הזה.');
      }
    });
  }

  get selectedArtistSongsCount(): number {
    return this.artistSongChoices.filter(song => song.selected).length;
  }

  toggleAllArtistSongs(selected: boolean): void {
    this.artistSongChoices = this.artistSongChoices.map(song => ({ ...song, selected }));
  }

  confirmArtistSongSelection(): void {
    const selectedUrls = this.artistSongChoices
      .filter(song => song.selected)
      .map(song => song.url);

    if (selectedUrls.length === 0) return;

    this.closeArtistSongSelection();
    this.processArtistSongUrls(selectedUrls);
  }

  closeArtistSongSelection(): void {
    this.showArtistSongSelection = false;
    this.artistSongChoices = [];
    this.importState = 'idle';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showArtistSongSelection) {
      this.closeArtistSongSelection();
    }
  }

  private openArtistSongSelection(songUrls: string[]): void {
    this.artistSongChoices = [...new Set(songUrls)].map(url => ({
      url,
      title: this.getSongTitleFromUrl(url),
      selected: true
    }));
    this.showArtistSongSelection = true;
    this.importState = 'idle';
    this.errorMessage = '';
    this.successMessage = '';
  }

  private getSongTitleFromUrl(url: string): string {
    try {
      const fileName = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
      const cleanName = fileName.replace(/\.html?$/i, '').replace(/^\d+_/, '').replaceAll('_', ' ');
      const separatorIndex = cleanName.lastIndexOf(' - ');
      return separatorIndex >= 0 ? cleanName.slice(separatorIndex + 3).trim() : cleanName.trim();
    } catch {
      return url;
    }
  }

  private processArtistSongUrls(songUrls: string[]): void {
    const uniqueUrls = [...new Set(songUrls)];

    this.activeCompactImports += uniqueUrls.length;
    this.importUrl = '';
    this.importState = 'idle';
    this.errorMessage = '';
    this.successMessage = `זוהו ${uniqueUrls.length} שירים. השליפות נשלחו בנפרד לרקע.`;

    this.processArtistSongUrlQueue(uniqueUrls);
  }

  private processArtistSongUrlQueue(songUrls: string[], index = 0): void {
    if (index >= songUrls.length) return;

    this.songService.importSongFromUrl(songUrls[index]).subscribe({
      next: (result) => {
        if (result.draft && !result.isArtistPage) {
          this.saveImportedSongDraft(result.draft, true);
        } else {
          this.finishCompactImport(false, result.message || 'לא הצלחנו לשלוף מספיק פרטים לשמירת טיוטה.');
        }

        this.processArtistSongUrlQueue(songUrls, index + 1);
      },
      error: (error) => {
        const result = error.error as ImportSongFromUrlResponse | undefined;

        if (result?.draft && !result.isArtistPage) {
          this.saveImportedSongDraft(result.draft, true);
        } else {
          this.finishCompactImport(false, result?.message || 'שליפת אחד השירים מעמוד האמן נכשלה.');
        }

        this.processArtistSongUrlQueue(songUrls, index + 1);
      }
    });
  }

  private saveImportedSongDraft(draft: ImportedSongDraft, backgroundCompact = false): void {
    const normalizedDraft = this.normalizeDraftForForm(draft);
    const request: AddSongRequest = {
      title: normalizedDraft.title,
      artists: normalizedDraft.artists,
      youtubeUrl: normalizedDraft.youtubeUrl,
      imageUrl: normalizedDraft.imageUrl || undefined,
      tags: normalizedDraft.tags || [],
      genres: [],
      lyricsWithChords: normalizedDraft.lyricsWithChords,
      originalKeyId: normalizedDraft.originalKeyId || 1,
      easyKeyId: normalizedDraft.easyKeyId || undefined,
      isApproved: false
    };

    this.songService.addSong(request).subscribe({
      next: () => {
        if (backgroundCompact) {
          this.finishCompactImport(true);
          this.modalService.notifySongUpdated();
          return;
        }

        this.importUrl = '';
        this.importState = 'idle';
        this.successMessage = 'השיר נשמר כטיוטה וממתין לעריכה';
        this.modalService.notifySongUpdated();
      },
      error: (error) => {
        if (backgroundCompact) {
          this.finishCompactImport(false, error?.error?.message || 'שמירת הטיוטה נכשלה.');
          return;
        }

        this.importState = 'error';
        this.errorMessage = error?.error?.message || 'השליפה הצליחה, אבל שמירת הטיוטה נכשלה.';
      }
    });
  }

  private finishCompactImport(saved: boolean, message?: string): void {
    this.activeCompactImports = Math.max(0, this.activeCompactImports - 1);

    if (saved) {
      this.compactImportsSaved += 1;
    } else {
      this.compactImportsFailed += 1;
      this.errorMessage = message || 'שליפה אחת נכשלה.';
    }

    this.importState = this.compactImportsFailed > 0 ? 'error' : 'idle';

    if (this.activeCompactImports > 0) {
      this.successMessage = `נשמרו ${this.compactImportsSaved} טיוטות. ${this.activeCompactImports} שליפות עדיין רצות ברקע.`;
      return;
    }

    this.successMessage = this.compactImportsSaved > 0
      ? `נשמרו ${this.compactImportsSaved} טיוטות.`
      : '';
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
