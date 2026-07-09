import { Component, ElementRef, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService } from '../../services/subscription.service';
import { ArtistService } from '../../services/artist.service';
import { SongService } from '../../services/song.service';
import { FileUploadInputComponent } from '../shared/file-upload-input/file-upload-input.component';
import { RequiredFieldFeedbackService } from '../../services/required-field-feedback.service';
import { SubscriptionDto, SubscriptionPlan } from '../../models/subscription.model';
import { ArtistStatus, BannerMediaType, PerformanceEventInput, UpdateArtistDto } from '../../models/artist.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';

interface ArtistHitForm {
  clientKey: string;
  title: string;
  imageUrl?: string;
  youTubeUrl: string;
  displayOrder: number;
  isActive: boolean;
}

interface ArtistFormData {
  userId: number;
  name: string;
  englishName: string;
  shortBio: string;
  biography: string;
  imageUrl: string;
  websiteUrl: string;
  socialLinks: { platform: number; url: string }[];   // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג€ֲ¬ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ
  musicLinks: { platform: number; url: string }[];    // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ³׳’ג‚¬ג€׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ»׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ³׳’ג‚¬ג€׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג€ֲ¬ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ
  // Performance event (full)
  performance: {
    enabled: boolean;
    name: string;
    description: string;
    eventDate: string;
    location: string;
    price: number | null;
    ticketUrl: string;
    imageUrl: string;         // poster (square)
    bannerImageUrl: string;   // banner (wide 4:1)
    isActive: boolean;
  };
  // Banner
  bannerMediaType: BannerMediaType;
  bannerUrl: string;
  bannerBlur: number;
  // Premium fields - gallery (unified)
  galleryItems?: { kind: 'image' | 'video'; imageUrl?: string; caption?: string; videoUrl?: string; title?: string; displayOrder: number }[];
  hits?: ArtistHitForm[];
  albums?: { title: string; coverImageUrl: string; releaseYear: number | null; externalUrl: string; displayOrder: number; isActive: boolean }[];
}

interface PlatformLinkOption {
  platform: number;
  label: string;
  icon: string;
  placeholder: string;
}

@Component({
  selector: 'app-artist-create',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadInputComponent, TranslatePipe],
  templateUrl: './artist-create.component.html',
  styleUrls: ['./artist-create.component.css']
})
export class ArtistCreateComponent implements OnInit {
  @Input() embedded = false;
  @Output() close = new EventEmitter<void>();
  @Output() backToChat = new EventEmitter<void>();

  currentStep = 1;
  readonly totalSteps = 3;
  loading = false;
  saving = false;
  submitted = false;
  error = '';
  subscription?: SubscriptionDto;
  isPremium = false;
  private draftSaved = false;
  private hitKeySeed = 0;
  private draggedHitIndex: number | null = null;

  readonly GALLERY_MIN_ITEMS = 5;

  galleryVideoErrors: Record<number, string> = {};

  private readonly langService = inject(LanguageService);

  get socialPlatformOptions(): PlatformLinkOption[] {
    return [
      { platform: 1, label: 'Instagram', icon: 'photo_camera', placeholder: this.langService.translate('artist_create.platform_instagram') },
      { platform: 2, label: 'Facebook', icon: 'thumb_up', placeholder: this.langService.translate('artist_create.platform_facebook') },
      { platform: 4, label: 'TikTok', icon: 'music_note', placeholder: this.langService.translate('artist_create.platform_tiktok') },
      { platform: 6, label: 'Twitter / X', icon: 'alternate_email', placeholder: this.langService.translate('artist_create.platform_twitter') },
    ];
  }

