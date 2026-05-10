import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AgencyListDto } from '../../../models/agency.model';
import { AgencyAnalyticsSummary, AgencyService } from '../../../services/agency.service';
import { SiteAlertService } from '../../../services/site-alert.service';

@Component({
  selector: 'app-agencies-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agencies-list.component.html',
  styleUrls: ['./agencies-list.component.css']
})
export class AgenciesListComponent implements OnInit {
  private readonly agencyService = inject(AgencyService);
  private readonly router = inject(Router);
  private readonly alerts = inject(SiteAlertService);

  agencies: AgencyListDto[] = [];
  loading = false;
  error: string | null = null;
  searchTerm = '';
  activeFilter: boolean | null = null;
  currentPage = 1;
  pageSize = 20;
  totalCount = 0;
  totalPages = 0;
  analytics: AgencyAnalyticsSummary | null = null;

  ngOnInit(): void {
    this.loadAgencies();
    this.loadAnalytics();
  }

  loadAgencies(): void {
    this.loading = true;
    this.error = null;
    this.agencyService.getAgencies(this.searchTerm || undefined, this.activeFilter ?? undefined, this.currentPage, this.pageSize)
      .subscribe({
        next: result => {
          this.agencies = result.items;
          this.totalCount = result.totalCount;
          this.totalPages = Math.ceil(result.totalCount / result.pageSize);
          this.loading = false;
        },
        error: () => {
          this.error = 'לא הצלחנו לטעון את הסוכנויות';
          this.loading = false;
        }
      });
  }

  loadAnalytics(): void {
    this.agencyService.getAnalytics().subscribe({
      next: data => this.analytics = data,
      error: () => this.analytics = null
    });
  }

  getAgencyAnalytics(agencyId: number): AgencyAnalyticsSummary['byAgency'][number] | null {
    return this.analytics?.byAgency.find(item => item.agencyId === agencyId) || null;
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadAgencies();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.activeFilter = null;
    this.onSearch();
  }

  addAgency(): void {
    this.router.navigate(['/admin/users/agencies/new']);
  }

  editAgency(id: number): void {
    this.router.navigate(['/admin/users/agencies/edit', id]);
  }

  viewAgency(slug: string): void {
    this.router.navigate(['/agency', slug]);
  }

  async deleteAgency(agency: AgencyListDto): Promise<void> {
    if (!await this.alerts.confirm(`למחוק את הסוכנות "${agency.name}"?`)) return;
    this.agencyService.deleteAgency(agency.id).subscribe({
      next: () => this.loadAgencies(),
      error: () => alert('לא הצלחנו למחוק את הסוכנות')
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadAgencies();
  }

  getPaginationRange(): number[] {
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
}
