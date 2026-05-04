import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LikedContent } from '../../models/liked-content.model';
import { Article, ArticleContentType, ArticleStatus } from '../../models/article.model';
import { CreatePlaylistDto, Playlist, PlaylistDetail, PlaylistSong } from '../../models/playlist.model';
import { LikedContentService } from '../../services/liked-content.service';
import { PlaylistService } from '../../services/playlist.service';
import { SongCardComponent } from '../shared/song-card/song-card.component';
import { NewsBannerComponent } from '../shared/news-banner/news-banner.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

interface SavedSongCard {
  id: number;
  title: string;
  imageUrl?: string;
  artists: Array<{ name: string }>;
}

@Component({
  selector: 'app-playlists-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SongCardComponent, NewsBannerComponent, TranslatePipe],
  templateUrl: './playlists-page.component.html',
  styleUrls: ['./playlists-page.component.css']
})
export class PlaylistsPageComponent implements OnInit, AfterViewChecked, OnDestroy {

  @ViewChild('heroBox') heroBox!: ElementRef<HTMLDivElement>;
  @ViewChild('heroContent') heroContent!: ElementRef<HTMLDivElement>;

  private readonly langService = inject(LanguageService);
  private fullHeroHeight = 0;
  private heroLayoutDone = false;
  private rafPending = false;

  playlists: Playlist[] = [];
  defaultPlaylist: Playlist | null = null;
  defaultPlaylistDetail: PlaylistDetail | null = null;
  personalPlaylists: Playlist[] = [];
  likedContent: LikedContent[] = [];

  isLoading = false;
  error: string | null = null;
  isCreatingPlaylist = false;
  isSavingPlaylist = false;
  createPlaylistError: string | null = null;
  newPlaylistName = '';
  newPlaylistIsPublic = true;

  openDotsMenuId: number | null = null;
  editingImageId: number | null = null;
  pendingImageUrl = '';
  isSavingImage = false;

  visibleSongCount = 8;
  visibleContentCount = 6;

  constructor(
    private playlistService: PlaylistService,
    private likedContentService: LikedContentService,
    private router: Router,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadPageData();

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });
    document.addEventListener('click', this.onDocumentClick);
  }

  ngAfterViewChecked(): void {
    if (!this.heroLayoutDone && this.heroContent?.nativeElement && this.heroBox?.nativeElement) {
      this.updateHeroLayout();
      this.heroLayoutDone = true;
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
    document.removeEventListener('click', this.onDocumentClick);
  }

  private onScroll = () => {
    if (!this.rafPending) {
      this.rafPending = true;
      requestAnimationFrame(() => {
        this.shrinkHero();
        this.rafPending = false;
      });
    }
  };

  private onDocumentClick = () => {
    if (this.openDotsMenuId !== null) {
      this.ngZone.run(() => { this.openDotsMenuId = null; });
    }
  };

  private updateHeroLayout(): void {
    const box = this.heroBox?.nativeElement;
    const content = this.heroContent?.nativeElement;
    if (!box || !content) return;
    const contentRect = content.getBoundingClientRect();
    const boxTop = 8;
    const h = Math.round(contentRect.bottom - boxTop + window.scrollY);
    this.fullHeroHeight = h;
    box.style.height = h + 'px';
    this.shrinkHero();
  }

  private shrinkHero(): void {
    const box = this.heroBox?.nativeElement;
    if (!box || this.fullHeroHeight === 0) return;
    const minH = window.innerWidth <= 600 ? 44 : 56;
    const newH = Math.max(minH, this.fullHeroHeight - window.scrollY);
    box.style.height = newH + 'px';

    const content = this.heroContent?.nativeElement;
    if (content) {
      const fade = Math.min(1, window.scrollY / 140);
      content.style.opacity = String(1 - fade);
    }
  }

  loadPageData(): void {
    this.isLoading = true;
    this.error = null;
    this.heroLayoutDone = false;

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
        this.error = err?.message || err?.error?.message || this.langService.translate('playlists.error_load');
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

  showMoreSongs(): void {
    this.visibleSongCount += 8;
  }

  showMoreContent(): void {
    this.visibleContentCount += 6;
  }

  viewPlaylist(id: number): void {
    this.router.navigate(['/playlist', id]);
  }

  printPlaylist(id: number): void {
    this.router.navigate(['/playlist', id], { queryParams: { chordBook: 'true' } });
  }

  toggleDotsMenu(id: number, event: Event): void {
    event.stopPropagation();
    this.openDotsMenuId = this.openDotsMenuId === id ? null : id;
  }

  openImageEdit(id: number, currentUrl: string | undefined, event: Event): void {
    event.stopPropagation();
    this.openDotsMenuId = null;
    this.editingImageId = id;
    this.pendingImageUrl = currentUrl || '';
    this.isSavingImage = false;
  }

  cancelImageEdit(): void {
    this.editingImageId = null;
    this.pendingImageUrl = '';
    this.isSavingImage = false;
  }

  savePlaylistImage(id: number): void {
    this.isSavingImage = true;
    this.playlistService.updatePlaylist(id, { imageUrl: this.pendingImageUrl || undefined }).subscribe({
      next: (updated) => {
        const idx = this.personalPlaylists.findIndex(p => p.id === id);
        if (idx >= 0) {
          this.personalPlaylists[idx] = { ...this.personalPlaylists[idx], imageUrl: updated.imageUrl };
        }
        this.cancelImageEdit();
      },
      error: (err) => {
        console.error('Error updating image:', err);
        this.isSavingImage = false;
      }
    });
  }

  getSongGridImages(playlist: Playlist): string[] {
    if (playlist.imageUrl) return [];
    return (playlist.thumbnailSongImages || []).slice(0, 4);
  }

  getSongGridSlots(playlist: Playlist): (string | null)[] {
    const images = this.getSongGridImages(playlist);
    const slots: (string | null)[] = [...images];
    while (slots.length < 4) slots.push(null);
    return slots;
  }

  duplicatePlaylist(id: number): void {
    this.openDotsMenuId = null;
    this.playlistService.duplicatePlaylist(id).subscribe({
      next: (newPlaylist) => {
        this.personalPlaylists = [newPlaylist, ...this.personalPlaylists];
      },
      error: (err) => {
        console.error('Error duplicating playlist:', err);
      }
    });
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
      this.createPlaylistError = this.langService.translate('playlists.error_name');
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
        this.createPlaylistError = err?.error?.message || err?.message || this.langService.translate('playlists.error_create');
      }
    });
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
    this.openDotsMenuId = null;

    if (!confirm(this.langService.translate('playlists.confirm_delete'))) {
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
      tagIds: [],
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
