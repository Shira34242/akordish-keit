import { AfterViewChecked, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PlaylistService } from '../../services/playlist.service';
import { PlaylistDetail, UpdatePlaylistDto } from '../../models/playlist.model';
import { AuthService } from '../../services/auth.service';
import { MediaService } from '../../services/admin/media.service';
import { ChordBookPanelComponent } from './chord-book-panel/chord-book-panel.component';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { RewardService, RewardWallet } from '../../services/reward.service';

@Component({
  selector: 'app-playlist-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ChordBookPanelComponent, TranslatePipe],
  templateUrl: './playlist-detail.component.html',
  styleUrls: ['./playlist-detail.component.css']
})
export class PlaylistDetailComponent implements OnInit, AfterViewChecked, OnDestroy {

  @ViewChild('heroBox') heroBox!: ElementRef<HTMLDivElement>;
  @ViewChild('heroContent') heroContent!: ElementRef<HTMLDivElement>;

  private fullHeroHeight = 0;
  private heroLayoutDone = false;
  private rafPending = false;

  playlistId!: number;
  playlist: PlaylistDetail | null = null;
  isLoading = false;
  error: string | null = null;

  isEditing = false;
  editedName = '';
  editedDescription = '';
  editedIsPublic = false;
  editedImageUrl: string | undefined = undefined;

  showChordBook = false;
  showChordBookRestricted = false;

  isUploadingImage = false;
  imageUploadError: string | null = null;

  isSavingEdit = false;
  rewardWallet: RewardWallet | null = null;

  private readonly langService = inject(LanguageService);

  get thumbnailSlots(): (string | null)[] {
    if (this.displayedImageUrl) return [];
    const images = (this.playlist?.songs || [])
      .slice(0, 4)
      .map(s => s.songImageUrl || null);
    if (images.every(s => s === null)) return [];
    while (images.length < 4) images.push(null);
    return images;
  }

  get displayedImageUrl(): string | undefined {
    return this.isEditing ? this.editedImageUrl : this.playlist?.imageUrl;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private playlistService: PlaylistService,
    private authService: AuthService,
    private rewardService: RewardService,
    private mediaService: MediaService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.rewardService.getMyWallet().subscribe({ next: wallet => this.rewardWallet = wallet });
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.playlistId = +id;
        this.loadPlaylist();
      }
    });

    this.route.queryParams.subscribe(params => {
      if (params['chordBook'] === 'true') {
        if (this.canUseChordBook()) {
          this.showChordBook = true;
        } else {
          this.showChordBookRestricted = true;
        }
      }
    });

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
    });
  }

  ngAfterViewChecked(): void {
    if (!this.heroLayoutDone && this.heroContent?.nativeElement && this.heroBox?.nativeElement) {
      this.updateHeroLayout();
      this.heroLayoutDone = true;
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.onScroll);
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

  private updateHeroLayout(): void {
    const box = this.heroBox?.nativeElement;
    const content = this.heroContent?.nativeElement;
    if (!box || !content) return;
    const rect = content.getBoundingClientRect();
    const h = Math.round(rect.bottom - 8 + window.scrollY);
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

  loadPlaylist(): void {
    this.isLoading = true;
    this.error = null;
    this.heroLayoutDone = false;

    this.playlistService.getPlaylistById(this.playlistId).subscribe({
      next: (playlist) => {
        this.playlist = playlist;
        if (!this.isEditing) {
          this.syncEditedFromPlaylist();
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading playlist:', err);
        this.error = this.langService.translate('playlist.error_load');
        this.isLoading = false;
      }
    });
  }

  private syncEditedFromPlaylist(): void {
    if (!this.playlist) return;
    this.editedName = this.playlist.name;
    this.editedDescription = this.playlist.description || '';
    this.editedIsPublic = this.playlist.isPublic;
    this.editedImageUrl = this.playlist.imageUrl;
  }

  enterEdit(): void {
    this.syncEditedFromPlaylist();
    this.imageUploadError = null;
    this.isEditing = true;
  }

  cancelEdit(): void {
    this.isEditing = false;
    this.imageUploadError = null;
    this.isUploadingImage = false;
    this.syncEditedFromPlaylist();
  }

  setEditedIsPublic(value: boolean): void {
    if (this.isSavingEdit) return;
    this.editedIsPublic = value;
  }

  saveEdit(): void {
    if (!this.editedName.trim() || this.isSavingEdit || this.isUploadingImage) return;

    const dto: UpdatePlaylistDto = {
      name: this.editedName.trim(),
      description: this.editedDescription.trim() || '',
      isPublic: this.editedIsPublic,
      imageUrl: this.editedImageUrl ?? ''
    };

    this.isSavingEdit = true;
    this.playlistService.updatePlaylist(this.playlistId, dto).subscribe({
      next: () => {
        this.isSavingEdit = false;
        this.isEditing = false;
        this.loadPlaylist();
      },
      error: (err) => {
        console.error('Error updating playlist:', err);
        this.isSavingEdit = false;
      }
    });
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.imageUploadError = this.langService.translate('playlist.error_image_type');
      input.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.imageUploadError = this.langService.translate('playlist.error_image_size');
      input.value = '';
      return;
    }

    this.imageUploadError = null;
    this.isUploadingImage = true;

    this.mediaService.uploadMedia(file).subscribe({
      next: (res) => {
        this.editedImageUrl = res.url;
        this.isUploadingImage = false;
        input.value = '';
      },
      error: (err) => {
        console.error('Error uploading image:', err);
        this.imageUploadError = err?.error?.message || this.langService.translate('playlist.error_image_upload');
        this.isUploadingImage = false;
        input.value = '';
      }
    });
  }

  clearEditedImage(): void {
    if (this.isUploadingImage) return;
    this.editedImageUrl = undefined;
    this.imageUploadError = null;
  }

  removeSong(songId: number): void {
    if (confirm(this.langService.translate('playlist.confirm_remove'))) {
      this.playlistService.removeSongFromPlaylist(this.playlistId, songId).subscribe({
        next: () => this.loadPlaylist(),
        error: (err) => console.error('Error removing song:', err)
      });
    }
  }

  goToSong(songId: number): void {
    this.router.navigate(['/song', songId], {
      queryParams: { playlistId: this.playlistId }
    });
  }

  deletePlaylist(): void {
    if (confirm(this.langService.translate('playlist.confirm_delete'))) {
      this.playlistService.deletePlaylist(this.playlistId).subscribe({
        next: () => this.router.navigate(['/my-playlists']),
        error: (err) => console.error('Error deleting playlist:', err)
      });
    }
  }

  getDefaultImage(): string {
    return '/logo.png';
  }

  isOwner(): boolean {
    const currentUser = this.authService.currentUserValue;
    return !!(currentUser && this.playlist && currentUser.id === this.playlist.userId);
  }

  canUseChordBook(): boolean {
    return this.rewardWallet?.isAvailable === true;
  }

  dismissChordBookRestricted(): void {
    this.showChordBookRestricted = false;
  }
}
