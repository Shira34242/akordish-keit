import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TeacherService } from '../../../services/teacher.service';
import { AgencyService } from '../../../services/agency.service';
import { TeacherListDto } from '../../../models/teacher.model';
import { AgencyListDto, AgencyContactMode } from '../../../models/agency.model';
import { PagedResult } from '../../../models/user.model';
import { CitiesService, City } from '../../../services/cities.service';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';
import { SiteAlertService } from '../../../services/site-alert.service';
import { BumpModalComponent } from '../../shared/bump-modal/bump-modal.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-teachers-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ImgFallbackDirective, BumpModalComponent],
  templateUrl: './teachers-list.component.html',
  styleUrls: ['./teachers-list.component.css']
})
export class TeachersListComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  teachers: TeacherListDto[] = [];
  loading = false;
  error: string | null = null;
  viewMode: 'list' | 'grid' = (localStorage.getItem('admin-teachers-view') as 'list' | 'grid') || 'list';
  setView(mode: 'list' | 'grid') { this.viewMode = mode; localStorage.setItem('admin-teachers-view', mode); }
  cities: City[] = [];
 
  // Pagination
  currentPage = 1;
  pageSize = 25;
  totalCount = 0;
  totalPages = 0;

  // Filters
  searchTerm = '';
  filterStatus: number | null = null;
  filterFeatured: boolean | null = null;

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
    private router: Router
  ) { }
  
  // Batch selection
  selectionMode = false;
  selectedIds = new Set<number>();
  bumpModalOpen = false;
  agencies: AgencyListDto[] = [];
  selectedAgencyId: number | null = null;

  ngOnInit(): void {
    this.loadTeachers();
    this.loadCities();
  }

  loadTeachers(): void {
    this.loading = true;
    this.error = null;

    this.teacherService.getTeachers(
      this.searchTerm || undefined,
      undefined, // instrumentId
      this.filterStatus ?? undefined,
      this.filterFeatured ?? undefined,
      this.currentPage,
      this.pageSize
    ).subscribe({
      next: (result: PagedResult<TeacherListDto>) => {
        this.teachers = result.items;
        this.totalCount = result.totalCount;
        this.totalPages = Math.ceil(result.totalCount / result.pageSize);
        this.loading = false;
      },
      error: (err) => {
        console.error('שגיאה בטעינת מורים:', err);
        this.error = 'שגיאה בטעינת נתוני המורים';
        this.loading = false;
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
    this.currentPage = 1;
    this.loadTeachers();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadTeachers();
    }
  }

  editTeacher(id: number): void {
    this.router.navigate(['/admin/users/teachers/edit', id]);
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
    this.router.navigate(['/admin/users/teachers/new']);
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

  getPaginationRange(): number[] {
    const range: number[] = [];
    const start = Math.max(1, this.currentPage - 2);
    const end = Math.min(this.totalPages, this.currentPage + 2);

    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }

  // ============================================================
  // Batch selection
  // ============================================================

  toggleSelectionMode(): void {
    this.selectionMode = !this.selectionMode;
    if (!this.selectionMode) {
      this.selectedIds.clear();
      this.selectedAgencyId = null;
    } else {
      this.loadAgencies();
    }
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

  get selectedIdsArray(): number[] {
    return Array.from(this.selectedIds);
  }

  openBumpModal(): void {
    this.bumpModalOpen = true;
  }

  onBumped(): void {
    this.bumpModalOpen = false;
    this.selectedIds.clear();
    this.loadTeachers();
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
