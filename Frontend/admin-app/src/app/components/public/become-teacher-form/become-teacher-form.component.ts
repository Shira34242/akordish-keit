import { Component, ElementRef, EventEmitter, inject, OnDestroy, OnInit, Output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TeacherService } from '../../../services/teacher.service';
import { SystemTablesService, SystemItem } from '../../../services/system-tables.service';
import { CitiesService, City } from '../../../services/cities.service';
import { CreateTeacherDto, CreateTeacherInstrumentDto, CreateTeacherTestimonialDto } from '../../../models/teacher.model';
import { ProfileStatus, CreateGalleryImageDto, SocialLinkDto, SocialPlatform } from '../../../models/music-service-provider.model';
import { TeachingLanguage, getTeachingLanguageOptions } from '../../../models/teaching-language.enum';
import { TargetAudience, getTargetAudienceOptions } from '../../../models/target-audience.enum';
import { AuthService } from '../../../services/auth.service';
import { RequiredFieldFeedbackService } from '../../../services/required-field-feedback.service';
import { MediaService } from '../../../services/admin/media.service';
import { LanguageService } from '../../../services/language.service';
import { ProfileImageCropperComponent } from '../../shared/profile-image-cropper/profile-image-cropper.component';

@Component({
  selector: 'app-become-teacher-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ProfileImageCropperComponent],
  templateUrl: './become-teacher-form.component.html',
  styleUrls: ['./become-teacher-form.component.css']
})
export class BecomeTeacherFormComponent implements OnInit, OnDestroy {
  private readonly teacherService = inject(TeacherService);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly citiesService = inject(CitiesService);
  private readonly authService = inject(AuthService);
  private readonly requiredFieldFeedback = inject(RequiredFieldFeedbackService);
  private readonly mediaService = inject(MediaService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly langService = inject(LanguageService);

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
  bannerImageUrl: string = '';
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
  testimonials: CreateTeacherTestimonialDto[] = [];
  newTestimonial = { studentName: '', text: '' };
  socialLinks: SocialLinkDto[] = [];
  activeSocialPlatform: SocialPlatform | null = null;
  hasWhatsAppForPhone = false;
  profileImageUploading = false;
  profileCropFile: File | null = null;
  profileCropUrl: string | null = null;
  profileCropFileName = 'profile-image';
  galleryUploadingCount = 0;
  showVideoLinkInput = false;

  // Available data
  availableInstruments: SystemItem[] = [];
  availableCities: City[] = [];
  cityId: number | undefined = undefined;

  // Options
  languageOptions = getTeachingLanguageOptions();
  audienceOptions = getTargetAudienceOptions();
  readonly SOCIAL_PLATFORMS = [
    { value: SocialPlatform.Instagram, label: 'Instagram', icon: 'photo_camera' },
    { value: SocialPlatform.Facebook, label: 'Facebook', icon: 'facebook' },
    { value: SocialPlatform.YouTube, label: 'YouTube', icon: 'smart_display' },
    { value: SocialPlatform.TikTok, label: 'TikTok', icon: 'music_note' },
    { value: SocialPlatform.Twitter, label: 'Twitter / X', icon: 'alternate_email' },
    { value: SocialPlatform.Spotify, label: 'Spotify', icon: 'graphic_eq' },
    { value: SocialPlatform.Zing, label: 'Zing', icon: 'language' }
  ];

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
    if (this.cityDropdownOpen) {
      this.cityDropdownOpen = false;
      this.citySearchText = '';
    } else {
      this.openCityDropdown();
    }
  }

  openCityDropdown(): void {
    if (this.cityDropdownOpen) return;
    this.closeAllDropdowns();
    this.cityDropdownOpen = true;
    this.citySearchText = '';
    this.filteredCities = this.availableCities;
  }

  onCityTextInput(event: Event): void {
    this.citySearchText = (event.target as HTMLInputElement).value;
    if (!this.cityDropdownOpen) {
      this.cityDropdownOpen = true;
    }
    this.onCitySearchChange();
  }

  onCityInputBlur(): void {
    setTimeout(() => {
      if (this.cityDropdownOpen) {
        this.cityDropdownOpen = false;
        this.citySearchText = '';
      }
    }, 200);
  }

