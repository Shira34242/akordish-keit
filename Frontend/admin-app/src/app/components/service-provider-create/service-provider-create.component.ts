import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MusicServiceProviderService } from '../../services/music-service-provider.service';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService } from '../../services/subscription.service';
import { SystemTablesService, SystemItem } from '../../services/system-tables.service';
import { CitiesService, City } from '../../services/cities.service';
import {
  CreateMusicServiceProviderDto,
  ProfileStatus,
  CreateGalleryImageDto,
  CreateServiceProviderCategoryDto
} from '../../models/music-service-provider.model';
import {
  SubscriptionPlan,
  SubscriptionDto
} from '../../models/subscription.model';

interface Category {
  id: number;
  name: string;
}

@Component({
  selector: 'app-service-provider-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './service-provider-create.component.html',
  styleUrls: ['./service-provider-create.component.css']
})
export class ServiceProviderCreateComponent implements OnInit {
  subscription?: SubscriptionDto;
  isPremium = false;
  loading = true;
  saving = false;
  error = '';

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
  selectedCategoryId: number | undefined = undefined;
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

  constructor(
    private serviceProviderService: MusicServiceProviderService,
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private systemTablesService: SystemTablesService,
    private citiesService: CitiesService,
    public router: Router
  ) {}

  ngOnInit() {
    this.loadSubscriptionStatus();
    this.loadCategories();
    this.loadCities();
    this.prefillUserData();
  }

  loadSubscriptionStatus() {
    const user = this.authService.currentUserValue;
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    // בודקים אם יש מנוי קיים במערכת
    this.subscriptionService.getUserActiveSubscription(user.id).subscribe({
      next: (subscription) => {
        this.loading = false;

        // אם יש מנוי פעיל במערכת - משתמשים בו (עדיפות ראשונה)
        if (subscription) {
          this.subscription = subscription;
          this.isPremium = subscription.plan === SubscriptionPlan.Premium;

          // ניקוי localStorage - המנוי כבר קיים במערכת
          localStorage.removeItem('selectedSubscriptionPlan');
          localStorage.removeItem('selectedBillingCycle');
          localStorage.removeItem('pendingProfessionalType');

          console.log('User has active subscription:', subscription.plan);
        } else {
          // אין מנוי קיים - בודקים אם יש בחירה שמורה מתהליך ההרשמה
          const selectedPlan = localStorage.getItem('selectedSubscriptionPlan');
          const billingCycle = localStorage.getItem('selectedBillingCycle');

          if (selectedPlan) {
            console.log('Using localStorage subscription selection:', selectedPlan, billingCycle);
            this.isPremium = selectedPlan === SubscriptionPlan.Premium.toString();

            // כרגע המנוי לא קיים במערכת - יווצר בשליחת הטופס
          }
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Error loading subscription:', err);
        // אם יש שגיאה בטעינת המנוי, נבדוק localStorage
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
      },
      error: (error) => console.error('Error loading categories:', error)
    });
  }

  // City dropdown methods
  toggleCityDropdown() {
    this.cityDropdownOpen = !this.cityDropdownOpen;
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
    if (!this.cityId) return 'בחר עיר...';
    const city = this.availableCities.find(c => c.id === this.cityId);
    return city ? city.name : 'בחר עיר...';
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
    this.categoriesDropdownOpen = false;
  }

  // Gallery methods
  addGalleryImage() {
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

  removeGalleryImage(index: number) {
    if (confirm('האם למחוק תמונה זו מהגלריה?')) {
      this.galleryImages.splice(index, 1);
      this.galleryImages.forEach((img, idx) => img.order = idx);
    }
  }

  onSubmit() {
    if (!this.validateForm()) {
      return;
    }

    this.saving = true;
    this.error = '';

    const currentUser = this.authService.currentUserValue;

    const dto: CreateMusicServiceProviderDto = {
      userId: currentUser?.id,
      displayName: this.displayName,
      shortBio: this.shortBio,
      fullDescription: this.fullDescription,
      isTeacher: false,
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
      status: ProfileStatus.Pending,
      categories: this.selectedCategoryId ? [{
        categoryId: this.selectedCategoryId,
        subCategory: undefined
      } as CreateServiceProviderCategoryDto] : [],
      galleryImages: this.galleryImages
    };

    this.serviceProviderService.createServiceProviderProfile(dto).subscribe({
      next: (provider) => {
        this.saving = false;

        // ניקוי localStorage לאחר הצלחה
        localStorage.removeItem('selectedSubscriptionPlan');
        localStorage.removeItem('selectedBillingCycle');
        localStorage.removeItem('pendingProfessionalType');

        alert('פרופיל בעל המקצוע נשלח לאישור! נבדוק את פרטייך ונעדכן אותך בקרוב.');
        this.router.navigate(['/professionals', provider.id]);
      },
      error: (err) => {
        console.error('Error creating service provider profile:', err);
        this.error = err.error?.message || 'שגיאה ביצירת פרופיל בעל המקצוע';
        this.saving = false;

        // ניקוי localStorage גם במקרה של שגיאה
        localStorage.removeItem('selectedSubscriptionPlan');
        localStorage.removeItem('selectedBillingCycle');
        localStorage.removeItem('pendingProfessionalType');
      }
    });
  }

  validateForm(): boolean {
    if (!this.displayName.trim()) {
      this.error = 'נא להזין שם תצוגה';
      return false;
    }

    if (!this.email || !this.email.trim()) {
      this.error = 'נא להזין אימייל';
      return false;
    }

    if (!this.phoneNumber || !this.phoneNumber.trim()) {
      this.error = 'נא להזין טלפון';
      return false;
    }

    if (!this.selectedCategoryId) {
      this.error = 'נא לבחור קטגוריה';
      return false;
    }

    return true;
  }

  closeDropdowns(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) {
      this.cityDropdownOpen = false;
      this.categoriesDropdownOpen = false;
    }
  }
}
