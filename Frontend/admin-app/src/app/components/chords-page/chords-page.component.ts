import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SongService } from '../../services/song.service';
import { SongCardComponent } from '../shared/song-card/song-card.component';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MusicalKey } from '../../models/song.model';

@Component({
    selector: 'app-chords-page',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, SongCardComponent],
    templateUrl: './chords-page.component.html',
    styleUrls: ['./chords-page.component.css']
})
export class ChordsPageComponent implements OnInit {
    songs: any[] = [];
    totalCount: number = 0;
    isLoading: boolean = false;

    // Pagination
    currentPage: number = 1;
    pageSize: number = 20;
    totalPages: number = 0;

    // Filters
    search: string = '';
    selectedArtistId: number | null = null;
    selectedGenreId: number | null = null;
    selectedKeyId: number | null = null;
    sortBy: string = 'date';

    // Autocomplete data
    artists: any[] = [];
    genres: any[] = [];
    musicalKeys: MusicalKey[] = [];

    // Filtered lists (max 10)
    filteredArtists: any[] = [];
    filteredGenres: any[] = [];
    filteredKeys: MusicalKey[] = [];

    // Search text for autocomplete
    artistSearchText: string = '';
    genreSearchText: string = '';
    keySearchText: string = '';

    // Dropdown visibility
    showArtistDropdown: boolean = false;
    showGenreDropdown: boolean = false;
    showKeyDropdown: boolean = false;

    private searchSubject = new Subject<string>();

    constructor(private songService: SongService) {
        this.searchSubject.pipe(
            debounceTime(500),
            distinctUntilChanged()
        ).subscribe(query => {
            this.search = query;
            this.currentPage = 1;
            this.loadSongs();
        });
    }

    ngOnInit(): void {
        this.loadSongs();
        this.loadFilterData();
    }

    // Close dropdowns when clicking outside
    @HostListener('document:click', ['$event'])
    onDocumentClick(event: Event): void {
        const target = event.target as HTMLElement;
        if (!target.closest('.filter-autocomplete')) {
            this.showArtistDropdown = false;
            this.showGenreDropdown = false;
            this.showKeyDropdown = false;
        }
    }

    loadSongs(): void {
        this.isLoading = true;
        this.songService.getSongs(
            this.search || undefined,
            this.currentPage,
            this.pageSize,
            this.selectedArtistId || undefined,
            this.selectedGenreId || undefined,
            this.selectedKeyId || undefined,
            this.sortBy
        ).subscribe({
            next: (res) => {
                this.songs = res.songs;
                this.totalCount = res.totalCount;
                this.totalPages = res.totalPages;
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Failed to load songs', err);
                this.isLoading = false;
            }
        });
    }

    loadFilterData(): void {
        this.songService.getMusicalKeys().subscribe(keys => {
            this.musicalKeys = keys;
            this.filteredKeys = keys.slice(0, 10);
        });

        this.songService.getAllArtists().subscribe(artists => {
            this.artists = artists;
            this.filteredArtists = artists.slice(0, 10);
        });

        this.songService.getGenres().subscribe(genres => {
            this.genres = genres;
            this.filteredGenres = genres.slice(0, 10);
        });
    }

    // Artist autocomplete
    onArtistSearch(event: Event): void {
        const query = (event.target as HTMLInputElement).value.toLowerCase();
        this.showArtistDropdown = true;
        
        if (!query) {
            this.filteredArtists = this.artists.slice(0, 10);
        } else {
            this.filteredArtists = this.artists
                .filter(a => a.name.toLowerCase().includes(query) || 
                            (a.englishName && a.englishName.toLowerCase().includes(query)))
                .slice(0, 10);
        }
    }

    selectArtist(artist: any): void {
        if (artist) {
            this.selectedArtistId = artist.id;
            this.artistSearchText = artist.name;
        } else {
            this.selectedArtistId = null;
            this.artistSearchText = '';
        }
        this.showArtistDropdown = false;
        this.onFilterChange();
    }

    // Genre autocomplete
    onGenreSearch(event: Event): void {
        const query = (event.target as HTMLInputElement).value.toLowerCase();
        this.showGenreDropdown = true;
        
        if (!query) {
            this.filteredGenres = this.genres.slice(0, 10);
        } else {
            this.filteredGenres = this.genres
                .filter(g => g.name.toLowerCase().includes(query))
                .slice(0, 10);
        }
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

    // Key autocomplete
    onKeySearch(event: Event): void {
        const query = (event.target as HTMLInputElement).value.toLowerCase();
        this.showKeyDropdown = true;
        
        if (!query) {
            this.filteredKeys = this.musicalKeys.slice(0, 10);
        } else {
            this.filteredKeys = this.musicalKeys
                .filter(k => k.displayName.toLowerCase().includes(query) || 
                            k.name.toLowerCase().includes(query))
                .slice(0, 10);
        }
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
        const value = (event.target as HTMLInputElement).value;
        this.searchSubject.next(value);
    }

    onFilterChange(): void {
        this.currentPage = 1;
        this.loadSongs();
    }

    clearFilters(): void {
        this.search = '';
        this.selectedArtistId = null;
        this.selectedGenreId = null;
        this.selectedKeyId = null;
        this.sortBy = 'date';
        this.artistSearchText = '';
        this.genreSearchText = '';
        this.keySearchText = '';
        this.currentPage = 1;
        this.loadSongs();
    }

    goToPage(page: number): void {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.loadSongs();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }
}