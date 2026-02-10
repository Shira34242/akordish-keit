import { Component, EventEmitter, inject, OnDestroy, OnInit, Output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeacherService } from '../../../services/teacher.service';
import { SystemTablesService, SystemItem } from '../../../services/system-tables.service';
import { CitiesService, City } from '../../../services/cities.service';
import { CreateTeacherDto, CreateTeacherInstrumentDto } from '../../../models/teacher.model';
import { ProfileStatus, CreateGalleryImageDto } from '../../../models/music-service-provider.model';
import { TeachingLanguage, getTeachingLanguageOptions } from '../../../models/teaching-language.enum';
import { TargetAudience, getTargetAudienceOptions } from '../../../models/target-audience.enum';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-become-teacher-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './become-teacher-form.component.html',
  styleUrls: ['./become-teacher-form.component.css']
})
export class BecomeTeacherFormComponent implements OnInit, OnDestroy {
  private readonly teacherService = inject(TeacherService);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly citiesService = inject(CitiesService);
  private readonly authService = inject(AuthService);

  @Output() close = new EventEmitter<void>();
  @Output() success = new EventEmitter<void>();

  saving = false;
  currentStep = 1;
  totalSteps = 3;

  // Form fields
  displayName: string = '';
  shortBio: string = '';
  fullDescription: string = '';
  location: string = '';
  phoneNumber: string = '';
  whatsAppNumber: string = '';
  email: string = '';
  websiteUrl: string = '';
  profileImageUrl: string = '';
  videoUrl: string = '';
  yearsOfExperience: number = 0;
  workingHours: string = '';
  priceList: string = '';
  selectedLanguages: number[] = [];
  selectedAudiences: number[] = [];
  availability: string = '';
  education: string = '';
  lessonTypes: string = '';
  specializations: string = '';
  selectedInstrumentIds: number[] = [];
  galleryImages: CreateGalleryImageDto[] = [];
  newGalleryImage = { imageUrl: '', caption: '' };

  // Available data
  availableInstruments: SystemItem[] = [];
  availableCities: City[] = [];
  cityId: number | undefined = undefined;

  // Options
  languageOptions = getTeachingLanguageOptions();
  audienceOptions = getTargetAudienceOptions();

  // UI state
  cityDropdownOpen = false;
  instrumentsDropdownOpen = false;
  languageDropdownOpen = false;
  audienceDropdownOpen = false;
  citySearchText = '';
  instrumentSearchText = '';
  filteredCities: City[] = [];
  filteredInstruments: SystemItem[] = [];
  filteredLanguageOptions = getTeachingLanguageOptions();
  filteredAudienceOptions = getTargetAudienceOptions();

