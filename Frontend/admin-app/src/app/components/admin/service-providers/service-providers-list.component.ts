import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';
import { MusicServiceProviderListDto } from '../../../models/music-service-provider.model';
import { PagedResult } from '../../../models/user.model';
import { CitiesService, City } from '../../../services/cities.service';

@Component({
  selector: 'app-service-providers-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './service-providers-list.component.html',
  styleUrls: ['./service-providers-list.component.css']
})
export class ServiceProvidersListComponent implements OnInit {
  providers: MusicServiceProviderListDto[] = [];
  loading = false;
  error: string | null = null;

  currentPage = 1;
  pageSize = 10;
  totalCount = 0;
  totalPages = 0;

  searchTerm = '';
  filterStatus: number | null = null;
  filterFeatured: boolean | null = null;
  filterIsTeacher: boolean | null = null;
  filterCityId: number | null = null;

  cities: City[] = [];

  statusOptions = [
    { value: null, label: 'כל הסטטוסים' },
    { value: 0, label: 'ממתין לאישור' },
    { value: 1, label: 'פעיל' },
    { value: 2, label: 'מושעה' }
  ];

  constructor(
    private providerService: MusicServiceProviderService,
    private citiesService: CitiesService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadCities();
    this.loadProviders();
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

    this.providerService.getServiceProviders(
      this.searchTerm || undefined,
      undefined, // categoryId - not used in admin list
      this.filterCityId ?? undefined,
      this.filterStatus ?? undefined,
      this.filterFeatured ?? undefined,
      this.filterIsTeacher ?? false, // Default to showing only professionals (isTeacher=false)
      this.currentPage,
      this.pageSize
    ).subscribe({
      next: (result: PagedResult<MusicServiceProviderListDto>) => {
        this.providers = result.items;
        this.totalCount = result.totalCount;
        this.totalPages = Math.ceil(result.totalCount / result.pageSize);
        this.loading = false;
      },
      error: (err) => {
        console.error('שגיאה בטעינת בעלי מקצוע:', err);
        this.error = 'שגיאה בטעינת נתוני בעלי המקצוע';
        this.loading = false;
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
    this.currentPage = 1;
    this.loadProviders();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadProviders();
    }
  }

  editProvider(id: number): void {
    this.router.navigate(['/admin/service-providers/edit', id]);
  }

  viewProvider(id: number): void {
    this.router.navigate(['/admin/service-providers/view', id]);
  }

  approveProvider(id: number): void {
    if (confirm('האם לאשר את בעל המקצוע?')) {
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

  rejectProvider(id: number): void {
    if (confirm('האם להשעות את בעל המקצוע?')) {
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

  deleteProvider(id: number): void {
    if (confirm('האם למחוק את בעל המקצוע? פעולה זו אינה הפיכה.')) {
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

  unlinkFromUser(id: number): void {
    if (confirm('האם לנתק את בעל המקצוע מהמשתמש?')) {
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

  addNewProvider(): void {
    this.router.navigate(['/admin/service-providers/new']);
  }

  getStatusBadgeClass(status: number): string {
    switch (status) {
      case 0: return 'badge-warning';
      case 1: return 'badge-success';
      case 2: return 'badge-danger';
      default: return 'badge-secondary';
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
}
