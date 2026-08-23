import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  MarketingCampaignDashboard,
  MarketingCampaignService,
  MarketingCampaignSummary
} from '../../../../services/admin/marketing-campaign.service';

type StatusFilter = 'all' | 'active' | 'inactive';
type SortOption = 'created' | 'visits' | 'signups' | 'conversion';
type TargetType = 'internal' | 'external';

@Component({
  selector: 'app-marketing-links',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './marketing-links.component.html',
  styleUrls: ['./marketing-links.component.css']
})
export class MarketingLinksComponent implements OnInit {
  readonly targetSuggestions = [
    { label: 'דף הבית', path: '/' },
    { label: 'מאגר האקורדים', path: '/chords' },
    { label: 'חדשות המוזיקה', path: '/music-news' },
    { label: 'כתבות', path: '/blog' },
    { label: 'הופעות', path: '/events' },
    { label: 'פודקאסטים', path: '/podcasts' },
    { label: 'אינדקס עולם המוזיקה', path: '/professionals' },
    { label: 'שליחת אקורדים', path: '/join-chords' },
    { label: 'הצטרפות לאינדקס', path: '/join-index' }
  ];

  dashboard: MarketingCampaignDashboard | null = null;
  loading = true;
  saving = false;
  deleting = false;
  errorMessage = '';
  copiedId: number | null = null;
  formOpen = false;
  editingCampaign: MarketingCampaignSummary | null = null;
  deleteCandidate: MarketingCampaignSummary | null = null;
  campaignName = '';
  source = '';
  targetPath = '/';
  targetType: TargetType = 'internal';
  searchTerm = '';
  statusFilter: StatusFilter = 'all';
  sortBy: SortOption = 'created';
  dateFrom = this.toDateInput(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  dateTo = this.toDateInput(new Date());

  constructor(private readonly campaignService: MarketingCampaignService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  get visibleCampaigns(): MarketingCampaignSummary[] {
    const query = this.searchTerm.trim().toLocaleLowerCase('he');
    const rows = (this.dashboard?.campaigns ?? []).filter(campaign => {
      const matchesStatus = this.statusFilter === 'all' ||
        (this.statusFilter === 'active' ? campaign.isActive : !campaign.isActive);
      const matchesSearch = !query || `${campaign.name} ${campaign.source} ${campaign.targetPath}`
        .toLocaleLowerCase('he').includes(query);
      return matchesStatus && matchesSearch;
    });

    return [...rows].sort((a, b) => {
      if (this.sortBy === 'visits') return b.visits - a.visits;
      if (this.sortBy === 'signups') return b.signups - a.signups;
      if (this.sortBy === 'conversion') return b.conversionRate - a.conversionRate;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';
    const inclusiveEnd = new Date(`${this.dateTo}T00:00:00`);
    inclusiveEnd.setDate(inclusiveEnd.getDate() + 1);
    this.campaignService.getDashboard(this.dateFrom, this.toDateInput(inclusiveEnd)).subscribe({
      next: dashboard => {
        this.dashboard = dashboard;
        this.loading = false;
      },
      error: error => {
        this.errorMessage = error?.error?.message || 'לא הצלחנו לטעון את נתוני הקישורים';
        this.loading = false;
      }
    });
  }

  setDateRange(days: number): void {
    this.dateTo = this.toDateInput(new Date());
    this.dateFrom = this.toDateInput(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
    this.loadDashboard();
  }

  openCreate(): void {
    this.editingCampaign = null;
    this.campaignName = '';
    this.source = '';
    this.targetPath = '/';
    this.targetType = 'internal';
    this.errorMessage = '';
    this.formOpen = true;
  }

  openEdit(campaign: MarketingCampaignSummary): void {
    this.editingCampaign = campaign;
    this.campaignName = campaign.name;
    this.source = campaign.source;
    this.targetPath = campaign.targetPath;
    this.targetType = campaign.isExternal ? 'external' : 'internal';
    this.errorMessage = '';
    this.formOpen = true;
  }

  closeForm(): void {
    if (this.saving) return;
    this.formOpen = false;
    this.editingCampaign = null;
  }

  setTargetType(type: TargetType): void {
    if (this.targetType === type) return;
    this.targetType = type;
    this.targetPath = type === 'external' ? '' : '/';
  }

  saveCampaign(): void {
    const request = {
      name: this.campaignName.trim(),
      source: this.source.trim(),
      targetPath: this.normalizePath(this.targetPath)
    };
    if (request.name.length < 2 || request.source.length < 2 || !request.targetPath) {
      this.errorMessage = this.targetType === 'external'
        ? 'יש למלא שם, מקור וכתובת חיצונית תקינה שמתחילה ב-https://'
        : 'יש למלא שם, מקור ונתיב פנימי תקין שמתחיל ב-/';
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    const operation = this.editingCampaign
      ? this.campaignService.update(this.editingCampaign.id, { ...request, targetPath: request.targetPath })
      : this.campaignService.create({ ...request, targetPath: request.targetPath });

    operation.subscribe({
      next: campaign => {
        const wasCreated = !this.editingCampaign;
        this.saving = false;
        this.formOpen = false;
        this.editingCampaign = null;
        this.loadDashboard();
        if (wasCreated) void this.copyLink(campaign);
      },
      error: error => {
        this.errorMessage = error?.error?.message || 'שמירת הקישור נכשלה';
        this.saving = false;
      }
    });
  }

  toggleStatus(campaign: MarketingCampaignSummary): void {
    this.campaignService.setStatus(campaign.id, !campaign.isActive).subscribe({
      next: () => campaign.isActive = !campaign.isActive,
      error: () => this.errorMessage = 'עדכון מצב הקישור נכשל'
    });
  }

  askToDelete(campaign: MarketingCampaignSummary): void {
    this.deleteCandidate = campaign;
  }

  cancelDelete(): void {
    if (!this.deleting) this.deleteCandidate = null;
  }

  confirmDelete(): void {
    const campaign = this.deleteCandidate;
    if (!campaign) return;
    this.deleting = true;
    this.errorMessage = '';
    this.campaignService.delete(campaign.id).subscribe({
      next: () => {
        this.deleting = false;
        this.deleteCandidate = null;
        this.loadDashboard();
      },
      error: error => {
        this.errorMessage = error?.error?.message || 'מחיקת הקישור נכשלה';
        this.deleting = false;
      }
    });
  }

  async copyLink(campaign: MarketingCampaignSummary): Promise<void> {
    try {
      await navigator.clipboard.writeText(campaign.trackingUrl);
      this.copiedId = campaign.id;
      window.setTimeout(() => this.copiedId = null, 2200);
    } catch {
      this.errorMessage = 'לא הצלחנו להעתיק. אפשר לסמן את הקישור ולהעתיק ידנית.';
    }
  }

  trackByCampaignId(_: number, campaign: MarketingCampaignSummary): number {
    return campaign.id;
  }

  private normalizePath(value: string): string | null {
    const trimmed = value.trim();
    if (this.targetType === 'external') {
      try {
        const url = new URL(trimmed);
        return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
      } catch {
        return null;
      }
    }
    if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) return null;
    return trimmed;
  }

  private toDateInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
