import { Component, OnInit, OnDestroy, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TeacherService } from '../../../services/teacher.service';
import { SystemTablesService, SystemItem } from '../../../services/system-tables.service';
import { UserService } from '../../../services/user.service';
import { CitiesService, City } from '../../../services/cities.service';
import { CreateTeacherDto, UpdateTeacherDto, TeacherDto, CreateTeacherInstrumentDto } from '../../../models/teacher.model';
import { ProfileStatus, CreateGalleryImageDto } from '../../../models/music-service-provider.model';
import { UserListDto } from '../../../models/user.model';
import { TeachingLanguage, getTeachingLanguageOptions, hasLanguage, toggleLanguage } from '../../../models/teaching-language.enum';
import { TargetAudience, getTargetAudienceOptions, hasAudience, toggleAudience } from '../../../models/target-audience.enum';
import { UserSelectionModalComponent } from './user-selection-modal.component';

@Component({
  selector: 'app-teacher-form',
  standalone: true,
  imports: [CommonModule, FormsModule, UserSelectionModalComponent],
  templateUrl: './teacher-form.component.html',
  styleUrls: ['./teacher-form.component.css']
})
export class TeacherFormComponent implements OnInit {
  private readonly teacherService = inject(TeacherService);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly userService = inject(UserService);
  private readonly citiesService = inject(CitiesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  isEditMode = false;
  teacherId?: number;
  loading = false;
  saving = false;

  // Separate properties for create/update mode
  userId: number | undefined = undefined;
  userName: string | undefined = undefined;
  userEmail: string | undefined = undefined;
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
  isFeatured: boolean = false;
  isTeacher: boolean = true;
  status: ProfileStatus = ProfileStatus.Pending;
  priceList: string = '';
  languages: number = 0;
  targetAudience: number = 0;
  availability: string = '';
  education: string = '';
  lessonTypes: string = '';
  specializations: string = '';
  selectedInstrumentIds: number[] = [];
  selectedLanguages: number[] = [];
  selectedAudiences: number[] = [];
  galleryImages: CreateGalleryImageDto[] = [];
  newGalleryImage = { imageUrl: '', caption: '' };

  // Available instruments, cities, and users loaded from API
  availableInstruments: SystemItem[] = [];
  availableCities: City[] = [];
  availableUsers: UserListDto[] = [];
  loadingUsers = false;
  cityId: number | undefined = undefined;

  // Available language and audience options
  languageOptions = getTeachingLanguageOptions();
  audienceOptions = getTargetAudienceOptions();

  // UI state
  showUserSelectionModal = false;
  cityDropdownOpen = false;
  instrumentsDropdownOpen = false;
  languageDropdownOpen = false;
  audienceDropdownOpen = false;
  citySearchText = '';
  instrumentSearchText = '';
  languageSearchText = '';
  audienceSearchText = '';
  filteredCities: City[] = [];
  filteredInstruments: SystemItem[] = [];
  filteredLanguageOptions = getTeachingLanguageOptions();
  filteredAudienceOptions = getTargetAudienceOptions();

  ngOnInit(): void {
    this.loadInstruments();
    this.loadCities();
    this.loadUsers();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.teacherId = +id;
      this.loadTeacher();
    } else {
      // Check for userId in query params (upgrade from user)
      const userIdParam = this.route.snapshot.queryParamMap.get('userId');
      if (userIdParam) {
        this.userId = +userIdParam;
      }
    }
  }

