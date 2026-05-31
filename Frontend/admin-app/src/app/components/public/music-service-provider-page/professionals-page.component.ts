import { Component, OnInit, AfterViewInit, HostListener, ViewChild, ElementRef, inject } from '@angular/core';
import { LanguageService } from '../../../services/language.service';
import { ImgFallbackDirective } from '../../../directives/img-fallback.directive';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';
import { TeacherService } from '../../../services/teacher.service';
import { CitiesService, City } from '../../../services/cities.service';
import { SystemTablesService } from '../../../services/system-tables.service';
import { MusicServiceProviderListDto } from '../../../models/music-service-provider.model';
import { TeacherListDto } from '../../../models/teacher.model';
import { TargetAudience, getTargetAudienceOptions } from '../../../models/target-audience.enum';
import { TeachingLanguage, getTeachingLanguageOptions } from '../../../models/teaching-language.enum';
import { BecomeProfessionalFormComponent } from '../become-professional-form/become-professional-form.component';
import { AdDisplayComponent } from '../ad-display/ad-display.component';
import { AuthService } from '../../../services/auth.service';
import { QuickAddAssistantService } from '../../../services/quick-add-assistant.service';
import { SearchService, SearchItem } from '../../../services/search.service';
import { AgencyListDto, AgencyDto, AgencyProfileDto } from '../../../models/agency.model';
import { AgencyService } from '../../../services/agency.service';
import { AnalyticsService } from '../../../services/analytics.service';
import { CloudflareImagePipe, cloudflareBackgroundImage } from '../../../pipes/cloudflare-image.pipe';

interface Category {
  id: number;
  name: string;
  showInQuickCategories?: boolean;
  quickCategoryLabel?: string;
  quickCategoryImageUrl?: string;
  quickCategoryOrder?: number;
}

interface Instrument {
  id: number;
  name: string;
}

interface AgencyWithProfiles extends AgencyListDto {
  profileCards: AgencyProfileDto[];
  loadingProfiles: boolean;
  profilesError: boolean;
  profilesErrorMessage: string;
}

@Component({
  selector: 'app-professionals-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, BecomeProfessionalFormComponent, ImgFallbackDirective, AdDisplayComponent, CloudflareImagePipe],
  templateUrl: './professionals-page.component.html',
  styleUrls: ['./professionals-page.component.css']
})
export class ProfessionalsPageComponent implements OnInit, AfterViewInit {

  @ViewChild('heroBg') heroBg?: ElementRef<HTMLDivElement>;
  private fullHeroHeight = 0;
  private rafPending = false;
  private readonly stripPageSize = 10;
  private readonly catalogPageSize = 24;
  private readonly searchPageSize = 40;
  private readonly scrollLoadOffset = 700;
  private searchDebounceTimer?: ReturnType<typeof setTimeout>;
  agencyBanners: AgencyWithProfiles[] = [];

  // ג”€ג”€ג”€ Tab ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  activeTab: 'professionals' | 'teachers' = 'professionals';

  // ג”€ג”€ג”€ Top filter (category dropdown ג€” ׳›׳•׳׳ ׳׳•׳¨׳™׳) ג”€ג”€
  topFilterValue: string = 'all'; // 'all' | 'teachers' | category id as string

  // ג”€ג”€ג”€ Dropdown visibility ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  showCategoryDropdown = false;
  showCityDropdown = false;
  showInstrumentDropdown = false;
  showLanguageDropdown = false;
  showAudienceDropdown = false;

  showBecomeProfessionalForm = false;

  // ג”€ג”€ג”€ Shared search fields ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  searchTerm: string = '';
  selectedCityId: number | null = null;
  cityFilterSearchTerm = '';

  // ג”€ג”€ג”€ Professionals filters ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  selectedCategoryId: number | null = null;

  // ג”€ג”€ג”€ Teachers filters ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  selectedInstrumentId: number | null = null;
  selectedTargetAudience: TargetAudience | null = null;
  selectedLanguage: TeachingLanguage | null = null;

  // ג”€ג”€ג”€ Data lists ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  cities: City[] = [];
  categories: Category[] = [];
  instruments: Instrument[] = [];
  targetAudienceOptions = getTargetAudienceOptions();
  languageOptions = getTeachingLanguageOptions();

