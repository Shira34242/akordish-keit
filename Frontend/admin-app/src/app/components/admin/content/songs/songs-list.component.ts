import { Component, OnInit, OnDestroy, inject, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, forkJoin, Subscription, Observable, Subject } from 'rxjs';
import { SongService, UpdateSongArtistsDto } from '../../../../services/song.service';
import { ArtistBasicDto, SongDto, SongDuplicateCandidate, SongDuplicateGroup, SongDuplicateScanResponse } from '../../../../models/song.model';
import { ModalService } from '../../../../services/modal.service';
import { SiteAlertService } from '../../../../services/site-alert.service';
import { ArtistService } from '../../../../services/artist.service';
import { UserService } from '../../../../services/user.service';
import { ArtistListDto } from '../../../../models/artist.model';
import { UserWithProfileDto } from '../../../../models/user.model';
import { BumpModalComponent } from '../../../shared/bump-modal/bump-modal.component';
import { ContentPromotionModalComponent } from '../../../shared/content-promotion-modal/content-promotion-modal.component';
import { ContentPromotionTargetType } from '../../../../services/content-promotion.service';
import { NotificationService } from '../../../../services/notification.service';
import { NotificationCategory, NotificationType } from '../../../../models/notification.model';

@Component({
  selector: 'app-songs-list',
  standalone: true,
  imports: [CommonModule, FormsModule, BumpModalComponent, ContentPromotionModalComponent],
  templateUrl: './songs-list.component.html',
  styleUrls: ['./songs-list.component.css']
})
export class SongsListComponent implements OnInit, OnDestroy, AfterViewInit {
  private static readonly STATE_KEY = 'admin-songs-filters';
  private songUpdatedSub?: Subscription;
  private textFilterSub?: Subscription;
  private songsLoadSub?: Subscription;
  private songsLoadMoreSub?: Subscription;
  private songsSavedStateLoadSub?: Subscription;
  private songsReloadSub?: Subscription;
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly songService = inject(SongService);
  private readonly router = inject(Router);
  private readonly modalService = inject(ModalService);
  private readonly artistService = inject(ArtistService);
  private readonly userService = inject(UserService);
  private readonly notificationService = inject(NotificationService);
  private isDestroyed = false;
  private scrollObserver?: IntersectionObserver;
  private _pendingScrollY = 0;
  private _pendingPage = 0;
  private activeListRequestId = 0;
  private textFilterPending = false;
  private readonly textFilterChanges$ = new Subject<string>();
  private static readonly MAX_RESTORED_PAGES = 3;

  @ViewChild('scrollSentinel') scrollSentinelRef?: ElementRef<HTMLElement>;

