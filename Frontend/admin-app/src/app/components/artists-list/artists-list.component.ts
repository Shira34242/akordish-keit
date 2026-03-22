import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { ArtistService } from '../../services/artist.service';
import { ArtistListDto, ArtistStatus } from '../../models/artist.model';

@Component({
  selector: 'app-artists-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './artists-list.component.html',
  styleUrls: ['./artists-list.component.css']
})
export class ArtistsListComponent implements OnInit, OnDestroy {
  featuredArtists: ArtistListDto[] = [];
  allArtists: ArtistListDto[] = [];

  loadingFeatured = true;
  loadingAll = true;

  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalCount = 0;

  // Filters
  filterPremium: boolean | undefined = undefined;
  sortBy: string = 'name';
  searchTerm: string = '';

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private artistService: ArtistService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadFeaturedArtists();
    this.loadAllArtists();

    // חיפוש שרת עם debounce — 300ms אחרי שהמשתמש מפסיק להקליד
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.loadAllArtists(1, term);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchTermChange(term: string): void {
    this.searchSubject.next(term.trim());
  }

  loadFeaturedArtists(): void {
    this.loadingFeatured = true;

    this.artistService.getFeaturedArtists(10).subscribe({
      next: (artists) => {
        this.featuredArtists = artists;
        this.loadingFeatured = false;
      },
      error: (error) => {
        console.error('Error loading featured artists:', error);
        this.loadingFeatured = false;
      }
    });
  }

  loadAllArtists(page: number = 1, search?: string): void {
    this.loadingAll = true;

    const searchParam = search !== undefined ? search : this.searchTerm.trim() || undefined;

    this.artistService.getArtists(
      this.filterPremium,
      ArtistStatus.Active,
      page,
      this.pageSize,
      this.sortBy,
      searchParam
    ).subscribe({
      next: (result) => {
        this.allArtists = result.items;
        this.totalCount = result.totalCount;
        this.currentPage = page;
        this.loadingAll = false;
      },
      error: (error) => {
        console.error('Error loading artists:', error);
        this.loadingAll = false;
      }
    });
  }

  onFilterChange(): void {
    this.loadAllArtists(1);
  }

  setSortBy(sort: string): void {
    this.sortBy = sort;
    this.loadAllArtists(1);
  }

  navigateToArtist(artistId: number): void {
    this.router.navigate(['/artist', artistId]);
  }

  get totalPages(): number {
    return Math.ceil(this.totalCount / this.pageSize);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.loadAllArtists(this.currentPage + 1);
    }
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.loadAllArtists(this.currentPage - 1);
    }
  }

  goToPage(page: number): void {
    this.loadAllArtists(page);
  }

  becomeArtist(): void {
    localStorage.setItem('pendingProfessionalType', 'artist');
    this.router.navigate(['/subscription/select'], {
      queryParams: { from: 'become-artist' }
    });
  }
}
