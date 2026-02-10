import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TeacherService } from '../../../services/teacher.service';
import { CitiesService, City } from '../../../services/cities.service';
import { SystemTablesService } from '../../../services/system-tables.service';
import { TeacherListDto, TeacherDto } from '../../../models/teacher.model';
import { TargetAudience, getTargetAudienceOptions } from '../../../models/target-audience.enum';
import { TeachingLanguage, getTeachingLanguageOptions } from '../../../models/teaching-language.enum';
import { TeacherProfileModalComponent } from '../../admin/teachers/teacher-profile-modal.component';
import { BecomeTeacherFormComponent } from '../become-teacher-form/become-teacher-form.component';
import { AuthService } from '../../../services/auth.service';

interface Instrument {
  id: number;
  name: string;
}

interface TeacherBanner {
  title: string;
  teachers: TeacherListDto[];
  instrumentId?: number;
  showAll?: boolean;
}

@Component({
  selector: 'app-teachers-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TeacherProfileModalComponent, BecomeTeacherFormComponent],
  templateUrl: './teachers-page.component.html',
  styleUrls: ['./teachers-page.component.css']
})
export class TeachersPageComponent implements OnInit {
  // Modal
  selectedTeacherId: number | null = null;
  showBecomeTeacherForm = false;

  // Search fields
  searchTerm: string = '';
  selectedCityId: number | null = null;
  selectedInstrumentId: number | null = null;
  selectedTargetAudience: TargetAudience | null = null;
  selectedLanguage: TeachingLanguage | null = null;

  // Data lists
  cities: City[] = [];
  instruments: Instrument[] = [];
  targetAudienceOptions = getTargetAudienceOptions();
  languageOptions = getTeachingLanguageOptions();

  // Teachers data
  allTeachers: TeacherListDto[] = []; // Store all teachers
  featuredTeachers: TeacherListDto[] = [];
  organTeachers: TeacherListDto[] = [];
  soundTeachers: TeacherListDto[] = [];
  vocalTeachers: TeacherListDto[] = [];
  additionalTeachers: TeacherListDto[] = [];

  // Filtered state
  isFiltered: boolean = false;
  filteredTeachers: TeacherListDto[] = [];

  // Quick search instruments
  quickSearchInstruments = [
    { id: 0, name: 'גיטרה', hebrewName: 'גיטרה' },
    { id: 0, name: 'פסנתר', hebrewName: 'פסנתר' },
    { id: 0, name: 'כינור', hebrewName: 'כינור' },
    { id: 0, name: 'חליל', hebrewName: 'חליל' }
  ];

  loading: boolean = true;

  constructor(
    private teacherService: TeacherService,
    private citiesService: CitiesService,
    private systemTablesService: SystemTablesService,
    private router: Router,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadCities();
    this.loadInstruments();
    this.loadTeachers();
  }

  loadCities(): void {
    this.citiesService.getCities().subscribe({
      next: (cities) => {
        this.cities = cities.filter(c => c.isActive);
      },
      error: (err) => console.error('Error loading cities:', err)
    });
  }

  loadInstruments(): void {
    this.systemTablesService.getItems('instruments', 1, 100).subscribe({
      next: (response: any) => {
        this.instruments = response.items || response;

        // Map quick search instrument IDs
        this.quickSearchInstruments.forEach(quick => {
          const instrument = this.instruments.find(i =>
            i.name.toLowerCase().includes(quick.name.toLowerCase())
          );
          if (instrument) {
            quick.id = instrument.id;
          }
        });
      },
      error: (err) => console.error('Error loading instruments:', err)
    });
  }

