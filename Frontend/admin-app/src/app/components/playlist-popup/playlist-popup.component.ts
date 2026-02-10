import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PlaylistService } from '../../services/playlist.service';
import { Playlist, CreatePlaylistDto } from '../../models/playlist.model';

@Component({
  selector: 'app-playlist-popup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './playlist-popup.component.html',
  styleUrls: ['./playlist-popup.component.css']
})
export class PlaylistPopupComponent implements OnInit {
  @Input() songId!: number;
  @Output() close = new EventEmitter<void>();

  recentPlaylists: Playlist[] = [];
  isLoading = false;
  isCreatingNew = false;
  newPlaylistName = '';
  newPlaylistIsPublic = true;  // ברירת מחדל: ציבורי
  error: string | null = null;
  successMessage: string | null = null;

  constructor(private playlistService: PlaylistService) {}

  ngOnInit(): void {
    this.loadRecentPlaylists();
  }

  loadRecentPlaylists(): void {
    this.isLoading = true;
    this.playlistService.getRecentPlaylists().subscribe({
      next: (playlists) => {
        this.recentPlaylists = playlists;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading playlists:', err);
        this.error = 'שגיאה בטעינת הרשימות';
        this.isLoading = false;
      }
    });
  }

  addToPlaylist(playlistId: number): void {
    this.error = null;
    this.successMessage = null;

    this.playlistService.addSongToPlaylist(playlistId, this.songId).subscribe({
      next: () => {
        this.successMessage = 'השיר נוסף לרשימה בהצלחה!';
        setTimeout(() => {
          this.closePopup();
        }, 1500);
      },
      error: (err) => {
        console.error('Error adding song to playlist:', err);
        if (err.status === 400) {
          this.error = 'השיר כבר קיים ברשימה זו';
        } else {
          this.error = 'שגיאה בהוספת השיר לרשימה';
        }
      }
    });
  }

  toggleCreateNew(): void {
    this.isCreatingNew = !this.isCreatingNew;
    this.newPlaylistName = '';
    this.newPlaylistIsPublic = true;  // איפוס לברירת מחדל
    this.error = null;
    this.successMessage = null;
  }

  createNewPlaylist(): void {
    if (!this.newPlaylistName.trim()) {
      this.error = 'יש להזין שם לרשימה';
      return;
    }

    this.error = null;
    this.successMessage = null;

    const dto: CreatePlaylistDto = {
      name: this.newPlaylistName.trim(),
      isPublic: this.newPlaylistIsPublic
    };

    this.playlistService.createPlaylist(dto).subscribe({
      next: (playlist) => {
        this.successMessage = 'הרשימה נוצרה בהצלחה!';
        // הוספת השיר לרשימה החדשה
        this.addToPlaylist(playlist.id);
      },
      error: (err) => {
        console.error('Error creating playlist:', err);
        this.error = 'שגיאה ביצירת הרשימה';
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
}