  selectCity(cityId: number | undefined): void {
    this.cityId = cityId;
    this.cityDropdownOpen = false;
    this.citySearchText = '';
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
      city.name.toLowerCase().includes(search)
    );
  }

  // Instruments dropdown methods
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
      return this.langService.translate('common.select_instrument');
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
    if (this.selectedInstrumentIds.length > 0) {
      this.requiredFieldFeedback.clearFeedback(this.host.nativeElement.querySelector('[data-required-instruments]'));
    }
  }

  isInstrumentSelected(instrumentId: number): boolean {
    return this.selectedInstrumentIds.includes(instrumentId);
  }

  // Language dropdown methods
  toggleLanguageDropdown(): void {
    const nextState = !this.languageDropdownOpen;
    this.closeAllDropdowns();
    this.languageDropdownOpen = nextState;
    if (this.languageDropdownOpen) {
      this.filteredLanguageOptions = this.languageOptions;
    }
  }

  getSelectedLanguagesText(): string {
    if (this.selectedLanguages.length === 0) return this.langService.translate('common.select_language');
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
    const nextState = !this.audienceDropdownOpen;
    this.closeAllDropdowns();
    this.audienceDropdownOpen = nextState;
    if (this.audienceDropdownOpen) {
      this.filteredAudienceOptions = this.audienceOptions;
    }
  }

  getSelectedAudiencesText(): string {
    if (this.selectedAudiences.length === 0) return this.langService.translate('common.select_audience');
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
  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.profileImageUploading) return;

    if (!this.canCropProfileFile(file)) {
      this.uploadCroppedProfileImage(file);
      return;
    }

    this.profileCropFileName = file.name;
    this.profileCropFile = file;
    this.profileCropUrl = null;
  }

  openProfileImageCropper(): void {
    if (!this.profileImageUrl || this.profileImageUploading) return;
    this.profileCropFile = null;
    this.profileCropFileName = 'profile-image';
    this.profileCropUrl = this.profileImageUrl;
  }

  cancelProfileImageCrop(): void {
    this.profileCropFile = null;
    this.profileCropUrl = null;
  }

  uploadCroppedProfileImage(file: File): void {
    this.profileCropFile = null;
    this.profileCropUrl = null;
    this.profileImageUploading = true;
    this.mediaService.uploadMedia(file).subscribe({
      next: (response) => {
        this.profileImageUrl = response.url;
        this.profileImageUploading = false;
      },
      error: () => {
        this.profileImageUploading = false;
        alert(this.langService.translate('form.error_profile_image'));
      }
    });
  }

  private canCropProfileFile(file: File): boolean {
    return /(\.jpe?g|\.png|\.webp|\.gif|\.avif|\.bmp)$/i.test(file.name)
      || ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'].includes(file.type);
  }

  onGalleryFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;

    this.galleryUploadingCount += files.length;
    files.forEach(file => {
      this.mediaService.uploadMedia(file).subscribe({
        next: (response) => {
          this.galleryImages.push({
            imageUrl: response.url,
            caption: '',
            order: this.galleryImages.length
          });
          this.galleryUploadingCount--;
        },
        error: () => {
          this.galleryUploadingCount--;
          alert(this.langService.translate('form.error_gallery_file'));
        }
      });
    });
  }

  addGalleryImage(): void {
    if (!this.newGalleryImage.imageUrl.trim()) {
      alert(this.langService.translate('form.enter_image_url'));
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
    if (confirm(this.langService.translate('form.confirm_delete_image'))) {
      this.galleryImages.splice(index, 1);
      this.galleryImages.forEach((img, idx) => img.order = idx);
    }
  }

  addTestimonial(): void {
    if (!this.newTestimonial.text.trim()) {
      alert(this.langService.translate('form.enter_testimonial'));
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

  addSocialLink(): void {
    this.selectSocialPlatform(SocialPlatform.Instagram);
  }

  removeSocialLink(index: number): void {
    this.socialLinks.splice(index, 1);
  }

  selectSocialPlatform(platform: SocialPlatform): void {
    this.activeSocialPlatform = this.activeSocialPlatform === platform ? null : platform;
    if (this.activeSocialPlatform && !this.socialLinks.some(link => link.platform === platform)) {
      this.socialLinks = [...this.socialLinks, { platform, url: '' }];
    }
  }

  getSocialUrl(platform: SocialPlatform): string {
    return this.socialLinks.find(link => link.platform === platform)?.url ?? '';
  }

  setSocialUrl(platform: SocialPlatform, event: Event): void {
    const url = (event.target as HTMLInputElement).value;
    const existing = this.socialLinks.find(link => link.platform === platform);
    if (existing) {
      existing.url = url;
      return;
    }
    this.socialLinks = [...this.socialLinks, { platform, url }];
  }

  hasSocialUrl(platform: SocialPlatform): boolean {
    return !!this.getSocialUrl(platform).trim();
  }

  trackBySocialPlatform(_: number, item: { value: SocialPlatform }): number {
    return item.value;
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
      this.showRequiredStep(1, '[name="teacherDisplayName"]');
      return false;
    }
    if (!this.email || !this.email.trim()) {
      this.showRequiredStep(1, '[name="teacherEmail"]');
      return false;
    }
    if (!this.phoneNumber || !this.phoneNumber.trim()) {
      this.showRequiredStep(1, '[name="teacherPhone"]');
      return false;
    }
    return true;
  }

  validateStep2(): boolean {
    if (this.selectedInstrumentIds.length === 0) {
      this.showRequiredStep(2, '[data-required-instruments]');
      return false;
    }
    return true;
  }

  private showRequiredStep(step: number, selector: string): void {
    this.currentStep = step;
    setTimeout(() => this.requiredFieldFeedback.showRequiredBySelector(this.host.nativeElement, selector));
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
      whatsAppNumber: this.hasWhatsAppForPhone ? this.phoneNumber : this.whatsAppNumber,
      email: this.email,
      websiteUrl: this.websiteUrl?.trim() || undefined,
      bannerImageUrl: this.bannerImageUrl?.trim() || undefined,
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
      socialLinks: this.socialLinks
        .filter(link => !!link.url?.trim())
        .map(link => ({
          platform: link.platform,
          url: link.url.trim()
        })),
      instruments: this.selectedInstrumentIds.map(id => ({
        instrumentId: id,
        isPrimary: false
      } as CreateTeacherInstrumentDto)),
      galleryImages: this.galleryImages,
      testimonials: this.testimonials
    };

    this.teacherService.createTeacher(dto).subscribe({
      next: () => {
        this.saving = false;
        alert(this.langService.translate('form.success_submitted'));
        this.success.emit();
        this.onClose();
      },
      error: (error: any) => {
        console.error('Error creating teacher:', error);
        let errorMessage = this.langService.translate('form.error_submit');
        if (error.error?.errors) {
          const validationErrors = Object.entries(error.error.errors)
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
          errorMessage += '\n\n' + this.langService.translate('form.error_details_prefix') + '\n' + validationErrors;
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
