import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TeacherService } from '../../../services/teacher.service';
import { TeacherListDto } from '../../../models/teacher.model';
import { PagedResult } from '../../../models/user.model';
import { CitiesService, City } from '../../../services/cities.service';

@Component({
  selector: 'app-teachers-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teachers-list.component.html',
  styleUrls: ['./teachers-list.component.css']
})
export class TeachersListComponent implements OnInit {
  teachers: TeacherListDto[] = [];
  loading = false;
  error: string | null = null;
  cities: City[] = [];
 
  // Pagination
  currentPage = 1;
  pageSize = 10;
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
    private router: Router,
    private citiesService: CitiesService
    
  ) { }

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
    this.router.navigate(['/admin/teachers/edit', id]);
  }

  viewTeacher(id: number): void {
    this.router.navigate(['/admin/teachers/view', id]);
  }

  approveTeacher(id: number): void {
    if (confirm('האם לאשר את המורה?')) {
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

  rejectTeacher(id: number): void {
    if (confirm('האם לדחות את המורה?')) {
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

  deleteTeacher(id: number): void {
    if (confirm('האם למחוק את המורה? פעולה זו אינה הפיכה.')) {
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

  unlinkFromUser(id: number): void {
    if (confirm('האם לנתק את המורה מהמשתמש?')) {
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

  addNewTeacher(): void {
    this.router.navigate(['/admin/teachers/new']);
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
}
