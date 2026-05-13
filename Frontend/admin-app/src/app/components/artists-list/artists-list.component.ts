import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, HostListener, ViewChild } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { ArtistService } from '../../services/artist.service';
import { LanguageService } from '../../services/language.service';
import { ArtistListDto, ArtistStatus } from '../../models/artist.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ArtistCircleComponent } from '../shared/artist-circle/artist-circle.component';
import { AutoScrollDirective } from '../../directives/auto-scroll.directive';

@Component({
  selector: 'app-artists-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslatePipe, ArtistCircleComponent, AutoScrollDirective],
  templateUrl: './artists-list.component.html',
  styleUrls: ['./artists-list.component.css']
})
export class ArtistsListComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('heroBg') heroBg?: ElementRef<HTMLDivElement>;

  featuredArtists: ArtistListDto[] = [];
  popularArtists: ArtistListDto[] = [];
  allArtists: ArtistListDto[] = [];

  loadingFeatured = true;
  loadingPopular = true;
  loadingAll = true;

  // Pagination
  currentPage = 1;
  pageSize = 20;
  totalCount = 0;

  // Filters
  filterPremium: boolean | undefined = undefined;
  sortBy: string = 'name';
  searchTerm: string = '';
  showSortDropdown = false;

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();
  private fullHeroHeight = 0;
  private rafPending = false;

  constructor(
    private artistService: ArtistService,
    private router: Router,
    private langService: LanguageService
  ) {}

  ngOnInit(): void {
    this.loadFeaturedArtists();
    this.loadPopularArtists();
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

  ngAfterViewInit(): void {
    setTimeout(() => this.initHeroHeight(), 0);
  }

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

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showSortDropdown = false;
  }

  private initHeroHeight(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg) return;
    this.fullHeroHeight = Math.round(window.innerHeight * 0.6);
    bg.style.height = `${this.fullHeroHeight}px`;
    this.shrinkHero();
  }

  private shrinkHero(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg || this.fullHeroHeight === 0) return;

    const minHeight = 56;
    const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
    bg.style.height = `${newHeight}px`;

    const collapseOverlay = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
    if (collapseOverlay) {
      const collapseRange = this.fullHeroHeight - minHeight;
      const collapseProgress = collapseRange > 0
        ? Math.min(1, (this.fullHeroHeight - newHeight) / collapseRange)
        : 0;
      collapseOverlay.style.opacity = String(collapseProgress);
    }
  }

  onSearchTermChange(term: string): void {
    this.searchSubject.next(term.trim());
  }

  loadFeaturedArtists(): void {
    this.loadingFeatured = true;

    this.artistService.getFeaturedArtists(12).subscribe({
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

  loadPopularArtists(): void {
    this.loadingPopular = true;

    this.artistService.getTopArtists(12).subscribe({
      next: (artists) => {
        this.popularArtists = artists;
        this.loadingPopular = false;
      },
      error: (error) => {
        console.error('Error loading popular artists:', error);
        this.loadingPopular = false;
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

  toggleSortDropdown(): void {
    this.showSortDropdown = !this.showSortDropdown;
  }

  getSortLabel(): string {
    const keys: Record<string, string> = {
      'name': 'artists.sort_az',
      'songcount': 'artists.sort_popular',
      'created': 'artists.sort_new'
    };
    return this.langService.translate(keys[this.sortBy] || 'artists.sort_az');
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

  trackById(index: number, item: any): number {
    return item.id;
  }
}