  loadTeachers(): void {
    this.loading = true;

    // Load featured teachers (top 10)
    this.teacherService.getTeachers(undefined, undefined, 1, true, 1, 10).subscribe({
      next: (response: any) => {
        this.featuredTeachers = response.items || response.data || [];
      },
      error: (err) => console.error('Error loading featured teachers:', err)
    });

    // Load all active teachers
    this.teacherService.getTeachers(undefined, undefined, 1, undefined, 1, 200).subscribe({
      next: (response: any) => {
        this.allTeachers = response.items || response.data || [];

        // DEBUG: Log sample teacher data
        if (this.allTeachers.length > 0) {
          console.log('Sample teacher data:', this.allTeachers[0]);
          console.log('Fields check:', {
            hasLanguages: 'languages' in this.allTeachers[0],
            hasTargetAudience: 'targetAudience' in this.allTeachers[0],
            hasPrimaryInstrument: 'primaryInstrument' in this.allTeachers[0],
            languages: this.allTeachers[0].languages,
            targetAudience: this.allTeachers[0].targetAudience,
            primaryInstrument: this.allTeachers[0].primaryInstrument
          });
        }

        // Filter teachers by specific instruments
        this.organTeachers = this.filterTeachersByInstrument(this.allTeachers, 'אורגן');
        this.soundTeachers = this.filterTeachersByInstrument(this.allTeachers, 'סאונד');
        this.vocalTeachers = this.filterTeachersByInstrument(this.allTeachers, 'פיתוח קול');
        console.log('Organ teachers count:', this.organTeachers.length);
        // Additional teachers (not in any specific category)
        const categorizedIds = new Set([
          ...this.featuredTeachers.map(t => t.id),
          ...this.organTeachers.map(t => t.id),
          ...this.soundTeachers.map(t => t.id),
          ...this.vocalTeachers.map(t => t.id)
        ]);

        this.additionalTeachers = this.allTeachers.filter((t: TeacherListDto) => !categorizedIds.has(t.id));

        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading teachers:', err);
        this.loading = false;
      }
    });
  }

  filterTeachersByInstrument(teachers: TeacherListDto[], instrumentName: string, limit: number = 10): TeacherListDto[] {
    // Find the instrument ID by name
    const instrument = this.instruments.find(i =>
      i.name.toLowerCase().includes(instrumentName.toLowerCase())
    );

    if (!instrument) {
      return [];
    }

    // Filter teachers who teach this instrument (not just primary)
    const filtered = teachers.filter(teacher =>
      teacher.instrumentIds && teacher.instrumentIds.includes(instrument.id)
    );

    return limit > 0 ? filtered.slice(0, limit) : filtered;
  }

  onSearch(): void {
    // Check if any filter is active
    const hasActiveFilter =
      this.searchTerm.trim() !== '' ||
      this.selectedCityId !== null ||
      this.selectedInstrumentId !== null ||
      this.selectedTargetAudience !== null ||
      this.selectedLanguage !== null;

    if (!hasActiveFilter) {
      // No filters - show default view with banners
      this.isFiltered = false;
      this.filteredTeachers = [];
      return;
    }

    // Apply all filters client-side (faster and more efficient for this dataset size)
    this.isFiltered = true;
    this.filteredTeachers = this.applyAllFilters(this.allTeachers);
  }

  applyAllFilters(teachers: TeacherListDto[]): TeacherListDto[] {
    let filtered = [...teachers];

    console.log('=== Starting filter process ===');
    console.log('Total teachers:', filtered.length);
    console.log('Active filters:', {
      searchTerm: this.searchTerm,
      selectedCityId: this.selectedCityId,
      selectedInstrumentId: this.selectedInstrumentId,
      selectedTargetAudience: this.selectedTargetAudience,
      selectedLanguage: this.selectedLanguage
    });

    // Filter by search term (name or instrument)
    if (this.searchTerm.trim() !== '') {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(t =>
        t.displayName?.toLowerCase().includes(searchLower) ||
        t.primaryInstrument?.toLowerCase().includes(searchLower)
      );
      console.log('After search term filter:', filtered.length);
    }

    // Filter by city (convert to number for comparison)
    if (this.selectedCityId !== null) {
      const cityId = Number(this.selectedCityId);
      console.log('Filtering by city ID:', cityId, 'Type:', typeof cityId);
      filtered = filtered.filter(t => t.cityId === cityId);
      console.log('After city filter:', filtered.length);
    }

    // Filter by instrument (convert to number for comparison)
    if (this.selectedInstrumentId !== null) {
      const instrumentId = Number(this.selectedInstrumentId);
      console.log('Filtering by instrument ID:', instrumentId);
      console.log('Sample teacher instrumentIds:', filtered.slice(0, 5).map(t => ({
        id: t.id,
        name: t.displayName,
        instrumentIds: t.instrumentIds
      })));
      filtered = filtered.filter(t =>
        t.instrumentIds && t.instrumentIds.includes(instrumentId)
      );
      console.log('After instrument filter:', filtered.length);
    }

    // Filter by target audience (using bitwise AND for flags enum)
    if (this.selectedTargetAudience !== null && this.selectedTargetAudience !== 0) {
      const selectedAudience = this.selectedTargetAudience; // Store in local variable for TypeScript
      console.log('Filtering by target audience:', selectedAudience);
      console.log('Sample teacher targetAudience values:', filtered.slice(0, 5).map(t => ({
        id: t.id,
        name: t.displayName,
        targetAudience: t.targetAudience
      })));
      filtered = filtered.filter(t =>
        t.targetAudience !== undefined &&
        t.targetAudience !== null &&
        (t.targetAudience & selectedAudience) !== 0
      );
      console.log('After target audience filter:', filtered.length);
    }

    // Filter by language (using bitwise AND for flags enum)
    if (this.selectedLanguage !== null && this.selectedLanguage !== 0) {
      const selectedLang = this.selectedLanguage; // Store in local variable for TypeScript
      console.log('Filtering by language:', selectedLang);
      console.log('Sample teacher languages values:', filtered.slice(0, 5).map(t => ({
        id: t.id,
        name: t.displayName,
        languages: t.languages
      })));
      filtered = filtered.filter(t =>
        t.languages !== undefined &&
        t.languages !== null &&
        (t.languages & selectedLang) !== 0
      );
      console.log('After language filter:', filtered.length);
    }

    console.log('=== Final filtered count:', filtered.length, '===');
    return filtered;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCityId = null;
    this.selectedInstrumentId = null;
    this.selectedTargetAudience = null;
    this.selectedLanguage = null;
    this.isFiltered = false;
    this.filteredTeachers = [];
  }

