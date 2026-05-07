import { Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpEventType } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TeacherService } from '../../services/teacher.service';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService } from '../../services/subscription.service';
import { SystemTablesService, SystemItem } from '../../services/system-tables.service';
import { CitiesService, City } from '../../services/cities.service';
import { RequiredFieldFeedbackService } from '../../services/required-field-feedback.service';
import { MediaService } from '../../services/admin/media.service';
import {
  CreateTeacherDto,
  CreateTeacherInstrumentDto,
  CreateTeacherTestimonialDto
} from '../../models/teacher.model';
import { ProfileStatus, CreateGalleryImageDto, SocialLinkDto, SocialPlatform } from '../../models/music-service-provider.model';
import { TeachingLanguage, getTeachingLanguageOptions } from '../../models/teaching-language.enum';
import { TargetAudience, getTargetAudienceOptions } from '../../models/target-audience.enum';
import {
  SubscriptionPlan,
  SubscriptionDto
} from '../../models/subscription.model';

interface PlatformLinkOption {
  platform: SocialPlatform;
  label: string;
  icon: string;
  placeholder: string;
}

@Component({
  selector: 'app-teacher-create',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teacher-create.component.html',
  styleUrls: ['./teacher-create.component.css']
})
export class TeacherCreateComponent implements OnInit {
  @Input() embedded = false;
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
  profileImageUploading = false;
  galleryUploadingCount = 0;
  galleryUploadProgress = 0;
  showVideoLinkInput = false;
  showTestimonialDraft = false;
  newVideoUrl = '';
  videoLinks: string[] = [];

  // Available data
  availableInstruments: SystemItem[] = [];
  availableCities: City[] = [];
  cityId: number | undefined = undefined;

