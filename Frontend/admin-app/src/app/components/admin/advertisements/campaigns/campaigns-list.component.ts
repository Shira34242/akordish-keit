import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AdCampaignService } from '../../../../services/admin/ad-campaign.service';
import { AdCampaign, AdCampaignStats, CreateAdCampaignRequest, UpdateAdCampaignRequest } from '../../../../models/admin/advertisement.model';
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
  private readonly route = inject(ActivatedRoute);

  campaigns: AdCampaign[] = [];
  filteredCampaigns: AdCampaign[] = [];
  loading = false;
  saving = false;
  viewMode: 'list' | 'grid' = window.innerWidth <= 768
    ? 'grid'
    : (localStorage.getItem('admin-campaigns-view') as 'list' | 'grid') || 'list';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-campaigns-view', mode); }
  searchTerm = '';
  private searchTimer?: ReturnType<typeof setTimeout>;
  activeTab: 'campaigns' | 'spots' | 'clients' | 'links' = 'campaigns';

  // Pagination
  totalCount = 0;
  pageNumber = 1;
  pageSize = 25;
  totalPages = 0;
  hasPreviousPage = false;
  hasNextPage = false;

  showCampaignForm = false;
  selectedCampaign?: AdCampaign;
  campaignStats?: AdCampaignStats;
  initialClientId?: number;
  initialAdSpotId?: number;

  ngOnInit() {
    this.loadStats();
    this.loadCampaigns();
    const clientId = Number(this.route.snapshot.queryParamMap.get('clientId'));
    const adSpotId = Number(this.route.snapshot.queryParamMap.get('adSpotId'));
    const shouldCreate = this.route.snapshot.queryParamMap.get('create') === '1';
    this.initialClientId = Number.isFinite(clientId) && clientId > 0 ? clientId : undefined;
    this.initialAdSpotId = Number.isFinite(adSpotId) && adSpotId > 0 ? adSpotId : undefined;
    if (shouldCreate || this.initialClientId || this.initialAdSpotId) {
      this.showCampaignForm = true;
    }
  }

  loadStats(): void {
    this.campaignService.getStats().subscribe({
      next: stats => this.campaignStats = stats,
      error: error => console.error('Error loading campaign stats:', error)
    });
  }

  loadCampaigns() {
    this.loading = true;
    this.campaignService.getCampaigns(this.pageNumber, this.pageSize, undefined, this.searchTerm).subscribe({
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
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.pageNumber = 1;
      this.loadCampaigns();
    }, 300);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth <= 768) this.viewMode = 'grid';
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

  getMediaType(url: string | undefined): 'image' | 'video' {
    const normalized = (url || '').toLowerCase().split('?')[0].split('#')[0];
    return ['.mp4', '.webm', '.ogg', '.ogv'].some(extension => normalized.endsWith(extension))
      ? 'video'
      : 'image';
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('he-IL');
  }

  formatCurrency(amount: number): string {
    return `₪${amount.toLocaleString('he-IL')}`;
  }

  createNewCampaign() {
    this.selectedCampaign = undefined;
    this.initialClientId = undefined;
    this.initialAdSpotId = undefined;
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
          this.loadStats();
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
          this.loadStats();
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
        this.loadStats();
        this.loadCampaigns();
      },
      error: (error) => {
        console.error('Error deleting campaign:', error);
        this.siteAlerts.show('שגיאה בפעולה. בדוק את הפרטים ונסה שוב.');
      }
    });
  }

  switchTab(tab: 'campaigns' | 'spots' | 'clients' | 'links') {
    this.activeTab = tab;
    if (tab === 'spots') {
      this.router.navigate(['/admin/advertising/spots']);
    } else if (tab === 'clients') {
      this.router.navigate(['/admin/advertising/clients']);
    } else if (tab === 'links') {
      this.router.navigate(['/admin/advertising/links']);
    }
  }
}
