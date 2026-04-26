import { Component, OnInit, AfterViewInit, HostListener, ViewChild, ElementRef } from '@angular/core';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';
import { TeacherService } from '../../../services/teacher.service';
import { CitiesService, City } from '../../../services/cities.service';
import { SystemTablesService } from '../../../services/system-tables.service';
import { MusicServiceProviderListDto } from '../../../models/music-service-provider.model';
import { TeacherListDto } from '../../../models/teacher.model';
import { TargetAudience, getTargetAudienceOptions } from '../../../models/target-audience.enum';
import { TeachingLanguage, getTeachingLanguageOptions } from '../../../models/teaching-language.enum';
import { BecomeProfessionalFormComponent } from '../become-professional-form/become-professional-form.component';
import { AuthService } from '../../../services/auth.service';
import { QuickAddAssistantService } from '../../../services/quick-add-assistant.service';

interface Category {
  id: number;
  name: string;
}

interface Instrument {
  id: number;
  name: string;
}

@Component({
  selector: 'app-professionals-page',
  standalone: true,
  imports: [CommonModule, FormsModule, BecomeProfessionalFormComponent, ImgFallbackDirective],
  templateUrl: './professionals-page.component.html',
  styleUrls: ['./professionals-page.component.css']
})
export class ProfessionalsPageComponent implements OnInit, AfterViewInit {

  @ViewChild('heroBg') heroBg?: ElementRef<HTMLDivElement>;
  private fullHeroHeight = 0;
  private rafPending = false;

  // ─── Tab ─────────────────────────────────────────
  activeTab: 'professionals' | 'teachers' = 'professionals';

  // ─── Top filter (category dropdown — כולל מורים) ──
  topFilterValue: string = 'all'; // 'all' | 'teachers' | category id as string

  // ─── Dropdown visibility ──────────────────────────
  showCategoryDropdown = false;
  showCityDropdown = false;
  showInstrumentDropdown = false;
  showLanguageDropdown = false;
  showAudienceDropdown = false;

  showBecomeProfessionalForm = false;

  // ─── Shared search fields ─────────────────────────
  searchTerm: string = '';
  selectedCityId: number | null = null;

  // ─── Professionals filters ────────────────────────
  selectedCategoryId: number | null = null;

  // ─── Teachers filters ─────────────────────────────
  selectedInstrumentId: number | null = null;
  selectedTargetAudience: TargetAudience | null = null;
  selectedLanguage: TeachingLanguage | null = null;

  // ─── Data lists ──────────────────────────────────
  cities: City[] = [];
  categories: Category[] = [];
  instruments: Instrument[] = [];
  targetAudienceOptions = getTargetAudienceOptions();
  languageOptions = getTeachingLanguageOptions();

  // ─── Professionals data ───────────────────────────
  featuredProfessionals: MusicServiceProviderListDto[] = [];
  musicStores: MusicServiceProviderListDto[] = [];
  recordingStudios: MusicServiceProviderListDto[] = [];
  amplification: MusicServiceProviderListDto[] = [];
  additionalProfessionals: MusicServiceProviderListDto[] = [];
  isFiltered: boolean = false;
  filteredProfessionals: MusicServiceProviderListDto[] = [];
  loading: boolean = true;

  quickSearchCategories = [
    { id: 0, name: 'חנויות מוזיקה', hebrewName: 'חנויות מוזיקה' },
    { id: 0, name: 'אולפני הקלטות', hebrewName: 'אולפני הקלטות' },
    { id: 0, name: 'עריכת וידאו', hebrewName: 'עריכת וידאו' },
    { id: 0, name: 'הגברה', hebrewName: 'הגברה' }
  ];

  // ─── Teachers data ────────────────────────────────
  allTeachers: TeacherListDto[] = [];
  featuredTeachers: TeacherListDto[] = [];
  organTeachers: TeacherListDto[] = [];
  soundTeachers: TeacherListDto[] = [];
  vocalTeachers: TeacherListDto[] = [];
  additionalTeachers: TeacherListDto[] = [];
  isFilteredTeachers: boolean = false;
  filteredTeachers: TeacherListDto[] = [];
  loadingTeachers: boolean = true;

