import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LikedContent } from '../../models/liked-content.model';
import { CreatePlaylistDto, Playlist, PlaylistDetail } from '../../models/playlist.model';
import { LikedContentService } from '../../services/liked-content.service';
import { PlaylistService } from '../../services/playlist.service';

@Component({
  selector: 'app-playlists-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './playlists-page.component.html',
  styleUrls: ['./playlists-page.component.css']
})
export class PlaylistsPageComponent implements OnInit {
  playlists: Playlist[] = [];
  defaultPlaylist: Playlist | null = null;
  defaultPlaylistDetail: PlaylistDetail | null = null;
  personalPlaylists: Playlist[] = [];
  likedContent: LikedContent[] = [];

  isLoading = false;
  error: string | null = null;
  activeTab: 'all' | 'songs' | 'content' = 'all';
  isCreatingPlaylist = false;
  isSavingPlaylist = false;
  createPlaylistError: string | null = null;
  newPlaylistName = '';
  newPlaylistIsPublic = true;

  constructor(
    private playlistService: PlaylistService,
    private likedContentService: LikedContentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPageData();
  }

  loadPageData(): void {
    this.isLoading = true;
    this.error = null;

    this.playlistService.getMyPlaylists().subscribe({
      next: (playlists) => {
        this.playlists = playlists;
        this.defaultPlaylist = playlists.find((playlist) => playlist.isDefault) || null;
        this.personalPlaylists = playlists.filter((playlist) => !playlist.isDefault && !playlist.isAdopted);

        if (this.defaultPlaylist) {
          this.playlistService.getPlaylistById(this.defaultPlaylist.id).subscribe({
            next: (playlistDetail) => {
              this.defaultPlaylistDetail = playlistDetail;
              this.loadLikedContent();
            },
            error: () => {
              this.defaultPlaylistDetail = null;
              this.loadLikedContent();
            }
          });
          return;
        }

        this.loadLikedContent();
      },
      error: (err) => {
        console.error('Error loading playlists:', err);
        this.error = err?.message || err?.error?.message || 'שגיאה בטעינת הרשימות';
        this.isLoading = false;
      }
    });
  }

  loadLikedContent(): void {
    this.likedContentService.getUserLikedContent().subscribe({
      next: (content) => {
        this.likedContent = content;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading liked content:', err);
        this.likedContent = [];
        this.isLoading = false;
      }
    });
  }

  setTab(tab: 'all' | 'songs' | 'content'): void {
    this.activeTab = tab;
  }

  goToSong(songId: number): void {
    this.router.navigate(['/song', songId]);
  }

  viewPlaylist(id: number): void {
    this.router.navigate(['/playlist', id]);
  }

  createPlaylist(): void {
    this.isCreatingPlaylist = true;
    this.isSavingPlaylist = false;
    this.createPlaylistError = null;
    this.newPlaylistName = '';
    this.newPlaylistIsPublic = true;
  }

  cancelCreatePlaylist(): void {
    this.isCreatingPlaylist = false;
    this.isSavingPlaylist = false;
    this.createPlaylistError = null;
    this.newPlaylistName = '';
    this.newPlaylistIsPublic = true;
  }

  submitCreatePlaylist(): void {
    if (!this.newPlaylistName.trim()) {
      this.createPlaylistError = 'יש להזין שם לרשימה';
      return;
    }

    this.isSavingPlaylist = true;
    this.createPlaylistError = null;

    const dto: CreatePlaylistDto = {
      name: this.newPlaylistName.trim(),
      isPublic: this.newPlaylistIsPublic
    };

    this.playlistService.createPlaylist(dto).subscribe({
      next: (playlist) => {
        this.personalPlaylists = [playlist, ...this.personalPlaylists];
        this.playlists = this.defaultPlaylist
          ? [this.defaultPlaylist, ...this.personalPlaylists]
          : [...this.personalPlaylists];
        this.cancelCreatePlaylist();
      },
      error: (err) => {
        console.error('Error creating playlist:', err);
        this.isSavingPlaylist = false;
        this.createPlaylistError = err?.message || err?.error?.message || 'שגיאה ביצירת הרשימה';
      }
    });
  }

  viewLikedContent(content: LikedContent): void {
    if (content.contentType === 'Article' && content.slug) {
      this.router.navigate(['/news', content.slug]);
      return;
    }

    if (content.contentType === 'BlogPost' && content.slug) {
      this.router.navigate(['/blog', content.slug]);
    }
  }

  removeLikedContent(content: LikedContent, event: Event): void {
    event.stopPropagation();

    this.likedContentService.removeLikedContent(content.contentType, content.contentId).subscribe({
      next: () => {
        this.likedContent = this.likedContent.filter(
          (item) => !(item.contentType === content.contentType && item.contentId === content.contentId)
        );
      },
      error: (err) => {
        console.error('Error removing liked content:', err);
      }
    });
  }

  deletePlaylist(id: number, event: Event): void {
    event.stopPropagation();

    if (!confirm('למחוק את הרשימה?')) {
      return;
    }

    this.playlistService.deletePlaylist(id).subscribe({
      next: () => {
        this.personalPlaylists = this.personalPlaylists.filter((playlist) => playlist.id !== id);
        this.playlists = this.playlists.filter((playlist) => playlist.id !== id);
      },
      error: (err) => {
        console.error('Error deleting playlist:', err);
      }
    });
  }

  get totalSavedItems(): number {
    const savedSongs = this.defaultPlaylistDetail?.songs.length ?? 0;
    return savedSongs + this.likedContent.length;
  }

  get allPreviewSongs() {
    return this.defaultPlaylistDetail?.songs.slice(0, 6) ?? [];
  }

  get allPreviewContent() {
    return this.likedContent.slice(0, 6);
  }

  get allPreviewPlaylists() {
    return this.personalPlaylists.slice(0, 4);
  }
}
