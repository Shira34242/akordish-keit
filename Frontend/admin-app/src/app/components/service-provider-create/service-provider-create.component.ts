import { Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FileUploadInputComponent } from '../shared/file-upload-input/file-upload-input.component';
import { MusicServiceProviderService } from '../../services/music-service-provider.service';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService } from '../../services/subscription.service';
import { SystemTablesService, SystemItem } from '../../services/system-tables.service';
import { CitiesService, City } from '../../services/cities.service';
import { RequiredFieldFeedbackService } from '../../services/required-field-feedback.service';
import {
  CreateMusicServiceProviderDto,
  ProfileStatus,
  CreateGalleryImageDto,
  CreateServiceProviderCategoryDto,
  CreateServiceProviderTestimonialDto
} from '../../models/music-service-provider.model';
import {
  SubscriptionPlan,
  SubscriptionDto
} from '../../models/subscription.model';
import { SocialLinkDto, SocialPlatform } from '../../models/music-service-provider.model';

interface Category {
  id: number;
  name: string;
}

interface PlatformLinkOption {
  platform: SocialPlatform;
  label: string;
  icon: string;
  placeholder: string;
}

@Component({
  selector: 'app-service-provider-create',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadInputComponent],
  templateUrl: './service-provider-create.component.html',
  styleUrls: ['./service-provider-create.component.css']
})
export class ServiceProviderCreateComponent implements OnInit {
  @Input() embedded = false;
  @Input() presetCategoryId?: number;
  @Input() allowUncategorized = false;
  @Output() close = new EventEmitter<void>();
  @Output() backToChat = new EventEmitter<void>();

  currentStep = 1;
  readonly totalSteps = 3;
  subscription?: SubscriptionDto;
  isPremium = false;
  loading = true;
  saving = false;
  submitted = false;
  error = '';

  // Form fields
  displayName: string = '';
  shortBio: string = '';
  fullDescription: string = '';
  location: string = '';
  phoneNumber: string = '';
  hasWhatsAppOnPhone = false;
  email: string = '';
  websiteUrl: string = '';
  bannerImageUrl: string = '';
  profileImageUrl: string = '';
  videoUrl: string = '';
  yearsOfExperience: number = 0;
  workingHours: string = '';
  selectedCategoryId: number | undefined = undefined;
  galleryImages: CreateGalleryImageDto[] = [];
  newGalleryImage = { imageUrl: '', caption: '' };
  socialLinks: SocialLinkDto[] = [];
  customerTestimonials: CreateServiceProviderTestimonialDto[] = [];
  newTestimonial = { clientName: '', text: '' };

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
  private initialCategoryId?: number;
  private initialAllowUncategorized = false;
  readonly socialPlatformOptions: PlatformLinkOption[] = [
    { platform: SocialPlatform.Instagram, label: 'Instagram', icon: 'photo_camera', placeholder: 'הדבק קישור לאינסטגרם' },
    { platform: SocialPlatform.Facebook, label: 'Facebook', icon: 'thumb_up', placeholder: 'הדבק קישור לפייסבוק' },
    { platform: SocialPlatform.YouTube, label: 'YouTube', icon: 'smart_display', placeholder: 'הדבק קישור ליוטיוב' },
    { platform: SocialPlatform.TikTok, label: 'TikTok', icon: 'music_note', placeholder: 'הדבק קישור לטיקטוק' },
    { platform: SocialPlatform.Twitter, label: 'Twitter / X', icon: 'alternate_email', placeholder: 'הדבק קישור ל-X / Twitter' }
  ];

  constructor(
    private serviceProviderService: MusicServiceProviderService,
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private systemTablesService: SystemTablesService,
    private citiesService: CitiesService,
    private route: ActivatedRoute,
    public router: Router,
    private host: ElementRef<HTMLElement>,
    private requiredFieldFeedback: RequiredFieldFeedbackService
  ) {}

