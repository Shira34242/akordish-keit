import { Component, ElementRef, OnInit, inject, HostListener, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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
import { getSocialPlatformIconSvg, normalizeSocialPlatform } from '../../../utils/social-platform-icons';


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
  private readonly sanitizer = inject(DomSanitizer);
  @Input() embedded = false;
  @Input() serviceProviderIdInput?: number;
  @Input() userIdInput?: number;
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
  newBranch: CreateServiceProviderBranchDto = { name: '', cityId: undefined, imageUrl: '', address: '', phoneNumber: '', email: '', openingHours: '', order: 0 };
  editingBranchIndex: number | null = null;

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
    { platform: SocialPlatform.Instagram, label: 'Instagram', icon: 'instagram', placeholder: 'קישור לאינסטגרם' },
    { platform: SocialPlatform.Facebook, label: 'Facebook', icon: 'facebook', placeholder: 'קישור לפייסבוק' },
    { platform: SocialPlatform.YouTube, label: 'YouTube', icon: 'youtube', placeholder: 'קישור ליוטיוב' },
    { platform: SocialPlatform.TikTok, label: 'TikTok', icon: 'tiktok', placeholder: 'קישור לטיקטוק' },
    { platform: SocialPlatform.Twitter, label: 'Twitter / X', icon: 'x', placeholder: 'קישור ל-X / Twitter' },
    { platform: SocialPlatform.Spotify, label: 'Spotify', icon: 'spotify', placeholder: 'קישור לספוטיפיי' },
    { platform: SocialPlatform.Website, label: 'Website', icon: 'website', placeholder: 'קישור נוסף' }
  ];
  readonly ServiceProviderParkingType = ServiceProviderParkingType;

  get isPublished(): boolean {
    return this.status === ProfileStatus.Active;
  }

  setPublished(isPublished: boolean): void {
    this.status = isPublished ? ProfileStatus.Active : ProfileStatus.Pending;
  }

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
      // Check for userId input/query params (upgrade from user)
      const userIdParam = this.route.snapshot.queryParamMap.get('userId');
      const resolvedUserId = this.userIdInput ?? (userIdParam ? +userIdParam : undefined);
      if (resolvedUserId) {
        this.userId = resolvedUserId;
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
        this.availableCategories = result.items.filter((item: any) => item.isActive && Number(item.quickCategoryType ?? 0) !== 1);
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
        this.syncSelectedUserFromList();
        this.loadingUsers = false;
      },
      error: (error: any) => {
        console.error('Error loading users:', error);
        this.loadingUsers = false;
      }
    });
  }

  private syncSelectedUserFromList(): void {
    if (!this.userId || this.userName) return;
    const selectedUser = this.availableUsers.find(user => user.id === this.userId);
    if (!selectedUser) return;

    this.userName = selectedUser.username;
    this.userEmail = selectedUser.email;
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
        this.socialLinks = this.normalizeSocialLinks(provider.socialLinks);
        this.customerTestimonials = provider.customerTestimonials?.map(item => ({
          clientName: item.clientName,
          text: item.text,
          order: item.order
        })) || [];
        this.branches = provider.branches?.map(b => ({
          name: b.name,
          cityId: b.cityId,
          imageUrl: b.imageUrl,
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
      parkingType: this.parkingType,
      hasAccessibleEntrance: this.hasAccessibleEntrance,
      isAnash: this.isAnash,
      isFeatured: this.isFeatured,
      status: this.status,
      categories: this.selectedCategoryId ? [{ categoryId: this.selectedCategoryId } as CreateServiceProviderCategoryDto] : [],
      galleryImages: this.normalizedGalleryImages(),
      socialLinks: this.normalizedSocialLinks(),
      customerTestimonials: this.normalizedTestimonials(),
      branches: this.normalizedBranches()
    };

    if (this.isEditMode && this.serviceProviderId) {
      const dto: UpdateMusicServiceProviderDto = {
        ...commonPayload
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
        ...commonPayload,
        userId: this.userId,
        isTeacher: false, // Always false for professionals
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
      this.categoryDropdownOpen = true;
      this.categorySearchText = '';
      this.filteredCategories = this.availableCategories;
      setTimeout(() => {
        this.requiredFieldFeedback.showRequiredBySelector(this.host.nativeElement, '[data-required-admin-category]');
      });
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

  getSelectedCityName(): string | null {
    if (!this.cityId) return null;
    const city = this.availableCities.find(c => c.id === this.cityId);
    return city ? city.name : null;
  }

  getCityName(cityId?: number): string {
    if (!cityId) return '';
    return this.availableCities.find(city => city.id === cityId)?.name ?? '';
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
    return this.socialLinks.find(link => normalizeSocialPlatform(link.platform) === platform)?.url ?? '';
  }

  setPlatformLink(platform: SocialPlatform, url: string): void {
    const normalizedUrl = url.trim();
    const existingLink = this.socialLinks.find(link => normalizeSocialPlatform(link.platform) === platform);

    if (!normalizedUrl) {
      this.socialLinks = this.socialLinks.filter(link => normalizeSocialPlatform(link.platform) !== platform);
      return;
    }

    if (existingLink) {
      existingLink.url = normalizedUrl;
      existingLink.platform = platform;
      return;
    }

    this.socialLinks = [...this.socialLinks, { platform, url: normalizedUrl }];
  }

  trackByPlatform(_index: number, option: PlatformLinkOption): number {
    return option.platform;
  }

  getSocialIconSvg(platform: SocialPlatform): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(getSocialPlatformIconSvg(platform));
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
    const branch: CreateServiceProviderBranchDto = {
      name: this.newBranch.name.trim(),
      cityId: this.newBranch.cityId,
      imageUrl: this.newBranch.imageUrl?.trim() || undefined,
      address: this.newBranch.address?.trim() || undefined,
      phoneNumber: this.newBranch.phoneNumber?.trim() || undefined,
      email: this.newBranch.email?.trim() || undefined,
      openingHours: this.newBranch.openingHours?.trim() || undefined,
      order: this.editingBranchIndex ?? this.branches.length
    };

    if (this.editingBranchIndex !== null) {
      this.branches[this.editingBranchIndex] = branch;
      this.branches.forEach((b, idx) => b.order = idx);
    } else {
      this.branches.push(branch);
    }

    this.resetBranchDraft();
  }

  async removeBranch(index: number): Promise<void> {
    if (await this.siteAlerts.confirm('האם למחוק את הסניף הזה?')) {
      this.branches.splice(index, 1);
      this.branches.forEach((b, idx) => b.order = idx);
      if (this.editingBranchIndex === index) {
        this.resetBranchDraft();
      } else if (this.editingBranchIndex !== null && this.editingBranchIndex > index) {
        this.editingBranchIndex--;
      }
    }
  }

  editBranch(index: number): void {
    const branch = this.branches[index];
    if (!branch) return;

    this.editingBranchIndex = index;
    this.newBranch = {
      name: branch.name || '',
      cityId: branch.cityId,
      imageUrl: branch.imageUrl || '',
      address: branch.address || '',
      phoneNumber: branch.phoneNumber || '',
      email: branch.email || '',
      openingHours: branch.openingHours || '',
      order: branch.order ?? index
    };
  }

  cancelBranchEdit(): void {
    this.resetBranchDraft();
  }

  private resetBranchDraft(): void {
    this.editingBranchIndex = null;
    this.newBranch = { name: '', cityId: undefined, imageUrl: '', address: '', phoneNumber: '', email: '', openingHours: '', order: 0 };
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

  private normalizedSocialLinks(): SocialLinkDto[] {
    return this.socialLinks
      .filter(link => link.url?.trim())
      .map(link => ({
        id: link.id,
        platform: normalizeSocialPlatform(link.platform),
        url: link.url.trim()
      }));
  }

  private normalizeSocialLinks(links: SocialLinkDto[] | undefined): SocialLinkDto[] {
    return (links ?? [])
      .filter(link => !!link?.url?.trim())
      .map(link => ({
        ...link,
        platform: normalizeSocialPlatform(link.platform),
        url: link.url.trim()
      }));
  }

  private normalizedTestimonials(): CreateServiceProviderTestimonialDto[] {
    return this.customerTestimonials
      .filter(item => item.text?.trim())
      .map((item, index) => ({
        clientName: this.optionalText(item.clientName),
        text: item.text.trim(),
        order: index
      }));
  }

  private normalizedBranches(): CreateServiceProviderBranchDto[] {
    return this.branches
      .filter(branch => branch.name?.trim())
      .map((branch, index) => ({
        name: branch.name.trim(),
        cityId: branch.cityId,
        imageUrl: this.optionalText(branch.imageUrl),
        address: this.optionalText(branch.address),
        phoneNumber: this.optionalText(branch.phoneNumber),
        email: this.optionalText(branch.email),
        openingHours: this.optionalText(branch.openingHours),
        order: index
      }));
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
