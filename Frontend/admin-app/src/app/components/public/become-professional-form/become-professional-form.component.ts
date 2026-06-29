import { Component, ElementRef, EventEmitter, inject, OnDestroy, OnInit, Output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';
import { SystemTablesService, SystemItem } from '../../../services/system-tables.service';
import { CitiesService, City } from '../../../services/cities.service';
import { CreateMusicServiceProviderDto, ProfileStatus, CreateGalleryImageDto, CreateServiceProviderCategoryDto, ServiceProviderParkingType, SocialLinkDto, SocialPlatform } from '../../../models/music-service-provider.model';
import { AuthService } from '../../../services/auth.service';
import { RequiredFieldFeedbackService } from '../../../services/required-field-feedback.service';
import { MediaService } from '../../../services/admin/media.service';
import { LanguageService } from '../../../services/language.service';
import { getSocialPlatformIconSvg, normalizeSocialPlatform } from '../../../utils/social-platform-icons';

interface Category {
  id: number;
  name: string;
}

@Component({
  selector: 'app-become-professional-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './become-professional-form.component.html',
  styleUrls: ['./become-professional-form.component.css']
})
export class BecomeProfessionalFormComponent implements OnInit, OnDestroy {
  private readonly professionalService = inject(MusicServiceProviderService);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly citiesService = inject(CitiesService);
  private readonly authService = inject(AuthService);
  private readonly requiredFieldFeedback = inject(RequiredFieldFeedbackService);
  private readonly mediaService = inject(MediaService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly langService = inject(LanguageService);
  private readonly sanitizer = inject(DomSanitizer);

  @Output() close = new EventEmitter<void>();
  @Output() success = new EventEmitter<void>();

  saving = false;
  currentStep = 1;
  totalSteps = 2;

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
  bannerImageUrl: string = '';
  videoUrl: string = '';
  yearsOfExperience: number = 0;
  workingHours: string = '';
  parkingType: ServiceProviderParkingType = ServiceProviderParkingType.None;
  hasAccessibleEntrance: boolean = false;
  isAnash: boolean = false;
  selectedCategoryId: number | undefined = undefined; // Single category for professionals
  galleryImages: CreateGalleryImageDto[] = [];
  newGalleryImage = { imageUrl: '', caption: '' };
  socialLinks: SocialLinkDto[] = [];
  activeSocialPlatform: SocialPlatform | null = null;
  hasWhatsAppForPhone = false;
  profileImageUploading = false;
  bannerImageUploading = false;
  galleryUploadingCount = 0;
  showVideoLinkInput = false;

  // Available data
  availableCategories: Category[] = [];
  availableCities: City[] = [];
  cityId: number | undefined = undefined;

  // UI state
  cityDropdownOpen = false;
  categoriesDropdownOpen = false;
  citySearchText = '';
  categorySearchText = '';
  filteredCities: City[] = [];
  filteredCategories: Category[] = [];
  readonly ServiceProviderParkingType = ServiceProviderParkingType;
  readonly SOCIAL_PLATFORMS = [
    { value: SocialPlatform.Instagram, label: 'Instagram', icon: 'instagram' },
    { value: SocialPlatform.Facebook, label: 'Facebook', icon: 'facebook' },
    { value: SocialPlatform.YouTube, label: 'YouTube', icon: 'youtube' },
    { value: SocialPlatform.TikTok, label: 'TikTok', icon: 'tiktok' },
    { value: SocialPlatform.Twitter, label: 'Twitter / X', icon: 'x' },
    { value: SocialPlatform.Spotify, label: 'Spotify', icon: 'spotify' },
    { value: SocialPlatform.Website, label: 'Website', icon: 'website' }
  ];

  ngOnInit(): void {
    this.loadCategories();
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

  loadCategories(): void {
    this.systemTablesService.getItems('music-service-provider-categories', 1, 100).subscribe({
      next: (result) => {
        this.availableCategories = (result.items || []).filter(item => this.isServiceProviderCategory(item));
        this.filteredCategories = this.availableCategories;
      },
      error: (error: any) => console.error('Error loading categories:', error)
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

  // Categories dropdown methods
  toggleCategoriesDropdown(): void {
    const nextState = !this.categoriesDropdownOpen;
    this.closeAllDropdowns();
    this.categoriesDropdownOpen = nextState;
    if (this.categoriesDropdownOpen) {
      this.categorySearchText = '';
      this.filteredCategories = this.availableCategories;
    }
  }

  getSelectedCategoryText(): string {
    if (!this.selectedCategoryId) {
      return this.langService.translate('common.select_category');
    }
    const category = this.availableCategories.find(cat => cat.id === this.selectedCategoryId);
    return category ? category.name : this.langService.translate('common.select_category');
  }

  onCategorySearchChange(): void {
    if (!this.categorySearchText.trim()) {
      this.filteredCategories = this.availableCategories;
      return;
    }
    const search = this.categorySearchText.toLowerCase().trim();
    this.filteredCategories = this.availableCategories.filter(category =>
      category.name.toLowerCase().includes(search)
    );
  }

  selectCategory(categoryId: number): void {
    this.selectedCategoryId = categoryId;
    this.categoriesDropdownOpen = false;
    this.requiredFieldFeedback.clearFeedback(this.host.nativeElement.querySelector('[data-required-category]'));
  }

  // Gallery methods
  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.profileImageUploading) return;

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

  onBannerImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.bannerImageUploading) return;

    this.bannerImageUploading = true;
    this.mediaService.uploadMedia(file).subscribe({
      next: (response) => {
        this.bannerImageUrl = response.url;
        this.bannerImageUploading = false;
      },
      error: () => {
        this.bannerImageUploading = false;
        alert(this.langService.translate('form.error_profile_image'));
      }
    });
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

  selectSocialPlatform(platform: SocialPlatform): void {
    this.activeSocialPlatform = this.activeSocialPlatform === platform ? null : platform;
    if (this.activeSocialPlatform && !this.socialLinks.some(link => normalizeSocialPlatform(link.platform) === platform)) {
      this.socialLinks = [...this.socialLinks, { platform, url: '' }];
    }
  }

  getSocialUrl(platform: SocialPlatform): string {
    return this.socialLinks.find(link => normalizeSocialPlatform(link.platform) === platform)?.url ?? '';
  }

  setSocialUrl(platform: SocialPlatform, event: Event): void {
    const url = (event.target as HTMLInputElement).value;
    const existing = this.socialLinks.find(link => normalizeSocialPlatform(link.platform) === platform);
    if (existing) {
      existing.url = url;
      existing.platform = platform;
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

  getSocialIconSvg(platform: SocialPlatform): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(getSocialPlatformIconSvg(platform));
  }

  // Navigation methods
  nextStep(): void {
    if (this.currentStep === 1 && !this.validateStep1()) return;
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
      this.showRequiredStep(1, '[name="professionalDisplayName"]');
      return false;
    }
    if (!this.email || !this.email.trim()) {
      this.showRequiredStep(1, '[name="professionalEmail"]');
      return false;
    }
    if (!this.phoneNumber || !this.phoneNumber.trim()) {
      this.showRequiredStep(1, '[name="professionalPhone"]');
      return false;
    }
    if (!this.selectedCategoryId) {
      this.showRequiredStep(1, '[data-required-category]');
      return false;
    }
    return true;
  }

  private showRequiredStep(step: number, selector: string): void {
    this.currentStep = step;
    setTimeout(() => this.requiredFieldFeedback.showRequiredBySelector(this.host.nativeElement, selector));
  }

  onSubmit(): void {
    if (!this.validateStep1()) {
      return;
    }

    this.saving = true;
    const currentUser = this.authService.currentUserValue;

    const dto: CreateMusicServiceProviderDto = {
      userId: currentUser?.id,
      displayName: this.displayName,
      shortBio: this.shortBio,
      fullDescription: this.fullDescription,
      isTeacher: false, // Always false - this creates a professional profile
      cityId: this.cityId,
      location: this.location,
      phoneNumber: this.phoneNumber,
      whatsAppNumber: this.hasWhatsAppForPhone ? this.phoneNumber : this.whatsAppNumber,
      email: this.email,
      websiteUrl: this.websiteUrl?.trim() || undefined,
      profileImageUrl: this.profileImageUrl,
      bannerImageUrl: this.bannerImageUrl?.trim() || undefined,
      videoUrl: this.videoUrl,
      yearsOfExperience: this.yearsOfExperience,
      workingHours: this.workingHours,
      parkingType: this.parkingType,
      hasAccessibleEntrance: this.hasAccessibleEntrance,
      isAnash: this.isAnash,
      isFeatured: false,
      status: ProfileStatus.Pending, // Always pending for public registration
      categories: this.selectedCategoryId ? [{
        categoryId: this.selectedCategoryId,
        subCategory: undefined
      } as CreateServiceProviderCategoryDto] : [],
      galleryImages: this.galleryImages,
      socialLinks: this.socialLinks
        .filter(link => !!link.url?.trim())
        .map(link => ({
          platform: normalizeSocialPlatform(link.platform),
          url: link.url.trim()
        }))
    };

    this.professionalService.createServiceProvider(dto).subscribe({
      next: () => {
        this.saving = false;
        alert(this.langService.translate('form.success_submitted'));
        this.success.emit();
        this.onClose();
      },
      error: (error: any) => {
        console.error('Error creating professional:', error);
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
    this.categoriesDropdownOpen = false;
  }

  private isServiceProviderCategory(item: SystemItem): boolean {
    const label = `${item.name || ''} ${item['quickCategoryLabel'] || ''}`.toLowerCase();
    const looksLikeTeacherCategory =
      label.includes('מורה') ||
      label.includes('מורים') ||
      label.includes('teacher');

    return item['isActive'] !== false
      && Number(item['quickCategoryType'] ?? 0) !== 1
      && !item['quickCategoryInstrumentId']
      && !looksLikeTeacherCategory;
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }
}