  onQuickSearch(instrumentName: string): void {
    const instrument = this.instruments.find(i =>
      i.name.toLowerCase().includes(instrumentName.toLowerCase())
    );

    if (instrument) {
      this.selectedInstrumentId = instrument.id;
      this.onSearch();
    }
  }

  onViewMore(category: string): void {
    // Filter to show only this category (no limit - show all)
    this.isFiltered = true;

    switch(category) {
      case 'featured':
        // Show all featured teachers, not just the first 10
        this.filteredTeachers = this.allTeachers.filter(t => t.isFeatured);
        break;
      case 'organ':
        this.filteredTeachers = this.filterTeachersByInstrument(this.allTeachers, 'אורגן', 0);
        break;
      case 'sound':
        this.filteredTeachers = this.filterTeachersByInstrument(this.allTeachers, 'סאונד', 0);
        break;
      case 'vocal':
        this.filteredTeachers = this.filterTeachersByInstrument(this.allTeachers, 'פיתוח קול', 0);
        break;
      default:
        this.filteredTeachers = this.allTeachers;
    }

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  viewTeacher(teacherId: number): void {
    this.selectedTeacherId = teacherId;
  }

  closeTeacherProfile(): void {
    this.selectedTeacherId = null;
  }

  openBecomeTeacherForm(): void {
    if (!this.authService.isLoggedIn) {
      this.authService.requestLogin('/teachers');
      return;
    }
    // Route through subscription selection
    localStorage.setItem('pendingProfessionalType', 'teacher');
    this.router.navigate(['/subscription/select']);
  }

  closeBecomeTeacherForm(): void {
    this.showBecomeTeacherForm = false;
  }

  getCityName(cityId?: number): string {
    if (!cityId) return '';
    const city = this.cities.find(c => c.id === cityId);
    return city?.name || '';
  }

  getTeacherInstruments(teacher: TeacherListDto): string {
    if (!teacher.instrumentIds || teacher.instrumentIds.length === 0) {
      return '';
    }

    const instrumentNames = teacher.instrumentIds
      .map(id => this.instruments.find(i => i.id === id)?.name)
      .filter(name => name !== undefined) as string[];

    if (instrumentNames.length === 0) {
      return '';
    }

    if (instrumentNames.length === 1) {
      return `מורה ל${instrumentNames[0]}`;
    }

    // Multiple instruments: "מורה לפסנתר, גיטרה וכינור"
    const lastInstrument = instrumentNames[instrumentNames.length - 1];
    const otherInstruments = instrumentNames.slice(0, -1).join(', ');
    return `מורה ל${otherInstruments} ו${lastInstrument}`;
  }
}
