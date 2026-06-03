import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { SongService, UpdateSongArtistsDto } from '../../../../services/song.service';
import { ArtistBasicDto, SongDto } from '../../../../models/song.model';
import { ModalService } from '../../../../services/modal.service';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { SiteAlertService } from '../../../../services/site-alert.service';
import { ArtistService } from '../../../../services/artist.service';
import { UserService } from '../../../../services/user.service';
import { ArtistListDto } from '../../../../models/artist.model';
import { UserWithProfileDto } from '../../../../models/user.model';
import { BumpModalComponent } from '../../../shared/bump-modal/bump-modal.component';

@Component({
  selector: 'app-songs-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent, BumpModalComponent],
  templateUrl: './songs-list.component.html',
  styleUrls: ['./songs-list.component.css']
})
export class SongsListComponent implements OnInit, OnDestroy {
  private songUpdatedSub?: Subscription;
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly songService = inject(SongService);
  private readonly router = inject(Router);
  private readonly modalService = inject(ModalService);
  private readonly artistService = inject(ArtistService);
  private readonly userService = inject(UserService);

  // State
  songs: SongDto[] = [];
  artists: ArtistListDto[] = [];
  loading = false;
  loadError = '';
  bulkActionLoading = false;
  selectedSongIds = new Set<number>();
  bumpModalOpen = false;
  artistModalOpen = false;
  artistModalSong: SongDto | null = null;
  artistModalMode: UpdateSongArtistsDto['mode'] = 'add';
  artistModalArtistIds: number[] = [];
  artistsExpanded = false;
  uploaderModalOpen = false;
  uploaderModalSong: SongDto | null = null;
  uploaderProfileSearchQuery = '';
  uploaderProfileSearchResults: UserWithProfileDto[] = [];
  uploaderProfileSearchLoading = false;
  uploaderProfileTypeFilter: 'all' | 'artist' | 'teacher' | 'serviceProvider' | 'user' = 'all';
  selectedUploaderProfile: UserWithProfileDto | null = null;
  artistKeepModalOpen = false;
  artistKeepChoices: { song: SongDto; artists: ArtistBasicDto[]; selectedArtistId: number }[] = [];
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
  uploaderSearch = '';
  dateFrom = '';
  dateTo = '';
  approvalFilter: 'all' | 'approved' | 'pending' = 'all';
  sortBy: string = 'date'; // date, views, name

  ngOnInit(): void {
    this.loadArtists();
    this.loadSongs();

    // האזנה לעדכוני שירים (הוספה/עריכה)
    this.songUpdatedSub = this.modalService.songUpdated$.subscribe(() => {
      this.loadSongs();
    });
  }

  ngOnDestroy(): void {
    this.songUpdatedSub?.unsubscribe();
  }
  
  loadSongs(): void {
    this.loading = true;
    this.loadError = '';

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
      this.sortBy,
      undefined,
      this.uploaderSearch || undefined,
      this.dateFrom || undefined,
      this.dateTo || undefined,
      this.approvalFilter === 'all' ? undefined : this.approvalFilter === 'approved'
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
        this.songs = [];
        this.totalItems = 0;
        this.loadError = error?.status === 403
          ? 'אין לך הרשאה לצפות במסך ניהול האקורדים. אם זו הרשאה שאמורה להיות פתוחה עבורך, צריך לעדכן את התפקיד או ההרשאה במערכת.'
          : (error?.message || 'לא הצלחנו לטעון את רשימת האקורדים.');
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

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadSongs();
  }

