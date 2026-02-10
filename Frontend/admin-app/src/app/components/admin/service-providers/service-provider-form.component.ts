import { Component, OnInit, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';
import { SystemTablesService, SystemItem } from '../../../services/system-tables.service';
import { UserService } from '../../../services/user.service';
import { CitiesService, City } from '../../../services/cities.service';
import { CreateMusicServiceProviderDto, UpdateMusicServiceProviderDto, MusicServiceProviderDto, CreateServiceProviderCategoryDto, ProfileStatus, CreateGalleryImageDto } from '../../../models/music-service-provider.model';
import { UserListDto } from '../../../models/user.model';

@Component({
  selector: 'app-service-provider-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './service-provider-form.component.html',
  styleUrls: ['./service-provider-form.component.css']
})
export class ServiceProviderFormComponent implements OnInit {
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
  profileImageUrl: string = '';
  videoUrl: string = '';
  yearsOfExperience: number = 0;
  workingHours: string = '';
  isFeatured: boolean = false;
  isTeacher: boolean = false;
  status: ProfileStatus = ProfileStatus.Pending;
  selectedCategoryId: number | undefined = undefined; // Single category for professionals
  galleryImages: CreateGalleryImageDto[] = [];
  newGalleryImage = { imageUrl: '', caption: '' };

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

  ngOnInit(): void {
    this.loadCategories();
    this.loadCities();
    this.loadUsers();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.serviceProviderId = +id;
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
        this.profileImageUrl = provider.profileImageUrl || '';
        this.videoUrl = provider.videoUrl || '';
        this.yearsOfExperience = provider.yearsOfExperience || 0;
        this.workingHours = provider.workingHours || '';
        this.isFeatured = provider.isFeatured || false;
        this.status = provider.status;
        this.selectedCategoryId = provider.categories?.[0]?.categoryId; // Get first category
        this.galleryImages = provider.galleryImages?.map(img => ({
          imageUrl: img.imageUrl,
          caption: img.caption,
          order: img.order
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
        profileImageUrl: this.profileImageUrl?.trim() || undefined,
        videoUrl: this.videoUrl?.trim() || undefined,
        yearsOfExperience: this.yearsOfExperience || undefined,
        workingHours: this.workingHours || undefined,
        isFeatured: this.isFeatured,
        status: this.status,
        categories: this.selectedCategoryId ? [{ categoryId: this.selectedCategoryId } as CreateServiceProviderCategoryDto] : [],
        galleryImages: this.galleryImages
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
        profileImageUrl: this.profileImageUrl?.trim() || undefined,
        videoUrl: this.videoUrl?.trim() || undefined,
        yearsOfExperience: this.yearsOfExperience || undefined,
        workingHours: this.workingHours || undefined,
        isFeatured: this.isFeatured,
        status: this.status,
        categories: this.selectedCategoryId ? [{ categoryId: this.selectedCategoryId } as CreateServiceProviderCategoryDto] : [],
        galleryImages: this.galleryImages
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
      alert('נא לבחור קטגוריה');
      return false;
    }

    return true;
  }

  selectCategory(categoryId: number): void {
    this.selectedCategoryId = categoryId;
    this.categoryDropdownOpen = false;
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
    this.categoryDropdownOpen = !this.categoryDropdownOpen;
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
      this.cityDropdownOpen = false;
      this.categoryDropdownOpen = false;
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/service-providers']);
  }
}
