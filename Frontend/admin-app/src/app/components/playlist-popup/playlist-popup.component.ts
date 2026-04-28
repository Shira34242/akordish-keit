import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CreatePlaylistDto, Playlist, SongPlaylistState } from '../../models/playlist.model';
import { PlaylistService } from '../../services/playlist.service';

@Component({
  selector: 'app-playlist-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './playlist-popup.component.html',
  styleUrls: ['./playlist-popup.component.css']
})
export class PlaylistPopupComponent implements OnInit {
  @Input() songId!: number;
  @Input() autoSaveToDefault = false;
  @Output() close = new EventEmitter<void>();
  @Output() songSaved = new EventEmitter<void>();

  defaultPlaylist: Playlist | null = null;
  personalPlaylists: Playlist[] = [];
  songState: SongPlaylistState = { isInDefault: false, playlistIds: [] };
  selectedPlaylistIds = new Set<number>();

  isLoading = false;
  isCreatingNew = false;
  newPlaylistName = '';
  newPlaylistIsPublic = true;
  error: string | null = null;
  successMessage: string | null = null;

  constructor(private playlistService: PlaylistService) {}

  ngOnInit(): void {
    this.loadPopupData();
  }

  loadPopupData(): void {
    this.isLoading = true;
    this.error = null;

    this.playlistService.getMyPlaylists().subscribe({
      next: (playlists) => {
        this.defaultPlaylist = playlists.find(p => p.isDefault) ?? null;
        this.personalPlaylists = playlists.filter(p => !p.isDefault && !p.isAdopted);
        this.loadSongState();
      },
      error: (err) => {
        console.error('Error loading playlists:', err);
        this.error = err?.message || err?.error?.message || 'שגיאה בטעינת הרשימות';
        this.isLoading = false;
      }
    });
  }

  loadSongState(): void {
    this.playlistService.getSongPlaylistState(this.songId).subscribe({
      next: (state) => {
        this.songState = state;
        this.selectedPlaylistIds = new Set(state.playlistIds);

        if (this.autoSaveToDefault && !state.isInDefault) {
          this.saveToDefaultAndStayOpen();
          return;
        }

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading song state:', err);
        this.error = err?.message || err?.error?.message || 'שגיאה בטעינת מצב השמירה';
        this.isLoading = false;
      }
    });
  }

  saveToDefaultAndStayOpen(): void {
    this.playlistService.saveToDefaultPlaylist(this.songId).subscribe({
      next: () => {
        this.songState.isInDefault = true;
        this.successMessage = 'השיר נשמר ב"השמורים שלי"';
        this.songSaved.emit();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error saving to default playlist:', err);
        this.error =
          err.status === 400
            ? 'השיר כבר שמור ב"השמורים שלי"'
            : err?.message || err?.error?.message || 'שגיאה בשמירת השיר';
        this.isLoading = false;
      }
    });
  }

  onDefaultToggle(): void {
    this.error = null;
    if (this.songState.isInDefault) {
      this.playlistService.removeFromDefaultPlaylist(this.songId, false).subscribe({
        next: () => {
          this.songState.isInDefault = false;
          this.songSaved.emit();
        },
        error: (err) => {
          console.error('Error removing from default:', err);
          this.error = err?.message || err?.error?.message || 'לא ניתן להסיר את השיר';
        }
      });
    } else {
      this.playlistService.saveToDefaultPlaylist(this.songId).subscribe({
        next: () => {
          this.songState.isInDefault = true;
          this.songSaved.emit();
        },
        error: (err) => {
          console.error('Error saving to default:', err);
          this.error = err?.message || err?.error?.message || 'לא ניתן לשמור את השיר';
        }
      });
    }
  }

  onPlaylistToggle(playlistId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.error = null;
    this.successMessage = null;

    if (checked) {
      this.playlistService.addSongToPlaylist(playlistId, this.songId).subscribe({
        next: () => {
          this.selectedPlaylistIds.add(playlistId);
          this.songSaved.emit();
          if (!this.songState.isInDefault) {
            this.playlistService.saveToDefaultPlaylist(this.songId).subscribe({
              next: () => { this.songState.isInDefault = true; },
              error: () => {}
            });
          }
        },
        error: (err) => {
          console.error('Error adding song to playlist:', err);
          this.error = err?.error?.message || err?.message || 'לא ניתן להוסיף את השיר לרשימה';
          (event.target as HTMLInputElement).checked = false;
        }
      });
      return;
    }

    this.playlistService.removeSongFromPlaylist(playlistId, this.songId).subscribe({
      next: () => {
        this.selectedPlaylistIds.delete(playlistId);
      },
      error: (err) => {
        console.error('Error removing song from playlist:', err);
        this.error = err?.message || err?.error?.message || 'לא ניתן להסיר את השיר מהרשימה';
        (event.target as HTMLInputElement).checked = true;
      }
    });
  }

  toggleCreateNew(): void {
    this.isCreatingNew = !this.isCreatingNew;
    this.newPlaylistName = '';
    this.newPlaylistIsPublic = true;
    this.error = null;
    this.successMessage = null;
  }

  createNewPlaylist(): void {
    if (!this.newPlaylistName.trim()) {
      this.error = 'יש להזין שם לרשימה';
      return;
    }

    const dto: CreatePlaylistDto = {
      name: this.newPlaylistName.trim(),
      isPublic: this.newPlaylistIsPublic
    };

    this.playlistService.createPlaylist(dto).subscribe({
      next: (playlist) => {
        this.personalPlaylists = [playlist, ...this.personalPlaylists];
        this.isCreatingNew = false;
        this.newPlaylistName = '';
        this.successMessage = 'הרשימה נוצרה בהצלחה';

        this.playlistService.addSongToPlaylist(playlist.id, this.songId).subscribe({
          next: () => {
            this.selectedPlaylistIds.add(playlist.id);
            this.songSaved.emit();
          },
          error: (err) => {
            console.error('Error adding song to newly created playlist:', err);
            this.error =
              err?.message || err?.error?.message || 'הרשימה נוצרה אבל לא הצלחנו להוסיף אליה את השיר';
          }
        });
      },
      error: (err) => {
        console.error('Error creating playlist:', err);
        this.error = err?.error?.message || err?.message || 'שגיאה ביצירת הרשימה';
      }
    });
  }

  closePopup(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closePopup();
    }
  }

  isSelected(playlistId: number): boolean {
    return this.selectedPlaylistIds.has(playlistId);
  }
}
