import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AdCampaignService } from '../../../../services/admin/ad-campaign.service';
import { AdCampaign, CreateAdCampaignRequest, UpdateAdCampaignRequest } from '../../../../models/admin/advertisement.model';
import { PagedResult } from '../../../../models/pagination.model';
import { CampaignFormComponent } from './campaign-form.component';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';

@Component({
  selector: 'app-campaigns-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CampaignFormComponent, PaginationComponent],
  templateUrl: './campaigns-list.component.html',
  styleUrls: ['./campaigns-list.component.css']
})
export class CampaignsListComponent implements OnInit {
  private readonly campaignService = inject(AdCampaignService);
  private readonly router = inject(Router);

  campaigns: AdCampaign[] = [];
  filteredCampaigns: AdCampaign[] = [];
  loading = false;
  searchTerm = '';
  activeTab: 'campaigns' | 'spots' | 'clients' = 'campaigns';

  // Pagination
  totalCount = 0;
  pageNumber = 1;
  pageSize = 10;
  totalPages = 0;
  hasPreviousPage = false;
  hasNextPage = false;

  showCampaignForm = false;
  selectedCampaign?: AdCampaign;

  ngOnInit() {
    this.loadCampaigns();
  }

  loadCampaigns() {
    this.loading = true;
    this.campaignService.getCampaigns(this.pageNumber, this.pageSize).subscribe({
      next: (data: PagedResult<AdCampaign>) => {
        this.campaigns = data.items;
        this.filteredCampaigns = data.items;
        this.totalCount = data.totalCount;
        this.totalPages = data.totalPages;
        this.hasPreviousPage = data.hasPreviousPage;
        this.hasNextPage = data.hasNextPage;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading campaigns:', error);
        this.loading = false;
      }
    });
  }

  onPageChange(page: number): void {
    this.pageNumber = page;
    this.loadCampaigns();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.pageNumber = 1; // Reset to first page
    this.loadCampaigns();
  }

  onSearch() {
    if (!this.searchTerm.trim()) {
      this.filteredCampaigns = this.campaigns;
      return;
    }

    const term = this.searchTerm.toLowerCase();
    this.filteredCampaigns = this.campaigns.filter(campaign =>
      campaign.name.toLowerCase().includes(term) ||
      campaign.clientName.toLowerCase().includes(term) ||
      campaign.adSpotName.toLowerCase().includes(term)
    );
  }

  getStatusClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Active': 'status-active',
      'Draft': 'status-draft',
      'Paused': 'status-paused',
      'Completed': 'status-completed',
      'Archived': 'status-archived'
    };
    return statusMap[status] || 'status-default';
  }

  getStatusText(status: string): string {
    const statusTextMap: { [key: string]: string } = {
      'Active': 'פעיל',
      'Draft': 'טיוטה',
      'Paused': 'מושהה',
      'Completed': 'הושלם',
      'Archived': 'ארכיון'
    };
    return statusTextMap[status] || status;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('he-IL');
  }

  formatCurrency(amount: number): string {
    return `₪${amount.toLocaleString('he-IL')}`;
  }

  createNewCampaign() {
    this.selectedCampaign = undefined;
    this.showCampaignForm = true;
  }

  editCampaign(campaign: AdCampaign) {
    this.selectedCampaign = campaign;
    this.showCampaignForm = true;
  }

  onSaveCampaign(campaignData: CreateAdCampaignRequest | UpdateAdCampaignRequest) {
    if (this.selectedCampaign) {
      // Edit mode
      this.campaignService.updateCampaign(this.selectedCampaign.id, campaignData as UpdateAdCampaignRequest).subscribe({
        next: () => {
          this.showCampaignForm = false;
          this.loadCampaigns();
        },
        error: (error) => {
          console.error('Error updating campaign:', error);
          alert('שגיאה בעדכון הקמפיין');
        }
      });
    } else {
      // Create mode
      this.campaignService.createCampaign(campaignData as CreateAdCampaignRequest).subscribe({
        next: () => {
          this.showCampaignForm = false;
          this.loadCampaigns();
        },
        error: (error) => {
          console.error('Error creating campaign:', error);
          console.error('Error details:', error.error);
          if (error.error?.errors) {
            console.error('Validation errors:', error.error.errors);
            const errorMessages = Object.entries(error.error.errors)
              .map(([field, messages]: [string, any]) => `${field}: ${messages.join(', ')}`)
              .join('\n');
            alert(`שגיאה ביצירת הקמפיין:\n${errorMessages}`);
          } else {
            alert('שגיאה ביצירת הקמפיין');
          }
        }
      });
    }
  }

  onCancelCampaignForm() {
    this.showCampaignForm = false;
    this.selectedCampaign = undefined;
  }

  deleteCampaign(campaign: AdCampaign) {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הקמפיין "${campaign.name}"?`)) {
      return;
    }

    this.campaignService.deleteCampaign(campaign.id).subscribe({
      next: () => {
        this.loadCampaigns();
      },
      error: (error) => {
        console.error('Error deleting campaign:', error);
        alert('שגיאה במחיקת הקמפיין');
      }
    });
  }

  switchTab(tab: 'campaigns' | 'spots' | 'clients') {
    this.activeTab = tab;
    if (tab === 'spots') {
      this.router.navigate(['/admin/advertising/spots']);
    } else if (tab === 'clients') {
      this.router.navigate(['/admin/advertising/clients']);
    }
  }
}
