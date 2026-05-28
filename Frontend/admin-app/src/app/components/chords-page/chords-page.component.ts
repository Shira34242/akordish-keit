import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SongService } from '../../services/song.service';
import { AuthService } from '../../services/auth.service';
import { KnownChordInstrument, KnownChordSort, UserKnownChordService } from '../../services/user-known-chord.service';
import { SystemItem, SystemTablesService } from '../../services/system-tables.service';
import { SongCardComponent } from '../shared/song-card/song-card.component';
import { AutoScrollDirective } from '../../directives/auto-scroll.directive';
import { Subject, Subscription, EMPTY } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { MusicalKey } from '../../models/song.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { songSlug } from '../../utils/slug';

@Component({
    selector: 'app-chords-page',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, SongCardComponent, TranslatePipe, AutoScrollDirective],
    templateUrl: './chords-page.component.html',
    styleUrls: ['./chords-page.component.css']
})
export class ChordsPageComponent implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild('heroBg') heroBg?: ElementRef<HTMLDivElement>;
    @ViewChild('catalogSentinel') catalogSentinel?: ElementRef<HTMLDivElement>;
    private fullHeroHeight = 0;
    private rafPending = false;
    private scrollObserver?: IntersectionObserver;

    // Main results (catalog + search)
    songs: any[] = [];
    totalCount: number = 0;
    isLoading: boolean = false;
    isLoadingMore: boolean = false;
    hasMoreSongs: boolean = true;
    currentPage: number = 1;
    pageSize: number = 20;
    totalPages: number = 0;

    // Category section data
    recentSongs: any[] = [];
    popularSongs: any[] = [];
    mostViewedSongs: any[] = [];
    dontMissSongs: any[] = [];
    recentlyViewedSongs: any[] = [];

    // Filters
    search: string = '';
    selectedArtistId: number | null = null;
    selectedGenreId: number | null = null;
    selectedKeyId: number | null = null;
    selectedTagId: number | null = null;
    selectedTagName: string = '';
    sortBy: string = 'date';
    knownChordsMode = false;
    knownInstrument: KnownChordInstrument = 'guitar';
    knownSortBy: KnownChordSort = 'closest';

    // Artist strip selection
    selectedFilterArtistId: number | null = null;

    // Autocomplete data
    artists: any[] = [];
    genres: any[] = [];
    musicalKeys: MusicalKey[] = [];
    quickTags: SystemItem[] = [];
    filteredArtists: any[] = [];
    filteredGenres: any[] = [];
    filteredKeys: MusicalKey[] = [];

    artistSearchText: string = '';
    genreSearchText: string = '';
    keySearchText: string = '';

    showArtistDropdown: boolean = false;
    showGenreDropdown: boolean = false;
    showKeyDropdown: boolean = false;
    showSortDropdown: boolean = false;

    private searchSubject = new Subject<string>();
    private searchSubscription?: Subscription;
    private recentlyViewedKey = 'chords-recently-viewed';

    // switchMap stream for main song loading — cancels previous in-flight request
    private songLoadParams = new Subject<{
        search?: string;
        page: number;
        pageSize: number;
        artistId?: number;
        genreId?: number;
        keyId?: number;
        sortBy: string;
        tagId?: number;
    }>();
    private songLoadSubscription?: Subscription;
    private sectionsLoaded = false;
    // Incremented on every filter change — loadMore() discards stale responses
    private filterEpoch = 0;

    get isFiltered(): boolean {
        return !!(this.search || this.selectedArtistId || this.selectedGenreId || this.selectedKeyId || this.selectedTagId || this.knownChordsMode);
    }

    constructor(
        private songService: SongService,
        private authService: AuthService,
        private knownChordService: UserKnownChordService,
        private systemTablesService: SystemTablesService,
        private router: Router
    ) {
        this.searchSubscription = this.searchSubject.pipe(
            debounceTime(500),
            distinctUntilChanged()
        ).subscribe(query => {
            this.knownChordsMode = false;
            this.filterEpoch++;
            this.search = query;
            this.currentPage = 1;
            this.hasMoreSongs = true;
            this.songs = [];
            this.loadSongs();
        });

        // switchMap cancels any in-flight request when a new one arrives
        this.songLoadSubscription = this.songLoadParams.pipe(
            switchMap(params => {
                this.isLoading = true;
                return this.songService.getSongs(
                    params.search,
                    params.page,
                    params.pageSize,
                    params.artistId,
                    params.genreId,
                    params.keyId,
                    params.sortBy,
                    params.tagId
                ).pipe(
                    catchError(() => {
                        this.isLoading = false;
                        return EMPTY;
                    })
                );
            })
        ).subscribe({
            next: (res) => {
                this.songs = res.songs;
                this.totalCount = res.totalCount;
                this.totalPages = res.totalPages;
                this.hasMoreSongs = this.currentPage < this.totalPages;
                this.isLoading = false;
                // Load category sections only after the first catalog load completes
                if (!this.sectionsLoaded) {
                    this.sectionsLoaded = true;
                    this.loadCategorySections();
                }
            }
        });
    }

    handleRandomSongClick(): void {
        this.songService.getRandomSong().subscribe({
            next: (song: any) => {
                if (song?.id) {
                    const slug = songSlug(song);
                    this.router.navigate(slug ? ['/song', song.id, slug] : ['/song', song.id]);
                }
            },
            error: (err: any) => console.error('Failed to get random song', err)
        });
    }

    ngOnInit(): void {
        this.loadSongs();
        this.loadFilterData();
        this.loadQuickTags();
        this.loadRecentlyViewed();
        // loadCategorySections() is deferred — runs after loadSongs() returns for the first time
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            this.initHeroHeight();
            this.initInfiniteScroll();
        }, 0);
    }

    ngOnDestroy(): void {
        this.scrollObserver?.disconnect();
        this.searchSubscription?.unsubscribe();
        this.songLoadSubscription?.unsubscribe();
    }

    // ─────────────────────────────────────────────
    // Hero shrink
    // ─────────────────────────────────────────────

    @HostListener('window:scroll')
    onScroll(): void {
        if (this.rafPending) return;
        this.rafPending = true;
        requestAnimationFrame(() => {
            this.shrinkHero();
            this.rafPending = false;
        });
    }

    @HostListener('window:resize')
    onResize(): void {
        this.initHeroHeight();
    }

    private initHeroHeight(): void {
        const bg = this.heroBg?.nativeElement;
        if (!bg) return;
        this.fullHeroHeight = Math.round(window.innerHeight * 0.6);
        bg.style.height = this.fullHeroHeight + 'px';
        this.shrinkHero();
    }

    private shrinkHero(): void {
        const bg = this.heroBg?.nativeElement;
        if (!bg || this.fullHeroHeight === 0) return;
        const minHeight = 56;
        const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
        bg.style.height = newHeight + 'px';

        const collapseOverlay = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
        if (collapseOverlay) {
            const collapseRange = this.fullHeroHeight - minHeight;
            const collapseProgress = collapseRange > 0
                ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
                : 0;
            collapseOverlay.style.opacity = String(collapseProgress);
        }
    }

    // ─────────────────────────────────────────────
    // Category sections
    // ─────────────────────────────────────────────

    private loadCategorySections(): void {
        this.songService.getSongs(undefined, 1, 8, undefined, undefined, undefined, 'date')
            .subscribe({ next: (res) => this.recentSongs = res.songs || [], error: () => {} });

        // Single request for 16 view-sorted songs, split into two sections
        this.songService.getSongs(undefined, 1, 16, undefined, undefined, undefined, 'views')
            .subscribe({ next: (res) => {
                const all = res.songs || [];
                this.popularSongs = all.slice(0, 8);
                this.mostViewedSongs = all.slice(8);
            }, error: () => {} });

        this.songService.getSongs(undefined, 1, 8, undefined, undefined, undefined, 'name')
            .subscribe({ next: (res) => this.dontMissSongs = res.songs || [], error: () => {} });
    }

    private loadRecentlyViewed(): void {
        try {
            this.recentlyViewedSongs = JSON.parse(localStorage.getItem(this.recentlyViewedKey) || '[]');
        } catch {
            this.recentlyViewedSongs = [];
        }
    }

    saveToRecent(song: any): void {
        try {
            let recent: any[] = JSON.parse(localStorage.getItem(this.recentlyViewedKey) || '[]');
            recent = recent.filter((s: any) => s.id !== song.id);
            recent.unshift(song);
            localStorage.setItem(this.recentlyViewedKey, JSON.stringify(recent.slice(0, 12)));
        } catch {}
    }

    // ─────────────────────────────────────────────
    // Artist strip
    // ─────────────────────────────────────────────

    selectFilterArtist(artist: any): void {
        this.knownChordsMode = false;
        this.filterEpoch++;
        if (this.selectedFilterArtistId === artist.id) {
            this.selectedFilterArtistId = null;
            this.selectedArtistId = null;
            this.artistSearchText = '';
        } else {
            this.selectedFilterArtistId = artist.id;
            this.selectedArtistId = artist.id;
            this.artistSearchText = artist.name;
        }
        this.currentPage = 1;
        this.loadSongs();
    }

    // ─────────────────────────────────────────────
    // Strip scroll arrows
    // ─────────────────────────────────────────────

    scrollStrip(el: HTMLElement, forward: boolean): void {
        el.scrollBy({ left: forward ? -300 : 300, behavior: 'smooth' });
    }

    // ─────────────────────────────────────────────
    // Infinite scroll
    // ─────────────────────────────────────────────

    private initInfiniteScroll(): void {
        const sentinel = this.catalogSentinel?.nativeElement;
        if (!sentinel) return;
        this.scrollObserver = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                this.loadMore();
            }
        }, { rootMargin: '200px' });
        this.scrollObserver.observe(sentinel);
    }

    loadMore(): void {
        if (this.knownChordsMode || this.isLoading || this.isLoadingMore || !this.hasMoreSongs) return;
        if (this.currentPage >= this.totalPages) return;
        this.isLoadingMore = true;
        this.currentPage++;
        const epochAtStart = this.filterEpoch;
        this.songService.getSongs(
            this.search || undefined,
            this.currentPage,
            this.pageSize,
            this.selectedArtistId || undefined,
            this.selectedGenreId || undefined,
            this.selectedKeyId || undefined,
            this.sortBy,
            this.selectedTagId || undefined
        ).subscribe({
            next: (res) => {
                // Discard if a filter change happened while this request was in flight
                if (this.filterEpoch !== epochAtStart) { this.isLoadingMore = false; return; }
                this.songs = [...this.songs, ...(res.songs || [])];
                this.totalCount = res.totalCount;
                this.totalPages = res.totalPages;
                this.hasMoreSongs = this.currentPage < this.totalPages;
                this.isLoadingMore = false;
            },
            error: () => { this.isLoadingMore = false; }
        });
    }

    // ─────────────────────────────────────────────
    // Songs loading
    // ─────────────────────────────────────────────

    loadSongs(): void {
        if (this.knownChordsMode) {
            this.loadKnownChordSongs();
            return;
        }
        this.songLoadParams.next({
            search: this.search || undefined,
            page: this.currentPage,
            pageSize: this.pageSize,
            artistId: this.selectedArtistId || undefined,
            genreId: this.selectedGenreId || undefined,
            keyId: this.selectedKeyId || undefined,
            sortBy: this.sortBy,
            tagId: this.selectedTagId || undefined
        });
    }

    loadFilterData(): void {
        // Artists load immediately — visible in the strip
        this.songService.getAllArtists().subscribe(artists => {
            this.artists = artists;
            this.filteredArtists = artists.slice(0, 10);
        });
        // Keys and genres are only needed when the user opens a filter — defer them
        const loadSecondary = () => {
            this.songService.getMusicalKeys().subscribe(keys => {
                this.musicalKeys = keys;
                this.filteredKeys = keys.slice(0, 10);
            });
            this.songService.getGenres().subscribe(genres => {
                this.genres = genres;
                this.filteredGenres = genres.slice(0, 10);
            });
        };
        if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(loadSecondary, { timeout: 2000 });
        } else {
            setTimeout(loadSecondary, 800);
        }
    }

    loadQuickTags(): void {
        this.systemTablesService.getChordQuickTags().subscribe({
            next: tags => {
                this.quickTags = Array.isArray(tags) ? tags : [];
            },
            error: err => {
                console.error('ChordQuickTags: failed to load', err);
                this.quickTags = [];
            }
        });
    }

    selectQuickTag(tag: SystemItem): void {
        this.knownChordsMode = false;
        if (this.selectedTagId === tag.id) {
            this.selectedTagId = null;
            this.selectedTagName = '';
        } else {
            this.selectedTagId = tag.id;
            this.selectedTagName = tag.name;
            this.search = '';
        }
        this.currentPage = 1;
        this.hasMoreSongs = true;
        this.songs = [];
        this.loadSongs();
    }

    // ─────────────────────────────────────────────
    // Autocomplete handlers
    // ─────────────────────────────────────────────

    onArtistSearch(event: Event): void {
        const query = (event.target as HTMLInputElement).value.toLowerCase();
        this.closeAllFilterDropdowns();
        this.showArtistDropdown = true;
        this.selectedFilterArtistId = null;
        this.filteredArtists = query
            ? this.artists.filter(a =>
                a.name.toLowerCase().includes(query) ||
                (a.englishName && a.englishName.toLowerCase().includes(query))
              ).slice(0, 10)
            : this.artists.slice(0, 10);
    }

    selectArtist(artist: any): void {
        if (artist) {
            this.selectedArtistId = artist.id;
            this.artistSearchText = artist.name;
            this.selectedFilterArtistId = artist.id;
        } else {
            this.selectedArtistId = null;
            this.artistSearchText = '';
            this.selectedFilterArtistId = null;
        }
        this.showArtistDropdown = false;
        this.onFilterChange();
    }

    onGenreSearch(event: Event): void {
        const query = (event.target as HTMLInputElement).value.toLowerCase();
        this.closeAllFilterDropdowns();
        this.showGenreDropdown = true;
        this.filteredGenres = query
            ? this.genres.filter(g => g.name.toLowerCase().includes(query)).slice(0, 10)
            : this.genres.slice(0, 10);
    }

    selectGenre(genre: any): void {
        if (genre) {
            this.selectedGenreId = genre.id;
            this.genreSearchText = genre.name;
        } else {
            this.selectedGenreId = null;
            this.genreSearchText = '';
        }
        this.showGenreDropdown = false;
        this.onFilterChange();
    }

    onKeySearch(event: Event): void {
        const query = (event.target as HTMLInputElement).value.toLowerCase();
        this.closeAllFilterDropdowns();
        this.showKeyDropdown = true;
        this.filteredKeys = query
            ? this.musicalKeys.filter(k =>
                k.displayName.toLowerCase().includes(query) ||
                k.name.toLowerCase().includes(query)
              ).slice(0, 10)
            : this.musicalKeys.slice(0, 10);
    }

    selectKey(key: MusicalKey | null): void {
        if (key) {
            this.selectedKeyId = key.id;
            this.keySearchText = key.displayName;
        } else {
            this.selectedKeyId = null;
            this.keySearchText = '';
        }
        this.showKeyDropdown = false;
        this.onFilterChange();
    }

    onSearch(event: Event): void {
        this.searchSubject.next((event.target as HTMLInputElement).value);
    }

    onFilterChange(): void {
        this.knownChordsMode = false;
        this.filterEpoch++;
        this.currentPage = 1;
        this.hasMoreSongs = true;
        this.songs = [];
        this.loadSongs();
    }

    clearFilters(): void {
        this.search = '';
        this.selectedArtistId = null;
        this.selectedGenreId = null;
        this.selectedKeyId = null;
        this.selectedTagId = null;
        this.selectedTagName = '';
        this.selectedFilterArtistId = null;
        this.sortBy = 'date';
        this.knownChordsMode = false;
        this.knownSortBy = 'closest';
        this.artistSearchText = '';
        this.genreSearchText = '';
        this.keySearchText = '';
        this.currentPage = 1;
        this.hasMoreSongs = true;
        this.songs = [];
        this.loadSongs();
    }

    goToPage(page: number): void {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.loadSongs();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: Event): void {
        const target = event.target as HTMLElement;
        if (!target.closest('.filter-autocomplete')) {
            this.closeAllFilterDropdowns();
        }
        if (!target.closest('.sort-btn-wrap')) {
            this.showSortDropdown = false;
        }
    }

    toggleKnownChordsMode(): void {
        if (!this.authService.isLoggedIn) {
            this.authService.requestLogin('/chords');
            return;
        }

        this.knownChordsMode = !this.knownChordsMode;
        if (this.knownChordsMode) {
            this.knownSortBy = 'closest';
            this.search = '';
            this.selectedArtistId = null;
            this.selectedGenreId = null;
            this.selectedKeyId = null;
            this.selectedTagId = null;
            this.selectedTagName = '';
            this.selectedFilterArtistId = null;
            this.artistSearchText = '';
            this.genreSearchText = '';
            this.keySearchText = '';
        }
        this.currentPage = 1;
        this.hasMoreSongs = true;
        this.songs = [];
        this.loadSongs();
    }

    setKnownInstrument(instrument: KnownChordInstrument): void {
        if (this.knownInstrument === instrument) return;
        this.knownInstrument = instrument;
        if (this.knownChordsMode) {
            this.currentPage = 1;
            this.loadKnownChordSongs();
        }
    }

    setKnownSort(sortBy: KnownChordSort): void {
        if (this.knownSortBy === sortBy) return;
        this.knownSortBy = sortBy;
        if (this.knownChordsMode) {
            this.currentPage = 1;
            this.loadKnownChordSongs();
        }
    }

    closeKnownChordsMode(): void {
        this.knownChordsMode = false;
        this.knownSortBy = 'closest';
        this.currentPage = 1;
        this.hasMoreSongs = true;
        this.songs = [];
        this.loadSongs();
    }

    private loadKnownChordSongs(): void {
        this.isLoading = true;
        const maxMissing = this.knownSortBy === 'exact' ? 0 : -1;
        const sortBy = this.knownSortBy === 'exact' ? 'closest' : this.knownSortBy;
        this.knownChordService.getMatchingSongs(
            this.knownInstrument,
            sortBy,
            this.currentPage,
            this.pageSize,
            maxMissing
        ).subscribe({
            next: (res) => {
                this.songs = res.songs || [];
                this.totalCount = res.totalCount;
                this.totalPages = res.totalPages;
                this.hasMoreSongs = this.currentPage < this.totalPages;
                this.isLoading = false;
            },
            error: () => { this.isLoading = false; }
        });
    }

    trackBySong(_: number, song: any): number { return song.id; }
    trackByArtist(_: number, artist: any): number { return artist.id; }
    trackByTag(_: number, tag: SystemItem): number { return tag.id; }

    private closeAllFilterDropdowns(): void {
        this.showArtistDropdown = false;
        this.showGenreDropdown = false;
        this.showKeyDropdown = false;
    }
}
