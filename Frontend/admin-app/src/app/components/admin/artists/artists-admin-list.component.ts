import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { ArtistService } from '../../../services/artist.service';
import { AgencyService } from '../../../services/agency.service';
import { ArtistListDto, ArtistStatus } from '../../../models/artist.model';
import { PagedResult } from '../../../models/user.model';
import { AgencyListDto, UpsertAgencyProfileDto, AgencyContactMode } from '../../../models/agency.model';
import { ArtistEditModalComponent } from './artist-edit-modal.component';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';
import { AdminUsersLayoutActionsService } from '../users/users-layout/users-layout-actions.service';
import { SiteAlertService } from '../../../services/site-alert.service';
import { BumpModalComponent } from '../../shared/bump-modal/bump-modal.component';
import { environment } from '../../../../environments/environment';
import { artistRoute } from '../../../utils/slug';

@Component({
  selector: 'app-artists-admin-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ArtistEditModalComponent, ImgFallbackDirective, BumpModalComponent],
  templateUrl: './artists-admin-list.component.html',
  styleUrls: ['./artists-admin-list.component.css']
})
export class ArtistsAdminListComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  artists: ArtistListDto[] = [];
  loading = false;
  error: string | null = null;
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-artists-view') as 'list' | 'grid') || 'list';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-artists-view', mode); }

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
    private agencyService: AgencyService,
    private http: HttpClient,
    private router: Router,
    private layoutActions: AdminUsersLayoutActionsService
  ) { }
  
  // Batch selection
  selectionMode = false;
  selectedIds = new Set<number>();
  bumpModalOpen = false;
  agencies: AgencyListDto[] = [];
  selectedAgencyId: number | null = null;

  ngOnInit(): void {
    this.loadArtists();
    this.loadAgencies();
    this.layoutActions.addArtistRequest$.subscribe(() => {
      this.showEditModal = true;
      this.selectedArtistId = null;
    });
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

  viewArtist(artist: ArtistListDto): void {
    this.router.navigate(artistRoute(artist));
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

  // ============================================================
  // Batch selection
  // ============================================================

  toggleSelectionMode(): void {
    this.selectionMode = !this.selectionMode;
    if (!this.selectionMode) {
      this.selectedIds.clear();
      this.selectedAgencyId = null;
    }
  }

  clearSelection(): void {
    this.selectedIds.clear();
    this.selectedAgencyId = null;
  }

  toggleArtist(id: number): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  toggleSelectAll(): void {
    if (this.isAllSelected) {
      this.selectedIds.clear();
    } else {
      this.artists.forEach(a => this.selectedIds.add(a.id));
    }
  }

  get isAllSelected(): boolean {
    return this.artists.length > 0 && this.artists.every(a => this.selectedIds.has(a.id));
  }

  get selectedIdsArray(): number[] {
    return Array.from(this.selectedIds);
  }

  openBumpModal(): void {
    this.bumpModalOpen = true;
  }

  onBumped(): void {
    this.bumpModalOpen = false;
    this.selectedIds.clear();
    this.loadArtists();
  }

  async bulkDeleteSelected(): Promise<void> {
    const ids = this.selectedIdsArray;
    if (ids.length === 0) return;
    if (!await this.siteAlerts.confirm(`למחוק ${ids.length} אומנים? פעולה זו אינה הפיכה.`)) return;
    forkJoin(ids.map(id => this.artistService.deleteArtist(id))).subscribe({
      next: () => {
        this.selectedIds.clear();
        this.loadArtists();
      },
      error: (err) => {
        console.error('שגיאה במחיקה מרובה:', err);
        alert('שגיאה במחיקת האומנים');
      }
    });
  }

  private loadAgencies(): void {
    this.http.get<{ items: AgencyListDto[] }>(`${environment.apiBaseUrl}/api/Agencies`, { params: { pageSize: '100' } })
      .subscribe({
        next: (data) => this.agencies = data?.items || [],
        error: () => this.agencies = []
      });
  }

  async assignToAgency(): Promise<void> {
    if (!this.selectedAgencyId || this.selectedIds.size === 0) return;
    const targetAgency = this.agencies.find(a => a.id === this.selectedAgencyId);
    if (!targetAgency) return;

    if (!await this.siteAlerts.confirm(`לשייך ${this.selectedIds.size} אמנים לסוכנות "${targetAgency.name}"?`)) return;

    let done = 0;
    let failed = 0;
    const ids = Array.from(this.selectedIds);

    for (const id of ids) {
      try {
        await this.agencyService.addProfile(this.selectedAgencyId, {
          profileType: 'artist',
          profileId: id,
          contactMode: AgencyContactMode.Agency,
          showBadge: true,
          isFeaturedByAgency: false,
          displayOrder: 0
        }).toPromise();
        done++;
      } catch {
        failed++;
      }
    }

    this.selectedIds.clear();
    this.selectionMode = false;
    this.selectedAgencyId = null;
    alert(`שויכו ${done} פרופילים${failed > 0 ? `, ${failed} נכשלו` : ''}`);
    this.loadArtists();
  }
}
