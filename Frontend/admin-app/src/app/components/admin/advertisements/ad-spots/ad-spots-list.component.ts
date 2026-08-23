import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AdSpotService } from '../../../../services/admin/ad-spot.service';
import { AdSpot, CreateAdSpotRequest, UpdateAdSpotRequest } from '../../../../models/admin/advertisement.model';
import { PagedResult } from '../../../../models/pagination.model';
import { AdSpotFormComponent } from './ad-spot-form.component';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { SiteAlertService } from '../../../../services/site-alert.service';


@Component({
  selector: 'app-ad-spots-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdSpotFormComponent, PaginationComponent],
  templateUrl: './ad-spots-list.component.html',
  styleUrls: ['./ad-spots-list.component.css']
})
export class AdSpotsListComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly adSpotService = inject(AdSpotService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  adSpots: AdSpot[] = [];
  filteredAdSpots: AdSpot[] = [];
  loading = false;
  saving = false;
  searchTerm = '';
  private searchTimer?: ReturnType<typeof setTimeout>;
  private pendingEditId?: number;
  activeTab: 'campaigns' | 'spots' | 'clients' | 'links' = 'spots';
  viewMode: 'list' | 'grid' = window.innerWidth <= 768
    ? 'grid'
    : (localStorage.getItem('admin-ad-spots-view') as 'list' | 'grid') || 'list';

  // Pagination
  totalCount = 0;
  pageNumber = 1;
  pageSize = 25;
  totalPages = 0;
  hasPreviousPage = false;
  hasNextPage = false;

  showAdSpotForm = false;
  selectedAdSpot?: AdSpot;

  ngOnInit() {
    const requestedId = Number(this.route.snapshot.queryParamMap.get('edit'));
    this.pendingEditId = Number.isFinite(requestedId) && requestedId > 0 ? requestedId : undefined;
    this.loadAdSpots();
  }

  loadAdSpots() {
    this.loading = true;
    this.adSpotService.getAdSpots(this.pageNumber, this.pageSize, this.searchTerm).subscribe({
      next: (data: PagedResult<AdSpot>) => {
        this.adSpots = data.items;
        this.filteredAdSpots = data.items;
        this.totalCount = data.totalCount;
        this.totalPages = data.totalPages;
        this.hasPreviousPage = data.hasPreviousPage;
        this.hasNextPage = data.hasNextPage;
        this.loading = false;
        this.openRequestedSpot();
      },
      error: (error) => {
        console.error('Error loading ad spots:', error);
        this.loading = false;
      }
    });
  }

  async onPageChange(page: number): Promise<void> {
    this.pageNumber = page;
    this.loadAdSpots();
  }

  onSearch() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.pageNumber = 1;
      this.loadAdSpots();
    }, 300);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth <= 768) this.viewMode = 'grid';
  }

  setView(mode: 'list' | 'grid') {
    this.viewMode = mode;
    localStorage.setItem('admin-ad-spots-view', mode);
  }

  getAvailabilityClass(availability: string): string {
    const classMap: { [key: string]: string } = {
      'Available': 'availability-available',
      'Occupied': 'availability-occupied',
      'Scheduled': 'availability-scheduled'
    };
    return classMap[availability] || 'availability-default';
  }

  getAvailabilityText(availability: string): string {
    const textMap: { [key: string]: string } = {
      'Available': 'פנוי',
      'Occupied': 'תפוס',
      'Scheduled': 'מיידי'
    };
    return textMap[availability] || availability;
  }

  getCapacityClass(spot: AdSpot): string {
    if (spot.activeCampaigns >= 5) return 'unavailable';
    if (spot.activeCampaigns > 0) return 'partial';
    return 'available';
  }

  getCapacityText(spot: AdSpot): string {
    return `${Math.min(spot.activeCampaigns, 5)} מתוך 5`;
  }

  formatCurrency(amount: number): string {
    return `₪${amount.toLocaleString('he-IL')}`;
  }

  formatDate(date: Date | undefined): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('he-IL');
  }

  createNewSpot() {
    this.selectedAdSpot = undefined;
    this.showAdSpotForm = true;
  }

  editSpot(spot: AdSpot) {
    this.selectedAdSpot = spot;
    this.showAdSpotForm = true;
  }

  private openRequestedSpot(): void {
    const requestedId = this.pendingEditId;
    if (!requestedId) return;
    this.pendingEditId = undefined;

    const loadedSpot = this.adSpots.find(spot => spot.id === requestedId);
    if (loadedSpot) {
      this.editSpot(loadedSpot);
      return;
    }

    this.adSpotService.getAdSpot(requestedId).subscribe({
      next: spot => this.editSpot(spot),
      error: () => this.siteAlerts.show('לא ניתן לפתוח את שטח הפרסום המבוקש.')
    });
  }

  onSaveAdSpot(spotData: CreateAdSpotRequest | UpdateAdSpotRequest) {
    this.saving = true;
    if (this.selectedAdSpot) {
      this.adSpotService.updateAdSpot(this.selectedAdSpot.id, spotData as UpdateAdSpotRequest).subscribe({
        next: () => {
          this.saving = false;
          this.showAdSpotForm = false;
          this.loadAdSpots();
        },
        error: (error) => {
          this.saving = false;
          console.error('Error updating ad spot:', error);
          this.siteAlerts.show('שגיאה בפעולה. בדוק את הפרטים ונסה שוב.');
        }
      });
    } else {
      this.adSpotService.createAdSpot(spotData as CreateAdSpotRequest).subscribe({
        next: () => {
          this.saving = false;
          this.showAdSpotForm = false;
          this.loadAdSpots();
        },
        error: (error) => {
          this.saving = false;
          console.error('Error creating ad spot:', error);
          this.siteAlerts.show('שגיאה בפעולה. בדוק את הפרטים ונסה שוב.');
        }
      });
    }
  }

  onCancelAdSpotForm() {
    this.showAdSpotForm = false;
    this.selectedAdSpot = undefined;
  }

  async deleteSpot(spot: AdSpot): Promise<void> {
    if (!(await this.siteAlerts.confirm(`האם אתה בטוח שברצונך למחוק את המיקום "${spot.name}"?`))) {
      return;
    }

    this.adSpotService.deleteAdSpot(spot.id).subscribe({
      next: () => {
        this.loadAdSpots();
      },
      error: (error) => {
        console.error('Error deleting spot:', error);
        this.siteAlerts.show('שגיאה בפעולה. בדוק את הפרטים ונסה שוב.');
      }
    });
  }

  switchTab(tab: 'campaigns' | 'spots' | 'clients' | 'links') {
    this.activeTab = tab;
    if (tab === 'campaigns') {
      this.router.navigate(['/admin/advertising']);
    } else if (tab === 'clients') {
      this.router.navigate(['/admin/advertising/clients']);
    } else if (tab === 'links') {
      this.router.navigate(['/admin/advertising/links']);
    }
  }
}