  // State
  songs: SongDto[] = [];
  artists: ArtistListDto[] = [];
  loading = false;
  loadError = '';
  bulkActionLoading = false;
  sendingApprovalNotificationIds = new Set<number>();
  selectedSongIds = new Set<number>();
  bumpModalOpen = false;
  promotionModalOpen = false;
  readonly PromotionTargetType = ContentPromotionTargetType;
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
  duplicateScanLoading = false;
  duplicateScanModalOpen = false;
  duplicateScanResult: SongDuplicateScanResponse | null = null;
  duplicateDecisions = new Map<number, 'keep' | 'delete'>();
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-songs-view') as 'list' | 'grid') || 'list';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-songs-view', mode); }

  // Infinite scroll
  currentPage = 0;
  pageSize = 25;
  totalItems = 0;
  totalCount = 0;
  allLoaded = false;
  loadingMore = false;

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
    this.textFilterSub = this.textFilterChanges$
      .pipe(debounceTime(500))
      .subscribe(() => this.applyFilterChange());

    this.loadArtists();
    const hadState = this._restoreState();
    if (hadState) {
      this._loadFromSavedState();
    } else {
      this.loadSongs();
    }

    this.songUpdatedSub = this.modalService.songUpdated$.subscribe(() => {
      this._reloadPreservingState();
    });
  }

  ngAfterViewInit(): void {
    this.setupScrollObserver();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.songUpdatedSub?.unsubscribe();
    this.textFilterSub?.unsubscribe();
    this.cancelSongListRequests();
    this.textFilterChanges$.complete();
    this.destroyScrollObserver();
  }

  private cancelSongListRequests(): void {
    this.songsLoadSub?.unsubscribe();
    this.songsLoadMoreSub?.unsubscribe();
    this.songsSavedStateLoadSub?.unsubscribe();
    this.songsReloadSub?.unsubscribe();
  }

  private beginFreshListRequest(): number {
    this.cancelSongListRequests();
    this.activeListRequestId++;
    return this.activeListRequestId;
  }

  private invalidatePendingListResults(): void {
    this.cancelSongListRequests();
    this.activeListRequestId++;
    this.loading = false;
    this.loadingMore = false;
  }

  private isCurrentListRequest(requestId: number): boolean {
    return requestId === this.activeListRequestId && !this.isDestroyed;
  }

  private getFilterKey(): string {
    return JSON.stringify({
      searchTerm: this.searchTerm.trim(),
      selectedArtistId: this.selectedArtistId ?? null,
      selectedGenreId: this.selectedGenreId ?? null,
      selectedKeyId: this.selectedKeyId ?? null,
      uploaderSearch: this.uploaderSearch.trim(),
      dateFrom: this.dateFrom,
      dateTo: this.dateTo,
      approvalFilter: this.approvalFilter,
      sortBy: this.sortBy
    });
  }

  private destroyScrollObserver(): void {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = undefined;
    }
  }

  private setupScrollObserver(): void {
    if (this.isDestroyed) return;

    this.destroyScrollObserver();

    if (!this.scrollSentinelRef?.nativeElement) {
      setTimeout(() => this.setupScrollObserver(), 100);
      return;
    }

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.loading && !this.loadingMore && !this.allLoaded) {
          this.loadMoreSongs();
        }
      },
      { rootMargin: '200px' }
    );

    this.scrollObserver.observe(this.scrollSentinelRef.nativeElement);
  }

  private reattachScrollObserver(): void {
    if (!this.scrollSentinelRef?.nativeElement) return;
    this.scrollObserver?.disconnect();
    this.scrollObserver?.observe(this.scrollSentinelRef.nativeElement);
  }
  
  loadSongs(): void {
    const requestId = this.beginFreshListRequest();
    this.textFilterPending = false;
    this.loading = true;
    this.loadError = '';
    this.currentPage = 1;
    this.allLoaded = false;
    this.loadingMore = false;

    const search = this.searchTerm || undefined;
    const page = Number(this.currentPage);
    const pageSize = Number(this.pageSize);

    this.songsLoadSub = this.songService.getSongsForAdmin(
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
        if (!this.isCurrentListRequest(requestId)) return;
        this.songs = result.songs || result.items || result.data || [];
        this.totalItems = result.totalCount || result.total || 0;
        this.totalCount = this.totalItems;
        this.allLoaded = this.songs.length >= this.totalItems;
        this.clearSelection();
        this.loading = false;
        setTimeout(() => this.reattachScrollObserver(), 0);
      },
      error: (error) => {
        if (!this.isCurrentListRequest(requestId)) return;
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

  loadMoreSongs(): void {
    if (this.textFilterPending || this.loading || this.loadingMore || this.allLoaded) return;

    this.loadingMore = true;
    this.currentPage++;
    const requestId = this.activeListRequestId;
    const filterKey = this.getFilterKey();

    this.songsLoadMoreSub?.unsubscribe();
    this.songsLoadMoreSub = this.songService.getSongsForAdmin(
      this.searchTerm || undefined,
      this.currentPage,
      this.pageSize,
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
        if (!this.isCurrentListRequest(requestId) || filterKey !== this.getFilterKey()) return;
        const items = result.songs || result.items || result.data || [];
        this.songs = [...this.songs, ...items];
        this.totalItems = result.totalCount || result.total || 0;
        this.totalCount = this.totalItems;
        this.allLoaded = this.songs.length >= this.totalItems;
        this.loadingMore = false;
        this._persistState();
        setTimeout(() => this.reattachScrollObserver(), 0);
      },
      error: (error) => {
        if (!this.isCurrentListRequest(requestId) || filterKey !== this.getFilterKey()) return;
        console.error('Error loading more songs:', error);
        this.loadingMore = false;
        this.currentPage--;
      }
    });
  }

  onSearch(): void {
    this.onTextFilterInput();
  }

  onTextFilterInput(): void {
    this.textFilterPending = true;
    this.invalidatePendingListResults();
    this.textFilterChanges$.next(this.getFilterKey());
  }

  private applyFilterChange(): void {
    this.textFilterPending = false;
    this.currentPage = 1;
    this._persistState();
    this.loadSongs();
  }

  onSortChange(): void {
    this.currentPage = 1;
    this._persistState();
    this.loadSongs();
  }

  onFilterChange(): void {
    this.applyFilterChange();
  }

  setApprovalFilter(filter: 'all' | 'approved' | 'pending'): void {
    if (this.approvalFilter === filter) return;
    this.approvalFilter = filter;
    this.onFilterChange();
  }

  private _persistState(): void {
    sessionStorage.setItem(SongsListComponent.STATE_KEY, JSON.stringify({
      searchTerm: this.searchTerm,
      selectedArtistId: this.selectedArtistId,
      sortBy: this.sortBy,
      approvalFilter: this.approvalFilter,
      dateFrom: this.dateFrom,
      dateTo: this.dateTo,
      uploaderSearch: this.uploaderSearch,
      currentPage: this.currentPage,
      scrollY: window.scrollY,
    }));
  }

  private _restoreState(): boolean {
    const raw = sessionStorage.getItem(SongsListComponent.STATE_KEY);
    if (!raw) return false;
    try {
      const s = JSON.parse(raw);
      this.searchTerm = s.searchTerm ?? '';
      this.selectedArtistId = s.selectedArtistId ?? undefined;
      this.sortBy = s.sortBy ?? 'date';
      this.approvalFilter = s.approvalFilter ?? 'all';
      this.dateFrom = s.dateFrom ?? '';
      this.dateTo = s.dateTo ?? '';
      this.uploaderSearch = s.uploaderSearch ?? '';
      this._pendingScrollY = s.scrollY ?? 0;
      this._pendingPage = s.currentPage ?? 0;
      return true;
    } catch { return false; }
  }

  private _loadFromSavedState(): void {
    const requestId = this.beginFreshListRequest();
    const pagesToLoad = Math.min(this._pendingPage || 1, SongsListComponent.MAX_RESTORED_PAGES);
    const targetScrollY = this._pendingScrollY;
    this._pendingScrollY = 0;
    this._pendingPage = 0;

    this.loading = true;
    this.loadError = '';
    this.currentPage = 1;
    this.allLoaded = false;

    const requests: Observable<any>[] = [];
    for (let p = 1; p <= pagesToLoad; p++) {
      requests.push(this.songService.getSongsForAdmin(
        this.searchTerm || undefined, p, this.pageSize,
        this.selectedArtistId, this.selectedGenreId, this.selectedKeyId,
        this.sortBy, undefined,
        this.uploaderSearch || undefined,
        this.dateFrom || undefined, this.dateTo || undefined,
        this.approvalFilter === 'all' ? undefined : this.approvalFilter === 'approved'
      ));
    }

    this.songsSavedStateLoadSub = forkJoin(requests).subscribe({
      next: (results: any[]) => {
        if (!this.isCurrentListRequest(requestId)) return;
        const allSongs: SongDto[] = [];
        for (const r of results) {
          allSongs.push(...(r.songs || r.items || r.data || []));
        }
        this.songs = allSongs;
        const total = results[0]?.totalCount || results[0]?.total || 0;
        this.totalItems = total;
        this.totalCount = total;
        this.currentPage = pagesToLoad;
        this.allLoaded = allSongs.length >= total;
        this.clearSelection();
        this.loading = false;
        setTimeout(() => {
          this.reattachScrollObserver();
          if (targetScrollY > 0) {
            window.scrollTo(0, targetScrollY);
          }
        }, 150);
      },
      error: (error) => {
        if (!this.isCurrentListRequest(requestId)) return;
        console.error('Error loading songs from saved state:', error);
        this.songs = [];
        this.totalItems = 0;
        this.loadError = error?.message || 'שגיאה בטעינת שירים';
        this.loading = false;
      }
    });
  }

  private _reloadPreservingState(): void {
    const requestId = this.beginFreshListRequest();
    const savedScrollY = window.scrollY;
    const pagesToLoad = Math.min(this.currentPage || 1, SongsListComponent.MAX_RESTORED_PAGES);
    this.loading = true;
    this.loadError = '';

    const requests: Observable<any>[] = [];
    for (let p = 1; p <= pagesToLoad; p++) {
      requests.push(this.songService.getSongsForAdmin(
        this.searchTerm || undefined, p, this.pageSize,
        this.selectedArtistId, this.selectedGenreId, this.selectedKeyId,
        this.sortBy, undefined,
        this.uploaderSearch || undefined,
        this.dateFrom || undefined, this.dateTo || undefined,
        this.approvalFilter === 'all' ? undefined : this.approvalFilter === 'approved'
      ));
    }

    this.songsReloadSub = forkJoin(requests).subscribe({
      next: (results: any[]) => {
        if (!this.isCurrentListRequest(requestId)) return;
        const allSongs: SongDto[] = [];
        for (const r of results) {
          allSongs.push(...(r.songs || r.items || r.data || []));
        }
        this.songs = allSongs;
        const total = results[0]?.totalCount || results[0]?.total || 0;
        this.totalItems = total;
        this.totalCount = total;
        this.currentPage = pagesToLoad;
        this.allLoaded = allSongs.length >= total;
        this.clearSelection();
        this.loading = false;
        setTimeout(() => {
          this.reattachScrollObserver();
          window.scrollTo(0, savedScrollY);
        }, 100);
      },
      error: (error) => {
        if (!this.isCurrentListRequest(requestId)) return;
        console.error('Error reloading songs:', error);
        this.loading = false;
        this.loadSongs();
      }
    });
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
      this.uploaderSearch ||
      this.dateFrom ||
      this.dateTo ||
      this.approvalFilter !== 'all' ||
      this.sortBy !== 'date'
    );
  }

  get isSearchBusy(): boolean {
    return this.textFilterPending || this.loading;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedArtistId = undefined;
    this.uploaderSearch = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.approvalFilter = 'all';
    this.sortBy = 'date';
    sessionStorage.removeItem(SongsListComponent.STATE_KEY);
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

  selectAllCurrentPage(): void {
    this.songs.forEach(song => this.selectedSongIds.add(song.id));
  }

  clearSelection(): void {
    this.selectedSongIds.clear();
  }

  trackBySongId(_index: number, song: SongDto): number {
    return song.id;
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
      uploaderProfileType: profile.profileType === 'user' || profile.profileType === 'agency' ? undefined : profile.profileType,
      uploaderProfileId: profile.profileType === 'user' || profile.profileType === 'agency' ? undefined : profile.profileId
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

  scanDuplicateSongs(): void {
    this.duplicateScanLoading = true;
    this.duplicateScanResult = null;
    this.duplicateDecisions.clear();

    this.songService.scanDuplicateSongs().subscribe({
      next: (result) => {
        this.duplicateScanResult = result;
        this.duplicateScanModalOpen = true;
        this.duplicateScanLoading = false;
      },
      error: (error) => {
        console.error('Error scanning duplicate songs:', error);
        alert(error?.error?.message || 'שגיאה בסריקת כפילויות');
        this.duplicateScanLoading = false;
      }
    });
  }

  closeDuplicateScanModal(): void {
    if (this.bulkActionLoading) {
      return;
    }

    this.duplicateScanModalOpen = false;
  }

  getDuplicateDecision(songId: number): 'keep' | 'delete' | undefined {
    return this.duplicateDecisions.get(songId);
  }

  keepDuplicateCandidate(candidate: SongDuplicateCandidate): void {
    this.duplicateDecisions.set(candidate.id, 'keep');
  }

  async deleteDuplicateCandidate(candidate: SongDuplicateCandidate): Promise<void> {
    if (!await this.siteAlerts.confirm(`למחוק את "${candidate.title}"?`)) {
      return;
    }

    this.bulkActionLoading = true;
    this.songService.deleteSong(candidate.id).subscribe({
      next: () => {
        this.duplicateDecisions.set(candidate.id, 'delete');
        this.songs = this.songs.filter(song => song.id !== candidate.id);
        this.selectedSongIds.delete(candidate.id);
        this.bulkActionLoading = false;
      },
      error: (error) => {
        console.error('Error deleting duplicate candidate:', error);
        alert('שגיאה במחיקת האקורד');
        this.bulkActionLoading = false;
      }
    });
  }

  get hasDuplicateScanGroups(): boolean {
    return !!this.duplicateScanResult?.groups?.length;
  }

  getVisibleDuplicateGroups(): SongDuplicateGroup[] {
    return this.duplicateScanResult?.groups ?? [];
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
    this._persistState();
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

  async sendApprovalNotification(song: SongDto): Promise<void> {
    const userId = this.getSubmittingUserId(song);
    if (!song.isApproved || !userId || this.sendingApprovalNotificationIds.has(song.id)) return;

    if (!await this.siteAlerts.confirm(`לשלוח למשתמש הודעה שהשיר "${song.title}" אושר?`)) return;

    this.sendingApprovalNotificationIds.add(song.id);
    this.notificationService.sendStatusUpdate({
      userId,
      title: 'השיר אושר',
      message: `השיר "${song.title}" אושר וניתן לצפייה באתר.`,
      type: NotificationType.Approval,
      category: NotificationCategory.Song,
      relatedEntityType: 'Song',
      relatedEntityId: song.id,
      actionUrl: `/song/${song.id}`
    }).subscribe({
      next: () => {
        this.sendingApprovalNotificationIds.delete(song.id);
        this.siteAlerts.show('הודעת האישור נשלחה למשתמש');
      },
      error: (error) => {
        console.error('Error sending song approval notification:', error);
        this.sendingApprovalNotificationIds.delete(song.id);
        this.siteAlerts.show(error?.error?.message || 'שליחת הודעת האישור נכשלה');
      }
    });
  }

  getSubmittingUserId(song: SongDto): number | null {
    return song.uploadedByUserId ?? song.uploaderUserId ?? null;
  }

  getPublicCreditLabel(song: SongDto): string {
    if (song.uploaderProfile?.name) {
      return `${song.uploaderProfile.name} (${this.getUploaderTypeLabel(song.uploaderProfile.type)})`;
    }
    if (song.uploaderProfileType && song.uploaderProfileId) {
      return `${this.getUploaderTypeLabel(song.uploaderProfileType)} #${song.uploaderProfileId}`;
    }
    return 'לא נבחר קרדיט ציבורי';
  }

  openSubmittingUser(userId: number, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/admin/users/clients'], { queryParams: { userId } });
  }

  private getUploaderTypeLabel(type: string): string {
    if (type === 'artist') return 'אמן';
    if (type === 'serviceProvider') return 'בעל מקצוע';
    return 'משתמש';
  }

  openBumpModal(): void {
    this.bumpModalOpen = true;
  }

  openPromotionModal(): void {
    this.promotionModalOpen = true;
  }

  onBumped(): void {
    this.bumpModalOpen = false;
    this.clearSelection();
    this.loadSongs();
  }

  onPromoted(): void {
    this.promotionModalOpen = false;
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

}