  // ג”€ג”€ג”€ Professionals data ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  featuredProfessionals: MusicServiceProviderListDto[] = [];
  musicStores: MusicServiceProviderListDto[] = [];
  recordingStudios: MusicServiceProviderListDto[] = [];
  amplification: MusicServiceProviderListDto[] = [];
  additionalProfessionals: MusicServiceProviderListDto[] = [];
  isFiltered: boolean = false;
  filteredProfessionals: MusicServiceProviderListDto[] = [];
  loading: boolean = true;
  loadingMoreProfessionals = false;
  additionalProfessionalsPage = 1;
  additionalProfessionalsTotal = 0;
  filteredProfessionalsPage = 1;
  filteredProfessionalsTotal = 0;

  quickSearchCategories = [
    { id: 0, name: '׳—׳ ׳•׳™׳•׳× ׳׳•׳–׳™׳§׳”', hebrewName: '׳—׳ ׳•׳™׳•׳× ׳׳•׳–׳™׳§׳”' },
    { id: 0, name: '׳׳•׳׳₪׳ ׳™ ׳”׳§׳׳˜׳•׳×', hebrewName: '׳׳•׳׳₪׳ ׳™ ׳”׳§׳׳˜׳•׳×' },
    { id: 0, name: '׳¢׳¨׳™׳›׳× ׳•׳™׳“׳׳•', hebrewName: '׳¢׳¨׳™׳›׳× ׳•׳™׳“׳׳•' },
    { id: 0, name: '׳”׳’׳‘׳¨׳”', hebrewName: '׳”׳’׳‘׳¨׳”' }
  ];

  get visibleQuickCategories(): Category[] {
    const selected = this.categories
      .filter(category => category.showInQuickCategories)
      .sort((a, b) =>
        (a.quickCategoryOrder ?? 0) - (b.quickCategoryOrder ?? 0) ||
        a.name.localeCompare(b.name, 'he')
      );

    if (selected.length > 0) return selected;

    return this.quickSearchCategories
      .map(quick => this.categories.find(category => category.id === quick.id))
      .filter((category): category is Category => !!category);
  }

  // ג”€ג”€ג”€ Teachers data ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  allTeachers: TeacherListDto[] = [];
  featuredTeachers: TeacherListDto[] = [];
  organTeachers: TeacherListDto[] = [];
  soundTeachers: TeacherListDto[] = [];
  vocalTeachers: TeacherListDto[] = [];
  additionalTeachers: TeacherListDto[] = [];
  isFilteredTeachers: boolean = false;
  filteredTeachers: TeacherListDto[] = [];
  loadingTeachers: boolean = true;
  loadingMoreTeachers = false;
  additionalTeachersPage = 1;
  additionalTeachersTotal = 0;
  filteredTeachersPage = 1;
  filteredTeachersTotal = 0;
  private cityNameById = new Map<number, string>();
  private instrumentNameById = new Map<number, string>();

  quickSearchInstruments = [
    { id: 0, name: '׳’׳™׳˜׳¨׳”', hebrewName: '׳’׳™׳˜׳¨׳”' },
    { id: 0, name: '׳₪׳¡׳ ׳×׳¨', hebrewName: '׳₪׳¡׳ ׳×׳¨' },
    { id: 0, name: '׳›׳™׳ ׳•׳¨', hebrewName: '׳›׳™׳ ׳•׳¨' },
    { id: 0, name: '׳—׳׳™׳', hebrewName: '׳—׳׳™׳' }
  ];

  private readonly langService = inject(LanguageService);

  constructor(
    private professionalService: MusicServiceProviderService,
    private teacherService: TeacherService,
    private citiesService: CitiesService,
    private systemTablesService: SystemTablesService,
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private quickAddAssistantService: QuickAddAssistantService,
    private searchService: SearchService,
    private agencyService: AgencyService,
    private analytics: AnalyticsService,
    private hostRef: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    if (tab === 'teachers') {
      this.activeTab = 'teachers';
    }
    this.loadCities();
    this.loadAgencyBanners();
    this.loadProfessionals();
    this.loadInstrumentsAndTeachers();
  }

