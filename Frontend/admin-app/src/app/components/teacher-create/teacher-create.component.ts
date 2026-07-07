import { Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../services/language.service';
import { HttpEventType } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TeacherService } from '../../services/teacher.service';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService } from '../../services/subscription.service';
import { SystemTablesService, SystemItem } from '../../services/system-tables.service';
import { CitiesService, City } from '../../services/cities.service';
import { RequiredFieldFeedbackService } from '../../services/required-field-feedback.service';
import { MediaService } from '../../services/admin/media.service';
import { ProfileImageCropperComponent } from '../shared/profile-image-cropper/profile-image-cropper.component';
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

const SOCIAL_SVG_ICONS: Record<number, string> = {
  [SocialPlatform.Instagram]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke-width="3"/></svg>`,
  [SocialPlatform.Facebook]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
  [SocialPlatform.YouTube]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z M9.75 8.98 L15.5 12 L9.75 15.02 Z"/></svg>`,
  [SocialPlatform.TikTok]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.77a8.18 8.18 0 0 0 4.79 1.53V6.86a4.85 4.85 0 0 1-1.02-.17z"/></svg>`,
  [SocialPlatform.Twitter]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  [SocialPlatform.Spotify]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`,
  [SocialPlatform.Zing]: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/><path d="M8 10.5L16 7v2.5L8 13.5z"/></svg>`,
};

interface PlatformLinkOption {
  platform: SocialPlatform;
  label: string;
  svg: SafeHtml;
  placeholder: string;
}

@Component({
  selector: 'app-teacher-create',
  standalone: true,
  imports: [CommonModule, FormsModule, ProfileImageCropperComponent],
  templateUrl: './teacher-create.component.html',
  styleUrls: ['./teacher-create.component.css']
})
export class TeacherCreateComponent implements OnInit, OnDestroy {
  private readonly langService = inject(LanguageService);

  @Input() embedded = false;
  @Input() singlePage = false;
  @Input() agencyId?: number;
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
  bannerBlur: number = 0;
  profileImageUrl: string = '';
  videoUrl: string = '';
  yearsOfExperience: number = 0;
  workingHours: string = '';
  priceList: string = '';
  selectedLanguages: number[] = [];
  selectedAudiences: number[] = [];
  otherInstrument = '';
  otherLanguage = '';
  otherAudience = '';
  showOtherInstrument = false;
  showOtherLanguage = false;
  showOtherAudience = false;
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
  bannerImageUploading = false;
  galleryUploadingCount = 0;
  galleryUploadProgress = 0;
  profileImageUploadProgress = 0;
  bannerImageUploadProgress = 0;
  profileCropFile: File | null = null;
  profileCropUrl: string | null = null;
  profileCropFileName = 'profile-image';
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
  socialPlatformOptions: PlatformLinkOption[] = [];

  // UI state
  cityDropdownOpen = false;
  instrumentsDropdownOpen = false;
  languageDropdownOpen = false;
  audienceDropdownOpen = false;
  citySearchText = '';
  instrumentSearchText = '';
  filteredCities: City[] = [];
  filteredInstruments: SystemItem[] = [];
  private profileImageUploadSub?: Subscription;
  private bannerImageUploadSub?: Subscription;
  private galleryUploadSubs: Subscription[] = [];

  constructor(
    private teacherService: TeacherService,
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private systemTablesService: SystemTablesService,
    private citiesService: CitiesService,
    public router: Router,
    private host: ElementRef<HTMLElement>,
    private requiredFieldFeedback: RequiredFieldFeedbackService,
    private mediaService: MediaService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.socialPlatformOptions = this.buildSocialPlatformOptions();
    this.loadSubscriptionStatus();
    this.loadInstruments();
    this.loadCities();
    this.prefillUserData();
    setTimeout(() => this.scrollToTop(false));
  }

