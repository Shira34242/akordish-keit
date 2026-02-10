import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';
import { CitiesService, City } from '../../../services/cities.service';
import { SystemTablesService } from '../../../services/system-tables.service';
import { MusicServiceProviderListDto } from '../../../models/music-service-provider.model';
import { ProfessionalProfileModalComponent } from './professional-profile-modal.component';
import { BecomeProfessionalFormComponent } from '../become-professional-form/become-professional-form.component';
import { AuthService } from '../../../services/auth.service';

interface Category {
  id: number;
  name: string;
}

@Component({
  selector: 'app-professionals-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ProfessionalProfileModalComponent, BecomeProfessionalFormComponent],
  templateUrl: './professionals-page.component.html',
  styleUrls: ['./professionals-page.component.css']
})
export class ProfessionalsPageComponent implements OnInit {
  // Modal
  selectedProfessionalId: number | null = null;
  showBecomeProfessionalForm = false;

  // Search fields
  searchTerm: string = '';
  selectedCityId: number | null = null;
  selectedCategoryId: number | null = null;

  // Data lists
  cities: City[] = [];
  categories: Category[] = [];

  // Professionals data
  allProfessionals: MusicServiceProviderListDto[] = [];
  featuredProfessionals: MusicServiceProviderListDto[] = [];
  musicStores: MusicServiceProviderListDto[] = [];
  recordingStudios: MusicServiceProviderListDto[] = [];
  amplification: MusicServiceProviderListDto[] = [];
  additionalProfessionals: MusicServiceProviderListDto[] = [];

  // Filtered state
  isFiltered: boolean = false;
  filteredProfessionals: MusicServiceProviderListDto[] = [];

  // Quick search categories
  quickSearchCategories = [
    { id: 0, name: 'חנויות מוזיקה', hebrewName: 'חנויות מוזיקה' },
    { id: 0, name: 'אולפני הקלטות', hebrewName: 'אולפני הקלטות' },
    { id: 0, name: 'עריכת וידאו', hebrewName: 'עריכת וידאו' },
    { id: 0, name: 'הגברה', hebrewName: 'הגברה' }
  ];

  loading: boolean = true;

  constructor(
    private professionalService: MusicServiceProviderService,
    private citiesService: CitiesService,
    private systemTablesService: SystemTablesService,
    public authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCities();
    this.loadCategories();
    this.loadProfessionals();
  }

  loadCities(): void {
    this.citiesService.getCities().subscribe({
      next: (cities) => {
        this.cities = cities.filter(c => c.isActive);
      },
      error: (err) => console.error('Error loading cities:', err)
    });
  }

  loadCategories(): void {
    this.systemTablesService.getItems('music-service-provider-categories', 1, 100).subscribe({
      next: (response: any) => {
        this.categories = response.items || response;

        // Map quick search category IDs
        this.quickSearchCategories.forEach(quick => {
          const category = this.categories.find(c =>
            c.name.toLowerCase().includes(quick.name.toLowerCase())
          );
          if (category) {
            quick.id = category.id;
          }
        });
      },
      error: (err) => console.error('Error loading categories:', err)
    });
  }

  loadProfessionals(): void {
    this.loading = true;

    // Load featured professionals (top 10)
    this.professionalService.getServiceProviders(undefined, undefined, undefined, 1, true, false, 1, 10).subscribe({
      next: (response: any) => {
        this.featuredProfessionals = response.items || response.data || [];
      },
      error: (err) => console.error('Error loading featured professionals:', err)
    });

    // Load all active professionals (non-teachers)
    this.professionalService.getServiceProviders(undefined, undefined, undefined, 1, undefined, false, 1, 200).subscribe({
      next: (response: any) => {
        this.allProfessionals = response.items || response.data || [];

        // Load specific categories
        this.loadCategoryBanners();

        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading professionals:', err);
        this.loading = false;
      }
    });
  }

  loadCategoryBanners(): void {
    // Load music stores
    const musicStoreCategory = this.categories.find(c => c.name.includes('חנויות מוזיקה'));
    if (musicStoreCategory) {
      this.professionalService.getServiceProviders(undefined, musicStoreCategory.id, undefined, 1, undefined, false, 1, 10).subscribe({
        next: (response: any) => {
          this.musicStores = response.items || response.data || [];
          this.updateAdditionalProfessionals();
        },
        error: (err) => console.error('Error loading music stores:', err)
      });
    }

    // Load recording studios
    const recordingStudioCategory = this.categories.find(c => c.name.includes('אולפני הקלטות'));
    if (recordingStudioCategory) {
      this.professionalService.getServiceProviders(undefined, recordingStudioCategory.id, undefined, 1, undefined, false, 1, 10).subscribe({
        next: (response: any) => {
          this.recordingStudios = response.items || response.data || [];
          this.updateAdditionalProfessionals();
        },
        error: (err) => console.error('Error loading recording studios:', err)
      });
    }

    // Load amplification
    const amplificationCategory = this.categories.find(c => c.name.includes('הגברה'));
    if (amplificationCategory) {
      this.professionalService.getServiceProviders(undefined, amplificationCategory.id, undefined, 1, undefined, false, 1, 10).subscribe({
        next: (response: any) => {
          this.amplification = response.items || response.data || [];
          this.updateAdditionalProfessionals();
        },
        error: (err) => console.error('Error loading amplification:', err)
      });
    }
  }