  loadAgencyBanners(): void {
    this.agencyService.getIndexBanners(6).subscribe({
      next: agencies => {
        this.agencyBanners = agencies.map(a => ({
          ...a,
          profileCards: [] as AgencyProfileDto[],
          loadingProfiles: true,
          profilesError: false,
          profilesErrorMessage: ''
        }));
        if (this.agencyBanners.length > 0) {
          const profileRequests = this.agencyBanners.map((item, i) =>
            this.agencyService.getAgency(item.id).pipe(
              catchError((err) => {
                this.agencyBanners[i].profilesError = true;
                this.agencyBanners[i].loadingProfiles = false;
                const detail = err?.error?.detail || '';
                const type = err?.error?.type || '';
                this.agencyBanners[i].profilesErrorMessage = detail ? `${type}: ${detail}` : (err?.message || 'שגיאה');
                return of(null);
              })
            )
          );
          forkJoin(profileRequests).subscribe({
            next: (agencyDetails: Array<AgencyDto | null>) => {
              agencyDetails.forEach((detail, i) => {
                if (this.agencyBanners[i] && detail) {
                  this.agencyBanners[i].profileCards = (detail.profiles || [])
                    .filter(profile => this.isVisibleAgencyProfile(profile))
                    .slice(0, 12);
                  this.agencyBanners[i].loadingProfiles = false;
                }
              });
            },
            error: () => {
              this.agencyBanners.forEach(a => { a.loadingProfiles = false; a.profilesError = true; });
            }
          });
        }
      },
      error: () => this.agencyBanners = []
    });
  }

  private isVisibleAgencyProfile(profile: AgencyProfileDto | null | undefined): profile is AgencyProfileDto {
    return !!profile && !!profile.profileId;
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
      this.loadMoreWhenNearBottom();
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
    // ׳׳©׳×׳£ ׳׳× ׳’׳•׳‘׳” ׳”-hero ׳”׳ ׳•׳›׳—׳™ ׳¢׳ ׳”-CSS, ׳›׳“׳™ ׳©׳׳—׳¦׳ ׳”-"׳׳”׳¦׳˜׳¨׳₪׳•׳×" ׳™׳¦׳׳“ ׳׳₪׳™׳ ׳” ׳”׳¦׳”׳•׳‘׳” ׳”׳×׳—׳×׳•׳ ׳”
    this.hostRef.nativeElement.style.setProperty('--hero-height', newHeight + 'px');
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
    if (nextState) {
      this.cityFilterSearchTerm = '';
    }
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

  // ג”€ג”€ג”€ Top filter (category dropdown) ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
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

  // ג”€ג”€ג”€ Tab ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
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

  // ג”€ג”€ג”€ Cities ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  loadCities(): void {
    this.citiesService.getCities().subscribe({
      next: (cities) => {
        this.cities = cities
          .filter(c => c.isActive)
          .sort((a, b) => a.name.localeCompare(b.name, 'he'));
        this.cityNameById = new Map(this.cities.map(city => [city.id, city.name]));
      },
      error: (err) => console.error('Error loading cities:', err)
    });
  }

