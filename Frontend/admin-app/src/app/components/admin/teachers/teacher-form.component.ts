import { Component, ElementRef, OnInit, OnDestroy, HostListener, inject, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TeacherService } from '../../../services/teacher.service';
import { SystemTablesService, SystemItem } from '../../../services/system-tables.service';
import { UserService } from '../../../services/user.service';
import { CitiesService, City } from '../../../services/cities.service';
import { CreateTeacherDto, UpdateTeacherDto, TeacherDto, CreateTeacherInstrumentDto, CreateTeacherTestimonialDto } from '../../../models/teacher.model';
import { ProfileStatus, CreateGalleryImageDto, SocialLinkDto, SocialPlatform } from '../../../models/music-service-provider.model';
import { UserListDto } from '../../../models/user.model';
import { TeachingLanguage, getTeachingLanguageOptions, hasLanguage, toggleLanguage } from '../../../models/teaching-language.enum';
import { TargetAudience, getTargetAudienceOptions, hasAudience, toggleAudience } from '../../../models/target-audience.enum';
import { UserSelectionModalComponent } from './user-selection-modal.component';
import { FileUploadInputComponent } from '../../shared/file-upload-input/file-upload-input.component';
import { SiteAlertService } from '../../../services/site-alert.service';
import { RequiredFieldFeedbackService } from '../../../services/required-field-feedback.service';