  get musicPlatformOptions(): PlatformLinkOption[] {
    return [
      { platform: 3, label: 'YouTube', icon: 'smart_display', placeholder: this.langService.translate('artist_create.platform_youtube') },
      { platform: 7, label: 'Spotify', icon: 'album', placeholder: this.langService.translate('artist_create.platform_spotify') },
      { platform: 8, label: 'Zing', icon: 'library_music', placeholder: this.langService.translate('artist_create.platform_zing') },
      { platform: 11, label: 'Apple Music', icon: 'apple', placeholder: 'https://music.apple.com/...' },
      { platform: 9, label: "ג'וזיק", icon: 'queue_music', placeholder: 'https://jewzik.com/...' },
      { platform: 10, label: '24Six', icon: 'graphic_eq', placeholder: 'https://24six.fm/...' },
    ];
  }

  artistForm: ArtistFormData = {
    userId: 0,
    name: '',
    englishName: '',
    shortBio: '',
    biography: '',
    imageUrl: '',
    websiteUrl: '',
    socialLinks: [],
    musicLinks: [],
    performance: {
      enabled: false,
      name: '',
      description: '',
      eventDate: '',
      location: '',
      price: null,
      ticketUrl: '',
      imageUrl: '',
      bannerImageUrl: '',
      isActive: true
    },
    bannerMediaType: 'image',
    bannerUrl: '',
    bannerBlur: 0,
    galleryItems: [],
    hits: [],
    albums: []
  };

  constructor(
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private artistService: ArtistService,
    private songService: SongService,
    private router: Router,
    private host: ElementRef<HTMLElement>,
    private requiredFieldFeedback: RequiredFieldFeedbackService
  ) {}

  ngOnInit() {
    const user = this.authService.currentUserValue;
    if (!user) {
      this.authService.requestLogin(this.router.url);
      return;
    }

    this.artistForm.userId = user.id;
    this.loadSubscriptionStatus();
    this.syncBannerMediaMode();
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
    if (!user) return;

    this.loading = true;

    // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ© ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ³ײ²ֲ·׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ
    this.subscriptionService.getUserActiveSubscription(user.id).subscribe({
      next: (subscription) => {
        // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ© ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ³׳’ג‚¬ג€׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ³ײ²ֲ·׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ - ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢ (׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ³׳’ג‚¬ג€׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ)
        if (subscription) {
          this.subscription = subscription;
          this.isPremium = subscription.plan === SubscriptionPlan.Premium;
          this.loading = false;

          // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢ localStorage - ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ³ײ²ֲ·׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ³ײ²ֲ·׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ
          localStorage.removeItem('selectedSubscriptionPlan');
          localStorage.removeItem('selectedBillingCycle');
          localStorage.removeItem('pendingProfessionalType');
        } else {
          // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ - ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ© ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג€ֲ¬ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ
          const selectedPlan = localStorage.getItem('selectedSubscriptionPlan');

          if (selectedPlan) {
            this.isPremium = selectedPlan === SubscriptionPlan.Premium.toString();
          } else {
            this.isPremium = false; // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג€ֲ¬ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ - ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ³׳’ג‚¬ג€׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ³׳’ג‚¬ג€׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג‚¬ֲײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ
          }

          this.loading = false;
        }
      },
      error: () => {
        // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג‚¬ֲײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ»׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢ - ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¡׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ-localStorage
        const selectedPlan = localStorage.getItem('selectedSubscriptionPlan');

        if (selectedPlan) {
          this.isPremium = selectedPlan === SubscriptionPlan.Premium.toString();
        } else {
          this.isPremium = false;
        }

        this.loading = false;
      }
    });
  }

  addSocialLink() {
    this.artistForm.socialLinks.push({ platform: 1, url: '' });
  }

  removeSocialLink(index: number) {
    this.artistForm.socialLinks.splice(index, 1);
  }

  addMusicLink() {
    this.artistForm.musicLinks.push({ platform: 7, url: '' }); // Spotify as default
  }

  removeMusicLink(index: number) {
    this.artistForm.musicLinks.splice(index, 1);
  }

  addGalleryImage() {
    if (!this.artistForm.galleryItems) this.artistForm.galleryItems = [];
    this.artistForm.galleryItems.push({
      kind: 'image',
      imageUrl: '',
      caption: '',
      displayOrder: this.artistForm.galleryItems.length
    });
  }