  ngOnInit() {
    this.initializeIncomingCategoryState();
    this.loadSubscriptionStatus();
    this.loadCategories();
    this.loadCities();
    this.prefillUserData();
    setTimeout(() => this.scrollToTop(false));
  }

  nextStep(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.scrollToTop();
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.scrollToTop();
    }
  }

  goToStep(step: number): void {
    if (step >= 1 && step <= this.totalSteps) {
      this.currentStep = step;
      this.scrollToTop();
    }
  }

  loadSubscriptionStatus() {
    const user = this.authService.currentUserValue;
    if (!user) {
      this.authService.requestLogin(this.router.url);
      return;
    }

    // ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג‚¬ֲ׳³ֲ³ײ²ֲ§׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ© ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג€ֲ¢ ׳³ֲ³ײ²ֲ§׳³ֲ³׳’ג€ֲ¢׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ¢׳³ֲ³ײ²ֲ¨׳³ֲ³׳’ג‚¬ֳ·׳³ֲ³ײ³ג€”
    this.subscriptionService.getUserActiveSubscription(user.id).subscribe({
      next: (subscription) => {
        this.loading = false;

        // ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ© ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג€ֲ¢ ׳³ֲ³׳’ג€ֳ—׳³ֲ³ײ²ֲ¢׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ¢׳³ֲ³ײ²ֲ¨׳³ֲ³׳’ג‚¬ֳ·׳³ֲ³ײ³ג€” - ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ©׳³ֲ³ײ³ג€”׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ©׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³׳’ג‚¬ֲ¢ (׳³ֲ³ײ²ֲ¢׳³ֲ³׳’ג‚¬ֲ׳³ֲ³׳’ג€ֲ¢׳³ֲ³׳’ג€ֳ—׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³ײ³ג€” ׳³ֲ³ײ²ֲ¨׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ©׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֲ)
        if (subscription) {
          this.subscription = subscription;
          this.isPremium = subscription.plan === SubscriptionPlan.Premium;

          // ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ§׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג€ֲ¢ localStorage - ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג€ֲ¢ ׳³ֲ³׳’ג‚¬ֳ·׳³ֲ³׳’ג‚¬ֻ׳³ֲ³ײ²ֲ¨ ׳³ֲ³ײ²ֲ§׳³ֲ³׳’ג€ֲ¢׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ¢׳³ֲ³ײ²ֲ¨׳³ֲ³׳’ג‚¬ֳ·׳³ֲ³ײ³ג€”
          localStorage.removeItem('selectedSubscriptionPlan');
          localStorage.removeItem('selectedBillingCycle');
          localStorage.removeItem('pendingProfessionalType');

        } else {
          // ׳³ֲ³ײ²ֲ׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג€ֲ¢ ׳³ֲ³ײ²ֲ§׳³ֲ³׳’ג€ֲ¢׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ - ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג‚¬ֲ׳³ֲ³ײ²ֲ§׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ© ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³׳’ג‚¬ג€׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ¨׳³ֲ³׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ©׳³ֲ³ײ²ֲ׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³ײ²ֲ¨׳³ֲ³׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ׳³ֲ³ײ³ג€”׳³ֲ³׳’ג‚¬ֲ׳³ֲ³ײ²ֲ׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³ײ²ֲ¨׳³ֲ³ײ²ֲ©׳³ֲ³ײ²ֲ׳³ֲ³׳’ג‚¬ֲ
          const selectedPlan = localStorage.getItem('selectedSubscriptionPlan');
          const billingCycle = localStorage.getItem('selectedBillingCycle');

          if (selectedPlan) {
            this.isPremium = selectedPlan === SubscriptionPlan.Premium.toString();

            // ׳³ֲ³׳’ג‚¬ֳ·׳³ֲ³ײ²ֲ¨׳³ֲ³׳’ג‚¬ג„¢׳³ֲ³ײ²ֲ¢ ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג€ֲ¢ ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ ׳³ֲ³ײ²ֲ§׳³ֲ³׳’ג€ֲ¢׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ¢׳³ֲ³ײ²ֲ¨׳³ֲ³׳’ג‚¬ֳ·׳³ֲ³ײ³ג€” - ׳³ֲ³׳’ג€ֲ¢׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³ײ²ֲ¦׳³ֲ³ײ²ֲ¨ ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³ײ²ֲ©׳³ֲ³ײ²ֲ׳³ֲ³׳’ג€ֲ¢׳³ֲ³׳’ג‚¬ג€׳³ֲ³ײ³ג€” ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³ײ»ֲ׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג€ֳ—׳³ֲ³ײ²ֲ¡
          }
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Error loading subscription:', err);
        // ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ© ׳³ֲ³ײ²ֲ©׳³ֲ³׳’ג‚¬ג„¢׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ׳³ֲ³׳’ג‚¬ֲ ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³ײ»ֲ׳³ֲ³ײ²ֲ¢׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³ײ³ג€” ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג€ֲ¢, ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³ײ²ֲ§ localStorage
        const selectedPlan = localStorage.getItem('selectedSubscriptionPlan');
        if (selectedPlan) {
          this.isPremium = selectedPlan === SubscriptionPlan.Premium.toString();
        }
      }
    });
  }

  prefillUserData() {
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.displayName = currentUser.username;
      this.email = currentUser.email;
    }
  }

  loadCities() {
    this.citiesService.getCities().subscribe({
      next: (cities) => {
        this.availableCities = cities.filter(c => c.isActive);
        this.filteredCities = this.availableCities;
      },
      error: (error) => console.error('Error loading cities:', error)
    });
  }

  loadCategories() {
    this.systemTablesService.getItems('music-service-provider-categories', 1, 100).subscribe({
      next: (result) => {
        this.availableCategories = result.items;
        this.filteredCategories = this.availableCategories;
        if (this.initialCategoryId) {
          const categoryExists = this.availableCategories.some(category => category.id === this.initialCategoryId);
          this.selectedCategoryId = categoryExists ? this.initialCategoryId : undefined;
        }
      },
      error: (error) => console.error('Error loading categories:', error)
    });
  }

  // City dropdown methods
  toggleCityDropdown() {
    const nextState = !this.cityDropdownOpen;
    this.closeAllDropdowns();
    this.cityDropdownOpen = nextState;
    if (this.cityDropdownOpen) {
      this.citySearchText = '';
      this.filteredCities = this.availableCities;
    }
  }

  selectCity(cityId: number | undefined) {
    this.cityId = cityId;
    this.cityDropdownOpen = false;
  }

  getSelectedCityName(): string {
    if (!this.cityId) return '\u05d1\u05d7\u05e8 \u05e2\u05d9\u05e8...';
    const city = this.availableCities.find(c => c.id === this.cityId);
    return city ? city.name : '\u05d1\u05d7\u05e8 \u05e2\u05d9\u05e8...';
  }

  onCitySearchChange() {
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
  toggleCategoriesDropdown() {
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
      return this.allowUncategorized ? 'נותן שירות כללי' : '\u05d1\u05d7\u05e8 \u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d4...';
    }
    const category = this.availableCategories.find(cat => cat.id === this.selectedCategoryId);
    return category ? category.name : '\u05d1\u05d7\u05e8 \u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d4...';
  }

  onCategorySearchChange() {
    if (!this.categorySearchText.trim()) {
      this.filteredCategories = this.availableCategories;
      return;
    }
    const search = this.categorySearchText.toLowerCase().trim();
    this.filteredCategories = this.availableCategories.filter(category =>
      category.name.toLowerCase().includes(search)
    );
  }

  selectCategory(categoryId: number) {
    this.selectedCategoryId = categoryId;
    this.allowUncategorized = false;
    this.categoriesDropdownOpen = false;
    this.requiredFieldFeedback.clearFeedback(this.host.nativeElement.querySelector('[data-required-service-category]'));
  }

  // Gallery methods
  addGalleryImage() {
    if (!this.newGalleryImage.imageUrl.trim()) {
      alert('\u05e0\u05d0 \u05dc\u05d4\u05d6\u05d9\u05df \u05e7\u05d9\u05e9\u05d5\u05e8 \u05dc\u05ea\u05de\u05d5\u05e0\u05d4');
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

  removeGalleryImage(index: number) {
    if (confirm('\u05d4\u05d0\u05dd \u05dc\u05de\u05d7\u05d5\u05e7 \u05d0\u05ea \u05d4\u05ea\u05de\u05d5\u05e0\u05d4 \u05d4\u05d6\u05d5 \u05de\u05d4\u05d2\u05dc\u05e8\u05d9\u05d4?')) {
      this.galleryImages.splice(index, 1);
      this.galleryImages.forEach((img, idx) => img.order = idx);
    }
  }

  addTestimonial(): void {
    if (!this.newTestimonial.text.trim()) {
      alert('נא להזין טקסט המלצה');
      return;
    }

    this.customerTestimonials.push({
      clientName: this.newTestimonial.clientName.trim() || undefined,
      text: this.newTestimonial.text.trim(),
      order: this.customerTestimonials.length
    });

    this.newTestimonial = { clientName: '', text: '' };
  }

  removeTestimonial(index: number): void {
    if (confirm('האם למחוק את ההמלצה הזו?')) {
      this.customerTestimonials.splice(index, 1);
      this.customerTestimonials.forEach((item, idx) => item.order = idx);
    }
  }

  getPlatformLink(platform: SocialPlatform): string {
    return this.socialLinks.find(link => link.platform === platform)?.url ?? '';
  }

  setPlatformLink(platform: SocialPlatform, url: string): void {
    const normalizedUrl = url.trim();
    const existingLink = this.socialLinks.find(link => link.platform === platform);

    if (!normalizedUrl) {
      this.socialLinks = this.socialLinks.filter(link => link.platform !== platform);
      return;
    }

    if (existingLink) {
      existingLink.url = normalizedUrl;
      return;
    }

    this.socialLinks = [...this.socialLinks, { platform, url: normalizedUrl }];
  }

  trackByPlatform(_index: number, option: PlatformLinkOption): number {
    return option.platform;
  }

  onSubmit() {
    if (!this.validateForm()) {
      return;
    }

    this.saving = true;
    this.error = '';

    const currentUser = this.authService.currentUserValue;
    const normalizedGalleryImages = this.galleryImages
      .filter(image => image.imageUrl?.trim())
      .map((image, index) => ({
        ...image,
        imageUrl: image.imageUrl.trim(),
        caption: image.caption?.trim() || '',
        order: index
      }));

    const dto: CreateMusicServiceProviderDto = {
      userId: currentUser?.id,
      displayName: this.displayName.trim(),
      shortBio: this.shortBio?.trim() || undefined,
      fullDescription: this.fullDescription?.trim() || undefined,
      isTeacher: false,
      cityId: this.cityId,
      location: this.location?.trim() || undefined,
      phoneNumber: this.phoneNumber.trim(),
      whatsAppNumber: this.hasWhatsAppOnPhone ? this.phoneNumber.trim() : undefined,
      email: this.email.trim(),
      websiteUrl: this.websiteUrl?.trim() || undefined,
      bannerImageUrl: this.bannerImageUrl?.trim() || undefined,
      profileImageUrl: this.profileImageUrl?.trim() || undefined,
      videoUrl: this.videoUrl?.trim() || undefined,
      yearsOfExperience: this.yearsOfExperience,
      workingHours: this.workingHours?.trim() || undefined,
      isFeatured: false,
      status: ProfileStatus.Pending,
      categories: this.selectedCategoryId ? [{
        categoryId: this.selectedCategoryId,
        subCategory: undefined
      } as CreateServiceProviderCategoryDto] : [],
      galleryImages: normalizedGalleryImages,
      socialLinks: this.socialLinks
        .filter(link => link.url?.trim())
        .map(link => ({ ...link, url: link.url.trim() })),
      customerTestimonials: this.customerTestimonials
    };

    this.serviceProviderService.createServiceProviderProfile(dto).subscribe({
      next: (provider) => {
        this.saving = false;

        // ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ§׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג€ֲ¢ localStorage ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ׳³ֲ³׳’ג‚¬ג€׳³ֲ³ײ²ֲ¨ ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³ײ²ֲ¦׳³ֲ³ײ²ֲ׳³ֲ³׳’ג‚¬ג€׳³ֲ³׳’ג‚¬ֲ
        localStorage.removeItem('selectedSubscriptionPlan');
        localStorage.removeItem('selectedBillingCycle');
        localStorage.removeItem('pendingProfessionalType');

        // ׳³ֲ³ײ²ֲ¡׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ©׳³ֲ³ײ³ג€”׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ© ׳³ֲ³׳’ג‚¬ֳ·׳³ֲ³׳’ג‚¬ֻ׳³ֲ³ײ²ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג€ֳ—׳³ֲ³ײ²ֲ¨׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג€ֳ—׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ§׳³ֲ³ײ²ֲ¦׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³ײ²ֲ¢׳³ֲ³׳’ג€ֲ¢ (׳³ֲ³ײ²ֲ׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³ײ²ֲ¢ ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³ײ²ֲ¦׳³ֲ³׳’ג‚¬ג„¢׳³ֲ³ײ³ג€” ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³׳’ג€ֳ—׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג€ֳ—׳³ֲ³ײ²ֲ׳³ֲ³׳’ג€ֳ— "׳³ֲ³ײ²ֲ¢׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג‚¬ֲ ׳³ֲ³׳’ג€ֳ—׳³ֲ³ײ²ֲ¨׳³ֲ³ײ»ֲ׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ" ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³ײ³ג€”׳³ֲ³׳’ג‚¬ג€׳³ֲ³׳’ג‚¬ֻ׳³ֲ³ײ²ֲ¨׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³ײ³ג€” ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³ײ²ֲ׳³ֲ³׳’ג‚¬ֲ)
        this.authService.markAsProfessional();

        // ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ¢׳³ֲ³׳’ג‚¬ֻ׳³ֲ³ײ²ֲ¨ ׳³ֲ³ײ²ֲ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³׳’ג‚¬ג€׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ¨׳³ֲ³ײ³ג€” ׳³ֲ³׳’ג‚¬ג€׳³ֲ³׳’ג‚¬ֻ׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ׳³ֲ³׳’ג‚¬ֲ (׳³ֲ³ײ²ֲ©׳³ֲ³ײ²ֲ׳³ֲ³׳’ג‚¬ֻ 2 ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³ײ³ג€”׳³ֲ³׳’ג‚¬ֲ׳³ֲ³ײ²ֲ׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³׳’ג‚¬ֲ׳³ֲ³ײ²ֲ¨׳³ֲ³ײ²ֲ©׳³ֲ³ײ²ֲ׳³ֲ³׳’ג‚¬ֲ)
        this.submitted = true;
        this.scrollToTop();
      },
      error: (err) => {
        console.error('Error creating service provider profile:', err);
        this.error = err.error?.message || '\u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05d9\u05e6\u05d9\u05e8\u05ea \u05e4\u05e8\u05d5\u05e4\u05d9\u05dc \u05e0\u05d5\u05ea\u05df \u05e9\u05d9\u05e8\u05d5\u05ea';
        this.saving = false;

        // ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ§׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג€ֲ¢ localStorage ׳³ֲ³׳’ג‚¬ג„¢׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ§׳³ֲ³ײ²ֲ¨׳³ֲ³׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ©׳³ֲ³ײ²ֲ ׳³ֲ³ײ²ֲ©׳³ֲ³׳’ג‚¬ג„¢׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ׳³ֲ³׳’ג‚¬ֲ
        localStorage.removeItem('selectedSubscriptionPlan');
        localStorage.removeItem('selectedBillingCycle');
        localStorage.removeItem('pendingProfessionalType');
      }
    });
  }

  validateForm(): boolean {
    if (!this.displayName.trim()) {
      this.error = '\u05e0\u05d0 \u05dc\u05d4\u05d6\u05d9\u05df \u05e9\u05dd \u05ea\u05e6\u05d5\u05d2\u05d4';
      this.showRequiredStep(1, '#displayName');
      return false;
    }

    if (!this.email || !this.email.trim()) {
      this.error = '\u05e0\u05d0 \u05dc\u05d4\u05d6\u05d9\u05df \u05d0\u05d9\u05de\u05d9\u05d9\u05dc';
      this.showRequiredStep(2, '#email');
      return false;
    }

    if (!this.phoneNumber || !this.phoneNumber.trim()) {
      this.error = '\u05e0\u05d0 \u05dc\u05d4\u05d6\u05d9\u05df \u05d8\u05dc\u05e4\u05d5\u05df';
      this.showRequiredStep(2, '#phoneNumber');
      return false;
    }

    if (!this.selectedCategoryId && !this.allowUncategorized) {
      this.error = '\u05e0\u05d0 \u05dc\u05d1\u05d7\u05d5\u05e8 \u05e7\u05d8\u05d2\u05d5\u05e8\u05d9\u05d4';
      this.showRequiredStep(1, '[data-required-service-category]');
      return false;
    }

    return true;
  }

  private showRequiredStep(step: number, selector: string): void {
    this.currentStep = step;
    setTimeout(() => this.requiredFieldFeedback.showRequiredBySelector(this.host.nativeElement, selector));
  }

  @HostListener('document:click', ['$event'])
  closeDropdowns(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) {
      this.closeAllDropdowns();
    }
  }

  private closeAllDropdowns(): void {
    this.cityDropdownOpen = false;
    this.categoriesDropdownOpen = false;
  }


  goToSubscriptionSelection(): void {
    this.router.navigate(['/subscription/select'], { queryParams: { type: 'service-provider' } });
  }

  finishFlow(): void {
    if (this.embedded) {
      this.close.emit();
      return;
    }

    this.router.navigate(['/professionals']);
  }

  cancelFlow(): void {
    if (this.embedded) {
      this.close.emit();
      return;
    }

    this.router.navigate(['/professionals']);
  }

  returnToChat(): void {
    if (this.embedded) {
      this.backToChat.emit();
    }
  }

  private initializeIncomingCategoryState(): void {
    const categoryIdFromQuery = Number(this.route.snapshot.queryParamMap.get('categoryId'));
    const allowUncategorizedFromQuery = this.route.snapshot.queryParamMap.get('general') === 'true';

    this.initialCategoryId = this.presetCategoryId ?? (Number.isFinite(categoryIdFromQuery) && categoryIdFromQuery > 0 ? categoryIdFromQuery : undefined);
    this.initialAllowUncategorized = !this.initialCategoryId && (this.allowUncategorized || allowUncategorizedFromQuery);
    this.allowUncategorized = this.initialAllowUncategorized;
  }

  private scrollToTop(smooth = true): void {
    const behavior: ScrollBehavior = smooth ? 'smooth' : 'auto';

    if (this.embedded) {
      const scrollRegion = this.host.nativeElement.querySelector('.guided-scroll-region');
      scrollRegion?.scrollTo({ top: 0, behavior });
      return;
    }

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior });
    }
  }
}