  // Options
  languageOptions = getTeachingLanguageOptions();
  audienceOptions = getTargetAudienceOptions();
  readonly socialPlatformOptions: PlatformLinkOption[] = [
    { platform: SocialPlatform.Instagram, label: 'Instagram', icon: 'photo_camera', placeholder: 'הדבק קישור לאינסטגרם' },
    { platform: SocialPlatform.Facebook, label: 'Facebook', icon: 'thumb_up', placeholder: 'הדבק קישור לפייסבוק' },
    { platform: SocialPlatform.YouTube, label: 'YouTube', icon: 'smart_display', placeholder: 'הדבק קישור ליוטיוב' },
    { platform: SocialPlatform.TikTok, label: 'TikTok', icon: 'music_note', placeholder: 'הדבק קישור לטיקטוק' },
    { platform: SocialPlatform.Twitter, label: 'Twitter / X', icon: 'alternate_email', placeholder: 'הדבק קישור ל-X / Twitter' },
    { platform: SocialPlatform.Spotify, label: 'Spotify', icon: 'album', placeholder: 'הדבק קישור לספוטיפיי' },
    { platform: SocialPlatform.Zing, label: 'Zing', icon: 'library_music', placeholder: 'הדבק קישור לזינג' }
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

  constructor(
    private teacherService: TeacherService,
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private systemTablesService: SystemTablesService,
    private citiesService: CitiesService,
    public router: Router,
    private host: ElementRef<HTMLElement>,
    private requiredFieldFeedback: RequiredFieldFeedbackService,
    private mediaService: MediaService
  ) {}

  ngOnInit() {
    this.loadSubscriptionStatus();
    this.loadInstruments();
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

  // Instruments dropdown methods
  toggleInstrumentsDropdown() {
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
      return '\u05d1\u05d7\u05e8 \u05db\u05dc\u05d9 \u05e0\u05d2\u05d9\u05e0\u05d4...';
    }
    const names = this.selectedInstrumentIds
      .map(id => this.availableInstruments.find(inst => inst.id === id)?.name)
      .filter(name => name);
    if (names.length === 1) return names[0] ?? '';
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
    if (this.selectedInstrumentIds.length > 0) {
      this.requiredFieldFeedback.clearFeedback(this.host.nativeElement.querySelector('.instrument-picker'));
    }
  }

  isInstrumentSelected(instrumentId: number): boolean {
    return this.selectedInstrumentIds.includes(instrumentId);
  }

  getInstrumentImage(instrument: SystemItem): string {
    const possibleImage = [
      instrument['imageUrl'],
      instrument['iconUrl'],
      instrument['thumbnailUrl'],
      instrument['pictureUrl'],
      instrument['image'],
      instrument['icon']
    ].find(value => typeof value === 'string' && value.trim().length > 0);

    return typeof possibleImage === 'string' ? possibleImage.trim() : '';
  }

  // Language dropdown methods
  toggleLanguageDropdown() {
    const nextState = !this.languageDropdownOpen;
    this.closeAllDropdowns();
    this.languageDropdownOpen = nextState;
  }

  getSelectedLanguagesText(): string {
    if (this.selectedLanguages.length === 0) return '\u05d1\u05d7\u05e8 \u05e9\u05e4\u05d4...';
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
    const nextState = !this.audienceDropdownOpen;
    this.closeAllDropdowns();
    this.audienceDropdownOpen = nextState;
  }

  getSelectedAudiencesText(): string {
    if (this.selectedAudiences.length === 0) return '\u05d1\u05d7\u05e8 \u05e7\u05d4\u05dc \u05d9\u05e2\u05d3...';
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
        this.error = 'שגיאה בהעלאת תמונת הפרופיל';
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
          this.error = 'שגיאה בהעלאת קובץ לגלריה';
          completedFiles++;
          this.galleryUploadingCount = Math.max(0, this.galleryUploadingCount - 1);
          this.galleryUploadProgress = this.galleryUploadingCount ? this.galleryUploadProgress : 0;
          input.value = '';
        }
      });
    });
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
    this.galleryImages.splice(index, 1);
    this.galleryImages.forEach((img, idx) => img.order = idx);
  }

  addTestimonial(): void {
    if (!this.newTestimonial.text.trim()) {
      alert('נא להזין טקסט המלצה');
      return;
    }

    this.testimonials.push({
      studentName: this.newTestimonial.studentName.trim() || undefined,
      text: this.newTestimonial.text.trim(),
      order: this.testimonials.length
    });

    this.newTestimonial = { studentName: '', text: '' };
    this.showTestimonialDraft = false;
  }

  removeTestimonial(index: number): void {
    this.testimonials.splice(index, 1);
    this.testimonials.forEach((item, idx) => item.order = idx);
  }

  addSocialLink() {
    this.socialLinks.push({ platform: SocialPlatform.Instagram, url: '' });
  }

  removeSocialLink(index: number) {
    this.socialLinks.splice(index, 1);
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
    return this.socialPlatformOptions.find(option => option.platform === this.activeSocialPlatform)?.placeholder ?? 'הדבק קישור לפרופיל';
  }

  trackByPlatform(_index: number, option: PlatformLinkOption): number {
    return option.platform;
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
      caption: 'וידאו',
      order: normalizedGalleryImages.length + index
    }));

    const dto: CreateTeacherDto = {
      userId: currentUser?.id,
      displayName: this.displayName.trim(),
      shortBio: this.shortBio?.trim() || undefined,
      fullDescription: this.fullDescription?.trim() || undefined,
      isTeacher: true,
      cityId: this.cityId,
      location: this.location?.trim() || undefined,
      phoneNumber: this.phoneNumber.trim(),
      whatsAppNumber: this.hasWhatsAppOnPhone ? this.phoneNumber.trim() : undefined,
      email: this.email.trim(),
      websiteUrl: this.websiteUrl?.trim() || undefined,
      bannerImageUrl: this.bannerImageUrl?.trim() || undefined,
      profileImageUrl: this.profileImageUrl?.trim() || undefined,
      videoUrl: normalizedVideoLinks[0] || this.videoUrl?.trim() || undefined,
      yearsOfExperience: this.yearsOfExperience,
      workingHours: this.workingHours?.trim() || undefined,
      isFeatured: false,
      status: ProfileStatus.Pending,
      priceList: this.priceList?.trim() || undefined,
      languages: this.arrayToFlags(this.selectedLanguages),
      targetAudience: this.arrayToFlags(this.selectedAudiences),
      availability: this.availability?.trim() || undefined,
      education: this.education?.trim() || undefined,
      lessonTypes: this.lessonTypes?.trim() || undefined,
      specializations: this.specializations?.trim() || undefined,
      instruments: this.selectedInstrumentIds.map(id => ({
        instrumentId: id,
        isPrimary: false
      } as CreateTeacherInstrumentDto)),
      galleryImages: [...normalizedGalleryImages, ...videoGalleryItems],
      testimonials: this.testimonials,
      socialLinks: this.socialLinks
        .filter(link => link.url?.trim())
        .map(link => ({ ...link, url: link.url.trim() }))
    };

    this.teacherService.createTeacherProfile(dto).subscribe({
      next: (teacher) => {
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
        console.error('Error creating teacher profile:', err);
        this.error = err.error?.message || '\u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05d9\u05e6\u05d9\u05e8\u05ea \u05e4\u05e8\u05d5\u05e4\u05d9\u05dc \u05de\u05d5\u05e8\u05d4';
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

    if (this.selectedInstrumentIds.length === 0) {
      this.error = '\u05e0\u05d0 \u05dc\u05d1\u05d7\u05d5\u05e8 \u05dc\u05e4\u05d7\u05d5\u05ea \u05db\u05dc\u05d9 \u05e0\u05d2\u05d9\u05e0\u05d4 \u05d0\u05d7\u05d3';
      this.showRequiredStep(1, '.instrument-picker');
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
    this.instrumentsDropdownOpen = false;
    this.languageDropdownOpen = false;
    this.audienceDropdownOpen = false;
  }


  goToSubscriptionSelection(): void {
    this.router.navigate(['/subscription/select'], { queryParams: { type: 'teacher' } });
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

    this.router.navigate(['/teachers']);
  }

  returnToChat(): void {
    if (this.embedded) {
      this.backToChat.emit();
    }
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


