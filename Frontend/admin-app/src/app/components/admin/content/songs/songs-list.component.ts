import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { SongService } from '../../../../services/song.service';
import { SongDto } from '../../../../models/song.model';
import { ModalService } from '../../../../services/modal.service';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { SiteAlertService } from '../../../../services/site-alert.service';


@Component({
  selector: 'app-songs-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent],
  templateUrl: './songs-list.component.html',
  styleUrls: ['./songs-list.component.css']
})
export class SongsListComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly songService = inject(SongService);
  private readonly router = inject(Router);
  private readonly modalService = inject(ModalService);

  // State
  songs: SongDto[] = [];
  loading = false;
  bulkActionLoading = false;
  selectedSongIds = new Set<number>();
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-songs-view') as 'list' | 'grid') || 'list';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-songs-view', mode); }

  // Pagination
  currentPage = 1;
  pageSize = 25;
  totalItems = 0;
  totalPages = 0;
  totalCount = 0;
  pageNumber = 1;
  hasPreviousPage = false;
  hasNextPage = false;

  // Filters
  searchTerm = '';
  selectedArtistId?: number;
  selectedGenreId?: number;
  selectedKeyId?: number;
  sortBy: string = 'date'; // date, views, name

  ngOnInit(): void {
    this.loadSongs();

    // האזנה לעדכוני שירים (הוספה/עריכה)
    this.modalService.songUpdated$.subscribe(() => {
      this.loadSongs();
    });
  }
  
  loadSongs(): void {
    this.loading = true;

    const search = this.searchTerm || undefined;
    const page = Number(this.currentPage);
    const pageSize = Number(this.pageSize);

    this.songService.getSongsForAdmin(
      search,
      page,
      pageSize,
      this.selectedArtistId,
      this.selectedGenreId,
      this.selectedKeyId,
      this.sortBy
    ).subscribe({
      next: (result: any) => {
        this.songs = result.songs || result.items || result.data || [];
        this.totalItems = result.totalCount || result.total || 0;
        this.totalPages = result.totalPages || Math.ceil(this.totalItems / this.pageSize);
        this.totalCount = this.totalItems;
        this.pageNumber = this.currentPage;
        this.hasPreviousPage = result.hasPreviousPage ?? (this.currentPage > 1);
        this.hasNextPage = result.hasNextPage ?? (this.currentPage < this.totalPages);
        this.clearSelection();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading songs:', error);
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadSongs();
  }

  onSortChange(): void {
    this.currentPage = 1;
    this.loadSongs();
  }

  get selectedCount(): number {
    return this.selectedSongIds.size;
  }

  get selectedSongIdsArray(): number[] {
    return Array.from(this.selectedSongIds);
  }

  get hasSelection(): boolean {
    return this.selectedSongIds.size > 0;
  }

  get allCurrentPageSelected(): boolean {
    return this.songs.length > 0 && this.songs.every(song => this.selectedSongIds.has(song.id));
  }

  isSelected(songId: number): boolean {
    return this.selectedSongIds.has(songId);
  }

  toggleSongSelection(songId: number, event?: Event): void {
    event?.stopPropagation();
    if (this.selectedSongIds.has(songId)) {
      this.selectedSongIds.delete(songId);
      return;
    }

    this.selectedSongIds.add(songId);
  }

  toggleSelectCurrentPage(): void {
    if (this.allCurrentPageSelected) {
      this.songs.forEach(song => this.selectedSongIds.delete(song.id));
      return;
    }

    this.songs.forEach(song => this.selectedSongIds.add(song.id));
  }

  clearSelection(): void {
    this.selectedSongIds.clear();
  }

  createNew(): void {
    // פתיחת המודאל של הוספת שיר
    this.modalService.openAddSongModal();
  }

  editSong(id: number): void {
    // טוען את השיר המלא ופותח את המודאל במצב עריכה (כולל לא מאושרים)
    this.songService.getSongByIdForAdmin(id).subscribe({
      next: (song) => {
        this.modalService.openEditSongModal(song);
      },
      error: (error) => {
        console.error('Error loading song:', error);
        alert('שגיאה בטעינת השיר');
      }
    });
  }

  async duplicateSong(song: SongDto): Promise<void> {
    if (await this.siteAlerts.confirm(`האם לשכפל את השיר "${song.title}"?`)) {
      this.songService.duplicateSong(song.id).subscribe({
        next: (duplicate) => {
          alert(`השיר "${duplicate.title}" שוכפל בהצלחה!`);
          this.loadSongs();
        },
        error: (err) => {
          console.error('שגיאה בשכפול שיר:', err);
          alert('שגיאה בשכפול השיר');
        }
      });
    }
  }

  async deleteSong(song: SongDto): Promise<void> {
    if (await this.siteAlerts.confirm(`האם אתה בטוח שברצונך למחוק את "${song.title}"?`)) {
      this.songService.deleteSong(song.id).subscribe({
        next: () => {
          this.loadSongs();
        },
        error: (error) => {
          console.error('Error deleting song:', error);
          alert('שגיאה במחיקת השיר');
        }
      });
    }
  }

  async toggleApproval(song: SongDto): Promise<void> {
    const action = song.isApproved ? 'לבטל אישור' : 'לאשר';
    if (await this.siteAlerts.confirm(`האם אתה בטוח שברצונך ${action} את "${song.title}"?`)) {
      const newStatus = !song.isApproved;
      this.songService.toggleApproval(song.id, newStatus).subscribe({
        next: () => {
          song.isApproved = newStatus;
        },
        error: (error) => {
          console.error('Error toggling approval:', error);
          alert('שגיאה בעדכון סטטוס האישור');
        }
      });
    }
  }

  async bulkDeleteSelected(): Promise<void> {
    const ids = this.selectedSongIdsArray;
    if (ids.length === 0) return;

    if (!await this.siteAlerts.confirm(`למחוק ${ids.length} שירים שנבחרו?`)) return;

    this.bulkActionLoading = true;
    forkJoin(ids.map(id => this.songService.deleteSong(id))).subscribe({
      next: () => {
        this.bulkActionLoading = false;
        this.loadSongs();
      },
      error: (error) => {
        console.error('Error deleting selected songs:', error);
        alert('שגיאה במחיקת השירים');
        this.bulkActionLoading = false;
      }
    });
  }

  async bulkDuplicateSelected(): Promise<void> {
    const ids = this.selectedSongIdsArray;
    if (ids.length === 0) return;

    if (!await this.siteAlerts.confirm(`לשכפל ${ids.length} שירים שנבחרו?`)) return;

    this.bulkActionLoading = true;
    forkJoin(ids.map(id => this.songService.duplicateSong(id))).subscribe({
      next: () => {
        this.bulkActionLoading = false;
        this.loadSongs();
      },
      error: (error) => {
        console.error('Error duplicating selected songs:', error);
        alert('שגיאה בשכפול השירים');
        this.bulkActionLoading = false;
      }
    });
  }

  async bulkSetApproval(isApproved: boolean): Promise<void> {
    const ids = this.selectedSongIdsArray;
    if (ids.length === 0) return;

    const action = isApproved ? 'לאשר' : 'להעביר לממתין';
    if (!await this.siteAlerts.confirm(`${action} ${ids.length} שירים שנבחרו?`)) return;

    this.bulkActionLoading = true;
    forkJoin(ids.map(id => this.songService.toggleApproval(id, isApproved))).subscribe({
      next: () => {
        this.bulkActionLoading = false;
        this.loadSongs();
      },
      error: (error) => {
        console.error('Error updating selected songs:', error);
        alert('שגיאה בעדכון השירים');
        this.bulkActionLoading = false;
      }
    });
  }

  viewSong(id: number): void {
    this.router.navigate(['/song', id]);
  }

  formatArtists(song: SongDto): string {
    return song.artists?.map(a => a.name).join(', ') || '';
  }

  formatGenres(song: SongDto): string {
    return song.genres?.map(g => g.name).join(', ') || '';
  }

  formatDate(dateString: string | Date): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Pagination methods
  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadSongs();
    }
  }
}
