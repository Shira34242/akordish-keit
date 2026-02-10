import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AdSpotService } from '../../../../services/admin/ad-spot.service';
import { AdSpot, CreateAdSpotRequest, UpdateAdSpotRequest } from '../../../../models/admin/advertisement.model';
import { PagedResult } from '../../../../models/pagination.model';
import { AdSpotFormComponent } from './ad-spot-form.component';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';

@Component({
  selector: 'app-ad-spots-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdSpotFormComponent, PaginationComponent],
  templateUrl: './ad-spots-list.component.html',
  styleUrls: ['./ad-spots-list.component.css']
})
export class AdSpotsListComponent implements OnInit {
  private readonly adSpotService = inject(AdSpotService);
  private readonly router = inject(Router);

  adSpots: AdSpot[] = [];
  filteredAdSpots: AdSpot[] = [];
  loading = false;
  searchTerm = '';
  activeTab: 'campaigns' | 'spots' | 'clients' = 'spots';

  // Pagination
  totalCount = 0;
  pageNumber = 1;
  pageSize = 10;
  totalPages = 0;
  hasPreviousPage = false;
  hasNextPage = false;

  showAdSpotForm = false;
  selectedAdSpot?: AdSpot;

  ngOnInit() {
    this.loadAdSpots();
  }

  loadAdSpots() {
    this.loading = true;
    this.adSpotService.getAdSpots(this.pageNumber, this.pageSize).subscribe({
      next: (data: PagedResult<AdSpot>) => {
        this.adSpots = data.items;
        this.filteredAdSpots = data.items;
        this.totalCount = data.totalCount;
        this.totalPages = data.totalPages;
        this.hasPreviousPage = data.hasPreviousPage;
        this.hasNextPage = data.hasNextPage;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading ad spots:', error);
        this.loading = false;
      }
    });
  }

  onPageChange(page: number): void {
    this.pageNumber = page;
    this.loadAdSpots();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.pageNumber = 1;
    this.loadAdSpots();
  }

  onSearch() {
    if (!this.searchTerm.trim()) {
      this.filteredAdSpots = this.adSpots;
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredAdSpots = this.adSpots.filter(spot =>
      spot.name.toLowerCase().includes(term) ||
      spot.technicalId.toLowerCase().includes(term)
    );
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

  onSaveAdSpot(spotData: CreateAdSpotRequest | UpdateAdSpotRequest) {
    if (this.selectedAdSpot) {
      // Edit mode
      this.adSpotService.updateAdSpot(this.selectedAdSpot.id, spotData as UpdateAdSpotRequest).subscribe({
        next: () => {
          this.showAdSpotForm = false;
          this.loadAdSpots();
        },
        error: (error) => {
          console.error('Error updating ad spot:', error);
          alert('שגיאה בעדכון שטח הפרסום');
        }
      });
    } else {
      // Create mode
      this.adSpotService.createAdSpot(spotData as CreateAdSpotRequest).subscribe({
        next: () => {
          this.showAdSpotForm = false;
          this.loadAdSpots();
        },
        error: (error) => {
          console.error('Error creating ad spot:', error);
          alert('שגיאה ביצירת שטח פרסום');
        }
      });
    }
  }

  onCancelAdSpotForm() {
    this.showAdSpotForm = false;
    this.selectedAdSpot = undefined;
  }

  deleteSpot(spot: AdSpot) {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את המיקום "${spot.name}"?`)) {
      return;
    }

    this.adSpotService.deleteAdSpot(spot.id).subscribe({
      next: () => {
        this.loadAdSpots();
      },
      error: (error) => {
        console.error('Error deleting spot:', error);
        alert('שגיאה במחיקת המיקום. ייתכן שיש לו קמפיינים פעילים.');
      }
    });
  }

  switchTab(tab: 'campaigns' | 'spots' | 'clients') {
    this.activeTab = tab;
    if (tab === 'campaigns') {
      this.router.navigate(['/admin/advertising']);
    } else if (tab === 'clients') {
      this.router.navigate(['/admin/advertising/clients']);
    }
  }
}