  private buildSocialPlatformOptions(): PlatformLinkOption[] {
    return [
      { platform: SocialPlatform.Instagram, label: 'Instagram', svg: this.sanitizer.bypassSecurityTrustHtml(SOCIAL_SVG_ICONS[SocialPlatform.Instagram]), placeholder: this.langService.translate('create.link_instagram') },
      { platform: SocialPlatform.Facebook, label: 'Facebook', svg: this.sanitizer.bypassSecurityTrustHtml(SOCIAL_SVG_ICONS[SocialPlatform.Facebook]), placeholder: this.langService.translate('create.link_facebook') },
      { platform: SocialPlatform.YouTube, label: 'YouTube', svg: this.sanitizer.bypassSecurityTrustHtml(SOCIAL_SVG_ICONS[SocialPlatform.YouTube]), placeholder: this.langService.translate('create.link_youtube') },
      { platform: SocialPlatform.TikTok, label: 'TikTok', svg: this.sanitizer.bypassSecurityTrustHtml(SOCIAL_SVG_ICONS[SocialPlatform.TikTok]), placeholder: this.langService.translate('create.link_tiktok') },
      { platform: SocialPlatform.Twitter, label: 'Twitter / X', svg: this.sanitizer.bypassSecurityTrustHtml(SOCIAL_SVG_ICONS[SocialPlatform.Twitter]), placeholder: this.langService.translate('create.link_x') },
      { platform: SocialPlatform.Spotify, label: 'Spotify', svg: this.sanitizer.bypassSecurityTrustHtml(SOCIAL_SVG_ICONS[SocialPlatform.Spotify]), placeholder: this.langService.translate('create.link_spotify') },
      { platform: SocialPlatform.Zing, label: 'Zing', svg: this.sanitizer.bypassSecurityTrustHtml(SOCIAL_SVG_ICONS[SocialPlatform.Zing]), placeholder: this.langService.translate('create.link_zing') },
    ];
  }

  get displayInstruments(): SystemItem[] {
    return this.availableInstruments.filter(instrument => !this.isOrganInstrument(instrument));
  }

