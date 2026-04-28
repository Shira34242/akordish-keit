import { Component, ElementRef, OnInit, inject, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { FileUploadInputComponent } from '../../shared/file-upload-input/file-upload-input.component';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';
import { SystemTablesService, SystemItem } from '../../../services/system-tables.service';
import { UserService } from '../../../services/user.service';
import { CitiesService, City } from '../../../services/cities.service';
import {
  CreateMusicServiceProviderDto,
  UpdateMusicServiceProviderDto,
  MusicServiceProviderDto,
  CreateServiceProviderCategoryDto,
  ProfileStatus,
  ServiceProviderParkingType,
  CreateGalleryImageDto,
  SocialLinkDto,
  SocialPlatform,
  CreateServiceProviderTestimonialDto,
  CreateServiceProviderBranchDto
} from '../../../models/music-service-provider.model';
import { UserListDto } from '../../../models/user.model';
import { SiteAlertService } from '../../../services/site-alert.service';
import { RequiredFieldFeedbackService } from '../../../services/required-field-feedback.service';


interface PlatformLinkOption {
  platform: SocialPlatform;
  label: string;
  icon: string;
  placeholder: string;
}

@Component({
  selector: 'app-service-provider-form',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadInputComponent],
  templateUrl: './service-provider-form.component.html',
  styleUrls: ['./service-provider-form.component.css']
})
export class ServiceProviderFormComponent implements OnInit {
  private readonly siteAlerts = inject(SiteAlertService);
  private readonly requiredFieldFeedback = inject(RequiredFieldFeedbackService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  @Input() embedded = false;
  @Input() serviceProviderIdInput?: number;
  @Output() close = new EventEmitter<void>();

  private readonly serviceProviderService = inject(MusicServiceProviderService);
  private readonly systemTablesService = inject(SystemTablesService);
  private readonly userService = inject(UserService);
  private readonly citiesService = inject(CitiesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  isEditMode = false;
  serviceProviderId?: number;
  loading = false;
  saving = false;

  // Separate properties for create/update mode
  userId: number | undefined = undefined;
  userName: string | undefined = undefined;
  userEmail: string | undefined = undefined;
  displayName: string = '';
  shortBio: string = '';
  fullDescription: string = '';
  cityId: number | undefined = undefined;
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
  parkingType: ServiceProviderParkingType = ServiceProviderParkingType.None;
  hasAccessibleEntrance: boolean = false;
  isAnash: boolean = false;
  isFeatured: boolean = false;
  isTeacher: boolean = false;
  status: ProfileStatus = ProfileStatus.Pending;
  selectedCategoryId: number | undefined = undefined; // Single category for professionals
  galleryImages: CreateGalleryImageDto[] = [];
  newGalleryImage = { imageUrl: '', caption: '' };
  socialLinks: SocialLinkDto[] = [];
  customerTestimonials: CreateServiceProviderTestimonialDto[] = [];
  newTestimonial = { clientName: '', text: '' };
  branches: CreateServiceProviderBranchDto[] = [];
  newBranch: CreateServiceProviderBranchDto = { name: '', address: '', phoneNumber: '', email: '', openingHours: '', order: 0 };

  // Available categories, cities, and users loaded from API
  availableCategories: SystemItem[] = [];
  availableCities: City[] = [];
  availableUsers: UserListDto[] = [];
  loadingUsers = false;

  // UI state for dropdowns
  cityDropdownOpen = false;
  citySearchText = '';
  filteredCities: City[] = [];

  categoryDropdownOpen = false;
  categorySearchText = '';
  filteredCategories: SystemItem[] = [];
  readonly socialPlatformOptions: PlatformLinkOption[] = [
    { platform: SocialPlatform.Instagram, label: 'Instagram', icon: 'photo_camera', placeholder: 'קישור לאינסטגרם' },
    { platform: SocialPlatform.Facebook, label: 'Facebook', icon: 'thumb_up', placeholder: 'קישור לפייסבוק' },
    { platform: SocialPlatform.YouTube, label: 'YouTube', icon: 'smart_display', placeholder: 'קישור ליוטיוב' },
    { platform: SocialPlatform.TikTok, label: 'TikTok', icon: 'music_note', placeholder: 'קישור לטיקטוק' },
    { platform: SocialPlatform.Twitter, label: 'Twitter / X', icon: 'alternate_email', placeholder: 'קישור ל-X / Twitter' }
  ];
  readonly ServiceProviderParkingType = ServiceProviderParkingType;

  ngOnInit(): void {
    this.loadCategories();
    this.loadCities();
    this.loadUsers();
    const inputId = this.serviceProviderIdInput;
    const routeId = this.route.snapshot.paramMap.get('id');
    const resolvedId = inputId ?? (routeId ? +routeId : undefined);

    if (resolvedId) {
      this.isEditMode = true;
      this.serviceProviderId = resolvedId;
      this.loadServiceProvider();
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

  loadCategories(): void {
    this.systemTablesService.getItems('music-service-provider-categories', 1, 100).subscribe({
      next: (result) => {
        this.availableCategories = result.items.filter((item: any) => item.isActive);
        this.filteredCategories = this.availableCategories;
      },
      error: (error: any) => {
        console.error('Error loading categories:', error);
        alert('שגיאה בטעינת קטגוריות');
      }
    });
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

  loadServiceProvider(): void {
    if (!this.serviceProviderId) return;

    this.loading = true;
    this.serviceProviderService.getServiceProviderById(this.serviceProviderId).subscribe({
      next: (provider: MusicServiceProviderDto) => {
        this.userId = provider.userId;
        this.userName = provider.userName;
        this.userEmail = provider.userEmail;
        this.displayName = provider.displayName;
        this.shortBio = provider.shortBio || '';
        this.fullDescription = provider.fullDescription || '';
        this.cityId = provider.cityId;
        this.location = provider.location || '';
        this.phoneNumber = provider.phoneNumber || '';
        this.whatsAppNumber = provider.whatsAppNumber || '';
        this.email = provider.email || '';
        this.websiteUrl = provider.websiteUrl || '';
        this.bannerImageUrl = provider.bannerImageUrl || '';
        this.profileImageUrl = provider.profileImageUrl || '';
        this.videoUrl = provider.videoUrl || '';
        this.yearsOfExperience = provider.yearsOfExperience || 0;
        this.workingHours = provider.workingHours || '';
        this.parkingType = provider.parkingType ?? ServiceProviderParkingType.None;
        this.hasAccessibleEntrance = provider.hasAccessibleEntrance || false;
        this.isAnash = provider.isAnash || false;
        this.isFeatured = provider.isFeatured || false;
        this.status = provider.status;
        this.selectedCategoryId = provider.categories?.[0]?.categoryId; // Get first category
        this.galleryImages = provider.galleryImages?.map(img => ({
          imageUrl: img.imageUrl,
          caption: img.caption,
          order: img.order
        })) || [];
        this.socialLinks = provider.socialLinks || [];
        this.customerTestimonials = provider.customerTestimonials?.map(item => ({
          clientName: item.clientName,
          text: item.text,
          order: item.order
        })) || [];
        this.branches = provider.branches?.map(b => ({
          name: b.name,
          address: b.address,
          phoneNumber: b.phoneNumber,
          email: b.email,
          openingHours: b.openingHours,
          order: b.order
        })) || [];
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading service provider:', error);
        alert('שגיאה בטעינת בעל המקצוע');
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

    if (this.isEditMode && this.serviceProviderId) {
      const dto: UpdateMusicServiceProviderDto = {
        displayName: this.displayName,
        shortBio: this.shortBio || undefined,
        fullDescription: this.fullDescription || undefined,
        cityId: this.cityId,
        location: this.location || undefined,
        phoneNumber: this.phoneNumber,
        whatsAppNumber: this.whatsAppNumber || undefined,
        email: this.email,
        websiteUrl: this.websiteUrl?.trim() || undefined,
        bannerImageUrl: this.bannerImageUrl?.trim() || undefined,
        profileImageUrl: this.profileImageUrl?.trim() || undefined,
        videoUrl: this.videoUrl?.trim() || undefined,
        yearsOfExperience: this.yearsOfExperience || undefined,
        workingHours: this.workingHours || undefined,
        parkingType: this.parkingType,
        hasAccessibleEntrance: this.hasAccessibleEntrance,
        isAnash: this.isAnash,
        isFeatured: this.isFeatured,
        status: this.status,
        categories: this.selectedCategoryId ? [{ categoryId: this.selectedCategoryId } as CreateServiceProviderCategoryDto] : [],
        galleryImages: this.galleryImages,
        socialLinks: this.socialLinks.filter(link => link.url?.trim()),
        customerTestimonials: this.customerTestimonials,
        branches: this.branches
      };

      this.serviceProviderService.updateServiceProvider(this.serviceProviderId, dto).subscribe({
        next: () => {
          this.saving = false;
          this.goBack();
        },
        error: (error: any) => {
          console.error('Error updating service provider:', error);
          let errorMessage = 'שגיאה בעדכון בעל המקצוע';

          // Check for specific error message from server
          if (error.message) {
            errorMessage = error.message;
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.error?.errors) {
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
      const dto: CreateMusicServiceProviderDto = {
        userId: this.userId,
        displayName: this.displayName,
        shortBio: this.shortBio || undefined,
        fullDescription: this.fullDescription || undefined,
        isTeacher: false, // Always false for professionals
        cityId: this.cityId,
        location: this.location || undefined,
        phoneNumber: this.phoneNumber,
        whatsAppNumber: this.whatsAppNumber || undefined,
        email: this.email,
        websiteUrl: this.websiteUrl?.trim() || undefined,
        bannerImageUrl: this.bannerImageUrl?.trim() || undefined,
        profileImageUrl: this.profileImageUrl?.trim() || undefined,
        videoUrl: this.videoUrl?.trim() || undefined,
        yearsOfExperience: this.yearsOfExperience || undefined,
        workingHours: this.workingHours || undefined,
        parkingType: this.parkingType,
        hasAccessibleEntrance: this.hasAccessibleEntrance,
        isAnash: this.isAnash,
        isFeatured: this.isFeatured,
        status: this.status,
        categories: this.selectedCategoryId ? [{ categoryId: this.selectedCategoryId } as CreateServiceProviderCategoryDto] : [],
        galleryImages: this.galleryImages,
        socialLinks: this.socialLinks.filter(link => link.url?.trim()),
        customerTestimonials: this.customerTestimonials,
        branches: this.branches
      };

      this.serviceProviderService.createServiceProvider(dto).subscribe({
        next: () => {
          this.saving = false;
          this.goBack();
        },
        error: (error: any) => {
          console.error('Error creating service provider:', error);
          let errorMessage = 'שגיאה ביצירת בעל המקצוע';

          // Check for specific error message from server
          if (error.message) {
            errorMessage = error.message;
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.error?.errors) {
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

    if (!this.selectedCategoryId) {
      this.requiredFieldFeedback.showRequiredBySelector(this.host.nativeElement, '[data-required-admin-category]');
      return false;
    }

    return true;
  }

  selectCategory(categoryId: number): void {
    this.selectedCategoryId = categoryId;
    this.categoryDropdownOpen = false;
    this.requiredFieldFeedback.clearFeedback(this.host.nativeElement.querySelector('[data-required-admin-category]'));
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

  getSelectedCityName(): string | null {
    if (!this.cityId) return null;
    const city = this.availableCities.find(c => c.id === this.cityId);
    return city ? city.name : null;
  }

  onCitySearchChange(): void {
    const searchLower = this.citySearchText.toLowerCase();
    this.filteredCities = this.availableCities.filter(city =>
      city.name.toLowerCase().includes(searchLower) ||
      (city.englishName && city.englishName.toLowerCase().includes(searchLower))
    );
  }

  // Category dropdown methods
  toggleCategoryDropdown(): void {
    const nextState = !this.categoryDropdownOpen;
    this.closeAllDropdowns();
    this.categoryDropdownOpen = nextState;
    if (this.categoryDropdownOpen) {
      this.categorySearchText = '';
      this.filteredCategories = this.availableCategories;
    }
  }

  onCategorySearchChange(): void {
    const searchLower = this.categorySearchText.toLowerCase();
    this.filteredCategories = this.availableCategories.filter(cat =>
      cat.name.toLowerCase().includes(searchLower)
    );
  }

  getSelectedCategoryText(): string {
    if (!this.selectedCategoryId) {
      return 'בחר קטגוריה...';
    }
    const category = this.availableCategories.find(cat => cat.id === this.selectedCategoryId);
    return category ? category.name : 'בחר קטגוריה...';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) {
      this.closeAllDropdowns();
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

  async removeTestimonial(index: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם למחוק את ההמלצה הזו?')) {
      this.customerTestimonials.splice(index, 1);
      this.customerTestimonials.forEach((item, idx) => item.order = idx);
    }
  }

  addBranch(): void {
    if (!this.newBranch.name.trim()) {
      alert('נא להזין שם סניף');
      return;
    }
    this.branches.push({
      name: this.newBranch.name.trim(),
      address: this.newBranch.address?.trim() || undefined,
      phoneNumber: this.newBranch.phoneNumber?.trim() || undefined,
      email: this.newBranch.email?.trim() || undefined,
      openingHours: this.newBranch.openingHours?.trim() || undefined,
      order: this.branches.length
    });
    this.newBranch = { name: '', address: '', phoneNumber: '', email: '', openingHours: '', order: 0 };
  }

  async removeBranch(index: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם למחוק את הסניף הזה?')) {
      this.branches.splice(index, 1);
      this.branches.forEach((b, idx) => b.order = idx);
    }
  }

  private closeAllDropdowns(): void {
    this.cityDropdownOpen = false;
    this.categoryDropdownOpen = false;
  }

  goBack(): void {
    if (this.embedded) {
      this.close.emit();
      return;
    }

    this.router.navigate(['/admin/users/service-providers']);
  }
}
