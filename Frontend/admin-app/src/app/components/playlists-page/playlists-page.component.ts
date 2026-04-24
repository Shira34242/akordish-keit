import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LikedContent } from '../../models/liked-content.model';
import { Article, ArticleContentType, ArticleStatus } from '../../models/article.model';
import { CreatePlaylistDto, Playlist, PlaylistDetail, PlaylistSong } from '../../models/playlist.model';
import { LikedContentService } from '../../services/liked-content.service';
import { PlaylistService } from '../../services/playlist.service';
import { SongCardComponent } from '../shared/song-card/song-card.component';
import { NewsBannerComponent } from '../shared/news-banner/news-banner.component';

interface SavedSongCard {
  id: number;
  title: string;
  imageUrl?: string;
  artists: Array<{ name: string }>;
}

@Component({
  selector: 'app-playlists-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SongCardComponent, NewsBannerComponent],
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

  visibleSongCount = 8;
  visibleContentCount = 6;

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
    this.visibleSongCount = tab === 'songs' ? 8 : 4;
    this.visibleContentCount = tab === 'content' ? 6 : 3;
  }

  showMoreSongs(): void {
    this.visibleSongCount += 8;
  }

  showMoreContent(): void {
    this.visibleContentCount += 6;
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
        this.createPlaylistError = err?.error?.message || err?.message || 'שגיאה ביצירת הרשימה';
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

  mapPlaylistSongToCard(song: PlaylistSong): SavedSongCard {
    return {
      id: song.songId,
      title: song.songTitle,
      imageUrl: song.songImageUrl,
      artists: song.artistName ? [{ name: song.artistName }] : []
    };
  }

  getArticleBannerInput(item: LikedContent): Article {
    const contentType = item.contentType === 'BlogPost' ? ArticleContentType.Blog : ArticleContentType.News;

    return {
      id: item.contentId,
      title: item.title || '',
      subtitle: item.subtitle,
      content: '',
      featuredImageUrl: item.imageUrl || 'assets/default-article.png',
      publishDate: '',
      createdAt: '',
      authorName: '',
      categoryIds: [],
      categoryNames: [],
      contentType,
      slug: item.slug || '',
      shortDescription: item.subtitle,
      isFeatured: false,
      displayOrder: 0,
      status: ArticleStatus.Published,
      isPremium: false,
      viewCount: 0,
      likeCount: 0,
      tags: [],
      galleryImages: [],
      taggedArtists: []
    };
  }

  get totalSavedItems(): number {
    const savedSongs = this.defaultPlaylistDetail?.songs.length ?? 0;
    return savedSongs + this.likedContent.length;
  }

  get savedSongs(): PlaylistSong[] {
    return this.defaultPlaylistDetail?.songs ?? [];
  }

  get visibleSavedSongs(): PlaylistSong[] {
    return this.savedSongs.slice(0, this.visibleSongCount);
  }

  get visibleLikedContent(): LikedContent[] {
    return this.likedContent.slice(0, this.visibleContentCount);
  }

  get isEmptyState(): boolean {
    return (
      !this.isLoading &&
      !this.error &&
      this.savedSongs.length === 0 &&
      this.likedContent.length === 0 &&
      this.personalPlaylists.length === 0
    );
  }
}