  ngOnDestroy(): void {
    this.cancelProfileImageUpload();
    this.cancelBannerImageUpload();
    this.cancelGalleryUpload();
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
        this.availableInstruments = (result.items || []).filter(item => !this.isOrganInstrument(item));
        this.filteredInstruments = this.availableInstruments;
      },
      error: (error) => console.error('Error loading instruments:', error)
    });
  }

  private isOrganInstrument(instrument: SystemItem): boolean {
    return (instrument.name || '').trim().toLowerCase().includes('עוגב');
  }

  limitOtherField(field: 'otherInstrument' | 'otherLanguage' | 'otherAudience'): void {
    let rawValue = '';
    if (field === 'otherInstrument') rawValue = this.otherInstrument;
    if (field === 'otherLanguage') rawValue = this.otherLanguage;
    if (field === 'otherAudience') rawValue = this.otherAudience;

    const cleanValue = rawValue.trimStart().slice(0, 10);

    if (field === 'otherInstrument') this.otherInstrument = cleanValue;
    if (field === 'otherLanguage') this.otherLanguage = cleanValue;
    if (field === 'otherAudience') this.otherAudience = cleanValue;

    if (field === 'otherInstrument' && this.otherInstrument.trim()) {
      this.requiredFieldFeedback.clearFeedback(this.host.nativeElement.querySelector('.instrument-picker'));
    }
  }

  toggleOtherField(field: 'instrument' | 'language' | 'audience'): void {
    if (field === 'instrument') {
      this.showOtherInstrument = !this.showOtherInstrument;
      if (!this.showOtherInstrument) this.otherInstrument = '';
    }

    if (field === 'language') {
      this.showOtherLanguage = !this.showOtherLanguage;
      if (!this.showOtherLanguage) this.otherLanguage = '';
    }

    if (field === 'audience') {
      this.showOtherAudience = !this.showOtherAudience;
      if (!this.showOtherAudience) this.otherAudience = '';
    }
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
    const other = this.otherInstrument.trim();
    if (this.selectedInstrumentIds.length === 0 && !other) {
      return this.langService.translate('common.select_instrument');
    }
    const names = this.selectedInstrumentIds
      .map(id => this.availableInstruments.find(inst => inst.id === id)?.name)
      .filter(name => name);
    if (other) names.push(other);
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
    const other = this.otherLanguage.trim();
    if (this.selectedLanguages.length === 0 && !other) return this.langService.translate('common.select_language');
    const names = this.selectedLanguages
      .map(val => this.languageOptions.find(opt => opt.value === val)?.label)
      .filter(label => label);
    if (other) names.push(other);
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
    const other = this.otherAudience.trim();
    if (this.selectedAudiences.length === 0 && !other) return this.langService.translate('common.select_audience');
    const names = this.selectedAudiences
      .map(val => this.audienceOptions.find(opt => opt.value === val)?.label)
      .filter(label => label);
    if (other) names.push(other);
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
    input.value = '';
    if (!file) return;

    if (!this.canCropProfileFile(file)) {
      this.uploadProfileImageFile(file);
      return;
    }

    this.profileCropFileName = file.name;
    this.profileCropFile = file;
    this.profileCropUrl = null;
  }

  openProfileImageCropper(): void {
    if (!this.profileImageUrl || this.profileImageUploading) return;
    this.profileCropFile = null;
    this.profileCropFileName = 'profile-image';
    this.profileCropUrl = this.profileImageUrl;
  }

  cancelProfileImageCrop(): void {
    this.profileCropFile = null;
    this.profileCropUrl = null;
  }

  uploadCroppedProfileImage(file: File): void {
    this.profileCropFile = null;
    this.profileCropUrl = null;
    this.uploadProfileImageFile(file);
  }

  private uploadProfileImageFile(file: File): void {
    this.profileImageUploading = true;
    this.profileImageUploadProgress = 0;
    this.profileImageUploadSub?.unsubscribe();
    this.profileImageUploadSub = this.mediaService.uploadMediaWithProgress(file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.profileImageUploadProgress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
          return;
        }

        if (event.type !== HttpEventType.Response || !event.body?.url) return;

        this.profileImageUrl = event.body.url;
        this.profileImageUploadProgress = 100;
        this.profileImageUploading = false;
      },
      error: (error) => {
        console.error('Error uploading profile image:', error);
        this.error = this.langService.translate('common.error_profile_image');
        this.profileImageUploading = false;
        this.profileImageUploadProgress = 0;
      }
    });
  }

  private canCropProfileFile(file: File): boolean {
    return /(\.jpe?g|\.png|\.webp|\.gif|\.avif|\.bmp)$/i.test(file.name)
      || ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'].includes(file.type);
  }

  onBannerImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.bannerImageUploading = true;
    this.bannerImageUploadProgress = 0;
    this.bannerImageUploadSub?.unsubscribe();
    this.bannerImageUploadSub = this.mediaService.uploadMediaWithProgress(file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.bannerImageUploadProgress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
          return;
        }

        if (event.type !== HttpEventType.Response || !event.body?.url) return;

        this.bannerImageUrl = event.body.url;
        this.bannerImageUploadProgress = 100;
        this.bannerImageUploading = false;
        input.value = '';
      },
      error: (error) => {
        console.error('Error uploading banner image:', error);
        this.bannerImageUploading = false;
        this.bannerImageUploadProgress = 0;
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

      const sub = this.mediaService.uploadMediaWithProgress(file).subscribe({
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
      this.galleryUploadSubs.push(sub);
    });
  }

  cancelProfileImageUpload(): void {
    this.profileImageUploadSub?.unsubscribe();
    this.profileImageUploading = false;
    this.profileImageUploadProgress = 0;
  }

  cancelBannerImageUpload(): void {
    this.bannerImageUploadSub?.unsubscribe();
    this.bannerImageUploading = false;
    this.bannerImageUploadProgress = 0;
  }

  cancelGalleryUpload(): void {
    this.galleryUploadSubs.forEach(sub => sub.unsubscribe());
    this.galleryUploadSubs = [];
    this.galleryUploadingCount = 0;
    this.galleryUploadProgress = 0;
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
      alert(this.langService.translate('teacher_create.enter_image_url'));
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

  onSocialPlatformPointerDown(event: Event): void {
    event.preventDefault();
  }

  hasPlatformLink(platform: SocialPlatform): boolean {
    return !!this.getPlatformLink(platform).trim();
  }

  getActiveSocialPlaceholder(): string {
    return this.socialPlatformOptions.find(option => option.platform === this.activeSocialPlatform)?.placeholder ?? this.langService.translate('shared.paste_profile_link');
  }

  trackByPlatform(_index: number, option: PlatformLinkOption): number {
    return option.platform;
  }

  private arrayToFlags(selectedValues: number[]): number {
    if (!selectedValues || selectedValues.length === 0) return 0;
    return selectedValues.reduce((acc, val) => acc | val, 0);
  }

  normalizedBannerBlur(value: number | undefined): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(20, Math.round(numeric)));
  }

  getVideoThumbnail(url: string): string {
    const videoId = this.getYouTubeVideoId(url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
  }

  private getYouTubeVideoId(url: string): string {
    return url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/)?.[1] || '';
  }

  private withOtherDetails(description: string | undefined): string | undefined {
    const details = [
      this.otherInstrument.trim() ? `כלי נוסף: ${this.otherInstrument.trim()}` : '',
      this.otherLanguage.trim() ? `שפה נוספת: ${this.otherLanguage.trim()}` : '',
      this.otherAudience.trim() ? `קהל יעד נוסף: ${this.otherAudience.trim()}` : ''
    ].filter(Boolean);

    if (!details.length) return description;
    return [description?.trim(), details.join(' | ')].filter(Boolean).join('\n');
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

    const dto: CreateTeacherDto = {
      userId: currentUser?.id,
      agencyId: this.agencyId,
      displayName: this.displayName.trim(),
      shortBio: this.shortBio?.trim() || undefined,
      fullDescription: this.withOtherDetails(this.fullDescription?.trim()) || undefined,
      isTeacher: true,
      cityId: this.cityId,
      location: this.location?.trim() || undefined,
      phoneNumber: this.phoneNumber.trim(),
      whatsAppNumber: this.hasWhatsAppOnPhone ? this.phoneNumber.trim() : undefined,
      email: this.email.trim(),
      websiteUrl: this.websiteUrl?.trim() || undefined,
      bannerImageUrl: this.bannerImageUrl?.trim() || undefined,
      bannerBlur: this.normalizedBannerBlur(this.bannerBlur),
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
      otherInstrument: this.otherInstrument.trim() || undefined,
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
        this.error = this.getSaveErrorMessage(err);
        this.saving = false;

        // ׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ§׳³ֲ³׳’ג‚¬ֲ¢׳³ֲ³׳’ג€ֲ¢ localStorage ׳³ֲ³׳’ג‚¬ג„¢׳³ֲ³ײ²ֲ ׳³ֲ³׳’ג‚¬ֻ׳³ֲ³ײ²ֲ׳³ֲ³ײ²ֲ§׳³ֲ³ײ²ֲ¨׳³ֲ³׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ©׳³ֲ³ײ²ֲ ׳³ֲ³ײ²ֲ©׳³ֲ³׳’ג‚¬ג„¢׳³ֲ³׳’ג€ֲ¢׳³ֲ³ײ²ֲ׳³ֲ³׳’ג‚¬ֲ
        localStorage.removeItem('selectedSubscriptionPlan');
        localStorage.removeItem('selectedBillingCycle');
        localStorage.removeItem('pendingProfessionalType');
      }
    });
  }

  private getSaveErrorMessage(err: any): string {
    if (typeof err?.error === 'string' && err.error.trim()) {
      return err.error.trim();
    }

    if (err?.error?.errors && typeof err.error.errors === 'object') {
      const validationMessages = Object.values(err.error.errors)
        .flat()
        .filter(message => typeof message === 'string' && message.trim())
        .map(message => String(message).trim());

      if (validationMessages.length) {
        return validationMessages.join('\n');
      }
    }

    if (err?.error?.message) {
      return err.error.message;
    }

    if (err?.error?.title) {
      return err.error.title;
    }

    if (err?.message) {
      return err.message;
    }

    return this.langService.translate('teacher_create.error_save');
  }

  validateForm(): boolean {
    if (!this.displayName.trim()) {
      this.error = this.langService.translate('common.enter_display_name');
      this.showRequiredStep(1, '#displayName');
      return false;
    }

    if (!this.email || !this.email.trim()) {
      this.error = this.langService.translate('common.enter_email');
      this.showRequiredStep(1, '#email');
      return false;
    }

    if (!this.phoneNumber || !this.phoneNumber.trim()) {
      this.error = this.langService.translate('common.enter_phone');
      this.showRequiredStep(1, '#phoneNumber');
      return false;
    }

    if (this.selectedInstrumentIds.length === 0 && !this.otherInstrument.trim()) {
      this.error = this.langService.translate('teacher_create.select_instrument_min');
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


