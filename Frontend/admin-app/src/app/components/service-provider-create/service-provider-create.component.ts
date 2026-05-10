import { Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../services/language.service';
import { HttpEventType } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MusicServiceProviderService } from '../../services/music-service-provider.service';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService } from '../../services/subscription.service';
import { SystemTablesService, SystemItem } from '../../services/system-tables.service';
import { CitiesService, City } from '../../services/cities.service';
import { RequiredFieldFeedbackService } from '../../services/required-field-feedback.service';
import { MediaService } from '../../services/admin/media.service';
import {
  CreateMusicServiceProviderDto,
  ProfileStatus,
  CreateGalleryImageDto,
  CreateServiceProviderCategoryDto,
  CreateServiceProviderTestimonialDto,
  CreateServiceProviderBranchDto
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
  imports: [CommonModule, FormsModule],
  templateUrl: './service-provider-create.component.html',
  styleUrls: ['./service-provider-create.component.css']
})
export class ServiceProviderCreateComponent implements OnInit {
  private readonly langService = inject(LanguageService);

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
  hasBranches = false;
  branches: CreateServiceProviderBranchDto[] = [];
  newBranch: CreateServiceProviderBranchDto = { name: '', cityId: undefined, imageUrl: '', address: '', phoneNumber: '', email: '', openingHours: '', order: 0 };
  branchImageUploading = false;
  selectedCategoryId: number | undefined = undefined;
  galleryImages: CreateGalleryImageDto[] = [];
  newGalleryImage = { imageUrl: '', caption: '' };
  socialLinks: SocialLinkDto[] = [];
  customerTestimonials: CreateServiceProviderTestimonialDto[] = [];
  newTestimonial = { clientName: '', text: '' };
  activeSocialPlatform: SocialPlatform | null = null;
  profileImageUploading = false;
  galleryUploadingCount = 0;
  galleryUploadProgress = 0;
  showVideoLinkInput = false;
  showTestimonialDraft = false;
  newVideoUrl = '';
  videoLinks: string[] = [];

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
  get socialPlatformOptions(): PlatformLinkOption[] {
    return [
      { platform: SocialPlatform.Instagram, label: 'Instagram', icon: 'photo_camera', placeholder: this.langService.translate('create.link_instagram') },
      { platform: SocialPlatform.Facebook, label: 'Facebook', icon: 'thumb_up', placeholder: this.langService.translate('create.link_facebook') },
      { platform: SocialPlatform.YouTube, label: 'YouTube', icon: 'smart_display', placeholder: this.langService.translate('create.link_youtube') },
      { platform: SocialPlatform.TikTok, label: 'TikTok', icon: 'music_note', placeholder: this.langService.translate('create.link_tiktok') },
      { platform: SocialPlatform.Twitter, label: 'Twitter / X', icon: 'alternate_email', placeholder: this.langService.translate('create.link_x') },
    ];
  }

  constructor(
    private serviceProviderService: MusicServiceProviderService,
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private systemTablesService: SystemTablesService,
    private citiesService: CitiesService,
    private route: ActivatedRoute,
    public router: Router,
    private host: ElementRef<HTMLElement>,
    private requiredFieldFeedback: RequiredFieldFeedbackService,
    private mediaService: MediaService
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
    if (!this.cityId) return this.langService.translate('common.select_city');
    const city = this.availableCities.find(c => c.id === this.cityId);
    return city ? city.name : this.langService.translate('common.select_city');
  }

  getCityName(cityId?: number): string {
    if (!cityId) return '';
    return this.availableCities.find(city => city.id === cityId)?.name ?? '';
  }