  // ג”€ג”€ג”€ Load Professionals ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  loadProfessionals(): void {
    this.loading = true;
    this.systemTablesService.getItems('music-service-provider-categories', 1, 100).pipe(
      switchMap((response: any) => {
        this.categories = response.items || response;
        this.quickSearchCategories.forEach(quick => {
          const category = this.categories.find(c => c.name.toLowerCase().includes(quick.name.toLowerCase()));
          if (category) quick.id = category.id;
        });
        const musicStoreCat = this.categories.find(c => c.name.includes('׳—׳ ׳•׳™׳•׳× ׳׳•׳–׳™׳§׳”'));
        const recordingStudioCat = this.categories.find(c => c.name.includes('׳׳•׳׳₪׳ ׳™ ׳”׳§׳׳˜׳•׳×'));
        const amplificationCat = this.categories.find(c => c.name.includes('׳”׳’׳‘׳¨׳”'));
        return forkJoin({
          featured: this.professionalService.getServiceProviders(undefined, undefined, undefined, 1, true, false, 1, this.stripPageSize),
          musicStores: musicStoreCat
            ? this.professionalService.getServiceProviders(undefined, musicStoreCat.id, undefined, 1, undefined, false, 1, this.stripPageSize)
            : of({ items: [], data: [] } as any),
          recordingStudios: recordingStudioCat
            ? this.professionalService.getServiceProviders(undefined, recordingStudioCat.id, undefined, 1, undefined, false, 1, this.stripPageSize)
            : of({ items: [], data: [] } as any),
          amplification: amplificationCat
            ? this.professionalService.getServiceProviders(undefined, amplificationCat.id, undefined, 1, undefined, false, 1, this.stripPageSize)
            : of({ items: [], data: [] } as any),
          catalog: this.professionalService.getServiceProviders(undefined, undefined, undefined, 1, undefined, false, 1, this.catalogPageSize)
        });
      })
    ).subscribe({
      next: (results: any) => {
        this.featuredProfessionals = results.featured.items || results.featured.data || [];
        this.musicStores = results.musicStores.items || results.musicStores.data || [];
        this.recordingStudios = results.recordingStudios.items || results.recordingStudios.data || [];
        this.amplification = results.amplification.items || results.amplification.data || [];
        this.additionalProfessionals = results.catalog.items || results.catalog.data || [];
        this.additionalProfessionalsPage = results.catalog.pageNumber || 1;
        this.additionalProfessionalsTotal = results.catalog.totalCount || this.additionalProfessionals.length;
        this.loading = false;
      },
      error: (err) => { console.error('Error loading professionals:', err); this.loading = false; }
    });
  }

  // ג”€ג”€ג”€ Load Instruments + Teachers (together to avoid race) ג”€ג”€ג”€ג”€
  loadInstrumentsAndTeachers(): void {
    this.loadingTeachers = true;
    this.systemTablesService.getItems('instruments', 1, 100).pipe(
      switchMap((instrumentResponse: any) => {
        this.instruments = instrumentResponse.items || instrumentResponse || [];
        this.instrumentNameById = new Map(this.instruments.map(instrument => [instrument.id, instrument.name]));
        this.quickSearchInstruments.forEach(quick => {
          const instrument = this.instruments.find(i => i.name.toLowerCase().includes(quick.name.toLowerCase()));
          if (instrument) quick.id = instrument.id;
        });

        const organId = this.findInstrumentId('׳׳•׳¨׳’׳');
        const soundId = this.findInstrumentId('׳¡׳׳•׳ ׳“');
        const vocalId = this.findInstrumentId('׳₪׳™׳×׳•׳— ׳§׳•׳');

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

  private findInstrumentId(instrumentName: string): number | undefined {
    return this.instruments.find(i => i.name.toLowerCase().includes(instrumentName.toLowerCase()))?.id;
  }

  // ג”€ג”€ג”€ Search ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  onSearch(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = undefined;
    }

    if (this.activeTab === 'professionals') {
      this.onSearchProfessionals();
    } else {
      this.onSearchTeachers();
    }
  }

  onSearchInputChange(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.onSearch();
    }, 350);
  }

  private onSearchProfessionals(): void {
    const hasActiveFilter =
      this.searchTerm.trim() !== '' ||
      this.selectedCityId !== null ||
      this.selectedCategoryId !== null;
    if (!hasActiveFilter) {
      this.isFiltered = false;
      this.filteredProfessionals = [];
      this.filteredProfessionalsPage = 1;
      this.filteredProfessionalsTotal = 0;
      return;
    }
    this.isFiltered = true;
    this.filteredProfessionalsPage = 1;
    const searchParams = this.getProfessionalSearchParams();

    if (!this.selectedCategoryId && searchParams.globalSearch) {
      this.searchService.search(searchParams.globalSearch, this.searchPageSize).subscribe({
        next: (response) => {
          this.filteredProfessionals = this.mapSearchItemsToProfessionals(response.professionals || []);
          this.filteredProfessionalsTotal = this.filteredProfessionals.length;
        },
        error: (err) => console.error('Error searching professionals index:', err)
      });
      return;
    }

    this.professionalService.getServiceProviders(
      searchParams.search,
      this.selectedCategoryId || undefined,
      searchParams.cityId,
      1, undefined, false, 1, this.searchPageSize, searchParams.cityName
    ).subscribe({
      next: (response: any) => {
        this.filteredProfessionals = response.items || response.data || [];
        this.filteredProfessionalsTotal = response.totalCount || this.filteredProfessionals.length;
      },
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
      this.filteredTeachersPage = 1;
      this.filteredTeachersTotal = 0;
      return;
    }
    this.isFilteredTeachers = true;
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
    this.topFilterValue = 'all';
    if (this.activeTab === 'professionals') {
      this.selectedCategoryId = null;
      this.isFiltered = false;
      this.filteredProfessionals = [];
      this.filteredProfessionalsPage = 1;
      this.filteredProfessionalsTotal = 0;
    } else {
      this.selectedInstrumentId = null;
      this.selectedTargetAudience = null;
      this.selectedLanguage = null;
      this.isFilteredTeachers = false;
      this.filteredTeachers = [];
      this.filteredTeachersPage = 1;
      this.filteredTeachersTotal = 0;
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

  onQuickCategoryClick(category: Category): void {
    if (this.activeTab !== 'professionals') {
      this.setTab('professionals');
    }
    this.topFilterValue = category.id.toString();
    this.selectedCategoryId = category.id;
    this.onSearch();
  }

  getQuickCategoryLabel(category: Category): string {
    return category.quickCategoryLabel?.trim() || category.name;
  }

  getQuickCategoryBackground(category: Category): string | null {
    return cloudflareBackgroundImage(category.quickCategoryImageUrl, 'card');
  }

  // ג”€ג”€ג”€ View More ג€” Professionals ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  onViewMore(section: string): void {
    this.isFiltered = true;
    let categoryId: number | undefined;
    switch (section) {
      case 'featured':
        this.filteredProfessionalsPage = 1;
        this.professionalService.getServiceProviders(undefined, undefined, undefined, 1, true, false, 1, this.searchPageSize).subscribe({
          next: (response: any) => {
            this.filteredProfessionals = response.items || response.data || [];
            this.filteredProfessionalsTotal = response.totalCount || this.filteredProfessionals.length;
          }
        });
        break;
      case 'musicStores':
        categoryId = this.categories.find(c => c.name.includes('׳—׳ ׳•׳™׳•׳× ׳׳•׳–׳™׳§׳”'))?.id;
        if (categoryId) this.loadFilteredSection(categoryId);
        break;
      case 'recordingStudios':
        categoryId = this.categories.find(c => c.name.includes('׳׳•׳׳₪׳ ׳™ ׳”׳§׳׳˜׳•׳×'))?.id;
        if (categoryId) this.loadFilteredSection(categoryId);
        break;
      case 'amplification':
        categoryId = this.categories.find(c => c.name.includes('׳”׳’׳‘׳¨׳”'))?.id;
        if (categoryId) this.loadFilteredSection(categoryId);
        break;
      default:
        this.isFiltered = false;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private loadFilteredSection(categoryId: number): void {
    this.filteredProfessionalsPage = 1;
    this.professionalService.getServiceProviders(undefined, categoryId, undefined, 1, undefined, false, 1, this.searchPageSize).subscribe({
      next: (response: any) => {
        this.filteredProfessionals = response.items || response.data || [];
        this.filteredProfessionalsTotal = response.totalCount || this.filteredProfessionals.length;
      }
    });
  }

  // ג”€ג”€ג”€ View More ג€” Teachers ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  onViewMoreTeachers(category: string): void {
    this.isFilteredTeachers = true;
    this.filteredTeachersPage = 1;
    let instrumentId: number | undefined;
    let featured: boolean | undefined;
    switch (category) {
      case 'featured':
        featured = true;
        break;
      case 'organ':
        instrumentId = this.findInstrumentId('׳׳•׳¨׳’׳');
        break;
      case 'sound':
        instrumentId = this.findInstrumentId('׳¡׳׳•׳ ׳“');
        break;
      case 'vocal':
        instrumentId = this.findInstrumentId('׳₪׳™׳×׳•׳— ׳§׳•׳');
        break;
      default:
        break;
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
    const distanceFromBottom = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
    if (distanceFromBottom > this.scrollLoadOffset) return;

    if (this.activeTab === 'professionals') {
      if (this.isFiltered) {
        this.loadMoreFilteredProfessionals();
      } else {
        this.loadMoreCatalogProfessionals();
        this.loadMoreCatalogTeachers();
      }
      return;
    }

    if (this.isFilteredTeachers) {
      this.loadMoreFilteredTeachers();
    } else {
      this.loadMoreCatalogTeachers();
    }
  }

  private loadMoreCatalogProfessionals(): void {
    if (this.loadingMoreProfessionals || this.additionalProfessionals.length >= this.additionalProfessionalsTotal) return;
    this.loadingMoreProfessionals = true;
    const nextPage = this.additionalProfessionalsPage + 1;
    this.professionalService.getServiceProviders(undefined, undefined, undefined, 1, undefined, false, nextPage, this.catalogPageSize).subscribe({
      next: (response: any) => {
        this.appendUniqueProfessionals(this.additionalProfessionals, response.items || response.data || []);
        this.additionalProfessionalsPage = response.pageNumber || nextPage;
        this.additionalProfessionalsTotal = response.totalCount || this.additionalProfessionalsTotal;
        this.loadingMoreProfessionals = false;
      },
      error: (err) => {
        console.error('Error loading more professionals:', err);
        this.loadingMoreProfessionals = false;
      }
    });
  }

  private loadMoreFilteredProfessionals(): void {
    if (this.loadingMoreProfessionals || this.filteredProfessionals.length >= this.filteredProfessionalsTotal) return;
    this.loadingMoreProfessionals = true;
    const nextPage = this.filteredProfessionalsPage + 1;
    const searchParams = this.getProfessionalSearchParams();

    if (!this.selectedCategoryId && searchParams.globalSearch) {
      this.loadingMoreProfessionals = false;
      return;
    }

    this.professionalService.getServiceProviders(
      searchParams.search,
      this.selectedCategoryId || undefined,
      searchParams.cityId,
      1,
      undefined,
      false,
      nextPage,
      this.searchPageSize,
      searchParams.cityName
    ).subscribe({
      next: (response: any) => {
        this.appendUniqueProfessionals(this.filteredProfessionals, response.items || response.data || []);
        this.filteredProfessionalsPage = response.pageNumber || nextPage;
        this.filteredProfessionalsTotal = response.totalCount || this.filteredProfessionalsTotal;
        this.loadingMoreProfessionals = false;
      },
      error: (err) => {
        console.error('Error loading more filtered professionals:', err);
        this.loadingMoreProfessionals = false;
      }
    });
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

  private appendUniqueProfessionals(target: MusicServiceProviderListDto[], items: MusicServiceProviderListDto[]): void {
    const existingIds = new Set(target.map(item => item.id));
    target.push(...items.filter(item => !existingIds.has(item.id)));
  }

  private appendUniqueTeachers(target: TeacherListDto[], items: TeacherListDto[]): void {
    const existingIds = new Set(target.map(item => item.id));
    target.push(...items.filter(item => !existingIds.has(item.id)));
  }

  private getProfessionalSearchParams(): { search?: string; cityId?: number; cityName?: string; globalSearch?: string } {
    const trimmedSearch = this.searchTerm.trim();
    const cityFromSearch = this.findCityFromSearchTerm();
    const selectedCityName = this.selectedCityId ? this.getCityName(this.selectedCityId) : undefined;
    const globalSearch = trimmedSearch || selectedCityName || cityFromSearch?.name || undefined;

    return {
      search: trimmedSearch || undefined,
      cityId: this.selectedCityId ?? cityFromSearch?.id ?? undefined,
      cityName: selectedCityName || cityFromSearch?.name || trimmedSearch || undefined,
      globalSearch: globalSearch && globalSearch.length >= 2 ? globalSearch : undefined
    };
  }

  private mapSearchItemsToProfessionals(items: SearchItem[]): MusicServiceProviderListDto[] {
    return items.map(item => ({
      id: item.id,
      displayName: item.title,
      profileImageUrl: item.imageUrl,
      categoryName: item.subtitle,
      isTeacher: false,
      isFeatured: false,
      status: 1 as any,
      statusName: '',
      tier: 0,
      isPrimaryProfile: false,
      createdAt: '',
      categoriesCount: 0,
      branchCityIds: this.inferCityIdsFromText(item.subtitle)
    }));
  }

  private inferCityIdsFromText(text?: string): number[] {
    if (!text) return [];
    return this.cities
      .filter(city =>
        text.includes(city.name) ||
        (!!city.englishName && text.toLowerCase().includes(city.englishName.toLowerCase()))
      )
      .map(city => city.id);
  }

  // ─── Navigation ───────────────────────────────────
  viewProfessional(professionalId: number): void {
    this.router.navigate(['/professional', professionalId]);
  }

  viewTeacher(teacherId: number): void {
    this.router.navigate(['/teacher', teacherId]);
  }

  viewAgency(slug: string): void {
    const agency = this.agencyBanners.find(item => item.slug === slug);
    if (agency) {
      this.analytics.trackInteraction('agency_banner_click', agency.id, agency.name);
    }
    this.router.navigate(['/agency', slug]);
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

  // ג”€ג”€ג”€ Helpers ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  getCityName(cityId?: number): string {
    if (!cityId) return '';
    return this.cityNameById.get(cityId) || '';
  }

  get filteredCityOptions(): City[] {
    const search = this.cityFilterSearchTerm.trim().toLowerCase();
    if (!search) return this.cities;
    return this.cities.filter(city =>
      city.name.toLowerCase().includes(search) ||
      city.englishName?.toLowerCase().includes(search)
    );
  }

  getProviderCityLine(provider: MusicServiceProviderListDto): string {
    const cityNames = new Set<string>();
    if (provider.cityId) {
      const city = this.getCityName(provider.cityId);
      if (city) cityNames.add(city);
    }
    (provider.branchCityIds ?? []).forEach(cityId => {
      const city = this.getCityName(cityId);
      if (city) cityNames.add(city);
    });
    return Array.from(cityNames).join(', ');
  }

  private findCityFromSearchTerm(): City | undefined {
    const search = this.searchTerm.trim().toLowerCase();
    if (!search) return undefined;
    return this.cities.find(city =>
      city.name.toLowerCase().includes(search) ||
      city.englishName?.toLowerCase().includes(search)
    );
  }

  getTeacherInstruments(teacher: TeacherListDto): string {
    if (!teacher.instrumentIds || teacher.instrumentIds.length === 0) return '';
    const names = teacher.instrumentIds
      .map(id => this.instrumentNameById.get(id))
      .filter((n): n is string => !!n);
    if (names.length === 0) return '';
    const prefix = this.langService.translate('teacher.role_prefix');
    if (names.length === 1) return `${prefix}${names[0]}`;
    const last = names[names.length - 1];
    const and = this.langService.translate('teacher.role_and');
    return `${prefix}${names.slice(0, -1).join(', ')}${and}${last}`;
  }
  trackByProfessionalId(_index: number, professional: MusicServiceProviderListDto): number {
    return professional.id;
  }

  trackByTeacherId(_index: number, teacher: TeacherListDto): number {
    return teacher.id;
  }

  trackByCategoryId(_index: number, category: Category): number {
    return category.id;
  }

  trackByCityId(_index: number, city: City): number {
    return city.id;
  }

  trackByInstrumentId(_index: number, instrument: Instrument): number {
    return instrument.id;
  }

  trackByAgencyId(_index: number, agency: AgencyWithProfiles): number {
    return agency.id;
  }

  trackByAgencyProfileId(_index: number, profile: AgencyProfileDto): number {
    return profile.id;
  }

  private closeAllDropdowns(): void {
    this.showCategoryDropdown = false;
    this.showCityDropdown = false;
    this.showInstrumentDropdown = false;
    this.showLanguageDropdown = false;
    this.showAudienceDropdown = false;
  }

  agencyProfileSubtitle(profile: AgencyProfileDto): string {
    if (profile.isTeacher) return 'מורה';
    if (profile.profileType === 'artist') return 'אמן';
    if (profile.profileType === 'serviceProvider') return 'נותן שירות';
    return '';
  }

  goToAgencyProfile(profile: AgencyProfileDto): void {
    if (profile.profileUrl) {
      this.router.navigateByUrl(profile.profileUrl);
      return;
    }
    if (profile.isTeacher) {
      this.router.navigate(['/teacher', profile.profileId]);
      return;
    }
    if (profile.profileType === 'artist') {
      this.router.navigate(['/artist', profile.profileId]);
      return;
    }
    if (profile.profileType === 'serviceProvider') {
      this.router.navigate(['/professional', profile.profileId]);
    }
  }
}

