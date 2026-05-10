import { Component, OnInit, HostListener, inject } from '@angular/core';
import { LanguageService } from '../../../services/language.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { TeacherService } from '../../../services/teacher.service';
import { CitiesService, City } from '../../../services/cities.service';
import { SystemTablesService } from '../../../services/system-tables.service';
import { TeacherListDto } from '../../../models/teacher.model';
import { TargetAudience, getTargetAudienceOptions } from '../../../models/target-audience.enum';
import { TeachingLanguage, getTeachingLanguageOptions } from '../../../models/teaching-language.enum';
import { TeacherProfileModalComponent } from '../../admin/teachers/teacher-profile-modal.component';
import { BecomeTeacherFormComponent } from '../become-teacher-form/become-teacher-form.component';
import { AuthService } from '../../../services/auth.service';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';
import { QuickAddAssistantService } from '../../../services/quick-add-assistant.service';
import { TranslatePipe } from '../../../pipes/translate.pipe';

interface Instrument {
  id: number;
  name: string;
}

@Component({
  selector: 'app-teachers-page',
  standalone: true,
  imports: [CommonModule, FormsModule, TeacherProfileModalComponent, BecomeTeacherFormComponent, ImgFallbackDirective, TranslatePipe],
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
  featuredTeachers: TeacherListDto[] = [];
  organTeachers: TeacherListDto[] = [];
  soundTeachers: TeacherListDto[] = [];
  vocalTeachers: TeacherListDto[] = [];
  additionalTeachers: TeacherListDto[] = [];

  // Filtered state
  isFiltered: boolean = false;
  filteredTeachers: TeacherListDto[] = [];

  // Pagination state
  loadingMoreTeachers = false;
  additionalTeachersPage = 1;
  additionalTeachersTotal = 0;
  filteredTeachersPage = 1;
  filteredTeachersTotal = 0;

  // Quick search instruments
  quickSearchInstruments = [
    { id: 0, name: 'גיטרה', hebrewName: 'גיטרה' },
    { id: 0, name: 'פסנתר', hebrewName: 'פסנתר' },
    { id: 0, name: 'כינור', hebrewName: 'כינור' },
    { id: 0, name: 'חליל', hebrewName: 'חליל' }
  ];

  loading: boolean = true;

  private readonly stripPageSize = 10;
  private readonly catalogPageSize = 24;
  private readonly searchPageSize = 40;
  private readonly scrollLoadOffset = 700;
  private rafPending = false;

  private readonly langService = inject(LanguageService);

  constructor(
    private teacherService: TeacherService,
    private citiesService: CitiesService,
    private systemTablesService: SystemTablesService,
    private router: Router,
    public authService: AuthService,
    private quickAddAssistantService: QuickAddAssistantService
  ) {}

  ngOnInit(): void {
    this.loadCities();
    this.loadTeachers();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.loadMoreWhenNearBottom();
      this.rafPending = false;
    });
  }

  loadCities(): void {
    this.citiesService.getCities().subscribe({
      next: (cities) => {
        this.cities = cities.filter(c => c.isActive);
      },
      error: (err) => console.error('Error loading cities:', err)
    });
  }

  loadTeachers(): void {
    this.loading = true;

    this.systemTablesService.getItems('instruments', 1, 100).pipe(
      switchMap((instrumentResponse: any) => {
        this.instruments = instrumentResponse.items || instrumentResponse || [];

        this.quickSearchInstruments.forEach(quick => {
          const instrument = this.instruments.find(i =>
            i.name.toLowerCase().includes(quick.name.toLowerCase())
          );
          if (instrument) quick.id = instrument.id;
        });

        const organId = this.findInstrumentId('אורגן');
        const soundId = this.findInstrumentId('סאונד');
        const vocalId = this.findInstrumentId('פיתוח קול');

        return forkJoin({
          featured: this.teacherService.getTeachers(undefined, undefined, 1, true, 1, this.stripPageSize),
          organ: organId
            ? this.teacherService.getTeachers(undefined, organId, 1, undefined, 1, this.stripPageSize)
            : of({ items: [], data: [] } as any),
          sound: soundId
            ? this.teacherService.getTeachers(undefined, soundId, 1, undefined, 1, this.stripPageSize)
            : of({ items: [], data: [] } as any),
          vocal: vocalId
            ? this.teacherService.getTeachers(undefined, vocalId, 1, undefined, 1, this.stripPageSize)
            : of({ items: [], data: [] } as any),
          catalog: this.teacherService.getTeachers(undefined, undefined, 1, undefined, 1, this.catalogPageSize)
        });
      })
    ).subscribe({
      next: (results: any) => {
        this.featuredTeachers = results.featured.items || results.featured.data || [];
        this.organTeachers = results.organ.items || results.organ.data || [];
        this.soundTeachers = results.sound.items || results.sound.data || [];
        this.vocalTeachers = results.vocal.items || results.vocal.data || [];
        this.additionalTeachers = results.catalog.items || results.catalog.data || [];
        this.additionalTeachersPage = results.catalog.pageNumber || 1;
        this.additionalTeachersTotal = results.catalog.totalCount || this.additionalTeachers.length;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading teachers:', err);
        this.loading = false;
      }
    });
  }

  onSearch(): void {
    const hasActiveFilter =
      this.searchTerm.trim() !== '' ||
      this.selectedCityId !== null ||
      this.selectedInstrumentId !== null ||
      this.selectedTargetAudience !== null ||
      this.selectedLanguage !== null;

    if (!hasActiveFilter) {
      this.isFiltered = false;
      this.filteredTeachers = [];
      this.filteredTeachersPage = 1;
      this.filteredTeachersTotal = 0;
      return;
    }

    this.isFiltered = true;
    this.filteredTeachersPage = 1;

    this.teacherService.getTeachers(
      this.searchTerm || undefined,
      this.selectedInstrumentId || undefined,
      1,
      undefined,
      1,
      this.searchPageSize,
      this.selectedCityId || undefined,
      this.selectedTargetAudience || undefined,
      this.selectedLanguage || undefined
    ).subscribe({
      next: (response: any) => {
        this.filteredTeachers = response.items || response.data || [];
        this.filteredTeachersTotal = response.totalCount || this.filteredTeachers.length;
      },
      error: (err) => console.error('Error filtering teachers:', err)
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCityId = null;
    this.selectedInstrumentId = null;
    this.selectedTargetAudience = null;
    this.selectedLanguage = null;
    this.isFiltered = false;
    this.filteredTeachers = [];
    this.filteredTeachersPage = 1;
    this.filteredTeachersTotal = 0;
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
    this.isFiltered = true;
    this.filteredTeachersPage = 1;

    let instrumentId: number | undefined;
    let featured: boolean | undefined;

    switch (category) {
      case 'featured': featured = true; break;
      case 'organ':    instrumentId = this.findInstrumentId('אורגן'); break;
      case 'sound':    instrumentId = this.findInstrumentId('סאונד'); break;
      case 'vocal':    instrumentId = this.findInstrumentId('פיתוח קול'); break;
    }

    this.teacherService.getTeachers(undefined, instrumentId, 1, featured, 1, this.searchPageSize).subscribe({
      next: (response: any) => {
        this.filteredTeachers = response.items || response.data || [];
        this.filteredTeachersTotal = response.totalCount || this.filteredTeachers.length;
      },
      error: (err) => console.error('Error loading teacher section:', err)
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private loadMoreWhenNearBottom(): void {
    const distanceFromBottom =
      document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
    if (distanceFromBottom > this.scrollLoadOffset) return;

    if (this.isFiltered) {
      this.loadMoreFilteredTeachers();
    } else {
      this.loadMoreCatalogTeachers();
    }
  }

  private loadMoreCatalogTeachers(): void {
    if (this.loadingMoreTeachers || this.additionalTeachers.length >= this.additionalTeachersTotal) return;
    this.loadingMoreTeachers = true;
    const nextPage = this.additionalTeachersPage + 1;

    this.teacherService.getTeachers(undefined, undefined, 1, undefined, nextPage, this.catalogPageSize).subscribe({
      next: (response: any) => {
        this.appendUniqueTeachers(this.additionalTeachers, response.items || response.data || []);
        this.additionalTeachersPage = response.pageNumber || nextPage;
        this.additionalTeachersTotal = response.totalCount || this.additionalTeachersTotal;
        this.loadingMoreTeachers = false;
      },
      error: (err) => {
        console.error('Error loading more teachers:', err);
        this.loadingMoreTeachers = false;
      }
    });
  }

  private loadMoreFilteredTeachers(): void {
    if (this.loadingMoreTeachers || this.filteredTeachers.length >= this.filteredTeachersTotal) return;
    this.loadingMoreTeachers = true;
    const nextPage = this.filteredTeachersPage + 1;

    this.teacherService.getTeachers(
      this.searchTerm || undefined,
      this.selectedInstrumentId || undefined,
      1,
      undefined,
      nextPage,
      this.searchPageSize,
      this.selectedCityId || undefined,
      this.selectedTargetAudience || undefined,
      this.selectedLanguage || undefined
    ).subscribe({
      next: (response: any) => {
        this.appendUniqueTeachers(this.filteredTeachers, response.items || response.data || []);
        this.filteredTeachersPage = response.pageNumber || nextPage;
        this.filteredTeachersTotal = response.totalCount || this.filteredTeachersTotal;
        this.loadingMoreTeachers = false;
      },
      error: (err) => {
        console.error('Error loading more filtered teachers:', err);
        this.loadingMoreTeachers = false;
      }
    });
  }

  private appendUniqueTeachers(target: TeacherListDto[], items: TeacherListDto[]): void {
    const existingIds = new Set(target.map(item => item.id));
    target.push(...items.filter(item => !existingIds.has(item.id)));
  }

  private findInstrumentId(instrumentName: string): number | undefined {
    return this.instruments.find(i =>
      i.name.toLowerCase().includes(instrumentName.toLowerCase())
    )?.id;
  }

  trackByTeacherId(_index: number, teacher: TeacherListDto): number {
    return teacher.id;
  }

  viewTeacher(teacherId: number): void {
    this.router.navigate(['/teacher', teacherId]);
  }

  closeTeacherProfile(): void {
    this.selectedTeacherId = null;
  }

  openBecomeTeacherForm(): void {
    if (!this.authService.isLoggedIn) {
      this.authService.requestLogin('/teachers');
      return;
    }
    this.quickAddAssistantService.requestOpen('index');
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
    if (!teacher.instrumentIds || teacher.instrumentIds.length === 0) return '';

    const names = teacher.instrumentIds
      .map(id => this.instruments.find(i => i.id === id)?.name)
      .filter((name): name is string => name !== undefined);

    if (names.length === 0) return '';
    const prefix = this.langService.translate('teacher.role_prefix');
    if (names.length === 1) return `${prefix}${names[0]}`;

    const last = names[names.length - 1];
    const and = this.langService.translate('teacher.role_and');
    return `${prefix}${names.slice(0, -1).join(', ')}${and}${last}`;
  }
}
