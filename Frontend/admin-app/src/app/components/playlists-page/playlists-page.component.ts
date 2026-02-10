import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { PlaylistService } from '../../services/playlist.service';
import { Playlist } from '../../models/playlist.model';
import { LikedContentService } from '../../services/liked-content.service';
import { LikedContent } from '../../models/liked-content.model';

@Component({
  selector: 'app-playlists-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './playlists-page.component.html',
  styleUrls: ['./playlists-page.component.css']
})
export class PlaylistsPageComponent implements OnInit {
  playlists: Playlist[] = [];
  myPlaylists: Playlist[] = [];
  adoptedPlaylists: Playlist[] = [];
  likedContent: LikedContent[] = [];
  isLoading = false;
  isLoadingLiked = false;
  error: string | null = null;

  // Filter state
  activeFilter: 'all' | 'liked' | 'my-playlists' | 'adopted' | 'community' = 'all';

  constructor(
    private playlistService: PlaylistService,
    private likedContentService: LikedContentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadPlaylists();
    this.loadLikedContent();
  }

  loadPlaylists(): void {
    this.isLoading = true;
    this.error = null;

    this.playlistService.getMyPlaylists().subscribe({
      next: (playlists) => {
        this.playlists = playlists;
        // הפרדת רשימות רגילות מרשימות מאומצות
        this.myPlaylists = playlists.filter(p => !p.isAdopted);
        this.adoptedPlaylists = playlists.filter(p => p.isAdopted);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading playlists:', err);
        this.error = 'שגיאה בטעינת הרשימות';
        this.isLoading = false;
      }
    });
  }

  loadLikedContent(): void {
    this.isLoadingLiked = true;

    this.likedContentService.getUserLikedContent().subscribe({
      next: (content) => {
        this.likedContent = content;
        this.isLoadingLiked = false;
      },
      error: (err) => {
        console.error('Error loading liked content:', err);
        this.isLoadingLiked = false;
      }
    });
  }

  viewPlaylist(id: number): void {
    this.router.navigate(['/playlist', id]);
  }

  deletePlaylist(id: number, event: Event): void {
    event.stopPropagation();

    if (confirm('האם אתה בטוח שברצונך למחוק רשימה זו?')) {
      this.playlistService.deletePlaylist(id).subscribe({
        next: () => {
          this.playlists = this.playlists.filter(p => p.id !== id);
          this.myPlaylists = this.myPlaylists.filter(p => p.id !== id);
          this.adoptedPlaylists = this.adoptedPlaylists.filter(p => p.id !== id);
        },
        error: (err) => {
          console.error('Error deleting playlist:', err);
          alert('שגיאה במחיקת הרשימה');
        }
      });
    }
  }

  getPlaylistImage(playlist: Playlist): string | null {
    return playlist.imageUrl || null;
  }

  duplicatePlaylist(id: number, event: Event): void {
    event.stopPropagation();

    if (confirm('האם לשכפל רשימה זו? תיווצר עותק חדש ברשימות שלך')) {
      this.playlistService.duplicatePlaylist(id).subscribe({
        next: (duplicatedPlaylist) => {
          this.playlists.push(duplicatedPlaylist);
          // הוספה לרשימה המתאימה בהתאם לסטטוס
          if (duplicatedPlaylist.isAdopted) {
            this.adoptedPlaylists.push(duplicatedPlaylist);
          } else {
            this.myPlaylists.push(duplicatedPlaylist);
          }
          alert(`הרשימה "${duplicatedPlaylist.name}" שוכפלה בהצלחה! ✨`);
        },
        error: (err) => {
          console.error('Error duplicating playlist:', err);
          alert('שגיאה בשכפול הרשימה');
        }
      });
    }
  }

  viewLikedContent(content: LikedContent): void {
    // Navigate to the appropriate route based on content type
    if (content.contentType === 'Article') {
      if (content.slug) {
        this.router.navigate(['/news', content.slug]);
      } else {
        this.router.navigate(['/news', content.contentId]);
      }
    } else if (content.contentType === 'BlogPost') {
      if (content.slug) {
        this.router.navigate(['/blog', content.slug]);
      } else {
        this.router.navigate(['/blog', content.contentId]);
      }
    }
  }

  removeLikedContent(content: LikedContent, event: Event): void {
    event.stopPropagation();

    if (confirm('האם להסיר מהמועדפים?')) {
      this.likedContentService.removeLikedContent(content.contentType, content.contentId).subscribe({
        next: () => {
          this.likedContent = this.likedContent.filter(c =>
            !(c.contentType === content.contentType && c.contentId === content.contentId)
          );
        },
        error: (err) => {
          console.error('Error removing liked content:', err);
          alert('שגיאה בהסרת התוכן מהמועדפים');
        }
      });
    }
  }

  // Filter methods
  setFilter(filter: 'all' | 'liked' | 'my-playlists' | 'adopted' | 'community'): void {
    this.activeFilter = filter;
  }

  getTotalCount(): number {
    return this.myPlaylists.length + this.adoptedPlaylists.length + this.likedContent.length;
  }

  getMyPlaylistsCount(): number {
    return this.myPlaylists.length;
  }

  getAdoptedPlaylistsCount(): number {
    return this.adoptedPlaylists.length;
  }

  getLikedContentCount(): number {
    return this.likedContent.length;
  }

  // Get limited items for horizontal banners (max 10)
  getMyPlaylistsBanner(): Playlist[] {
    return this.myPlaylists.slice(0, 10);
  }

  getAdoptedPlaylistsBanner(): Playlist[] {
    return this.adoptedPlaylists.slice(0, 10);
  }

  getLikedContentBanner(): LikedContent[] {
    return this.likedContent.slice(0, 10);
  }

  shouldShowBanner(): boolean {
    return this.activeFilter === 'all';
  }

  shouldShowGridForCategory(category: 'liked' | 'my-playlists' | 'adopted'): boolean {
    return this.activeFilter === category;
  }

  navigateToCommunity(): void {
    this.router.navigate(['/community-playlists']);
  }
}
