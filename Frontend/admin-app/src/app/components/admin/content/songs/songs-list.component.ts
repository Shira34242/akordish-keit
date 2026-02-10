import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SongService } from '../../../../services/song.service';
import { SongDto } from '../../../../models/song.model';
import { ModalService } from '../../../../services/modal.service';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';

@Component({
  selector: 'app-songs-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent],
  templateUrl: './songs-list.component.html',
  styleUrls: ['./songs-list.component.css']
})
export class SongsListComponent implements OnInit {
  private readonly songService = inject(SongService);
  private readonly router = inject(Router);
  private readonly modalService = inject(ModalService);

  // State
  songs: SongDto[] = [];
  loading = false;

  // Pagination
  currentPage = 1;
  pageSize = 20;
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
  
  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.pageNumber = 1; // Reset to first page
    this.loadSongs();
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

  async deleteSong(song: SongDto): Promise<void> {
    if (confirm(`האם אתה בטוח שברצונך למחוק את "${song.title}"?`)) {
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
    if (confirm(`האם אתה בטוח שברצונך ${action} את "${song.title}"?`)) {
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

  get pages(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    const halfWindow = Math.floor(maxPagesToShow / 2);

    let startPage = Math.max(1, this.currentPage - halfWindow);
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  // Expose Math to template
  readonly Math = Math;
}
