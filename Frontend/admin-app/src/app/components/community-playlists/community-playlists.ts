import { AfterViewChecked, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { PlaylistService } from '../../services/playlist.service';
import { Playlist } from '../../models/playlist.model';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-community-playlists',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './community-playlists.html',
  styleUrls: ['./community-playlists.css']
})
export class CommunityPlaylistsComponent implements OnInit, AfterViewChecked, OnDestroy {

  @ViewChild('heroBox') heroBox!: ElementRef<HTMLDivElement>;
  @ViewChild('heroContent') heroContent!: ElementRef<HTMLDivElement>;

  private fullHeroHeight = 0;
  private heroLayoutDone = false;
  private rafPending = false;

  playlists: Playlist[] = [];
  filteredPlaylists: Playlist[] = [];
  searchTerm: string = '';
  isLoading = false;
  isLoadingMore = false;
  hasNextPage = false;
  totalCount = 0;
  private currentPage = 1;
  private readonly pageSize = 20;
  error: string | null = null;

  private normalizePagedResult(result: any): { items: Playlist[]; hasNextPage: boolean; totalCount: number } {
    if (Array.isArray(result)) {
      return {
        items: result,
        hasNextPage: false,
        totalCount: result.length
      };
    }

    const items = result?.items ?? result?.Items ?? [];
    const totalCount = result?.totalCount ?? result?.TotalCount ?? items.length;

    return {
      items,
      hasNextPage: result?.hasNextPage ?? result?.HasNextPage ?? false,
      totalCount
    };
  }

  private readonly langService = inject(LanguageService);

  constructor(
    private playlistService: PlaylistService,
    private router: Router,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadPublicPlaylists();
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

  loadPublicPlaylists(): void {
    this.isLoading = true;
    this.error = null;
    this.heroLayoutDone = false;
    this.currentPage = 1;

    this.playlistService.getPublicPlaylists(1, this.pageSize).subscribe({
      next: (result) => {
        const normalized = this.normalizePagedResult(result);
        this.playlists = normalized.items;
        this.filteredPlaylists = this.playlists;
        this.hasNextPage = normalized.hasNextPage;
        this.totalCount = normalized.totalCount;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading public playlists:', err);
        this.error = err?.message || err?.error?.message || this.langService.translate('community.error_load');
        this.isLoading = false;
      }
    });
  }

  loadMore(): void {
    if (!this.hasNextPage || this.isLoadingMore) return;

    this.isLoadingMore = true;
    this.currentPage++;

    this.playlistService.getPublicPlaylists(this.currentPage, this.pageSize).subscribe({
      next: (result) => {
        const normalized = this.normalizePagedResult(result);
        this.playlists = [...this.playlists, ...normalized.items];
        this.hasNextPage = normalized.hasNextPage;
        this.totalCount = normalized.totalCount;
        this.isLoadingMore = false;
        this.filterPlaylists();
      },
      error: (err) => {
        console.error('Error loading more playlists:', err);
        this.currentPage--;
        this.isLoadingMore = false;
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

  adoptPlaylist(id: number, event: Event): void {
    event.stopPropagation();

    if (confirm(this.langService.translate('community.confirm_adopt'))) {
      this.playlistService.adoptPlaylist(id).subscribe({
        next: () => {
          this.router.navigate(['/my-playlists']);
        },
        error: (err) => {
          console.error('Error adopting playlist:', err);
          alert(this.langService.translate('community.error_adopt'));
        }
      });
    }
  }
}