  loadArtists(): void {
    this.artistService.getArtists(undefined, undefined, 1, 200, 'name').subscribe({
      next: (result) => this.artists = result.items,
      error: (err) => console.error('Error loading artists', err)
    });
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

  get hasActiveFilters(): boolean {
    return !!(
      this.searchTerm ||
      this.selectedArtistId ||
      this.dateFrom ||
      this.dateTo ||
      this.approvalFilter !== 'all' ||
      this.sortBy !== 'date'
    );
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedArtistId = undefined;
    this.uploaderSearch = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.approvalFilter = 'all';
    this.sortBy = 'date';
    this.onFilterChange();
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

  openArtistModal(song?: SongDto): void {
    this.artistModalSong = song ?? null;
    this.artistModalMode = song ? 'replace' : 'add';
    this.artistModalArtistIds = song?.artists?.filter(artist => artist.id > 0).map(artist => artist.id) ?? [];
    this.artistsExpanded = false;
    this.artistModalOpen = true;
  }

  closeArtistModal(): void {
    if (this.bulkActionLoading) {
      return;
    }

    this.artistModalOpen = false;
    this.artistModalSong = null;
    this.artistModalArtistIds = [];
    this.artistModalMode = 'add';
    this.artistsExpanded = false;
    this.artistKeepModalOpen = false;
    this.artistKeepChoices = [];
  }

  isModalArtistSelected(artistId: number): boolean {
    return this.artistModalArtistIds.includes(artistId);
  }

  toggleModalArtist(artistId: number): void {
    if (this.isModalArtistSelected(artistId)) {
      this.artistModalArtistIds = this.artistModalArtistIds.filter(id => id !== artistId);
      return;
    }

    this.artistModalArtistIds = [...this.artistModalArtistIds, artistId];
  }

  get visibleModalArtists(): ArtistListDto[] {
    return this.artistsExpanded ? this.artists : this.artists.slice(0, 24);
  }

  get hasMoreModalArtists(): boolean {
    return this.artists.length > 24;
  }

  applyArtistModal(): void {
    const songIds = this.artistModalSong ? [this.artistModalSong.id] : this.selectedSongIdsArray;
    if (songIds.length === 0 || this.artistModalArtistIds.length === 0) {
      alert('בחר אמן אחד לפחות');
      return;
    }

    const songsToUpdate = this.getArtistTargetSongs();

    if (this.artistModalMode === 'add' && this.artistKeepChoices.length === 0) {
      const songsWithMultipleArtists = songsToUpdate.filter(song => this.getExistingSongArtists(song).length > 1);

      if (songsWithMultipleArtists.length > 0) {
        this.artistKeepChoices = songsWithMultipleArtists.map(song => {
          const artists = this.getExistingSongArtists(song);
          return {
            song,
            artists,
            selectedArtistId: artists[0].id
          };
        });
        this.artistKeepModalOpen = true;
        return;
      }
    }

    this.bulkActionLoading = true;
    const payload: UpdateSongArtistsDto = {
      artistIds: this.artistModalArtistIds,
      mode: this.artistModalMode
    };

    const onSuccess = () => {
      alert('האמנים עודכנו בהצלחה');
      this.bulkActionLoading = false;
      this.artistKeepModalOpen = false;
      this.artistKeepChoices = [];
      this.closeArtistModal();
      this.loadSongs();
    };
    const onError = (error: any) => {
      console.error('Error updating song artists:', error);
      alert(error?.error?.message || 'שגיאה בעדכון האמנים');
      this.bulkActionLoading = false;
    };

    if (this.artistModalMode === 'add') {
      forkJoin(songsToUpdate.map(song => this.songService.updateSongArtists(song.id, {
        artistIds: this.getReplacementArtistIds(song),
        mode: 'replace'
      }))).subscribe({
        next: onSuccess,
        error: onError
      });
      return;
    }

    if (this.artistModalSong) {
      this.songService.updateSongArtists(this.artistModalSong.id, payload).subscribe({
        next: onSuccess,
        error: onError
      });
      return;
    }

    this.songService.bulkUpdateSongArtists({ ...payload, songIds }).subscribe({
      next: onSuccess,
      error: onError
    });
  }

  openUploaderModal(song?: SongDto): void {
    this.uploaderModalSong = song ?? null;
    this.selectedUploaderProfile = null;
    this.uploaderProfileSearchQuery = '';
    this.uploaderProfileSearchResults = [];
    this.uploaderProfileTypeFilter = 'all';
    this.uploaderModalOpen = true;
    this.loadUploaderProfileResults();
  }

  closeUploaderModal(): void {
    if (this.bulkActionLoading) {
      return;
    }

    this.uploaderModalOpen = false;
    this.uploaderModalSong = null;
    this.selectedUploaderProfile = null;
    this.uploaderProfileSearchQuery = '';
    this.uploaderProfileSearchResults = [];
    this.uploaderProfileSearchLoading = false;
    this.artistKeepModalOpen = false;
    this.artistKeepChoices = [];
  }

  loadUploaderProfileResults(): void {
    this.uploaderProfileSearchLoading = true;
    this.userService.searchUsersWithProfiles(
      this.uploaderProfileSearchQuery,
      60,
      this.uploaderProfileTypeFilter
    ).subscribe({
      next: (results) => {
        this.uploaderProfileSearchResults = [...results].sort((a, b) =>
          a.displayName.localeCompare(b.displayName, 'he')
        );
        this.uploaderProfileSearchLoading = false;
      },
      error: (error) => {
        console.error('Error loading uploader profiles:', error);
        this.uploaderProfileSearchLoading = false;
      }
    });
  }

  selectUploaderProfile(profile: UserWithProfileDto): void {
    this.selectedUploaderProfile = profile;
    this.uploaderProfileSearchQuery = profile.displayName;
  }

  clearSelectedUploaderProfile(): void {
    this.selectedUploaderProfile = null;
    this.uploaderProfileSearchQuery = '';
    this.loadUploaderProfileResults();
  }

  applyUploaderModal(): void {
    const songIds = this.uploaderModalSong ? [this.uploaderModalSong.id] : this.selectedSongIdsArray;
    if (songIds.length === 0 || !this.selectedUploaderProfile) {
      alert('בחר משתמש או פרופיל לשיוך');
      return;
    }

    const profile = this.selectedUploaderProfile;
    this.bulkActionLoading = true;
    const payload = {
      uploaderUserId: profile.userId ?? undefined,
      uploaderProfileType: profile.profileType === 'user' ? undefined : profile.profileType,
      uploaderProfileId: profile.profileType === 'user' ? undefined : profile.profileId
    };

    const onSuccess = () => {
      alert('השיוך עודכן בהצלחה');
      this.bulkActionLoading = false;
      this.closeUploaderModal();
      this.loadSongs();
    };
    const onError = (error: any) => {
      console.error('Error updating song uploader:', error);
      alert(error?.error?.message || 'שגיאה בעדכון השיוך');
      this.bulkActionLoading = false;
    };

    if (this.uploaderModalSong) {
      this.songService.updateSongUploader(this.uploaderModalSong.id, payload).subscribe({
        next: onSuccess,
        error: onError
      });
      return;
    }

    this.songService.bulkUpdateSongUploader({ ...payload, songIds }).subscribe({
      next: onSuccess,
      error: onError
    });
  }

  closeArtistKeepModal(): void {
    if (this.bulkActionLoading) {
      return;
    }

    this.artistKeepModalOpen = false;
    this.artistKeepChoices = [];
  }

  setArtistToKeep(songId: number, artistId: number): void {
    this.artistKeepChoices = this.artistKeepChoices.map(choice =>
      choice.song.id === songId ? { ...choice, selectedArtistId: artistId } : choice
    );
  }

  confirmArtistKeepChoices(): void {
    this.artistKeepModalOpen = false;
    this.applyArtistModal();
  }

  private getArtistTargetSongs(): SongDto[] {
    if (this.artistModalSong) {
      return [this.artistModalSong];
    }

    return this.songs.filter(song => this.selectedSongIds.has(song.id));
  }

  private getExistingSongArtists(song: SongDto): ArtistBasicDto[] {
    return song.artists?.filter(artist => artist.id > 0) ?? [];
  }

  private getReplacementArtistIds(song: SongDto): number[] {
    const ids = [...this.artistModalArtistIds];
    const keepChoice = this.artistKeepChoices.find(choice => choice.song.id === song.id);

    if (keepChoice && !ids.includes(keepChoice.selectedArtistId)) {
      ids.unshift(keepChoice.selectedArtistId);
    }

    return Array.from(new Set(ids));
  }

  getProfileTypeLabel(profile: UserWithProfileDto): string {
    if (profile.profileType === 'artist') return 'אמן';
    if (profile.profileType === 'user') return 'משתמש';
    return profile.isTeacher ? 'מורה' : 'בעל מקצוע';
  }

  createNew(): void {
    // פתיחת המודאל של הוספת שיר
    this.modalService.openAddSongModal({ flowMode: 'legacy' });
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

  viewSong(song: SongDto): void {
    if (!song.isApproved) {
      this.router.navigate(['/song', song.id], { queryParams: { preview: 'true' } });
    } else {
      this.router.navigate(['/song', song.id]);
    }
  }

  formatArtists(song: SongDto): string {
    return song.artists?.map(a => a.name).join(', ') || '';
  }

  formatGenres(song: SongDto): string {
    return song.genres?.map(g => g.name).join(', ') || '';
  }

  openBumpModal(): void {
    this.bumpModalOpen = true;
  }

  onBumped(): void {
    this.bumpModalOpen = false;
    this.clearSelection();
    this.loadSongs();
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