  addGalleryVideo() {
    if (!this.artistForm.galleryItems) this.artistForm.galleryItems = [];
    this.artistForm.galleryItems.push({
      kind: 'video',
      videoUrl: '',
      title: '',
      displayOrder: this.artistForm.galleryItems.length
    });
  }

  removeGalleryItem(index: number) {
    this.artistForm.galleryItems?.splice(index, 1);
    this.artistForm.galleryItems?.forEach((it, order) => it.displayOrder = order);
    delete this.galleryVideoErrors[index];
  }

  validateGalleryVideo(index: number, url?: string): void {
    if (!url || !url.trim()) {
      delete this.galleryVideoErrors[index];
      return;
    }
    if (/(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(url)) {
      delete this.galleryVideoErrors[index];
    } else {
      this.galleryVideoErrors[index] = 'קישורי יוטיוב בלבד';
    }
  }

  addHit(): void {
    if (!this.artistForm.hits) this.artistForm.hits = [];
    this.artistForm.hits.push({
      clientKey: this.createHitKey(),
      title: '',
      imageUrl: '',
      youTubeUrl: '',
      displayOrder: this.artistForm.hits.length,
      isActive: true
    });
  }

  removeHit(index: number): void {
    this.artistForm.hits?.splice(index, 1);
    this.syncHitOrder();
  }

  onHitDragStart(index: number): void {
    this.draggedHitIndex = index;
  }

  onHitDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onHitDrop(index: number): void {
    const hits = this.artistForm.hits;
    if (!hits || this.draggedHitIndex === null || this.draggedHitIndex === index) {
      this.draggedHitIndex = null;
      return;
    }

    const [draggedHit] = hits.splice(this.draggedHitIndex, 1);
    hits.splice(index, 0, draggedHit);
    this.draggedHitIndex = null;
    this.syncHitOrder();
  }

  onHitDragEnd(): void {
    this.draggedHitIndex = null;
  }

  trackHit(_index: number, hit: ArtistHitForm): string {
    return hit.clientKey;
  }

  private syncHitOrder(): void {
    this.artistForm.hits?.forEach((hit, order) => hit.displayOrder = order);
  }

  private createHitKey(): string {
    this.hitKeySeed += 1;
    return `hit-${this.hitKeySeed}`;
  }

  onHitYouTubeUrlChange(index: number): void {
    const hit = this.artistForm.hits?.[index];
    if (!hit || !hit.youTubeUrl?.trim() || hit.imageUrl?.trim()) return;

    this.songService.getYouTubeMetadata(hit.youTubeUrl.trim()).subscribe({
      next: (meta) => {
        if (meta?.title && !hit.title?.trim()) {
          hit.title = meta.title;
        }
        if (meta?.thumbnailUrl && !hit.imageUrl?.trim()) {
          hit.imageUrl = meta.thumbnailUrl;
        }
      },
      error: () => { /* ignore — user can add image manually */ }
    });
  }

  addAlbum(): void {
    if (!this.artistForm.albums) this.artistForm.albums = [];
    this.artistForm.albums.push({
      title: '',
      coverImageUrl: '',
      releaseYear: null,
      externalUrl: '',
      displayOrder: this.artistForm.albums.length,
      isActive: true
    });
  }

  removeAlbum(index: number): void {
    this.artistForm.albums?.splice(index, 1);
    this.artistForm.albums?.forEach((album, order) => album.displayOrder = order);
  }

  get galleryItemsCount(): number {
    return (this.artistForm.galleryItems || []).filter(it => {
      if (it.kind === 'image') return !!it.imageUrl?.trim();
      return !!it.videoUrl?.trim();
    }).length;
  }

  setBannerType(mode: BannerMediaType): void {
    this.artistForm.bannerMediaType = mode;
  }

  getPlatformLink(links: { platform: number; url: string }[], platform: number): string {
    return links.find(link => Number(link.platform) === platform)?.url || '';
  }

  setPlatformLink(
    links: { platform: number; url: string }[],
    platform: number,
    url: string
  ): void {
    const trimmedUrl = url.trim();
    const existingLink = links.find(link => Number(link.platform) === platform);

    if (!trimmedUrl) {
      if (existingLink) {
        const index = links.indexOf(existingLink);
        links.splice(index, 1);
      }
      return;
    }

    if (existingLink) {
      existingLink.url = url;
      return;
    }

    links.push({ platform, url });
  }

  trackByPlatform(_: number, option: PlatformLinkOption): number {
    return option.platform;
  }

  private syncBannerMediaMode(): void {
    // ברירת מחדל — תמונה. נשמר לגבי תאימות לאחור.
    this.artistForm.bannerMediaType = this.artistForm.bannerMediaType || 'image';
  }

  getSocialPlatformName(platform: number): string {
    const platforms: Record<number, string> = {
      1: 'Instagram',
      2: 'Facebook',
      4: 'TikTok',
      5: '\u05d0\u05ea\u05e8 \u05d0\u05d9\u05e9\u05d9',
      6: 'Twitter / X'
    };
    return platforms[platform] || '\u05d0\u05d7\u05e8';
  }

  getMusicPlatformName(platform: number): string {
    const platforms: Record<number, string> = {
      3: 'YouTube',
      7: 'Spotify',
      8: 'Zing',
      9: "\u05d2'\u05d5\u05d6\u05d9\u05e7",
      10: '24Six',
      11: 'Apple Music'
    };
    return platforms[platform] || '\u05d0\u05d7\u05e8';
  }

  getCharCount(text: string | undefined): number {
    return text?.length || 0;
  }

  canDeactivate(): boolean | Observable<boolean> {
    if (!this.shouldSaveDraftOnExit()) {
      return true;
    }

    this.saving = true;
    this.error = '';

    return this.artistService.createArtistProfile(this.buildArtistDto(ArtistStatus.Draft)).pipe(
      map(() => {
        this.draftSaved = true;
        this.saving = false;
        return true;
      }),
      catchError((err) => {
        this.saving = false;
        console.error('Error saving artist draft:', err);
        return of(true);
      })
    );
  }

  onSubmit() {
    // Validation
    if (!this.artistForm.name.trim()) {
      this.error = '\u05e0\u05d0 \u05dc\u05de\u05dc\u05d0 \u05d0\u05ea \u05e9\u05dd \u05d4\u05d0\u05de\u05df';
      this.currentStep = 1;
      window.alert(this.error);
      setTimeout(() => this.requiredFieldFeedback.showRequiredBySelector(this.host.nativeElement, '#artistName'));
      return;
    }

    const richContentError = this.validateRichContent();
    if (richContentError) {
      this.showValidationError(richContentError, this.getRichContentValidationTarget());
      return;
    }

    const videoErrors = Object.values(this.galleryVideoErrors).filter(Boolean);
    if (videoErrors.length) {
      this.showValidationError(videoErrors[0], '[data-validation-target="gallery-video"]');
      return;
    }

    this.saving = true;
    this.error = '';

    // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג€ֲ¬ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג‚¬ֲײ²ֲ¢ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג€ֲ¬ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ + ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג€ֲ¬ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ
    const allLinks = [
      ...this.artistForm.socialLinks,
      ...this.artistForm.musicLinks
    ]
      .filter(link => link.url?.trim())
      .map(link => ({
        platform: Number(link.platform),
        url: link.url.trim()
      }))
      .filter(link => Number.isFinite(link.platform) && link.platform >= 1 && link.platform <= 11);

    const items = this.artistForm.galleryItems || [];
    const galleryImages = items
      .filter(it => it.kind === 'image' && it.imageUrl?.trim())
      .map((it, index) => ({
        imageUrl: it.imageUrl!.trim(),
        caption: it.caption?.trim() || undefined,
        displayOrder: index
      }));

    const videos = items
      .filter(it => it.kind === 'video' && it.videoUrl?.trim())
      .map((it, index) => ({
        videoUrl: it.videoUrl!.trim(),
        title: it.title?.trim() || undefined,
        displayOrder: index
      }));

    const hits = (this.artistForm.hits || [])
      .filter(hit => hit.youTubeUrl?.trim())
      .map((hit, index) => ({
        title: hit.title?.trim() || this.langService.translate('artist_create.default_hit_title'),
        imageUrl: hit.imageUrl?.trim() || undefined,
        youTubeUrl: hit.youTubeUrl.trim(),
        displayOrder: index,
        isActive: hit.isActive
      }));

    const albums = (this.artistForm.albums || [])
      .filter(album => album.coverImageUrl?.trim())
      .map((album, index) => ({
        title: album.title?.trim() || this.langService.translate('artist_create.default_album_title'),
        coverImageUrl: album.coverImageUrl.trim(),
        releaseYear: album.releaseYear ?? undefined,
        externalUrl: album.externalUrl?.trim() || '',
        displayOrder: index,
        isActive: album.isActive
      }));

    const performanceImageUrl = this.artistForm.performance.imageUrl?.trim()
      || this.artistForm.performance.bannerImageUrl?.trim()
      || '';
    const performanceBannerImageUrl = this.artistForm.performance.bannerImageUrl?.trim()
      || performanceImageUrl;

    const performance: PerformanceEventInput | null = this.artistForm.performance.enabled
      && performanceImageUrl
      ? {
          name: this.artistForm.performance.name?.trim() || this.artistForm.name.trim(),
          description: this.artistForm.performance.description?.trim() || undefined,
          imageUrl: performanceImageUrl,
          bannerImageUrl: performanceBannerImageUrl,
          ticketUrl: this.artistForm.performance.ticketUrl?.trim() || '',
          eventDate: this.artistForm.performance.eventDate
            ? new Date(this.artistForm.performance.eventDate).toISOString()
            : new Date().toISOString(),
          location: this.artistForm.performance.location?.trim() || undefined,
          price: this.artistForm.performance.price ?? null,
          isActive: this.artistForm.performance.isActive
        }
      : null;

    // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ³ײ²ֲ·׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ-DTO ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג€ֲ¬ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ
    const bannerType = this.artistForm.bannerMediaType;
    const bannerUrl = this.artistForm.bannerUrl?.trim();

    const dto: UpdateArtistDto = {
      status: ArtistStatus.Pending,
      name: this.artistForm.name.trim(),
      englishName: this.artistForm.englishName?.trim() || undefined,
      shortBio: this.artistForm.shortBio?.trim() || undefined,
      biography: this.artistForm.biography?.trim() || undefined,
      imageUrl: this.artistForm.imageUrl?.trim() || undefined,
      websiteUrl: this.artistForm.websiteUrl?.trim() || undefined,
      socialLinks: allLinks.length > 0
        ? allLinks
        : undefined,
      performanceIsActive: this.artistForm.performance.enabled,
      performanceEvent: performance,
      // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ³׳’ג‚¬ג€׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ - ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¡׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¡ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ
      bannerImageUrl: bannerType === 'image' && bannerUrl ? bannerUrl : undefined,
      bannerGifUrl: (bannerType === 'gif' || bannerType === 'video') && bannerUrl ? bannerUrl : undefined,
      bannerMediaType: bannerUrl ? bannerType : null,
      bannerBlur: this.normalizedBannerBlur(this.artistForm.bannerBlur),
      galleryImages: galleryImages.length > 0
        ? galleryImages
        : undefined,
      videos: videos.length > 0
        ? videos
        : undefined,
      hits: hits.length > 0
        ? hits
        : undefined,
      albums: albums.length > 0
        ? albums
        : undefined
    };

    // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג€ֲ¬ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲAPI
    this.artistService.createArtistProfile(dto).subscribe({
      next: () => {
        this.saving = false;

        // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢ localStorage
        localStorage.removeItem('selectedSubscriptionPlan');
        localStorage.removeItem('selectedBillingCycle');
        localStorage.removeItem('pendingProfessionalType');

        // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¡׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ© ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ³ײ²ֲ·׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ³׳’ג‚¬ג€׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ³׳’ג‚¬ג€׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¦׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢ (׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¢ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¦׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג‚¬ֲײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ³׳’ג‚¬ג€׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ³׳’ג‚¬ג€׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ³׳’ג‚¬ג€ "׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ³׳’ג‚¬ג€׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ»׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ" ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג€ֲ¬ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ)
        this.authService.markAsProfessional();

        // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג€ֲ¬ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג€ֲ¬ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ (׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ 2 ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ³׳³ג€™׳’ג€ֲ¬׳’ג‚¬ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ)
        this.submitted = true;
        this.scrollToTop();
      },
      error: (err) => {
        this.saving = false;
        this.error = err.error?.message || err.error || '\u05e9\u05d2\u05d9\u05d0\u05d4 \u05d1\u05d9\u05e6\u05d9\u05e8\u05ea \u05e4\u05e8\u05d5\u05e4\u05d9\u05dc \u05d4\u05d0\u05de\u05df';
        console.error('Error creating artist:', err);
        window.alert(this.error);

        // ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢ localStorage ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג‚¬ֲײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ§׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¨׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ©׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳³ג€™׳’ג‚¬ֲײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג€ֲ¬ײ²ֲ׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ (׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¢ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ¦׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ»ײ²ֲ ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ²ײ²ֲ¢׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ³׳’ג‚¬ג„¢׳³ג€™׳’ג‚¬ֲײ²ֲ¬׳²ֲ³ײ²ֲ·׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ׳³ֲ³ײ²ֲ³׳²ֲ²ײ²ֲ³׳³ֲ²ײ²ֲ²׳²ֲ²ײ²ֲ)
        localStorage.removeItem('selectedSubscriptionPlan');
        localStorage.removeItem('selectedBillingCycle');
        localStorage.removeItem('pendingProfessionalType');
      }
    });
  }

  cancel() {
    if (this.embedded) {
      this.close.emit();
      return;
    }

    if (confirm('\u05d4\u05d0\u05dd \u05dc\u05d1\u05d8\u05dc \u05d0\u05ea \u05d4\u05ea\u05d4\u05dc\u05d9\u05da? \u05d4\u05e9\u05d9\u05e0\u05d5\u05d9\u05d9\u05dd \u05e2\u05d3\u05d9\u05d9\u05df \u05dc\u05d0 \u05d9\u05d9\u05e9\u05de\u05e8\u05d5.')) {
      this.router.navigate(['/']);
    }
  }

  returnToChat(): void {
    if (this.embedded) {
      this.backToChat.emit();
    }
  }
  selectSubscription() {
    this.router.navigate(['/subscription/select'], { queryParams: { type: 'artist' } });
  }


  finishFlow(): void {
    if (this.embedded) {
      this.close.emit();
      return;
    }

    this.router.navigate(['/artists']);
  }

  private shouldSaveDraftOnExit(): boolean {
    return !this.embedded
      && !this.saving
      && !this.submitted
      && !this.draftSaved
      && !!this.artistForm.name?.trim();
  }

  private buildArtistDto(status: ArtistStatus): UpdateArtistDto {
    const allLinks = [
      ...this.artistForm.socialLinks,
      ...this.artistForm.musicLinks
    ]
      .filter(link => link.url?.trim())
      .map(link => ({
        platform: Number(link.platform),
        url: link.url.trim()
      }))
      .filter(link => Number.isFinite(link.platform) && link.platform >= 1 && link.platform <= 11);

    const items = this.artistForm.galleryItems || [];
    const galleryImages = items
      .filter(it => it.kind === 'image' && it.imageUrl?.trim())
      .map((it, index) => ({
        imageUrl: it.imageUrl!.trim(),
        caption: it.caption?.trim() || undefined,
        displayOrder: index
      }));

    const videos = items
      .filter(it => it.kind === 'video' && it.videoUrl?.trim())
      .map((it, index) => ({
        videoUrl: it.videoUrl!.trim(),
        title: it.title?.trim() || undefined,
        displayOrder: index
      }));

    const hits = (this.artistForm.hits || [])
      .filter(hit => hit.youTubeUrl?.trim())
      .map((hit, index) => ({
        title: hit.title?.trim() || this.langService.translate('artist_create.default_hit_title'),
        imageUrl: hit.imageUrl?.trim() || undefined,
        youTubeUrl: hit.youTubeUrl.trim(),
        displayOrder: index,
        isActive: hit.isActive
      }));

    const albums = (this.artistForm.albums || [])
      .filter(album => album.coverImageUrl?.trim())
      .map((album, index) => ({
        title: album.title?.trim() || this.langService.translate('artist_create.default_album_title'),
        coverImageUrl: album.coverImageUrl.trim(),
        releaseYear: album.releaseYear ?? undefined,
        externalUrl: album.externalUrl?.trim() || '',
        displayOrder: index,
        isActive: album.isActive
      }));

    const performanceImageUrl = this.artistForm.performance.imageUrl?.trim()
      || this.artistForm.performance.bannerImageUrl?.trim()
      || '';
    const performanceBannerImageUrl = this.artistForm.performance.bannerImageUrl?.trim()
      || performanceImageUrl;

    const performance: PerformanceEventInput | null = this.artistForm.performance.enabled
      && performanceImageUrl
      ? {
          name: this.artistForm.performance.name?.trim() || this.artistForm.name.trim(),
          description: this.artistForm.performance.description?.trim() || undefined,
          imageUrl: performanceImageUrl,
          bannerImageUrl: performanceBannerImageUrl,
          ticketUrl: this.artistForm.performance.ticketUrl?.trim() || '',
          eventDate: this.artistForm.performance.eventDate
            ? new Date(this.artistForm.performance.eventDate).toISOString()
            : new Date().toISOString(),
          location: this.artistForm.performance.location?.trim() || undefined,
          price: this.artistForm.performance.price ?? null,
          isActive: this.artistForm.performance.isActive
        }
      : null;

    const bannerType = this.artistForm.bannerMediaType;
    const bannerUrl = this.artistForm.bannerUrl?.trim();

    return {
      status,
      name: this.artistForm.name.trim(),
      englishName: this.artistForm.englishName?.trim() || undefined,
      shortBio: this.artistForm.shortBio?.trim() || undefined,
      biography: this.artistForm.biography?.trim() || undefined,
      imageUrl: this.artistForm.imageUrl?.trim() || undefined,
      websiteUrl: this.artistForm.websiteUrl?.trim() || undefined,
      socialLinks: allLinks.length > 0 ? allLinks : undefined,
      performanceIsActive: this.artistForm.performance.enabled,
      performanceEvent: performance,
      bannerImageUrl: bannerType === 'image' && bannerUrl ? bannerUrl : undefined,
      bannerGifUrl: (bannerType === 'gif' || bannerType === 'video') && bannerUrl ? bannerUrl : undefined,
      bannerMediaType: bannerUrl ? bannerType : null,
      bannerBlur: this.normalizedBannerBlur(this.artistForm.bannerBlur),
      galleryImages: galleryImages.length > 0 ? galleryImages : undefined,
      videos: videos.length > 0 ? videos : undefined,
      hits: hits.length > 0 ? hits : undefined,
      albums: albums.length > 0 ? albums : undefined
    };
  }

  private validateRichContent(): string | null {
    const p = this.artistForm.performance;
    if (p.enabled) {
      this.mirrorPerformanceImageFields(p);
      if (!p.imageUrl?.trim()) return this.langService.translate('artist_create.validation_performance_image');
      if (p.eventDate && Number.isNaN(new Date(p.eventDate).getTime())) return this.langService.translate('artist_create.validation_performance_date');
    }

    for (let i = 0; i < (this.artistForm.hits || []).length; i++) {
      const message = this.getHitValidationMessage(i);
      if (message) return message;
    }

    for (let i = 0; i < (this.artistForm.albums || []).length; i++) {
      const message = this.getAlbumValidationMessage(i);
      if (message) return message;
    }

    return null;
  }

  private getRichContentValidationTarget(): string {
    const p = this.artistForm.performance;
    if (p.enabled) {
      this.mirrorPerformanceImageFields(p);
      if (!p.imageUrl?.trim()) return '[data-validation-target="performance-image"]';
      if (p.eventDate && Number.isNaN(new Date(p.eventDate).getTime())) return '[name="perfDate"]';
    }

    for (let i = 0; i < (this.artistForm.hits || []).length; i++) {
      if (this.getHitValidationMessage(i)) return `[data-validation-target="hit-youtube-${i}"]`;
    }

    for (let i = 0; i < (this.artistForm.albums || []).length; i++) {
      if (this.getAlbumValidationMessage(i)) return `[data-validation-target="album-cover-${i}"]`;
    }

    return '#artistName';
  }

  private showValidationError(message: string, targetSelector: string): void {
    this.error = message;
    this.currentStep = targetSelector === '#artistName' ? 1 : 3;
    window.alert(message);
    setTimeout(() => this.scrollToValidationTarget(targetSelector));
  }

  private scrollToValidationTarget(targetSelector: string): void {
    const target = this.host.nativeElement.querySelector<HTMLElement>(targetSelector);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    const focusable = target.matches('input, textarea, select, button')
      ? target
      : target.querySelector<HTMLElement>('input, textarea, select, button');
    focusable?.focus({ preventScroll: true });
  }

  getHitValidationMessage(index: number): string | null {
    const hit = this.artistForm.hits?.[index];
    if (!hit || this.isBlankHit(hit) || this.isCompleteHit(hit)) return null;
    return `${this.langService.translate('artist_create.validation_hit_prefix')}${index + 1}${this.langService.translate('artist_create.validation_hit_suffix')}`;
  }

  getAlbumValidationMessage(index: number): string | null {
    const album = this.artistForm.albums?.[index];
    if (!album || this.isBlankAlbum(album) || this.isCompleteAlbum(album)) return null;
    return `${this.langService.translate('artist_create.validation_album_prefix')}${index + 1}${this.langService.translate('artist_create.validation_album_suffix')}`;
  }

  private isBlankHit(hit: NonNullable<ArtistFormData['hits']>[number]): boolean {
    return !hit.title?.trim() && !hit.imageUrl?.trim() && !hit.youTubeUrl?.trim();
  }

  private isCompleteHit(hit: NonNullable<ArtistFormData['hits']>[number]): boolean {
    return !!hit.youTubeUrl?.trim();
  }

  private isBlankAlbum(album: NonNullable<ArtistFormData['albums']>[number]): boolean {
    return !album.title?.trim() && !album.coverImageUrl?.trim() && !album.externalUrl?.trim() && !album.releaseYear;
  }

  private isCompleteAlbum(album: NonNullable<ArtistFormData['albums']>[number]): boolean {
    return !!album.coverImageUrl?.trim();
  }

  private mirrorPerformanceImageFields(performance: ArtistFormData['performance']): void {
    const imageUrl = performance.imageUrl?.trim();
    const bannerImageUrl = performance.bannerImageUrl?.trim();
    if (!imageUrl && bannerImageUrl) performance.imageUrl = bannerImageUrl;
    if (!bannerImageUrl && imageUrl) performance.bannerImageUrl = imageUrl;
  }

  private normalizedBannerBlur(value: number | null | undefined): number {
    const numericValue = Number(value) || 0;
    return Math.max(0, Math.min(20, numericValue));
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

