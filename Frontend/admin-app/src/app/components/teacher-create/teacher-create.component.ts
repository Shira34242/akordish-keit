import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TeacherService } from '../../services/teacher.service';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService } from '../../services/subscription.service';
import { SystemTablesService, SystemItem } from '../../services/system-tables.service';
import { CitiesService, City } from '../../services/cities.service';
import {
  CreateTeacherDto,
  CreateTeacherInstrumentDto
} from '../../models/teacher.model';
import { ProfileStatus, CreateGalleryImageDto } from '../../models/music-service-provider.model';
import { TeachingLanguage, getTeachingLanguageOptions } from '../../models/teaching-language.enum';
import { TargetAudience, getTargetAudienceOptions } from '../../models/target-audience.enum';
import {
  SubscriptionPlan,
  SubscriptionDto
} from '../../models/subscription.model';

@Component({
  selector: 'app-teacher-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teacher-create.component.html',
  styleUrls: ['./teacher-create.component.css']
})
export class TeacherCreateComponent implements OnInit {
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

  // Available data
  availableInstruments: SystemItem[] = [];
  availableCities: City[] = [];
  cityId: number | undefined = undefined;

  // Options
  languageOptions = getTeachingLanguageOptions();
  audienceOptions = getTargetAudienceOptions();

  // UI state
  cityDropdownOpen = false;
  instrumentsDropdownOpen = false;
  languageDropdownOpen = false;
  audienceDropdownOpen = false;
  citySearchText = '';
  instrumentSearchText = '';
  filteredCities: City[] = [];
  filteredInstruments: SystemItem[] = [];

  constructor(
    private teacherService: TeacherService,
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private systemTablesService: SystemTablesService,
    private citiesService: CitiesService,
    public router: Router
  ) {}

  ngOnInit() {
    this.loadSubscriptionStatus();
    this.loadInstruments();
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

  loadInstruments() {
    this.systemTablesService.getItems('instruments', 1, 100).subscribe({
      next: (result) => {
        this.availableInstruments = result.items;
        this.filteredInstruments = this.availableInstruments;
      },
      error: (error) => console.error('Error loading instruments:', error)
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

  // Instruments dropdown methods
  toggleInstrumentsDropdown() {
    this.instrumentsDropdownOpen = !this.instrumentsDropdownOpen;
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
    if (names.length === 1) return names[0]!;
    if (names.length === 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }

  onInstrumentSearchChange() {
    if (!this.instrumentSearchText.trim()) {
      this.filteredInstruments = this.availableInstruments;
      return;
    }
    const search = this.instrumentSearchText.toLowerCase().trim();
    this.filteredInstruments = this.availableInstruments.filter(instrument =>
      instrument.name.toLowerCase().includes(search)
    );
  }

  toggleInstrument(instrumentId: number) {
    const index = this.selectedInstrumentIds.indexOf(instrumentId);
    if (index > -1) {
      this.selectedInstrumentIds.splice(index, 1);
    } else {
      this.selectedInstrumentIds.push(instrumentId);
    }
  }

  isInstrumentSelected(instrumentId: number): boolean {
    return this.selectedInstrumentIds.includes(instrumentId);
  }

  // Language dropdown methods
  toggleLanguageDropdown() {
    this.languageDropdownOpen = !this.languageDropdownOpen;
  }

  getSelectedLanguagesText(): string {
    if (this.selectedLanguages.length === 0) return 'בחר שפות...';
    const names = this.selectedLanguages
      .map(val => this.languageOptions.find(opt => opt.value === val)?.label)
      .filter(label => label);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }

  toggleLanguage(value: number) {
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
  toggleAudienceDropdown() {
    this.audienceDropdownOpen = !this.audienceDropdownOpen;
  }

  getSelectedAudiencesText(): string {
    if (this.selectedAudiences.length === 0) return 'בחר קהל יעד...';
    const names = this.selectedAudiences
      .map(val => this.audienceOptions.find(opt => opt.value === val)?.label)
      .filter(label => label);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
  }

  toggleAudience(value: number) {
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

  private arrayToFlags(selectedValues: number[]): number {
    if (!selectedValues || selectedValues.length === 0) return 0;
    return selectedValues.reduce((acc, val) => acc | val, 0);
  }

  onSubmit() {
    if (!this.validateForm()) {
      return;
    }

    this.saving = true;
    this.error = '';

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
      whatsAppNumber: this.whatsAppNumber,
      email: this.email,
      websiteUrl: this.websiteUrl?.trim() || undefined,
      profileImageUrl: this.profileImageUrl,
      videoUrl: this.videoUrl,
      yearsOfExperience: this.yearsOfExperience,
      workingHours: this.workingHours,
      isFeatured: false,
      status: ProfileStatus.Pending,
      priceList: this.priceList,
      languages: this.arrayToFlags(this.selectedLanguages),
      targetAudience: this.arrayToFlags(this.selectedAudiences),
      availability: this.availability,
      education: this.education,
      lessonTypes: this.lessonTypes,
      specializations: this.specializations,
      instruments: this.selectedInstrumentIds.map(id => ({
        instrumentId: id,
        isPrimary: false
      } as CreateTeacherInstrumentDto)),
      galleryImages: this.galleryImages
    };

    this.teacherService.createTeacherProfile(dto).subscribe({
      next: (teacher) => {
        this.saving = false;

        // ניקוי localStorage לאחר הצלחה
        localStorage.removeItem('selectedSubscriptionPlan');
        localStorage.removeItem('selectedBillingCycle');
        localStorage.removeItem('pendingProfessionalType');

        alert('פרופיל המורה נשלח לאישור! נבדוק את פרטייך ונעדכן אותך בקרוב.');
        this.router.navigate(['/teachers', teacher.id]);
      },
      error: (err) => {
        console.error('Error creating teacher profile:', err);
        this.error = err.error?.message || 'שגיאה ביצירת פרופיל המורה';
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

    if (this.selectedInstrumentIds.length === 0) {
      this.error = 'נא לבחור לפחות כלי נגינה אחד';
      return false;
    }

    return true;
  }

  closeDropdowns(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-dropdown')) {
      this.cityDropdownOpen = false;
      this.instrumentsDropdownOpen = false;
      this.languageDropdownOpen = false;
      this.audienceDropdownOpen = false;
    }
  }
}