  loadCities(): void {
    this.citiesService.getCities().subscribe({
      next: (cities) => {
        this.availableCities = cities.filter(c => c.isActive);
        this.filteredCities = this.availableCities;
      },
      error: (error: any) => {
        console.error('Error loading cities:', error);
        alert('שגיאה בטעינת רשימת הערים');
      }
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
    if (!this.cityId) return '';
    const city = this.availableCities.find(c => c.id === this.cityId);
    return city ? city.name : '';
  }

  onCitySearchChange(): void {
    if (!this.citySearchText.trim()) {
      this.filteredCities = this.availableCities;
      return;
    }
    const search = this.citySearchText.toLowerCase().trim();
    this.filteredCities = this.availableCities.filter(city =>
      city.name.toLowerCase().includes(search) ||
      (city.englishName && city.englishName.toLowerCase().includes(search)) ||
      (city.district && city.district.toLowerCase().includes(search))
    );
  }

  // Language dropdown methods
  toggleLanguageDropdown(): void {
    this.languageDropdownOpen = !this.languageDropdownOpen;
    if (this.languageDropdownOpen) {
      this.languageSearchText = '';
      this.filteredLanguageOptions = this.languageOptions;
    }
  }

  getSelectedLanguagesText(): string {
    if (this.selectedLanguages.length === 0) {
      return 'בחר שפות...';
    }
    const names = this.selectedLanguages
      .map(val => this.languageOptions.find(opt => opt.value === val)?.label)
      .filter(label => label);

    if (names.length <= 2) {
      return names.join(', ');
    }
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }

  // Audience dropdown methods
  toggleAudienceDropdown(): void {
    this.audienceDropdownOpen = !this.audienceDropdownOpen;
    if (this.audienceDropdownOpen) {
      this.audienceSearchText = '';
      this.filteredAudienceOptions = this.audienceOptions;
    }
  }

  getSelectedAudiencesText(): string {
    if (this.selectedAudiences.length === 0) {
      return 'בחר קהל יעד...';
    }
    const names = this.selectedAudiences
      .map(val => this.audienceOptions.find(opt => opt.value === val)?.label)
      .filter(label => label);

    if (names.length <= 2) {
      return names.join(', ');
    }
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }

  loadInstruments(): void {
    this.systemTablesService.getItems('instruments', 1, 100).subscribe({
      next: (result) => {
        this.availableInstruments = result.items;
        this.filteredInstruments = this.availableInstruments;
      },
      error: (error: any) => {
        console.error('Error loading instruments:', error);
        alert('שגיאה בטעינת כלי נגינה');
      }
    });
  }

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
    if (names.length === 1) {
      return names[0]!;
    }
    if (names.length === 2) {
      return names.join(', ');
    }
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

  loadUsers(): void {
    this.loadingUsers = true;
    this.userService.getUsers(undefined, undefined, undefined, 1, 1000).subscribe({
      next: (result) => {
        this.availableUsers = result.items;
        this.loadingUsers = false;
      },
      error: (error: any) => {
        console.error('Error loading users:', error);
        this.loadingUsers = false;
      }
    });
  }

  loadTeacher(): void {
    if (!this.teacherId) return;

    this.loading = true;
    this.teacherService.getTeacherById(this.teacherId).subscribe({
      next: (teacher: TeacherDto) => {
        this.userId = teacher.userId;
        this.userName = teacher.userName;
        this.userEmail = teacher.userEmail;
        this.displayName = teacher.displayName;
        this.shortBio = teacher.shortBio || '';
        this.fullDescription = teacher.fullDescription || '';
        this.cityId = teacher.cityId;
        this.location = teacher.location || '';
        this.phoneNumber = teacher.phoneNumber || '';
        this.whatsAppNumber = teacher.whatsAppNumber || '';
        this.email = teacher.email || '';
        this.websiteUrl = teacher.websiteUrl || '';
        this.profileImageUrl = teacher.profileImageUrl || '';
        this.videoUrl = teacher.videoUrl || '';
        this.yearsOfExperience = teacher.yearsOfExperience || 0;
        this.workingHours = teacher.workingHours || '';
        this.isFeatured = teacher.isFeatured || false;
        this.status = teacher.status;
        this.priceList = teacher.priceList || '';
        this.languages = teacher.languages || 0;
        this.targetAudience = teacher.targetAudience || 0;
        this.selectedLanguages = this.flagsToArray(teacher.languages || 0, this.languageOptions);
        this.selectedAudiences = this.flagsToArray(teacher.targetAudience || 0, this.audienceOptions);
        this.availability = teacher.availability || '';
        this.education = teacher.education || '';
        this.lessonTypes = teacher.lessonTypes || '';
        this.specializations = teacher.specializations || '';
        this.selectedInstrumentIds = teacher.instruments?.map(i => i.instrumentId) || [];
        this.galleryImages = teacher.galleryImages?.map(img => ({
          imageUrl: img.imageUrl,
          caption: img.caption,
          order: img.order
        })) || [];
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading teacher:', error);
        alert('שגיאה בטעינת המורה');
        this.loading = false;
        this.goBack();
      }
    });
  }

  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    this.saving = true;

    if (this.isEditMode && this.teacherId) {
      const dto: UpdateTeacherDto = {
        displayName: this.displayName,
        shortBio: this.shortBio,
        fullDescription: this.fullDescription,
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
        isFeatured: this.isFeatured,
        status: this.status,
        priceList: this.priceList,
        languages: this.arrayToFlags(this.selectedLanguages),
        targetAudience: this.arrayToFlags(this.selectedAudiences),
        availability: this.availability,
        education: this.education,
        lessonTypes: this.lessonTypes,
        specializations: this.specializations,
        instruments: this.selectedInstrumentIds.map(id => ({ instrumentId: id, isPrimary: false } as CreateTeacherInstrumentDto)),
        galleryImages: this.galleryImages
      };

      this.teacherService.updateTeacher(this.teacherId, dto).subscribe({
        next: () => {
          this.saving = false;
          this.goBack();
        },
        error: (error: any) => {
          console.error('Error updating teacher:', error);
          console.error('Error details:', error.error);
          console.error('Validation errors:', error.error?.errors);
          let errorMessage = 'שגיאה בעדכון המורה';
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
    } else {
      const dto: CreateTeacherDto = {
        userId: this.userId,
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
        isFeatured: this.isFeatured,
        status: this.status,
        priceList: this.priceList,
        languages: this.arrayToFlags(this.selectedLanguages),
        targetAudience: this.arrayToFlags(this.selectedAudiences),
        availability: this.availability,
        education: this.education,
        lessonTypes: this.lessonTypes,
        specializations: this.specializations,
        instruments: this.selectedInstrumentIds.map(id => ({ instrumentId: id, isPrimary: false } as CreateTeacherInstrumentDto)),
        galleryImages: this.galleryImages
      };

      this.teacherService.createTeacher(dto).subscribe({
        next: () => {
          this.saving = false;
          alert('המורה נוצר בהצלחה');
          this.goBack();
        },
        error: (error: any) => {
          console.error('Error creating teacher:', error);
          console.error('Error details:', error.error);
          console.error('Validation errors:', error.error?.errors);
          let errorMessage = 'שגיאה ביצירת המורה';
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
  }

  validateForm(): boolean {
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

    if (this.selectedInstrumentIds.length === 0) {
      alert('נא לבחור לפחות כלי נגינה אחד');
      return false;
    }

    return true;
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

  // Helper methods to convert between bitwise flags and arrays
  private flagsToArray(flags: number, options: { value: number, label: string }[]): number[] {
    if (!flags) return [];
    return options.filter(opt => (flags & opt.value) === opt.value).map(opt => opt.value);
  }

  private arrayToFlags(selectedValues: number[]): number {
    if (!selectedValues || selectedValues.length === 0) return 0;
    return selectedValues.reduce((acc, val) => acc | val, 0);
  }

  // User selection modal methods
  openUserSelectionModal() {
    this.showUserSelectionModal = true;
  }

  closeUserSelectionModal() {
    this.showUserSelectionModal = false;
  }

  onUserSelected(user: UserListDto) {
    this.userId = user.id;
    this.userName = user.username;
    this.userEmail = user.email;
    this.showUserSelectionModal = false;
  }

  disconnectUser() {
    if (confirm('האם אתה בטוח שברצונך לנתק את המשתמש?')) {
      this.userId = undefined;
      this.userName = undefined;
      this.userEmail = undefined;
    }
  }

  // Search methods for languages and audiences
  onLanguageSearchChange() {
    if (!this.languageSearchText.trim()) {
      this.filteredLanguageOptions = this.languageOptions;
      return;
    }
    const search = this.languageSearchText.toLowerCase().trim();
    this.filteredLanguageOptions = this.languageOptions.filter(opt =>
      opt.label.toLowerCase().includes(search)
    );
  }

  onAudienceSearchChange() {
    if (!this.audienceSearchText.trim()) {
      this.filteredAudienceOptions = this.audienceOptions;
      return;
    }
    const search = this.audienceSearchText.toLowerCase().trim();
    this.filteredAudienceOptions = this.audienceOptions.filter(opt =>
      opt.label.toLowerCase().includes(search)
    );
  }

  toggleLanguage(value: number) {
    const index = this.selectedLanguages.indexOf(value);
    if (index > -1) {
      this.selectedLanguages.splice(index, 1);
    } else {
      this.selectedLanguages.push(value);
    }
  }

  toggleAudience(value: number) {
    const index = this.selectedAudiences.indexOf(value);
    if (index > -1) {
      this.selectedAudiences.splice(index, 1);
    } else {
      this.selectedAudiences.push(value);
    }
  }

  isLanguageChecked(value: number): boolean {
    return this.selectedLanguages.includes(value);
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

    const order = this.galleryImages ? this.galleryImages.length : 0;

    if (!this.galleryImages) {
      this.galleryImages = [];
    }

    this.galleryImages.push({
      imageUrl: this.newGalleryImage.imageUrl,
      caption: this.newGalleryImage.caption || '',
      order
    });

    this.newGalleryImage = { imageUrl: '', caption: '' };
  }

  removeGalleryImage(index: number): void {
    if (confirm('האם למחוק תמונה זו מהגלריה?')) {
      this.galleryImages?.splice(index, 1);
      // Update display orders
      this.galleryImages?.forEach((img, idx) => {
        img.order = idx;
      });
    }
  }

  moveGalleryImageUp(index: number): void {
    if (index === 0 || !this.galleryImages) return;

    const temp = this.galleryImages[index];
    this.galleryImages[index] = this.galleryImages[index - 1];
    this.galleryImages[index - 1] = temp;

    // Update display orders
    this.galleryImages.forEach((img, idx) => {
      img.order = idx;
    });
  }

  moveGalleryImageDown(index: number): void {
    if (!this.galleryImages || index === this.galleryImages.length - 1) return;

    const temp = this.galleryImages[index];
    this.galleryImages[index] = this.galleryImages[index + 1];
    this.galleryImages[index + 1] = temp;

    // Update display orders
    this.galleryImages.forEach((img, idx) => {
      img.order = idx;
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/teachers']);
  }

  // Close dropdowns when clicking outside
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
