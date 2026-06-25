import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AdCampaignService } from '../../../../services/admin/ad-campaign.service';
import { AdCampaign, CreateAdCampaignRequest, UpdateAdCampaignRequest } from '../../../../models/admin/advertisement.model';
import { PagedResult } from '../../../../models/pagination.model';
import { CampaignFormComponent } from './campaign-form.component';
import { PaginationComponent } from '../../../shared/pagination/pagination.component';
import { SiteAlertService } from '../../../../services/site-alert.service';


@Component({
  selector: 'app-campaigns-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CampaignFormComponent, PaginationComponent],
  templateUrl: './campaigns-list.component.html',
  styleUrls: ['./campaigns-list.component.css']
})
export class CampaignsListComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly campaignService = inject(AdCampaignService);
  private readonly router = inject(Router);

  campaigns: AdCampaign[] = [];
  filteredCampaigns: AdCampaign[] = [];
  loading = false;
  saving = false;
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-campaigns-view') as 'list' | 'grid') || 'list';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-campaigns-view', mode); }
  searchTerm = '';
  activeTab: 'campaigns' | 'spots' | 'clients' = 'campaigns';

  // Pagination
  totalCount = 0;
  pageNumber = 1;
  pageSize = 25;
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

  async onPageChange(page: number): Promise<void> {
    this.pageNumber = page;
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
    this.saving = true;
    if (this.selectedCampaign) {
      this.campaignService.updateCampaign(this.selectedCampaign.id, campaignData as UpdateAdCampaignRequest).subscribe({
        next: () => {
          this.saving = false;
          this.showCampaignForm = false;
          this.loadCampaigns();
        },
        error: (error) => {
          this.saving = false;
          console.error('Error updating campaign:', error);
          this.siteAlerts.show('שגיאה בפעולה. בדוק את הפרטים ונסה שוב.');
        }
      });
    } else {
      this.campaignService.createCampaign(campaignData as CreateAdCampaignRequest).subscribe({
        next: () => {
          this.saving = false;
          this.showCampaignForm = false;
          this.loadCampaigns();
        },
        error: (error) => {
          this.saving = false;
          console.error('Error creating campaign:', error);
          this.siteAlerts.show('שגיאה בפעולה. בדוק את הפרטים ונסה שוב.');
        }
      });
    }
  }

  onCancelCampaignForm() {
    this.showCampaignForm = false;
    this.selectedCampaign = undefined;
  }

  async deleteCampaign(campaign: AdCampaign): Promise<void> {
    if (!(await this.siteAlerts.confirm(`האם אתה בטוח שברצונך למחוק את הקמפיין "${campaign.name}"?`))) {
      return;
    }

    this.campaignService.deleteCampaign(campaign.id).subscribe({
      next: () => {
        this.loadCampaigns();
      },
      error: (error) => {
        console.error('Error deleting campaign:', error);
        this.siteAlerts.show('שגיאה בפעולה. בדוק את הפרטים ונסה שוב.');
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
