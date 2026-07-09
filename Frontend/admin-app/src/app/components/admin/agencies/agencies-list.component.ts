import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AgencyListDto } from '../../../models/agency.model';
import { AgencyService } from '../../../services/agency.service';
import { SiteAlertService } from '../../../services/site-alert.service';
import { PagedResult } from '../../../models/user.model';

@Component({
  selector: 'app-agencies-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agencies-list.component.html',
  styleUrls: ['./agencies-list.component.css']
})
export class AgenciesListComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly agencyService = inject(AgencyService);
  private readonly router = inject(Router);
  private readonly alerts = inject(SiteAlertService);
  private isDestroyed = false;
  private scrollObserver?: IntersectionObserver;

  @ViewChild('scrollSentinel') scrollSentinelRef?: ElementRef<HTMLElement>;

  agencies: AgencyListDto[] = [];
  loading = false;
  error: string | null = null;
  searchTerm = '';
  activeFilter: boolean | null = null;
  currentPage = 0;
  pageSize = 20;
  totalCount = 0;
  allLoaded = false;
  loadingMore = false;

  ngOnInit(): void {
    this.loadAgencies();
  }

  ngAfterViewInit(): void {
    this.setupScrollObserver();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.destroyScrollObserver();
  }

  private destroyScrollObserver(): void {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = undefined;
    }
  }

  private setupScrollObserver(): void {
    if (this.isDestroyed) return;

    this.destroyScrollObserver();

    if (!this.scrollSentinelRef?.nativeElement) {
      setTimeout(() => this.setupScrollObserver(), 100);
      return;
    }

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.loading && !this.loadingMore && !this.allLoaded) {
          this.loadMoreAgencies();
        }
      },
      { rootMargin: '200px' }
    );

    this.scrollObserver.observe(this.scrollSentinelRef.nativeElement);
  }

  private reattachScrollObserver(): void {
    if (!this.scrollSentinelRef?.nativeElement) return;
    this.scrollObserver?.disconnect();
    this.scrollObserver?.observe(this.scrollSentinelRef.nativeElement);
  }

  loadAgencies(): void {
    this.loading = true;
    this.error = null;
    this.currentPage = 1;
    this.allLoaded = false;
    this.loadingMore = false;
    this.agencyService.getAgencies(this.searchTerm || undefined, this.activeFilter ?? undefined, this.currentPage, this.pageSize)
      .subscribe({
        next: result => {
          this.agencies = result.items;
          this.totalCount = result.totalCount;
          this.allLoaded = result.items.length >= result.totalCount;
          this.loading = false;
          setTimeout(() => this.reattachScrollObserver(), 0);
        },
        error: () => {
          this.error = 'לא הצלחנו לטעון את הסוכנויות';
          this.loading = false;
        }
      });
  }

  loadMoreAgencies(): void {
    if (this.loading || this.loadingMore || this.allLoaded) return;

    this.loadingMore = true;
    this.currentPage++;

    this.agencyService.getAgencies(this.searchTerm || undefined, this.activeFilter ?? undefined, this.currentPage, this.pageSize)
      .subscribe({
        next: result => {
          this.agencies = [...this.agencies, ...result.items];
          this.totalCount = result.totalCount;
          this.allLoaded = this.agencies.length >= result.totalCount;
          this.loadingMore = false;
          setTimeout(() => this.reattachScrollObserver(), 0);
        },
        error: () => {
          this.loadingMore = false;
          this.currentPage--;
        }
      });
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
}
