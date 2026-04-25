import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ArtistService } from '../../../services/artist.service';
import { ArtistListDto, ArtistStatus } from '../../../models/artist.model';
import { PagedResult } from '../../../models/user.model';
import { ArtistEditModalComponent } from './artist-edit-modal.component';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';
import { AdminUsersLayoutActionsService } from '../users/users-layout/users-layout-actions.service';
import { SiteAlertService } from '../../../services/site-alert.service';


@Component({
  selector: 'app-artists-admin-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ArtistEditModalComponent, ImgFallbackDirective],
  templateUrl: './artists-admin-list.component.html',
  styleUrls: ['./artists-admin-list.component.css']
})
export class ArtistsAdminListComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  artists: ArtistListDto[] = [];
  loading = false;
  error: string | null = null;

  // Modal state
  showEditModal = false;
  selectedArtistId: number | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 25;
  totalCount = 0;
  totalPages = 0;

  // Filters
  searchTerm = '';
  filterStatus: ArtistStatus | null = null;
  filterPremium: boolean | null = null;
  sortBy = 'name';

  // Status enum for dropdown
  ArtistStatus = ArtistStatus;
  statusOptions = [
    { value: null, label: 'כל הסטטוסים' },
    { value: ArtistStatus.Pending, label: 'ממתין לאישור' },
    { value: ArtistStatus.Active, label: 'פעיל' },
    { value: ArtistStatus.Hidden, label: 'מוסתר' }
  ];

  premiumOptions = [
    { value: null, label: 'הכל' },
    { value: true, label: 'משלמים בלבד' },
    { value: false, label: 'חינמיים בלבד' }
  ];

  sortOptions = [
    { value: 'name', label: 'שם (א-ב)' },
    { value: 'songcount', label: 'לפי מספר שירים' },
    { value: 'created', label: 'חדשים ביותר' }
  ];

  constructor(
    private artistService: ArtistService,
    private router: Router,
    private layoutActions: AdminUsersLayoutActionsService
  ) { }

  ngOnInit(): void {
    this.loadArtists();
    this.layoutActions.addArtistRequest$.subscribe(() => this.addNewArtist());
  }

  loadArtists(): void {
    this.loading = true;
    this.error = null;

    this.artistService.getArtists(
      this.filterPremium ?? undefined,
      this.filterStatus ?? undefined,
      this.currentPage,
      this.pageSize,
      this.sortBy
    ).subscribe({
      next: (result: PagedResult<ArtistListDto>) => {
        this.artists = result.items;
        this.totalCount = result.totalCount;
        this.totalPages = Math.ceil(result.totalCount / result.pageSize);
        this.loading = false;
      },
      error: (err) => {
        console.error('שגיאה בטעינת אומנים:', err);
        this.error = 'שגיאה בטעינת נתוני האומנים';
        this.loading = false;
      }
    });
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadArtists();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterStatus = null;
    this.filterPremium = null;
    this.sortBy = 'name';
    this.currentPage = 1;
    this.loadArtists();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadArtists();
    }
  }

  editArtist(id: number): void {
    this.selectedArtistId = id;
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedArtistId = null;
  }

  onArtistSaved(): void {
    this.loadArtists(); // Reload the list after saving
  }

  viewArtist(id: number): void {
    this.router.navigate(['/artist', id]);
  }

  async approveArtist(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם לאשר את האומן ולהפוך אותו לפעיל?')) {
      this.artistService.updateArtistStatus(id, ArtistStatus.Active).subscribe({
        next: () => {
          this.loadArtists();
        },
        error: (err) => {
          console.error('שגיאה באישור אומן:', err);
          alert('שגיאה באישור האומן');
        }
      });
    }
  }

  async hideArtist(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם להסתיר את האומן?')) {
      this.artistService.updateArtistStatus(id, ArtistStatus.Hidden).subscribe({
        next: () => {
          this.loadArtists();
        },
        error: (err) => {
          console.error('שגיאה בהסתרת אומן:', err);
          alert('שגיאה בהסתרת האומן');
        }
      });
    }
  }

  async activateArtist(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם להפעיל את דף האמן ולהחזיר אותו לאינדקס?')) {
      this.artistService.updateArtistStatus(id, ArtistStatus.Active).subscribe({
        next: () => {
          this.loadArtists();
        },
        error: (err) => {
          console.error('שגיאה בהפעלת אמן:', err);
          alert('שגיאה בהפעלת האמן');
        }
      });
    }
  }

  async deleteArtist(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם למחוק את האומן? פעולה זו אינה הפיכה.')) {
      this.artistService.deleteArtist(id).subscribe({
        next: () => {
          alert('האומן נמחק בהצלחה');
          this.loadArtists();
        },
        error: (err) => {
          console.error('שגיאה במחיקת אומן:', err);
          alert('שגיאה במחיקת האומן');
        }
      });
    }
  }

  async duplicateArtist(id: number, name: string): Promise<void> {
    if (await this.siteAlerts.confirm(`האם לשכפל את האומן "${name}"?`)) {
      this.artistService.duplicateArtist(id).subscribe({
        next: (duplicate) => {
          alert(`האומן "${duplicate.name}" שוכפל בהצלחה!`);
          this.loadArtists();
        },
        error: (err) => {
          console.error('שגיאה בשכפול אומן:', err);
          alert('שגיאה בשכפול האומן');
        }
      });
    }
  }

  addNewArtist(): void {
    this.selectedArtistId = null;
    this.showEditModal = true;
  }

  getStatusBadgeClass(status: ArtistStatus): string {
    switch (status) {
      case ArtistStatus.Pending: return 'badge-warning';
      case ArtistStatus.Active: return 'badge-success';
      case ArtistStatus.Hidden: return 'badge-danger';
      default: return 'badge-secondary';
    }
  }

  getStatusLabel(status: ArtistStatus): string {
    switch (status) {
      case ArtistStatus.Pending: return 'ממתין לאישור';
      case ArtistStatus.Active: return 'פעיל';
      case ArtistStatus.Hidden: return 'מוסתר';
      default: return 'לא ידוע';
    }
  }

  getPaginationRange(): number[] {
    const range: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);

    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }
}
