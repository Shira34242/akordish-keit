import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PlaylistService } from '../../services/playlist.service';
import { PlaylistDetail, PlaylistSong, UpdatePlaylistDto } from '../../models/playlist.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-playlist-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './playlist-detail.component.html',
  styleUrls: ['./playlist-detail.component.css']
})
export class PlaylistDetailComponent implements OnInit {
  playlistId!: number;
  playlist: PlaylistDetail | null = null;
  isLoading = false;
  error: string | null = null;
  isEditing = false;
  editedName = '';
  editedDescription = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private playlistService: PlaylistService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.playlistId = +id;
        this.loadPlaylist();
      }
    });
  }

  loadPlaylist(): void {
    this.isLoading = true;
    this.error = null;

    this.playlistService.getPlaylistById(this.playlistId).subscribe({
      next: (playlist) => {
        this.playlist = playlist;
        this.editedName = playlist.name;
        this.editedDescription = playlist.description || '';
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading playlist:', err);
        this.error = 'שגיאה בטעינת הרשימה';
        this.isLoading = false;
      }
    });
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
    if (!this.isEditing && this.playlist) {
      // Reset to original values
      this.editedName = this.playlist.name;
      this.editedDescription = this.playlist.description || '';
    }
  }

  saveEdit(): void {
    if (!this.editedName.trim()) {
      alert('יש להזין שם לרשימה');
      return;
    }

    const dto: UpdatePlaylistDto = {
      name: this.editedName.trim(),
      description: this.editedDescription.trim() || undefined
    };

    this.playlistService.updatePlaylist(this.playlistId, dto).subscribe({
      next: () => {
        this.isEditing = false;
        this.loadPlaylist();
      },
      error: (err) => {
        console.error('Error updating playlist:', err);
        alert('שגיאה בעדכון הרשימה');
      }
    });
  }

  removeSong(songId: number): void {
    if (confirm('האם אתה בטוח שברצונך להסיר שיר זה מהרשימה?')) {
      this.playlistService.removeSongFromPlaylist(this.playlistId, songId).subscribe({
        next: () => {
          this.loadPlaylist();
        },
        error: (err) => {
          console.error('Error removing song:', err);
          alert('שגיאה בהסרת השיר');
        }
      });
    }
  }

  goToSong(songId: number): void {
    this.router.navigate(['/song', songId]);
  }

  deletePlaylist(): void {
    if (confirm('האם אתה בטוח שברצונך למחוק רשימה זו לצמיתות?')) {
      this.playlistService.deletePlaylist(this.playlistId).subscribe({
        next: () => {
          this.router.navigate(['/my-playlists']);
        },
        error: (err) => {
          console.error('Error deleting playlist:', err);
          alert('שגיאה במחיקת הרשימה');
        }
      });
    }
  }

  getDefaultImage(): string {
    return 'public/logo.png';
  }

  isOwner(): boolean {
    const currentUser = this.authService.currentUserValue;
    return !!(currentUser && this.playlist && currentUser.id === this.playlist.userId);
  }
}