  ngOnInit(): void {
    this.loadInstruments();
    this.loadCities();

    // Pre-fill with user data
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.displayName = currentUser.username;
      this.email = currentUser.email;
    }
  }

  loadCities(): void {
    this.citiesService.getCities().subscribe({
      next: (cities) => {
        this.availableCities = cities.filter(c => c.isActive);
        this.filteredCities = this.availableCities;
      },
      error: (error: any) => console.error('Error loading cities:', error)
    });
  }

  loadInstruments(): void {
    this.systemTablesService.getItems('instruments', 1, 100).subscribe({
      next: (result) => {
        this.availableInstruments = result.items;
        this.filteredInstruments = this.availableInstruments;
      },
      error: (error: any) => console.error('Error loading instruments:', error)
    });
  }

  // City dropdown methods
  toggleCityDropdown(): void {
    this.cityDropdownOpen = !this.cityDropdownOpen;
    if (this.cityDropdownOpen) {
      this.citySearchText = '';
      this.filteredCities = this.availableCities;
    }
  }

  selectCity(cityId: number | undefined): void {
    this.cityId = cityId;
    this.cityDropdownOpen = false;
  }

  getSelectedCityName(): string {
    if (!this.cityId) return 'בחר עיר...';
    const city = this.availableCities.find(c => c.id === this.cityId);
    return city ? city.name : 'בחר עיר...';
  }

  onCitySearchChange(): void {
    if (!this.citySearchText.trim()) {
      this.filteredCities = this.availableCities;
      return;
    }
    const search = this.citySearchText.toLowerCase().trim();
    this.filteredCities = this.availableCities.filter(city =>
      city.name.toLowerCase().includes(search)
    );
  }

  // Instruments dropdown methods
  toggleInstrumentsDropdown(): void {
    this.instrumentsDropdownOpen = !this.instrumentsDropdownOpen;
    if (this.instrumentsDropdownOpen) {
      this.instrumentSearchText = '';
      this.filteredInstruments = this.availableInstruments;
    }
  }

  getSelectedInstrumentsText(): string {
    if (this.selectedInstrumentIds.length === 0) {
      return 'בחר כלי נגינה...';
    }
    const names = this.selectedInstrumentIds
      .map(id => this.availableInstruments.find(inst => inst.id === id)?.name)
      .filter(name => name);
    if (names.length === 1) return names[0]!;
    if (names.length === 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }

  onInstrumentSearchChange(): void {
    if (!this.instrumentSearchText.trim()) {
      this.filteredInstruments = this.availableInstruments;
      return;
    }
    const search = this.instrumentSearchText.toLowerCase().trim();
    this.filteredInstruments = this.availableInstruments.filter(instrument =>
      instrument.name.toLowerCase().includes(search)
    );
  }

  toggleInstrument(instrumentId: number): void {
    const index = this.selectedInstrumentIds.indexOf(instrumentId);
    if (index > -1) {
      this.selectedInstrumentIds.splice(index, 1);
    } else {
      this.selectedInstrumentIds.push(instrumentId);
    }
  }

  isInstrumentSelected(instrumentId: number): boolean {
    return this.selectedInstrumentIds.includes(instrumentId);
  }

  // Language dropdown methods
  toggleLanguageDropdown(): void {
    this.languageDropdownOpen = !this.languageDropdownOpen;
    if (this.languageDropdownOpen) {
      this.filteredLanguageOptions = this.languageOptions;
    }
  }

  getSelectedLanguagesText(): string {
    if (this.selectedLanguages.length === 0) return 'בחר שפות...';
    const names = this.selectedLanguages
      .map(val => this.languageOptions.find(opt => opt.value === val)?.label)
      .filter(label => label);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }

  toggleLanguage(value: number): void {
    const index = this.selectedLanguages.indexOf(value);
    if (index > -1) {
      this.selectedLanguages.splice(index, 1);
    } else {
      this.selectedLanguages.push(value);
    }
  }

  isLanguageChecked(value: number): boolean {
    return this.selectedLanguages.includes(value);
  }

  // Audience dropdown methods
  toggleAudienceDropdown(): void {
    this.audienceDropdownOpen = !this.audienceDropdownOpen;
    if (this.audienceDropdownOpen) {
      this.filteredAudienceOptions = this.audienceOptions;
    }
  }

  getSelectedAudiencesText(): string {
    if (this.selectedAudiences.length === 0) return 'בחר קהל יעד...';
    const names = this.selectedAudiences
      .map(val => this.audienceOptions.find(opt => opt.value === val)?.label)
      .filter(label => label);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }

  toggleAudience(value: number): void {
    const index = this.selectedAudiences.indexOf(value);
    if (index > -1) {
      this.selectedAudiences.splice(index, 1);
    } else {
      this.selectedAudiences.push(value);
    }
  }

  isAudienceChecked(value: number): boolean {
    return this.selectedAudiences.includes(value);
  }

  // Gallery methods
  addGalleryImage(): void {
    if (!this.newGalleryImage.imageUrl.trim()) {
      alert('נא להזין URL לתמונה');
      return;
    }
    const order = this.galleryImages.length;
    this.galleryImages.push({
      imageUrl: this.newGalleryImage.imageUrl,
      caption: this.newGalleryImage.caption || '',
      order
    });
    this.newGalleryImage = { imageUrl: '', caption: '' };
  }

  removeGalleryImage(index: number): void {
    if (confirm('האם למחוק תמונה זו מהגלריה?')) {
      this.galleryImages.splice(index, 1);
      this.galleryImages.forEach((img, idx) => img.order = idx);
    }
  }

  // Navigation methods
  nextStep(): void {
    if (this.currentStep === 1 && !this.validateStep1()) return;
    if (this.currentStep === 2 && !this.validateStep2()) return;
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  validateStep1(): boolean {
    if (!this.displayName.trim()) {
      alert('נא להזין שם תצוגה');
      return false;
    }
    if (!this.email || !this.email.trim()) {
      alert('נא להזין אימייל');
      return false;
    }
    if (!this.phoneNumber || !this.phoneNumber.trim()) {
      alert('נא להזין טלפון');
      return false;
    }
    return true;
  }

  validateStep2(): boolean {
    if (this.selectedInstrumentIds.length === 0) {
      alert('נא לבחור לפחות כלי נגינה אחד');
      return false;
    }
    return true;
  }

  onSubmit(): void {
    if (!this.validateStep1() || !this.validateStep2()) {
      return;
    }

    this.saving = true;
    const currentUser = this.authService.currentUserValue;

    const dto: CreateTeacherDto = {
      userId: currentUser?.id,
      displayName: this.displayName,
      shortBio: this.shortBio,
      fullDescription: this.fullDescription,
      isTeacher: true,
      cityId: this.cityId,
      location: this.location,
      phoneNumber: this.phoneNumber,
      whatsAppNumber: this.whatsAppNumber,
      email: this.email,
      websiteUrl: this.websiteUrl?.trim() || undefined,
      profileImageUrl: this.profileImageUrl,
      videoUrl: this.videoUrl,
      yearsOfExperience: this.yearsOfExperience,
      workingHours: this.workingHours,
      isFeatured: false,
      status: ProfileStatus.Pending, // Always pending for public registration
      priceList: this.priceList,
      languages: this.arrayToFlags(this.selectedLanguages),
      targetAudience: this.arrayToFlags(this.selectedAudiences),
      availability: this.availability,
      education: this.education,
      lessonTypes: this.lessonTypes,
      specializations: this.specializations,
      instruments: this.selectedInstrumentIds.map(id => ({
        instrumentId: id,
        isPrimary: false
      } as CreateTeacherInstrumentDto)),
      galleryImages: this.galleryImages
    };

    this.teacherService.createTeacher(dto).subscribe({
      next: () => {
        this.saving = false;
        alert('הבקשה נשלחה בהצלחה! נבדוק את פרטייך ונעדכן אותך בקרוב.');
        this.success.emit();
        this.onClose();
      },
      error: (error: any) => {
        console.error('Error creating teacher:', error);
        let errorMessage = 'שגיאה בשליחת הבקשה';
        if (error.error?.errors) {
          const validationErrors = Object.entries(error.error.errors)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
          errorMessage += '\n\nפרטי השגיאה:\n' + validationErrors;
        }
        alert(errorMessage);
        this.saving = false;
      }
    });
  }

  private arrayToFlags(selectedValues: number[]): number {
    if (!selectedValues || selectedValues.length === 0) return 0;
    return selectedValues.reduce((acc, val) => acc | val, 0);
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) {
      this.cityDropdownOpen = false;
      this.instrumentsDropdownOpen = false;
      this.languageDropdownOpen = false;
      this.audienceDropdownOpen = false;
    }
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }
}