@Component({
  selector: 'app-teacher-form',
  standalone: true,
  imports: [CommonModule, FormsModule, UserSelectionModalComponent, FileUploadInputComponent],
  templateUrl: './teacher-form.component.html',
  styleUrls: ['./teacher-form.component.css']
})
export class TeacherFormComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly requiredFieldFeedback = inject(RequiredFieldFeedbackService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  @Input() embedded = false;
  @Input() teacherIdInput?: number;
  @Output() close = new EventEmitter<void>();

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
  bannerImageUrl: string = '';
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
  testimonials: CreateTeacherTestimonialDto[] = [];
  newTestimonial = { studentName: '', text: '' };
  socialLinks: SocialLinkDto[] = [];

  readonly SOCIAL_PLATFORMS = [
    { value: SocialPlatform.Instagram, label: 'Instagram' },
    { value: SocialPlatform.Facebook, label: 'Facebook' },
    { value: SocialPlatform.YouTube, label: 'YouTube' },
    { value: SocialPlatform.TikTok, label: 'TikTok' },
    { value: SocialPlatform.Twitter, label: 'Twitter / X' },
    { value: SocialPlatform.Spotify, label: 'Spotify' },
    { value: SocialPlatform.Zing, label: 'Zing' }
  ];

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
    const inputId = this.teacherIdInput;
    const routeId = this.route.snapshot.paramMap.get('id');
    const resolvedId = inputId ?? (routeId ? +routeId : undefined);

    if (resolvedId) {
      this.isEditMode = true;
      this.teacherId = resolvedId;
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
    const nextState = !this.cityDropdownOpen;
    this.closeAllDropdowns();
    this.cityDropdownOpen = nextState;
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
    const nextState = !this.languageDropdownOpen;
    this.closeAllDropdowns();
    this.languageDropdownOpen = nextState;
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
    const nextState = !this.audienceDropdownOpen;
    this.closeAllDropdowns();
    this.audienceDropdownOpen = nextState;
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
    const nextState = !this.instrumentsDropdownOpen;
    this.closeAllDropdowns();
    this.instrumentsDropdownOpen = nextState;
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
        this.bannerImageUrl = teacher.bannerImageUrl || '';
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
        this.testimonials = teacher.testimonials?.map(item => ({
          studentName: item.studentName,
          text: item.text,
          order: item.order
        })) || [];
        this.socialLinks = teacher.socialLinks?.map(link => ({
          id: link.id,
          platform: link.platform,
          url: link.url
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
    const commonPayload = {
      displayName: this.displayName.trim(),
      shortBio: this.optionalText(this.shortBio),
      fullDescription: this.optionalText(this.fullDescription),
      cityId: this.cityId,
      location: this.optionalText(this.location),
      phoneNumber: this.phoneNumber.trim(),
      whatsAppNumber: this.optionalText(this.whatsAppNumber),
      email: this.email.trim(),
      websiteUrl: this.optionalText(this.websiteUrl),
      bannerImageUrl: this.optionalText(this.bannerImageUrl),
      profileImageUrl: this.optionalText(this.profileImageUrl),
      videoUrl: this.optionalText(this.videoUrl),
      yearsOfExperience: this.yearsOfExperience || undefined,
      workingHours: this.optionalText(this.workingHours),
      isFeatured: this.isFeatured,
      status: this.status,
      priceList: this.optionalText(this.priceList),
      languages: this.arrayToFlags(this.selectedLanguages),
      targetAudience: this.arrayToFlags(this.selectedAudiences),
      availability: this.optionalText(this.availability),
      education: this.optionalText(this.education),
      lessonTypes: this.optionalText(this.lessonTypes),
      specializations: this.optionalText(this.specializations),
      instruments: this.selectedInstrumentIds.map(id => ({ instrumentId: id, isPrimary: false } as CreateTeacherInstrumentDto)),
      galleryImages: this.normalizedGalleryImages(),
      testimonials: this.normalizedTestimonials(),
      socialLinks: this.normalizedSocialLinks()
    };

    if (this.isEditMode && this.teacherId) {
      const dto: UpdateTeacherDto = {
        ...commonPayload
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
        ...commonPayload,
        userId: this.userId,
        isTeacher: true,
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
      this.requiredFieldFeedback.showRequiredBySelector(this.host.nativeElement, '[data-required-admin-instruments]');
      return false;
    }

    return true;
  }

  async toggleInstrument(instrumentId: number): Promise<void> {
    const index = this.selectedInstrumentIds.indexOf(instrumentId);
    if (index > -1) {
      this.selectedInstrumentIds.splice(index, 1);
    } else {
      this.selectedInstrumentIds.push(instrumentId);
    }
    if (this.selectedInstrumentIds.length > 0) {
      this.requiredFieldFeedback.clearFeedback(this.host.nativeElement.querySelector('[data-required-admin-instruments]'));
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

  async disconnectUser(): Promise<void> {
    if (await this.siteAlerts.confirm('האם אתה בטוח שברצונך לנתק את המשתמש?')) {
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

  async removeGalleryImage(index: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם למחוק תמונה זו מהגלריה?')) {
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

  addTestimonial(): void {
    if (!this.newTestimonial.text.trim()) {
      alert('נא להזין טקסט המלצה');
      return;
    }

    this.testimonials.push({
      studentName: this.newTestimonial.studentName.trim() || undefined,
      text: this.newTestimonial.text.trim(),
      order: this.testimonials.length
    });
    this.newTestimonial = { studentName: '', text: '' };
  }

  removeTestimonial(index: number): void {
    this.testimonials.splice(index, 1);
    this.testimonials.forEach((item, idx) => item.order = idx);
  }

  moveTestimonialUp(index: number): void {
    if (index === 0) return;
    const temp = this.testimonials[index];
    this.testimonials[index] = this.testimonials[index - 1];
    this.testimonials[index - 1] = temp;
    this.testimonials.forEach((item, idx) => item.order = idx);
  }

  moveTestimonialDown(index: number): void {
    if (index === this.testimonials.length - 1) return;
    const temp = this.testimonials[index];
    this.testimonials[index] = this.testimonials[index + 1];
    this.testimonials[index + 1] = temp;
    this.testimonials.forEach((item, idx) => item.order = idx);
  }

  addSocialLink(): void {
    this.socialLinks.push({ platform: SocialPlatform.Instagram, url: '' });
  }

  removeSocialLink(index: number): void {
    this.socialLinks.splice(index, 1);
  }

  private optionalText(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private normalizedGalleryImages(): CreateGalleryImageDto[] {
    return this.galleryImages
      .filter(img => img.imageUrl?.trim())
      .map((img, index) => ({
        imageUrl: img.imageUrl.trim(),
        caption: this.optionalText(img.caption),
        order: index
      }));
  }

  private normalizedTestimonials(): CreateTeacherTestimonialDto[] {
    return this.testimonials
      .filter(item => item.text?.trim())
      .map((item, index) => ({
        studentName: this.optionalText(item.studentName),
        text: item.text.trim(),
        order: index
      }));
  }

  private normalizedSocialLinks(): SocialLinkDto[] {
    return this.socialLinks
      .filter(link => link.url?.trim())
      .map(link => ({
        id: link.id,
        platform: link.platform,
        url: link.url.trim()
      }));
  }

  goBack(): void {
    if (this.embedded) {
      this.close.emit();
      return;
    }

    this.router.navigate(['/admin/users/teachers']);
  }

  preventEnterSubmit(event: Event): void {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'submit') {
      event.preventDefault();
    }
  }

  // Close dropdowns when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) {
      this.closeAllDropdowns();
    }
  }

  private closeAllDropdowns(): void {
    this.cityDropdownOpen = false;
    this.instrumentsDropdownOpen = false;
    this.languageDropdownOpen = false;
    this.audienceDropdownOpen = false;
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }
}
