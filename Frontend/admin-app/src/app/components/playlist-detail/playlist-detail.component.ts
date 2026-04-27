import { AfterViewChecked, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PlaylistService } from '../../services/playlist.service';
import { PlaylistDetail, UpdatePlaylistDto } from '../../models/playlist.model';
import { AuthService } from '../../services/auth.service';
import { ChordBookPanelComponent } from './chord-book-panel/chord-book-panel.component';

@Component({
  selector: 'app-playlist-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ChordBookPanelComponent],
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

  showChordBook = false;

  editingImage = false;
  pendingImageUrl = '';
  isSavingImage = false;

  isTogglingPublic = false;

  get thumbnailSlots(): (string | null)[] {
    if (this.playlist?.imageUrl) return [];
    const images = (this.playlist?.songs || [])
      .slice(0, 4)
      .map(s => s.songImageUrl || null);
    if (images.every(s => s === null)) return [];
    while (images.length < 4) images.push(null);
    return images;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private playlistService: PlaylistService,
    private authService: AuthService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.playlistId = +id;
        this.loadPlaylist();
      }
    });

    this.route.queryParams.subscribe(params => {
      if (params['chordBook'] === 'true') {
        this.showChordBook = true;
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
      this.editedName = this.playlist.name;
      this.editedDescription = this.playlist.description || '';
    }
  }

  saveEdit(): void {
    if (!this.editedName.trim()) return;

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
      }
    });
  }

  togglePublic(): void {
    if (!this.playlist || this.isTogglingPublic) return;
    this.isTogglingPublic = true;

    this.playlistService.updatePlaylist(this.playlistId, { isPublic: !this.playlist.isPublic }).subscribe({
      next: () => {
        if (this.playlist) this.playlist.isPublic = !this.playlist.isPublic;
        this.isTogglingPublic = false;
      },
      error: (err) => {
        console.error('Error toggling public:', err);
        this.isTogglingPublic = false;
      }
    });
  }

  openImageEdit(): void {
    this.editingImage = true;
    this.pendingImageUrl = this.playlist?.imageUrl || '';
  }

  cancelImageEdit(): void {
    this.editingImage = false;
    this.pendingImageUrl = '';
    this.isSavingImage = false;
  }

  savePlaylistImage(): void {
    this.isSavingImage = true;
    this.playlistService.updatePlaylist(this.playlistId, { imageUrl: this.pendingImageUrl || undefined }).subscribe({
      next: () => {
        if (this.playlist) this.playlist.imageUrl = this.pendingImageUrl || undefined;
        this.cancelImageEdit();
      },
      error: (err) => {
        console.error('Error updating image:', err);
        this.isSavingImage = false;
      }
    });
  }

  removeSong(songId: number): void {
    if (confirm('להסיר שיר זה מהרשימה?')) {
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
    if (confirm('למחוק את הרשימה לצמיתות?')) {
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
}
