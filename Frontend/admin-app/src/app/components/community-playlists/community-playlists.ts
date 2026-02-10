import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PlaylistService } from '../../services/playlist.service';
import { Playlist } from '../../models/playlist.model';

@Component({
  selector: 'app-community-playlists',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './community-playlists.html',
  styleUrls: ['./community-playlists.css']
})
export class CommunityPlaylistsComponent implements OnInit {
  playlists: Playlist[] = [];
  filteredPlaylists: Playlist[] = [];
  searchTerm: string = '';
  isLoading = false;
  error: string | null = null;

  constructor(
    private playlistService: PlaylistService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPublicPlaylists();
  }

  loadPublicPlaylists(): void {
    this.isLoading = true;
    this.error = null;

    this.playlistService.getPublicPlaylists().subscribe({
      next: (playlists) => {
        this.playlists = playlists;
        this.filteredPlaylists = playlists;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading public playlists:', err);
        this.error = 'שגיאה בטעינת רשימות המאגר הקהילתי';
        this.isLoading = false;
      }
    });
  }

  filterPlaylists(): void {
    if (!this.searchTerm.trim()) {
      this.filteredPlaylists = this.playlists;
      return;
    }

    const term = this.searchTerm.toLowerCase().trim();
    this.filteredPlaylists = this.playlists.filter(playlist =>
      playlist.name.toLowerCase().includes(term) ||
      (playlist.description && playlist.description.toLowerCase().includes(term))
    );
  }

  viewPlaylist(id: number): void {
    this.router.navigate(['/playlist', id]);
  }

  getPlaylistImage(playlist: Playlist): string | null {
    return playlist.imageUrl || null;
  }

  adoptPlaylist(id: number, event: Event): void {
    event.stopPropagation();

    if (confirm('האם לאמץ רשימה זו? תיווצר עותק ברשימות שלך')) {
      this.playlistService.adoptPlaylist(id).subscribe({
        next: (adoptedPlaylist) => {
        },
        error: (err) => {
          console.error('Error adopting playlist:', err);
          alert('שגיאה באימוץ הרשימה');
        }
      });
    }
  }
}
