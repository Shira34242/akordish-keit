import { Component, EventEmitter, inject, OnDestroy, OnInit, Output, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MusicServiceProviderService } from '../../../services/music-service-provider.service';
import { SystemTablesService, SystemItem } from '../../../services/system-tables.service';
import { CitiesService, City } from '../../../services/cities.service';
import { CreateMusicServiceProviderDto, ProfileStatus, CreateGalleryImageDto, CreateServiceProviderCategoryDto } from '../../../models/music-service-provider.model';
import { AuthService } from '../../../services/auth.service';

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
  videoUrl: string = '';
  yearsOfExperience: number = 0;
  workingHours: string = '';
  selectedCategoryId: number | undefined = undefined; // Single category for professionals
  galleryImages: CreateGalleryImageDto[] = [];
  newGalleryImage = { imageUrl: '', caption: '' };

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
        this.availableCategories = result.items;
        this.filteredCategories = this.availableCategories;
      },
      error: (error: any) => console.error('Error loading categories:', error)
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

  // Categories dropdown methods
  toggleCategoriesDropdown(): void {
    this.categoriesDropdownOpen = !this.categoriesDropdownOpen;
    if (this.categoriesDropdownOpen) {
      this.categorySearchText = '';
      this.filteredCategories = this.availableCategories;
    }
  }

  getSelectedCategoryText(): string {
    if (!this.selectedCategoryId) {
      return 'בחר קטגוריה...';
    }
    const category = this.availableCategories.find(cat => cat.id === this.selectedCategoryId);
    return category ? category.name : 'בחר קטגוריה...';
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
    if (!this.selectedCategoryId) {
      alert('נא לבחור קטגוריה');
      return false;
    }
    return true;
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
      whatsAppNumber: this.whatsAppNumber,
      email: this.email,
      websiteUrl: this.websiteUrl?.trim() || undefined,
      profileImageUrl: this.profileImageUrl,
      videoUrl: this.videoUrl,
      yearsOfExperience: this.yearsOfExperience,
      workingHours: this.workingHours,
      isFeatured: false,
      status: ProfileStatus.Pending, // Always pending for public registration
      categories: this.selectedCategoryId ? [{
        categoryId: this.selectedCategoryId,
        subCategory: undefined
      } as CreateServiceProviderCategoryDto] : [],
      galleryImages: this.galleryImages
    };

    this.professionalService.createServiceProvider(dto).subscribe({
      next: () => {
        this.saving = false;
        alert('הבקשה נשלחה בהצלחה! נבדוק את פרטייך ונעדכן אותך בקרוב.');
        this.success.emit();
        this.onClose();
      },
      error: (error: any) => {
        console.error('Error creating professional:', error);
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
      this.categoriesDropdownOpen = false;
    }
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }
}