  updateAdditionalProfessionals(): void {
    // Additional professionals (not in any specific category)
    const categorizedIds = new Set([
      ...this.featuredProfessionals.map(p => p.id),
      ...this.musicStores.map(p => p.id),
      ...this.recordingStudios.map(p => p.id),
      ...this.amplification.map(p => p.id)
    ]);

    this.additionalProfessionals = this.allProfessionals.filter(p => !categorizedIds.has(p.id));
  }

  onSearch(): void {
    // Check if any filter is active
    const hasActiveFilter =
      this.searchTerm.trim() !== '' ||
      this.selectedCityId !== null ||
      this.selectedCategoryId !== null;

    if (!hasActiveFilter) {
      // No filters - show default view with banners
      this.isFiltered = false;
      this.filteredProfessionals = [];
      return;
    }

    // Apply filters using API
    this.isFiltered = true;
    this.professionalService.getServiceProviders(
      this.searchTerm || undefined,
      this.selectedCategoryId || undefined,
      this.selectedCityId || undefined,
      1, // status = Active
      undefined,
      false, // isTeacher = false (professionals only)
      1,
      200
    ).subscribe({
      next: (response: any) => {
        this.filteredProfessionals = response.items || response.data || [];
      },
      error: (err) => console.error('Error filtering professionals:', err)
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCityId = null;
    this.selectedCategoryId = null;
    this.isFiltered = false;
    this.filteredProfessionals = [];
  }

  onQuickSearch(categoryName: string): void {
    const category = this.categories.find(c =>
      c.name.toLowerCase().includes(categoryName.toLowerCase())
    );

    if (category) {
      this.selectedCategoryId = category.id;
      this.onSearch();
    }
  }

  onViewMore(category: string): void {
    // Filter to show only this category (no limit - show all)
    this.isFiltered = true;

    switch(category) {
      case 'featured':
        // Show all featured professionals
        this.professionalService.getServiceProviders(undefined, undefined, undefined, 1, true, false, 1, 200).subscribe({
          next: (response: any) => {
            this.filteredProfessionals = response.items || response.data || [];
          },
          error: (err) => console.error('Error loading featured professionals:', err)
        });
        break;
      case 'musicStores':
        const musicStoreCategory = this.categories.find(c => c.name.includes('חנויות מוזיקה'));
        if (musicStoreCategory) {
          this.professionalService.getServiceProviders(undefined, musicStoreCategory.id, undefined, 1, undefined, false, 1, 200).subscribe({
            next: (response: any) => {
              this.filteredProfessionals = response.items || response.data || [];
            },
            error: (err) => console.error('Error loading music stores:', err)
          });
        }
        break;
      case 'recordingStudios':
        const recordingStudioCategory = this.categories.find(c => c.name.includes('אולפני הקלטות'));
        if (recordingStudioCategory) {
          this.professionalService.getServiceProviders(undefined, recordingStudioCategory.id, undefined, 1, undefined, false, 1, 200).subscribe({
            next: (response: any) => {
              this.filteredProfessionals = response.items || response.data || [];
            },
            error: (err) => console.error('Error loading recording studios:', err)
          });
        }
        break;
      case 'amplification':
        const amplificationCategory = this.categories.find(c => c.name.includes('הגברה'));
        if (amplificationCategory) {
          this.professionalService.getServiceProviders(undefined, amplificationCategory.id, undefined, 1, undefined, false, 1, 200).subscribe({
            next: (response: any) => {
              this.filteredProfessionals = response.items || response.data || [];
            },
            error: (err) => console.error('Error loading amplification:', err)
          });
        }
        break;
      default:
        this.filteredProfessionals = this.allProfessionals;
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  viewProfessional(professionalId: number): void {
    this.selectedProfessionalId = professionalId;
  }

  closeProfessionalProfile(): void {
    this.selectedProfessionalId = null;
  }

  openBecomeProfessionalForm(): void {
    if (!this.authService.isLoggedIn) {
      this.authService.requestLogin('/professionals');
      return;
    }
    // Route through subscription selection
    localStorage.setItem('pendingProfessionalType', 'service-provider');
    this.router.navigate(['/subscription/select']);
  }

  closeBecomeProfessionalForm(): void {
    this.showBecomeProfessionalForm = false;
  }

  getCityName(cityId?: number): string {
    if (!cityId) return '';
    const city = this.cities.find(c => c.id === cityId);
    return city?.name || '';
  }
}
