import { Component, OnInit, inject, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';
import { AgencyService } from '../../../services/agency.service';
import { MusicServiceProviderListDto } from '../../../models/music-service-provider.model';
import { AgencyListDto, AgencyContactMode } from '../../../models/agency.model';
import { PagedResult } from '../../../models/user.model';
import { CitiesService, City } from '../../../services/cities.service';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';
import { SiteAlertService } from '../../../services/site-alert.service';
import { ContentPromotionModalComponent } from '../../shared/content-promotion-modal/content-promotion-modal.component';
import { ContentPromotionTargetType } from '../../../services/content-promotion.service';
import { AdminUsersLayoutActionsService } from '../users/users-layout/users-layout-actions.service';
import { ServiceProviderFormComponent } from './service-provider-form.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-service-providers-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ImgFallbackDirective, ContentPromotionModalComponent, ServiceProviderFormComponent],
  templateUrl: './service-providers-list.component.html',
  styleUrls: ['./service-providers-list.component.css']
})
export class ServiceProvidersListComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private isDestroyed = false;
  private scrollObserver?: IntersectionObserver;

  @ViewChild('scrollSentinel') scrollSentinelRef?: ElementRef<HTMLElement>;
  providers: MusicServiceProviderListDto[] = [];
  loading = false;
  error: string | null = null;
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-providers-view') as 'list' | 'grid') || 'list';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-providers-view', mode); }
  showProviderFormModal = false;
  selectedProviderId: number | undefined = undefined;

  // Infinite scroll
  currentPage = 0;
  pageSize = 25;
  totalCount = 0;
  allLoaded = false;
  loadingMore = false;

  searchTerm = '';
  filterStatus: number | null = null;
  filterFeatured: boolean | null = null;
  filterIsTeacher: boolean | null = null;
  filterCityId: number | null = null;
  sortBy = 'created_desc';

  sortOptions = [
    { value: 'created_desc', label: 'חדש לישן' },
    { value: 'created_asc', label: 'ישן לחדש' },
    { value: 'name_asc', label: 'א-ת' },
    { value: 'name_desc', label: 'ת-א' }
  ];

  cities: City[] = [];

  statusOptions = [
    { value: null, label: 'כל הסטטוסים' },
    { value: 0, label: 'ממתין לאישור' },
    { value: 1, label: 'פעיל' },
    { value: 2, label: 'מושעה' }
  ];

  constructor(
    private providerService: MusicServiceProviderService,
    private agencyService: AgencyService,
    private http: HttpClient,
    private citiesService: CitiesService,
    private router: Router,
    private layoutActions: AdminUsersLayoutActionsService
  ) { }
  
  // Batch selection
  selectionMode = false;
  selectedIds = new Set<number>();
  promotionModalOpen = false;
  readonly PromotionTargetType = ContentPromotionTargetType;
  agencies: AgencyListDto[] = [];
  selectedAgencyId: number | null = null;

  ngOnInit(): void {
    this.loadCities();
    this.loadProviders();
    this.loadAgencies();
    this.layoutActions.addServiceProviderRequest$.subscribe(() => this.addNewProvider());
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
          this.loadMoreProviders();
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

  loadCities(): void {
    this.citiesService.getCities().subscribe({
      next: (cities) => {
        this.cities = cities.filter(c => c.isActive);
      },
      error: (err) => {
        console.error('שגיאה בטעינת ערים:', err);
      }
    });
  }

  loadProviders(): void {
    this.loading = true;
    this.error = null;
    this.currentPage = 1;
    this.allLoaded = false;
    this.loadingMore = false;

    this.providerService.getServiceProviders(
      this.searchTerm || undefined,
      undefined, // categoryId - not used in admin list
      this.filterCityId ?? undefined,
      this.filterStatus ?? undefined,
      this.filterFeatured ?? undefined,
      this.filterIsTeacher ?? false, // Default to showing only professionals (isTeacher=false)
      this.currentPage,
      this.pageSize,
      undefined,
      this.sortBy
    ).subscribe({
      next: (result: PagedResult<MusicServiceProviderListDto>) => {
        this.providers = result.items;
        this.totalCount = result.totalCount;
        this.allLoaded = result.items.length >= result.totalCount;
        this.clearSelection();
        this.loading = false;
        setTimeout(() => this.reattachScrollObserver(), 0);
      },
      error: (err) => {
        console.error('שגיאה בטעינת בעלי מקצוע:', err);
        this.error = 'שגיאה בטעינת נתוני בעלי המקצוע';
        this.loading = false;
      }
    });
  }

  loadMoreProviders(): void {
    if (this.loading || this.loadingMore || this.allLoaded) return;

    this.loadingMore = true;
    this.currentPage++;

    this.providerService.getServiceProviders(
      this.searchTerm || undefined,
      undefined,
      this.filterCityId ?? undefined,
      this.filterStatus ?? undefined,
      this.filterFeatured ?? undefined,
      this.filterIsTeacher ?? false,
      this.currentPage,
      this.pageSize,
      undefined,
      this.sortBy
    ).subscribe({
      next: (result: PagedResult<MusicServiceProviderListDto>) => {
        this.providers = [...this.providers, ...result.items];
        this.totalCount = result.totalCount;
        this.allLoaded = this.providers.length >= result.totalCount;
        this.loadingMore = false;
        setTimeout(() => this.reattachScrollObserver(), 0);
      },
      error: (err) => {
        console.error('שגיאה בטעינת בעלי מקצוע נוספים:', err);
        this.loadingMore = false;
        this.currentPage--;
      }
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadProviders();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadProviders();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterStatus = null;
    this.filterFeatured = null;
    this.filterIsTeacher = null;
    this.filterCityId = null;
    this.sortBy = 'created_desc';
    this.currentPage = 1;
    this.loadProviders();
  }

  editProvider(id: number): void {
    this.selectedProviderId = id;
    this.showProviderFormModal = true;
  }

  viewProvider(id: number): void {
    this.router.navigate(['/professional', id]);
  }

  async approveProvider(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם לאשר את בעל המקצוע?')) {
      this.providerService.approveServiceProvider(id).subscribe({
        next: () => {
          alert('בעל המקצוע אושר בהצלחה');
          this.loadProviders();
        },
        error: (err) => {
          console.error('שגיאה באישור בעל מקצוע:', err);
          alert('שגיאה באישור בעל המקצוע');
        }
      });
    }
  }

  async rejectProvider(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם להשעות את בעל המקצוע?')) {
      this.providerService.rejectServiceProvider(id).subscribe({
        next: () => {
          alert('בעל המקצוע הושעה');
          this.loadProviders();
        },
        error: (err) => {
          console.error('שגיאה בהשעיית בעל מקצוע:', err);
          alert('שגיאה בהשעיית בעל המקצוע');
        }
      });
    }
  }

  async activateProvider(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם להפעיל את דף נותן השירות ולהחזיר אותו לאינדקס?')) {
      this.providerService.approveServiceProvider(id).subscribe({
        next: () => {
          this.loadProviders();
        },
        error: (err) => {
          console.error('שגיאה בהפעלת בעל מקצוע:', err);
          alert('שגיאה בהפעלת בעל המקצוע');
        }
      });
    }
  }

  async deleteProvider(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם למחוק את בעל המקצוע? פעולה זו אינה הפיכה.')) {
      this.providerService.deleteServiceProvider(id).subscribe({
        next: () => {
          this.loadProviders();
        },
        error: (err) => {
          console.error('שגיאה במחיקת בעל מקצוע:', err);
          alert('שגיאה במחיקת בעל המקצוע');
        }
      });
    }
  }

  linkToUser(id: number): void {
    const userId = prompt('הזן מזהה משתמש לקישור:');
    if (userId && !isNaN(Number(userId))) {
      this.providerService.linkToUser(id, Number(userId)).subscribe({
        next: () => {
          alert('בעל המקצוע קושר למשתמש בהצלחה');
          this.loadProviders();
        },
        error: (err) => {
          console.error('שגיאה בקישור למשתמש:', err);
          alert('שגיאה בקישור למשתמש. אולי המשתמש כבר מקושר לפרופיל אחר?');
        }
      });
    }
  }

  async unlinkFromUser(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם לנתק את בעל המקצוע מהמשתמש?')) {
      this.providerService.unlinkFromUser(id).subscribe({
        next: () => {
          alert('בעל המקצוע נותק מהמשתמש בהצלחה');
          this.loadProviders();
        },
        error: (err) => {
          console.error('שגיאה בניתוק ממשתמש:', err);
          alert('שגיאה בניתוק ממשתמש');
        }
      });
    }
  }

  async duplicateProvider(id: number, name: string): Promise<void> {
    if (await this.siteAlerts.confirm(`האם לשכפל את "${name}"?`)) {
      this.providerService.duplicateServiceProvider(id).subscribe({
        next: (duplicate) => {
          alert(`"${duplicate.displayName}" שוכפל בהצלחה!`);
          this.loadProviders();
        },
        error: (err) => {
          console.error('שגיאה בשכפול בעל מקצוע:', err);
          alert('שגיאה בשכפול בעל המקצוע');
        }
      });
    }
  }

  addNewProvider(): void {
    this.selectedProviderId = undefined;
    this.showProviderFormModal = true;
  }

  closeProviderFormModal(): void {
    this.showProviderFormModal = false;
    this.selectedProviderId = undefined;
    this.loadProviders();
  }

  getStatusBadgeClass(status: number): string {
    switch (status) {
      case 0: return 'badge-warning';
      case 1: return 'badge-success';
      case 2: return 'badge-danger';
      default: return 'badge-secondary';
    }
  }

  getCityName(cityId: number | null | undefined): string | null {
    if (!cityId) return null;
    const city = this.cities.find(c => c.id === cityId);
    return city ? city.name : null;
  }

  getLocationDisplay(provider: MusicServiceProviderListDto): string {
    const cityName = this.getCityName(provider.cityId);
    if (cityName && provider.location) {
      return `${cityName}, ${provider.location}`;
    }
    return cityName || provider.location || '-';
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

  toggleProvider(id: number): void {
    this.selectedIds.has(id) ? this.selectedIds.delete(id) : this.selectedIds.add(id);
  }

  toggleSelectAll(): void {
    this.isAllSelected ? this.selectedIds.clear() : this.providers.forEach(p => this.selectedIds.add(p.id));
  }

  get isAllSelected(): boolean {
    return this.providers.length > 0 && this.providers.every(p => this.selectedIds.has(p.id));
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get hasSelection(): boolean {
    return this.selectedIds.size > 0;
  }

  isSelected(id: number): boolean {
    return this.selectedIds.has(id);
  }

  get selectedIdsArray(): number[] {
    return Array.from(this.selectedIds);
  }

  openPromotionModal(): void {
    this.promotionModalOpen = true;
  }

  onPromoted(): void {
    this.promotionModalOpen = false;
    this.selectedIds.clear();
    this.loadProviders();
  }

  async bulkDeleteSelected(): Promise<void> {
    const ids = this.selectedIdsArray;
    if (ids.length === 0) return;
    if (!await this.siteAlerts.confirm(`למחוק ${ids.length} בעלי מקצוע? פעולה זו אינה הפיכה.`)) return;
    forkJoin(ids.map(id => this.providerService.deleteServiceProvider(id))).subscribe({
      next: () => {
        this.selectedIds.clear();
        this.loadProviders();
      },
      error: (err) => {
        console.error('שגיאה במחיקה מרובה:', err);
        alert('שגיאה במחיקת בעלי המקצוע');
      }
    });
  }

  async bulkApproveSelected(): Promise<void> {
    const ids = this.selectedIdsArray;
    if (ids.length === 0) return;
    if (!await this.siteAlerts.confirm(`לאשר ${ids.length} בעלי מקצוע?`)) return;
    forkJoin(ids.map(id => this.providerService.approveServiceProvider(id))).subscribe({
      next: () => {
        this.selectedIds.clear();
        this.loadProviders();
      },
      error: (err) => {
        console.error('שגיאה באישור מרובה:', err);
        alert('שגיאה באישור בעלי המקצוע');
      }
    });
  }

  async bulkRejectSelected(): Promise<void> {
    const ids = this.selectedIdsArray;
    if (ids.length === 0) return;
    if (!await this.siteAlerts.confirm(`להשעות ${ids.length} בעלי מקצוע?`)) return;
    forkJoin(ids.map(id => this.providerService.rejectServiceProvider(id))).subscribe({
      next: () => {
        this.selectedIds.clear();
        this.loadProviders();
      },
      error: (err) => {
        console.error('שגיאה בהשעיה מרובה:', err);
        alert('שגיאה בהשעיית בעלי המקצוע');
      }
    });
  }

  async bulkConvertSelectedToTeachers(): Promise<void> {
    const selectedProviders = this.providers.filter(provider => this.selectedIds.has(provider.id));
    const alreadyTeachers = selectedProviders.filter(provider => provider.isTeacher).length;
    const targetIds = selectedProviders
      .filter(provider => !provider.isTeacher)
      .map(provider => provider.id);

    if (targetIds.length === 0) {
      alert('הפרופילים שסומנו כבר מוגדרים כמורים');
      return;
    }

    const skippedText = alreadyTeachers > 0 ? ` (${alreadyTeachers} כבר מורים ולא ישתנו)` : '';
    if (!await this.siteAlerts.confirm(`להפוך ${targetIds.length} פרופילים למורים? התוכן הקיים יישמר.${skippedText}`)) return;

    forkJoin(targetIds.map(id => this.providerService.convertToTeacher(id))).subscribe({
      next: () => {
        alert('הפרופילים הועברו לאינדקס המורים בהצלחה');
        this.selectedIds.clear();
        this.loadProviders();
      },
      error: (err) => {
        console.error('שגיאה בהמרת נותני שירות למורים:', err);
        alert('שגיאה בהמרת הפרופילים למורים');
      }
    });
  }

  async bulkDuplicateSelected(): Promise<void> {
    const ids = this.selectedIdsArray;
    if (ids.length === 0) return;
    if (!await this.siteAlerts.confirm(`לשכפל ${ids.length} בעלי מקצוע?`)) return;
    forkJoin(ids.map(id => this.providerService.duplicateServiceProvider(id))).subscribe({
      next: () => {
        this.selectedIds.clear();
        this.loadProviders();
      },
      error: (err) => {
        console.error('שגיאה בשכפול מרובה:', err);
        alert('שגיאה בשכפול בעלי המקצוע');
      }
    });
  }

  private loadAgencies(): void {
    this.http.get<{ items: AgencyListDto[] }>(`${environment.apiBaseUrl}/api/Agencies`, { params: { pageSize: '100' } })
      .subscribe({ next: d => this.agencies = d?.items || [], error: () => this.agencies = [] });
  }

  async assignToAgency(): Promise<void> {
    if (!this.selectedAgencyId || this.selectedIds.size === 0) return;
    const target = this.agencies.find(a => a.id === this.selectedAgencyId);
    if (!target || !await this.siteAlerts.confirm(`לשייך ${this.selectedIds.size} בעלי מקצוע לסוכנות "${target.name}"?`)) return;

    let done = 0, failed = 0;
    for (const id of Array.from(this.selectedIds)) {
      try {
        await this.agencyService.addProfile(this.selectedAgencyId, {
          profileType: 'serviceProvider', profileId: id, contactMode: AgencyContactMode.Agency,
          showBadge: true, isFeaturedByAgency: false, displayOrder: 0
        }).toPromise();
        done++;
      } catch { failed++; }
    }
    this.selectedIds.clear();
    this.selectionMode = false;
    this.selectedAgencyId = null;
    alert(`שויכו ${done} פרופילים${failed > 0 ? `, ${failed} נכשלו` : ''}`);
    this.loadProviders();
  }
}
