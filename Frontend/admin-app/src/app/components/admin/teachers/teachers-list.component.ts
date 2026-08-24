import { Component, OnInit, inject, OnDestroy, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { TeacherService } from '../../../services/teacher.service';
import { AgencyService } from '../../../services/agency.service';
import { TeacherListDto } from '../../../models/teacher.model';
import { AgencyListDto, AgencyContactMode } from '../../../models/agency.model';
import { PagedResult } from '../../../models/user.model';
import { CitiesService, City } from '../../../services/cities.service';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';
import { SiteAlertService } from '../../../services/site-alert.service';
import { ContentPromotionModalComponent } from '../../shared/content-promotion-modal/content-promotion-modal.component';
import { ContentPromotionTargetType } from '../../../services/content-promotion.service';
import { AdminUsersLayoutActionsService } from '../users/users-layout/users-layout-actions.service';
import { TeacherFormComponent } from './teacher-form.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-teachers-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ImgFallbackDirective, ContentPromotionModalComponent, TeacherFormComponent],
  templateUrl: './teachers-list.component.html',
  styleUrls: ['./teachers-list.component.css']
})
export class TeachersListComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private isDestroyed = false;
  private scrollObserver?: IntersectionObserver;

  @ViewChild('scrollSentinel') scrollSentinelRef?: ElementRef<HTMLElement>;
  teachers: TeacherListDto[] = [];
  loading = false;
  error: string | null = null;
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-teachers-view') as 'list' | 'grid') || 'list';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-teachers-view', mode); }
  cities: City[] = [];
  showTeacherFormModal = false;
  selectedTeacherId: number | undefined = undefined;
 
  // Infinite scroll
  currentPage = 0;
  pageSize = 25;
  totalCount = 0;
  allLoaded = false;
  loadingMore = false;

  // Filters
  searchTerm = '';
  filterStatus: number | null = null;
  filterFeatured: boolean | null = null;
  sortBy = 'created_desc';

  sortOptions = [
    { value: 'created_desc', label: 'חדש לישן' },
    { value: 'created_asc', label: 'ישן לחדש' },
    { value: 'name_asc', label: 'א-ת' },
    { value: 'name_desc', label: 'ת-א' }
  ];

  // Status enum for dropdown
  statusOptions = [
    { value: null, label: 'כל הסטטוסים' },
    { value: 0, label: 'ממתין לאישור' },
    { value: 1, label: 'פעיל' },
    { value: 2, label: 'מושעה' }
  ];

  constructor(
    private teacherService: TeacherService,
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
    this.loadTeachers();
    this.loadCities();
    this.loadAgencies();
    this.layoutActions.addTeacherRequest$.subscribe(() => this.addNewTeacher());
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
          this.loadMoreTeachers();
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

  loadTeachers(): void {
    this.loading = true;
    this.error = null;
    this.currentPage = 1;
    this.allLoaded = false;
    this.loadingMore = false;

    this.teacherService.getTeachers(
      this.searchTerm || undefined,
      undefined, // instrumentId
      this.filterStatus ?? undefined,
      this.filterFeatured ?? undefined,
      this.currentPage,
      this.pageSize,
      undefined,
      undefined,
      undefined,
      this.sortBy
    ).subscribe({
      next: (result: PagedResult<TeacherListDto>) => {
        this.teachers = result.items;
        this.totalCount = result.totalCount;
        this.allLoaded = result.items.length >= result.totalCount;
        this.clearSelection();
        this.loading = false;
        setTimeout(() => this.reattachScrollObserver(), 0);
      },
      error: (err) => {
        console.error('שגיאה בטעינת מורים:', err);
        this.error = 'שגיאה בטעינת נתוני המורים';
        this.loading = false;
      }
    });
  }

  loadMoreTeachers(): void {
    if (this.loading || this.loadingMore || this.allLoaded) return;

    this.loadingMore = true;
    this.currentPage++;

    this.teacherService.getTeachers(
      this.searchTerm || undefined,
      undefined,
      this.filterStatus ?? undefined,
      this.filterFeatured ?? undefined,
      this.currentPage,
      this.pageSize,
      undefined,
      undefined,
      undefined,
      this.sortBy
    ).subscribe({
      next: (result: PagedResult<TeacherListDto>) => {
        this.teachers = [...this.teachers, ...result.items];
        this.totalCount = result.totalCount;
        this.allLoaded = this.teachers.length >= result.totalCount;
        this.loadingMore = false;
        setTimeout(() => this.reattachScrollObserver(), 0);
      },
      error: (err) => {
        console.error('שגיאה בטעינת מורים נוספים:', err);
        this.loadingMore = false;
        this.currentPage--;
      }
    });
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
  
  onSearch(): void {
    this.currentPage = 1;
    this.loadTeachers();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadTeachers();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.filterStatus = null;
    this.filterFeatured = null;
    this.sortBy = 'created_desc';
    this.currentPage = 1;
    this.loadTeachers();
  }

  // ============================================================
  // Batch selection
  // ============================================================

  editTeacher(id: number): void {
    this.selectedTeacherId = id;
    this.showTeacherFormModal = true;
  }

  viewTeacher(id: number): void {
    this.router.navigate(['/teacher', id]);
  }

  async approveTeacher(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם לאשר את המורה?')) {
      this.teacherService.approveTeacher(id).subscribe({
        next: () => {
          this.loadTeachers();
        },
        error: (err) => {
          console.error('שגיאה באישור מורה:', err);
          alert('שגיאה באישור המורה');
        }
      });
    }
  }

  async rejectTeacher(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם לדחות את המורה?')) {
      this.teacherService.rejectTeacher(id).subscribe({
        next: () => {
          alert('המורה נדחה');
          this.loadTeachers();
        },
        error: (err) => {
          console.error('שגיאה בדחיית מורה:', err);
          alert('שגיאה בדחיית המורה');
        }
      });
    }
  }

  async activateTeacher(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם להפעיל את דף המורה ולהחזיר אותו לאינדקס?')) {
      this.teacherService.approveTeacher(id).subscribe({
        next: () => {
          this.loadTeachers();
        },
        error: (err) => {
          console.error('שגיאה בהפעלת מורה:', err);
          alert('שגיאה בהפעלת המורה');
        }
      });
    }
  }

  async deleteTeacher(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם למחוק את המורה? פעולה זו אינה הפיכה.')) {
      this.teacherService.deleteTeacher(id).subscribe({
        next: () => {
          alert('המורה נמחק בהצלחה');
          this.loadTeachers();
        },
        error: (err) => {
          console.error('שגיאה במחיקת מורה:', err);
          alert('שגיאה במחיקת המורה');
        }
      });
    }
  }

  linkToUser(id: number): void {
    const userId = prompt('הזן מזהה משתמש לקישור:');
    if (userId && !isNaN(Number(userId))) {
      this.teacherService.linkToUser(id, Number(userId)).subscribe({
        next: () => {
          alert('המורה קושר למשתמש בהצלחה');
          this.loadTeachers();
        },
        error: (err) => {
          console.error('שגיאה בקישור למשתמש:', err);
          alert('שגיאה בקישור למשתמש. אולי המשתמש כבר מקושר לפרופיל אחר?');
        }
      });
    }
  }

  async unlinkFromUser(id: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם לנתק את המורה מהמשתמש?')) {
      this.teacherService.unlinkFromUser(id).subscribe({
        next: () => {
          alert('המורה נותק מהמשתמש בהצלחה');
          this.loadTeachers();
        },
        error: (err) => {
          console.error('שגיאה בניתוק ממשתמש:', err);
          alert('שגיאה בניתוק ממשתמש');
        }
      });
    }
  }

  async duplicateTeacher(id: number, name: string): Promise<void> {
    if (await this.siteAlerts.confirm(`האם לשכפל את המורה "${name}"?`)) {
      this.teacherService.duplicateTeacher(id).subscribe({
        next: (duplicate) => {
          alert(`המורה "${duplicate.displayName}" שוכפל בהצלחה!`);
          this.loadTeachers();
        },
        error: (err) => {
          console.error('שגיאה בשכפול מורה:', err);
          alert('שגיאה בשכפול המורה');
        }
      });
    }
  }

  addNewTeacher(): void {
    this.selectedTeacherId = undefined;
    this.showTeacherFormModal = true;
  }

  closeTeacherFormModal(): void {
    this.showTeacherFormModal = false;
    this.selectedTeacherId = undefined;
    this.loadTeachers();
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
  getLocationDisplay(provider: TeacherListDto): string {
    const cityName = this.getCityName(provider.cityId);
    if (cityName && provider.location) {
      return `${cityName}, ${provider.location}`;
    }
    return cityName || provider.location || '-';
  }
  getStatusLabel(status: number): string {
    switch (status) {
      case 0: return 'ממתין לאישור';
      case 1: return 'מאושר';
      case 2: return 'מושעה';
      default: return 'לא ידוע';
    }
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

  toggleTeacher(id: number): void {
    this.selectedIds.has(id) ? this.selectedIds.delete(id) : this.selectedIds.add(id);
  }

  toggleSelectAll(): void {
    this.isAllSelected ? this.selectedIds.clear() : this.teachers.forEach(t => this.selectedIds.add(t.id));
  }

  get isAllSelected(): boolean {
    return this.teachers.length > 0 && this.teachers.every(t => this.selectedIds.has(t.id));
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
    this.loadTeachers();
  }

  async bulkDeleteSelected(): Promise<void> {
    const ids = this.selectedIdsArray;
    if (ids.length === 0) return;
    if (!await this.siteAlerts.confirm(`למחוק ${ids.length} מורים? פעולה זו אינה הפיכה.`)) return;
    forkJoin(ids.map(id => this.teacherService.deleteTeacher(id))).subscribe({
      next: () => {
        this.selectedIds.clear();
        this.loadTeachers();
      },
      error: (err) => {
        console.error('שגיאה במחיקה מרובה:', err);
        alert('שגיאה במחיקת המורים');
      }
    });
  }

  async bulkApproveSelected(): Promise<void> {
    const ids = this.selectedIdsArray;
    if (ids.length === 0) return;
    if (!await this.siteAlerts.confirm(`לאשר ${ids.length} מורים?`)) return;
    forkJoin(ids.map(id => this.teacherService.approveTeacher(id))).subscribe({
      next: () => {
        this.selectedIds.clear();
        this.loadTeachers();
      },
      error: (err) => {
        console.error('שגיאה באישור מרובה:', err);
        alert('שגיאה באישור המורים');
      }
    });
  }

  async bulkRejectSelected(): Promise<void> {
    const ids = this.selectedIdsArray;
    if (ids.length === 0) return;
    if (!await this.siteAlerts.confirm(`להשעות ${ids.length} מורים?`)) return;
    forkJoin(ids.map(id => this.teacherService.rejectTeacher(id))).subscribe({
      next: () => {
        this.selectedIds.clear();
        this.loadTeachers();
      },
      error: (err) => {
        console.error('שגיאה בהשעיה מרובה:', err);
        alert('שגיאה בהשעיית המורים');
      }
    });
  }

  async bulkDuplicateSelected(): Promise<void> {
    const ids = this.selectedIdsArray;
    if (ids.length === 0) return;
    if (!await this.siteAlerts.confirm(`לשכפל ${ids.length} מורים?`)) return;
    forkJoin(ids.map(id => this.teacherService.duplicateTeacher(id))).subscribe({
      next: () => {
        this.selectedIds.clear();
        this.loadTeachers();
      },
      error: (err) => {
        console.error('שגיאה בשכפול מרובה:', err);
        alert('שגיאה בשכפול המורים');
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
    if (!target || !await this.siteAlerts.confirm(`לשייך ${this.selectedIds.size} מורים לסוכנות "${target.name}"?`)) return;

    let done = 0, failed = 0;
    for (const id of Array.from(this.selectedIds)) {
      try {
        await this.agencyService.addProfile(this.selectedAgencyId, {
          profileType: 'teacher', profileId: id, contactMode: AgencyContactMode.Agency,
          showBadge: true, isFeaturedByAgency: false, displayOrder: 0
        }).toPromise();
        done++;
      } catch { failed++; }
    }
    this.selectedIds.clear();
    this.selectionMode = false;
    this.selectedAgencyId = null;
    alert(`שויכו ${done} פרופילים${failed > 0 ? `, ${failed} נכשלו` : ''}`);
    this.loadTeachers();
  }
}