  quickSearchInstruments = [
    { id: 0, name: 'גיטרה', hebrewName: 'גיטרה' },
    { id: 0, name: 'פסנתר', hebrewName: 'פסנתר' },
    { id: 0, name: 'כינור', hebrewName: 'כינור' },
    { id: 0, name: 'חליל', hebrewName: 'חליל' }
  ];

  constructor(
    private professionalService: MusicServiceProviderService,
    private teacherService: TeacherService,
    private citiesService: CitiesService,
    private systemTablesService: SystemTablesService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private quickAddAssistantService: QuickAddAssistantService
  ) {}

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'teachers') {
      this.activeTab = 'teachers';
    }
    this.loadCities();
    this.loadProfessionals();
    this.loadInstrumentsAndTeachers();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.initHeroHeight(), 0);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.shrinkHero();
      this.rafPending = false;
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.initHeroHeight();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.filter-btn-wrap')) {
      this.closeAllDropdowns();
    }
  }

  private initHeroHeight(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg) return;
    this.fullHeroHeight = Math.round(window.innerHeight * 0.6);
    bg.style.height = this.fullHeroHeight + 'px';
    this.shrinkHero();
  }

  private shrinkHero(): void {
    const bg = this.heroBg?.nativeElement;
    if (!bg || this.fullHeroHeight === 0) return;
    const minHeight = 56;
    const newHeight = Math.max(minHeight, this.fullHeroHeight - window.scrollY);
    bg.style.height = newHeight + 'px';
    const overlay = bg.querySelector('.hero-collapse-overlay') as HTMLElement | null;
    if (overlay) {
      const range = this.fullHeroHeight - minHeight;
      const progress = range > 0 ? Math.min(1, (this.fullHeroHeight - newHeight) / range) : 0;
      overlay.style.opacity = String(progress);
    }
  }

  toggleCategoryDropdown(): void {
    const nextState = !this.showCategoryDropdown;
    this.closeAllDropdowns();
    this.showCategoryDropdown = nextState;
  }

  toggleCityDropdown(): void {
    const nextState = !this.showCityDropdown;
    this.closeAllDropdowns();
    this.showCityDropdown = nextState;
  }

  toggleInstrumentDropdown(): void {
    const nextState = !this.showInstrumentDropdown;
    this.closeAllDropdowns();
    this.showInstrumentDropdown = nextState;
  }

  toggleLanguageDropdown(): void {
    const nextState = !this.showLanguageDropdown;
    this.closeAllDropdowns();
    this.showLanguageDropdown = nextState;
  }

  toggleAudienceDropdown(): void {
    const nextState = !this.showAudienceDropdown;
    this.closeAllDropdowns();
    this.showAudienceDropdown = nextState;
  }

  // ─── Top filter (category dropdown) ─────────────
  setTopFilter(value: string): void {
    this.topFilterValue = value;
    if (value === 'teachers') {
      this.setTab('teachers');
    } else {
      if (this.activeTab !== 'professionals') this.setTab('professionals');
      this.selectedCategoryId = value === 'all' ? null : parseInt(value, 10);
      this.onSearch();
    }
  }

  // ─── Tab ─────────────────────────────────────────
  setTab(tab: 'professionals' | 'teachers'): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    if (tab === 'professionals') {
      this.selectedInstrumentId = null;
      this.selectedTargetAudience = null;
      this.selectedLanguage = null;
      this.isFilteredTeachers = false;
      this.filteredTeachers = [];
    } else {
      this.selectedCategoryId = null;
      this.isFiltered = false;
      this.filteredProfessionals = [];
    }
    if (this.searchTerm.trim() !== '' || this.selectedCityId !== null) {
      this.onSearch();
    }
  }

  // ─── Cities ───────────────────────────────────────
  loadCities(): void {
    this.citiesService.getCities().subscribe({
      next: (cities) => { this.cities = cities.filter(c => c.isActive); },
      error: (err) => console.error('Error loading cities:', err)
    });
  }

  // ─── Load Professionals ───────────────────────────
  loadProfessionals(): void {
    this.loading = true;
    this.systemTablesService.getItems('music-service-provider-categories', 1, 100).pipe(
      switchMap((response: any) => {
        this.categories = response.items || response;
        this.quickSearchCategories.forEach(quick => {
          const category = this.categories.find(c => c.name.toLowerCase().includes(quick.name.toLowerCase()));
          if (category) quick.id = category.id;
        });
        const musicStoreCat = this.categories.find(c => c.name.includes('חנויות מוזיקה'));
        const recordingStudioCat = this.categories.find(c => c.name.includes('אולפני הקלטות'));
        const amplificationCat = this.categories.find(c => c.name.includes('הגברה'));
        return forkJoin({
          featured: this.professionalService.getServiceProviders(undefined, undefined, undefined, 1, true, false, 1, 10),
          musicStores: musicStoreCat
            ? this.professionalService.getServiceProviders(undefined, musicStoreCat.id, undefined, 1, undefined, false, 1, 10)
            : of({ items: [], data: [] } as any),
          recordingStudios: recordingStudioCat
            ? this.professionalService.getServiceProviders(undefined, recordingStudioCat.id, undefined, 1, undefined, false, 1, 10)
            : of({ items: [], data: [] } as any),
          amplification: amplificationCat
            ? this.professionalService.getServiceProviders(undefined, amplificationCat.id, undefined, 1, undefined, false, 1, 10)
            : of({ items: [], data: [] } as any),
          catalog: this.professionalService.getServiceProviders(undefined, undefined, undefined, 1, undefined, false, 1, 20)
        });
      })
    ).subscribe({
      next: (results: any) => {
        this.featuredProfessionals = results.featured.items || results.featured.data || [];
        this.musicStores = results.musicStores.items || results.musicStores.data || [];
        this.recordingStudios = results.recordingStudios.items || results.recordingStudios.data || [];
        this.amplification = results.amplification.items || results.amplification.data || [];
        this.additionalProfessionals = results.catalog.items || results.catalog.data || [];
        this.loading = false;
      },
      error: (err) => { console.error('Error loading professionals:', err); this.loading = false; }
    });
  }

  // ─── Load Instruments + Teachers (together to avoid race) ────
  loadInstrumentsAndTeachers(): void {
    this.loadingTeachers = true;
    forkJoin({
      instruments: this.systemTablesService.getItems('instruments', 1, 100),
      featured: this.teacherService.getTeachers(undefined, undefined, 1, true, 1, 10),
      all: this.teacherService.getTeachers(undefined, undefined, 1, undefined, 1, 200)
    }).subscribe({
      next: (results: any) => {
        this.instruments = results.instruments.items || results.instruments || [];
        this.quickSearchInstruments.forEach(quick => {
          const instrument = this.instruments.find(i => i.name.toLowerCase().includes(quick.name.toLowerCase()));
          if (instrument) quick.id = instrument.id;
        });

        this.featuredTeachers = results.featured.items || results.featured.data || [];
        this.allTeachers = results.all.items || results.all.data || [];

        this.organTeachers = this.filterTeachersByInstrument(this.allTeachers, 'אורגן');
        this.soundTeachers = this.filterTeachersByInstrument(this.allTeachers, 'סאונד');
        this.vocalTeachers = this.filterTeachersByInstrument(this.allTeachers, 'פיתוח קול');

        const categorizedIds = new Set([
          ...this.featuredTeachers.map(t => t.id),
          ...this.organTeachers.map(t => t.id),
          ...this.soundTeachers.map(t => t.id),
          ...this.vocalTeachers.map(t => t.id)
        ]);
        this.additionalTeachers = this.allTeachers.filter(t => !categorizedIds.has(t.id));
        this.loadingTeachers = false;
      },
      error: (err) => { console.error('Error loading teachers:', err); this.loadingTeachers = false; }
    });
  }

  filterTeachersByInstrument(teachers: TeacherListDto[], instrumentName: string, limit: number = 10): TeacherListDto[] {
    const instrument = this.instruments.find(i => i.name.toLowerCase().includes(instrumentName.toLowerCase()));
    if (!instrument) return [];
    const filtered = teachers.filter(t => t.instrumentIds && t.instrumentIds.includes(instrument.id));
    return limit > 0 ? filtered.slice(0, limit) : filtered;
  }

  // ─── Search ───────────────────────────────────────
  onSearch(): void {
    if (this.activeTab === 'professionals') {
      this.onSearchProfessionals();
    } else {
      this.onSearchTeachers();
    }
  }

  private onSearchProfessionals(): void {
    const hasActiveFilter =
      this.searchTerm.trim() !== '' ||
      this.selectedCityId !== null ||
      this.selectedCategoryId !== null;
    if (!hasActiveFilter) {
      this.isFiltered = false;
      this.filteredProfessionals = [];
      return;
    }
    this.isFiltered = true;
    this.professionalService.getServiceProviders(
      this.searchTerm || undefined,
      this.selectedCategoryId || undefined,
      this.selectedCityId || undefined,
      1, undefined, false, 1, 50
    ).subscribe({
      next: (response: any) => { this.filteredProfessionals = response.items || response.data || []; },
      error: (err) => console.error('Error filtering professionals:', err)
    });
  }

  private onSearchTeachers(): void {
    const hasActiveFilter =
      this.searchTerm.trim() !== '' ||
      this.selectedCityId !== null ||
      this.selectedInstrumentId !== null ||
      this.selectedTargetAudience !== null ||
      this.selectedLanguage !== null;
    if (!hasActiveFilter) {
      this.isFilteredTeachers = false;
      this.filteredTeachers = [];
      return;
    }
    this.isFilteredTeachers = true;
    this.filteredTeachers = this.applyTeacherFilters(this.allTeachers);
  }

  private applyTeacherFilters(teachers: TeacherListDto[]): TeacherListDto[] {
    let filtered = [...teachers];
    if (this.searchTerm.trim() !== '') {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(t =>
        t.displayName?.toLowerCase().includes(searchLower) ||
        t.primaryInstrument?.toLowerCase().includes(searchLower)
      );
    }
    if (this.selectedCityId !== null) {
      const cityId = Number(this.selectedCityId);
      filtered = filtered.filter(t => t.cityId === cityId);
    }
    if (this.selectedInstrumentId !== null) {
      const instrumentId = Number(this.selectedInstrumentId);
      filtered = filtered.filter(t => t.instrumentIds && t.instrumentIds.includes(instrumentId));
    }
    if (this.selectedTargetAudience !== null && this.selectedTargetAudience !== 0) {
      const selectedAudience = this.selectedTargetAudience;
      filtered = filtered.filter(t =>
        t.targetAudience !== undefined && t.targetAudience !== null &&
        (t.targetAudience & selectedAudience) !== 0
      );
    }
    if (this.selectedLanguage !== null && this.selectedLanguage !== 0) {
      const selectedLang = this.selectedLanguage;
      filtered = filtered.filter(t =>
        t.languages !== undefined && t.languages !== null &&
        (t.languages & selectedLang) !== 0
      );
    }
    return filtered;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCityId = null;
    if (this.activeTab === 'professionals') {
      this.selectedCategoryId = null;
      this.isFiltered = false;
      this.filteredProfessionals = [];
    } else {
      this.selectedInstrumentId = null;
      this.selectedTargetAudience = null;
      this.selectedLanguage = null;
      this.isFilteredTeachers = false;
      this.filteredTeachers = [];
    }
  }

  onQuickSearch(name: string): void {
    if (this.activeTab === 'professionals') {
      const category = this.categories.find(c => c.name.toLowerCase().includes(name.toLowerCase()));
      if (category) { this.selectedCategoryId = category.id; this.onSearch(); }
    } else {
      const instrument = this.instruments.find(i => i.name.toLowerCase().includes(name.toLowerCase()));
      if (instrument) { this.selectedInstrumentId = instrument.id; this.onSearch(); }
    }
  }

  // ─── View More — Professionals ────────────────────
  onViewMore(section: string): void {
    this.isFiltered = true;
    let categoryId: number | undefined;
    switch (section) {
      case 'featured':
        this.professionalService.getServiceProviders(undefined, undefined, undefined, 1, true, false, 1, 50).subscribe({
          next: (response: any) => { this.filteredProfessionals = response.items || response.data || []; }
        });
        break;
      case 'musicStores':
        categoryId = this.categories.find(c => c.name.includes('חנויות מוזיקה'))?.id;
        if (categoryId) this.loadFilteredSection(categoryId);
        break;
      case 'recordingStudios':
        categoryId = this.categories.find(c => c.name.includes('אולפני הקלטות'))?.id;
        if (categoryId) this.loadFilteredSection(categoryId);
        break;
      case 'amplification':
        categoryId = this.categories.find(c => c.name.includes('הגברה'))?.id;
        if (categoryId) this.loadFilteredSection(categoryId);
        break;
      default:
        this.isFiltered = false;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private loadFilteredSection(categoryId: number): void {
    this.professionalService.getServiceProviders(undefined, categoryId, undefined, 1, undefined, false, 1, 50).subscribe({
      next: (response: any) => { this.filteredProfessionals = response.items || response.data || []; }
    });
  }

  // ─── View More — Teachers ─────────────────────────
  onViewMoreTeachers(category: string): void {
    this.isFilteredTeachers = true;
    switch (category) {
      case 'featured':
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
        this.filteredTeachers = [...this.allTeachers];
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─── Navigation ───────────────────────────────────
  viewProfessional(professionalId: number): void {
    this.router.navigate(['/professional', professionalId]);
  }

  viewTeacher(teacherId: number): void {
    this.router.navigate(['/teacher', teacherId]);
  }

  openBecomeProfessionalForm(): void {
    if (!this.authService.isLoggedIn) {
      this.authService.requestLogin('/professionals');
      return;
    }
    this.quickAddAssistantService.requestOpen('index');
  }

  openBecomeTeacherForm(): void {
    if (!this.authService.isLoggedIn) {
      this.authService.requestLogin('/professionals');
      return;
    }
    this.router.navigate(['/subscription/select'], { queryParams: { type: 'teacher' } });
  }

  closeBecomeProfessionalForm(): void {
    this.showBecomeProfessionalForm = false;
  }

  // ─── Helpers ──────────────────────────────────────
  getCityName(cityId?: number): string {
    if (!cityId) return '';
    return this.cities.find(c => c.id === cityId)?.name || '';
  }

  getTeacherInstruments(teacher: TeacherListDto): string {
    if (!teacher.instrumentIds || teacher.instrumentIds.length === 0) return '';
    const names = teacher.instrumentIds
      .map(id => this.instruments.find(i => i.id === id)?.name)
      .filter((n): n is string => !!n);
    if (names.length === 0) return '';
    if (names.length === 1) return `׳׳•׳¨׳” ׳${names[0]}`;
    const last = names[names.length - 1];
    return `׳׳•׳¨׳” ׳${names.slice(0, -1).join(', ')} ׳•${last}`;
  }

  private closeAllDropdowns(): void {
    this.showCategoryDropdown = false;
    this.showCityDropdown = false;
    this.showInstrumentDropdown = false;
    this.showLanguageDropdown = false;
    this.showAudienceDropdown = false;
  }
}