  getBranchSummaryLine(branch: CreateServiceProviderBranchDto): string {
    return [this.getCityName(branch.cityId), branch.address, branch.openingHours]
      .filter(Boolean)
      .join(' · ');
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
      return this.allowUncategorized ? this.langService.translate('service_create.general_service') : this.langService.translate('common.select_category');
    }
    const category = this.availableCategories.find(cat => cat.id === this.selectedCategoryId);
    return category ? category.name : this.langService.translate('common.select_category');
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

  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.profileImageUploading = true;
    this.mediaService.uploadMedia(file).subscribe({
      next: (result) => {
        this.profileImageUrl = result.url;
        this.profileImageUploading = false;
        input.value = '';
      },
      error: (error) => {
        console.error('Error uploading profile image:', error);
        this.error = this.langService.translate('common.error_profile_image');
        this.profileImageUploading = false;
        input.value = '';
      }
    });
  }

  onGalleryFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;

    let completedFiles = 0;
    const progressByFile = new Map<string, number>();
    this.galleryUploadingCount += files.length;
    this.galleryUploadProgress = 0;

    files.forEach((file, index) => {
      const fileKey = `${file.name}-${file.size}-${index}`;
      progressByFile.set(fileKey, 0);

      this.mediaService.uploadMediaWithProgress(file).subscribe({
        next: (event) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            progressByFile.set(fileKey, Math.round((event.loaded / event.total) * 100));
            this.galleryUploadProgress = Math.round(
              Array.from(progressByFile.values()).reduce((sum, value) => sum + value, 0) / files.length
            );
            return;
          }

          if (event.type !== HttpEventType.Response || !event.body?.url) return;

          this.galleryImages.push({
            imageUrl: event.body.url,
            caption: '',
            order: this.galleryImages.length
          });
          completedFiles++;
          progressByFile.set(fileKey, 100);
          this.galleryUploadingCount = Math.max(0, this.galleryUploadingCount - 1);
          this.galleryUploadProgress = Math.round((completedFiles / files.length) * 100);
          input.value = '';
        },
        error: (error) => {
          console.error('Error uploading gallery image:', error);
          this.error = this.langService.translate('common.error_gallery_file');
          completedFiles++;
          this.galleryUploadingCount = Math.max(0, this.galleryUploadingCount - 1);
          this.galleryUploadProgress = this.galleryUploadingCount ? this.galleryUploadProgress : 0;
          input.value = '';
        }
      });
    });
  }

  onBranchImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.branchImageUploading) return;

    this.branchImageUploading = true;
    this.mediaService.uploadMedia(file).subscribe({
      next: (result) => {
        this.newBranch.imageUrl = result.url;
        this.branchImageUploading = false;
        input.value = '';
      },
      error: (error) => {
        console.error('Error uploading branch image:', error);
        this.error = this.langService.translate('service_create.error_branch_image');
        this.branchImageUploading = false;
        input.value = '';
      }
    });
  }

  addBranch(): void {
    if (!this.newBranch.name?.trim()) {
      this.error = this.langService.translate('service_create.enter_branch_name');
      return;
    }

    this.branches.push({
      name: this.newBranch.name.trim(),
      cityId: this.newBranch.cityId,
      imageUrl: this.newBranch.imageUrl?.trim() || undefined,
      address: this.newBranch.address?.trim() || undefined,
      phoneNumber: this.newBranch.phoneNumber?.trim() || undefined,
      email: this.newBranch.email?.trim() || undefined,
      openingHours: this.newBranch.openingHours?.trim() || undefined,
      order: this.branches.length
    });
    this.newBranch = { name: '', cityId: undefined, imageUrl: '', address: '', phoneNumber: '', email: '', openingHours: '', order: 0 };
  }

  removeBranch(index: number): void {
    this.branches.splice(index, 1);
    this.branches.forEach((branch, order) => branch.order = order);
  }

  addVideoLink(): void {
    const url = this.newVideoUrl.trim();
    if (!url) return;

    if (!this.videoLinks.includes(url)) {
      this.videoLinks.push(url);
    }

    this.videoUrl = this.videoLinks[0] ?? '';
    this.newVideoUrl = '';
    this.showVideoLinkInput = true;
  }

  removeVideoLink(index: number): void {
    this.videoLinks.splice(index, 1);
    this.videoUrl = this.videoLinks[0] ?? '';
  }

  private normalizedVideoLinks(): string[] {
    return this.videoLinks
      .map(url => url.trim())
      .filter((url, index, links) => !!url && links.indexOf(url) === index);
  }

  // Gallery methods
  addGalleryImage() {
    if (!this.newGalleryImage.imageUrl.trim()) {
      alert(this.langService.translate('common.enter_image_url'));
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
    this.galleryImages.splice(index, 1);
    this.galleryImages.forEach((img, idx) => img.order = idx);
  }

  addTestimonial(): void {
    if (!this.newTestimonial.text.trim()) {
      alert(this.langService.translate('form.enter_testimonial'));
      return;
    }

    this.customerTestimonials.push({
      clientName: this.newTestimonial.clientName.trim() || undefined,
      text: this.newTestimonial.text.trim(),
      order: this.customerTestimonials.length
    });

    this.newTestimonial = { clientName: '', text: '' };
    this.showTestimonialDraft = false;
  }

  removeTestimonial(index: number): void {
    this.customerTestimonials.splice(index, 1);
    this.customerTestimonials.forEach((item, idx) => item.order = idx);
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

  selectSocialPlatform(platform: SocialPlatform): void {
    this.activeSocialPlatform = this.activeSocialPlatform === platform ? null : platform;
  }

  hasPlatformLink(platform: SocialPlatform): boolean {
    return !!this.getPlatformLink(platform).trim();
  }

  getActiveSocialPlaceholder(): string {
    return this.socialPlatformOptions.find(option => option.platform === this.activeSocialPlatform)?.placeholder ?? this.langService.translate('create.link_profile');
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
    const normalizedVideoLinks = this.normalizedVideoLinks();
    const videoGalleryItems = normalizedVideoLinks.map((url, index) => ({
      imageUrl: url,
      caption: this.langService.translate('shared.video_caption'),
      order: normalizedGalleryImages.length + index
    }));

    const dto: CreateMusicServiceProviderDto = {
      userId: currentUser?.id,
      displayName: this.displayName.trim(),
      shortBio: this.shortBio?.trim() || undefined,
      fullDescription: this.fullDescription?.trim() || undefined,
      isTeacher: false,
      cityId: this.cityId,
      location: this.hasBranches ? undefined : this.location?.trim() || undefined,
      phoneNumber: this.phoneNumber.trim(),
      whatsAppNumber: this.hasWhatsAppOnPhone ? this.phoneNumber.trim() : undefined,
      email: this.email.trim(),
      websiteUrl: this.websiteUrl?.trim() || undefined,
      bannerImageUrl: this.bannerImageUrl?.trim() || undefined,
      profileImageUrl: this.profileImageUrl?.trim() || undefined,
      videoUrl: normalizedVideoLinks[0] || this.videoUrl?.trim() || undefined,
      yearsOfExperience: this.yearsOfExperience,
      workingHours: this.hasBranches ? undefined : this.workingHours?.trim() || undefined,
      isFeatured: false,
      status: ProfileStatus.Pending,
      categories: this.selectedCategoryId ? [{
        categoryId: this.selectedCategoryId,
        subCategory: undefined
      } as CreateServiceProviderCategoryDto] : [],
      galleryImages: [...normalizedGalleryImages, ...videoGalleryItems],
      socialLinks: this.socialLinks
        .filter(link => link.url?.trim())
        .map(link => ({ ...link, url: link.url.trim() })),
      customerTestimonials: this.customerTestimonials,
      branches: this.hasBranches ? this.normalizedBranches() : []
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
        this.error = err.error?.message || this.langService.translate('service_create.error_save');
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
      this.error = this.langService.translate('common.enter_display_name');
      this.showRequiredStep(1, '#displayName');
      return false;
    }

    if (!this.email || !this.email.trim()) {
      this.error = this.langService.translate('common.enter_email');
      this.showRequiredStep(2, '#email');
      return false;
    }

    if (!this.phoneNumber || !this.phoneNumber.trim()) {
      this.error = this.langService.translate('common.enter_phone');
      this.showRequiredStep(2, '#phoneNumber');
      return false;
    }

    if (!this.selectedCategoryId && !this.allowUncategorized) {
      this.error = this.langService.translate('service_create.select_category_required');
      this.showRequiredStep(1, '[data-required-service-category]');
      return false;
    }

    if (this.hasBranches && this.branches.length === 0) {
      this.error = this.langService.translate('service_create.add_branch');
      this.showRequiredStep(2, '[data-required-branches]');
      return false;
    }

    return true;
  }

  private showRequiredStep(step: number, selector: string): void {
    this.currentStep = step;
    setTimeout(() => this.requiredFieldFeedback.showRequiredBySelector(this.host.nativeElement, selector));
  }

  private normalizedBranches(): CreateServiceProviderBranchDto[] {
    return this.branches
      .filter(branch => branch.name?.trim())
      .map((branch, index) => ({
        name: branch.name.trim(),
        cityId: branch.cityId,
        imageUrl: branch.imageUrl?.trim() || undefined,
        address: branch.address?.trim() || undefined,
        phoneNumber: branch.phoneNumber?.trim() || undefined,
        email: branch.email?.trim() || undefined,
        openingHours: branch.openingHours?.trim() || undefined,
        order: index
      }));
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

