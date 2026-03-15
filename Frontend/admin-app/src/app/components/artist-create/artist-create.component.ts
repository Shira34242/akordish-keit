import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SubscriptionService } from '../../services/subscription.service';
import { ArtistService } from '../../services/artist.service';
import { FileUploadInputComponent } from '../shared/file-upload-input/file-upload-input.component';
import { SubscriptionDto, SubscriptionPlan } from '../../models/subscription.model';
import { UpdateArtistDto } from '../../models/artist.model';

interface ArtistFormData {
  userId: number;
  name: string;
  englishName: string;
  shortBio: string;
  biography: string;
  imageUrl: string;
  websiteUrl: string;
  socialLinks: { platform: number; url: string }[];
  // Premium fields
  bannerImageUrl?: string;
  bannerGifUrl?: string;
  galleryImages?: { imageUrl: string; caption: string; displayOrder: number }[];
  videos?: { videoUrl: string; title: string; displayOrder: number }[];
}

@Component({
  selector: 'app-artist-create',
  standalone: true,
  imports: [CommonModule, FormsModule, FileUploadInputComponent],
  templateUrl: './artist-create.component.html',
  styleUrls: ['./artist-create.component.css']
})
export class ArtistCreateComponent implements OnInit {
  loading = false;
  saving = false;
  error = '';
  subscription?: SubscriptionDto;
  isPremium = false;

  artistForm: ArtistFormData = {
    userId: 0,
    name: '',
    englishName: '',
    shortBio: '',
    biography: '',
    imageUrl: '',
    websiteUrl: '',
    socialLinks: [],
    galleryImages: [],
    videos: []
  };

  constructor(
    private authService: AuthService,
    private subscriptionService: SubscriptionService,
    private artistService: ArtistService,
    private router: Router
  ) {}

  ngOnInit() {
    const user = this.authService.currentUserValue;
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.artistForm.userId = user.id;
    this.loadSubscriptionStatus();
  }

  loadSubscriptionStatus() {
    const user = this.authService.currentUserValue;
    if (!user) return;

    this.loading = true;

    // בודקים אם יש מנוי קיים במערכת
    this.subscriptionService.getUserActiveSubscription(user.id).subscribe({
      next: (subscription) => {
        // אם יש מנוי פעיל במערכת - משתמשים בו (עדיפות ראשונה)
        if (subscription) {
          this.subscription = subscription;
          this.isPremium = subscription.plan === SubscriptionPlan.Premium;
          this.loading = false;
          console.log('Using existing active subscription:', subscription.plan, 'isPremium:', this.isPremium);

          // ניקוי localStorage - המנוי כבר קיים במערכת
          localStorage.removeItem('selectedSubscriptionPlan');
          localStorage.removeItem('selectedBillingCycle');
          localStorage.removeItem('pendingProfessionalType');
        } else {
          // אין מנוי קיים - בודקים אם יש בחירה שמורה מתהליך ההרשמה
          const selectedPlan = localStorage.getItem('selectedSubscriptionPlan');

          if (selectedPlan) {
            this.isPremium = selectedPlan === SubscriptionPlan.Premium.toString();
            console.log('Using selected plan from registration:', selectedPlan, 'isPremium:', this.isPremium);
          } else {
            this.isPremium = false; // ברירת מחדל - פרופיל רגיל
            console.log('No subscription or selection - creating regular profile');
          }

          this.loading = false;
        }
      },
      error: () => {
        // שגיאה בטעינת מנוי - מנסים לקרוא מ-localStorage
        const selectedPlan = localStorage.getItem('selectedSubscriptionPlan');

        if (selectedPlan) {
          this.isPremium = selectedPlan === SubscriptionPlan.Premium.toString();
          console.log('Error loading subscription, using localStorage:', selectedPlan);
        } else {
          this.isPremium = false;
          console.log('No subscription or selection found - creating regular profile');
        }

        this.loading = false;
      }
    });
  }

  addSocialLink() {
    this.artistForm.socialLinks.push({ platform: 2, url: '' });
  }

  removeSocialLink(index: number) {
    this.artistForm.socialLinks.splice(index, 1);
  }

  addGalleryImage() {
    if (!this.artistForm.galleryImages) {
      this.artistForm.galleryImages = [];
    }
    this.artistForm.galleryImages.push({
      imageUrl: '',
      caption: '',
      displayOrder: this.artistForm.galleryImages.length
    });
  }

  removeGalleryImage(index: number) {
    this.artistForm.galleryImages?.splice(index, 1);
  }

  addVideo() {
    if (!this.artistForm.videos) {
      this.artistForm.videos = [];
    }
    this.artistForm.videos.push({
      videoUrl: '',
      title: '',
      displayOrder: this.artistForm.videos.length
    });
  }

  removeVideo(index: number) {
    this.artistForm.videos?.splice(index, 1);
  }

  getPlatformName(platform: number): string {
    const platforms: Record<number, string> = {
      1: 'Instagram',
      2: 'Facebook',
      3: 'YouTube',
      4: 'TikTok',
      5: 'אתר אינטרנט',
      6: 'Twitter',
      7: 'Spotify'
    };
    return platforms[platform] || 'אחר';
  }

  getCharCount(text: string | undefined): number {
    return text?.length || 0;
  }

  onSubmit() {
    // Validation
    if (!this.artistForm.name.trim()) {
      this.error = 'נא למלא שם אומן';
      return;
    }

    this.saving = true;
    this.error = '';

    // הכנת ה-DTO לשליחה - כל השדות נשמרים תמיד (המנוי קובע מה יוצג בציבור)
    const dto: UpdateArtistDto = {
      name: this.artistForm.name,
      englishName: this.artistForm.englishName || undefined,
      shortBio: this.artistForm.shortBio || undefined,
      biography: this.artistForm.biography || undefined,
      imageUrl: this.artistForm.imageUrl || undefined,
      websiteUrl: this.artistForm.websiteUrl || undefined,
      socialLinks: this.artistForm.socialLinks.length > 0
        ? this.artistForm.socialLinks.map(sl => ({
            platform: Number(sl.platform),
            url: sl.url
          }))
        : undefined,
      // שדות פרמיום - נשמרים תמיד בבסיס הנתונים
      bannerImageUrl: this.artistForm.bannerImageUrl || undefined,
      bannerGifUrl: this.artistForm.bannerGifUrl || undefined,
      galleryImages: this.artistForm.galleryImages && this.artistForm.galleryImages.length > 0
        ? this.artistForm.galleryImages.map(gi => ({
            imageUrl: gi.imageUrl,
            caption: gi.caption || undefined,
            displayOrder: gi.displayOrder
          }))
        : undefined,
      videos: this.artistForm.videos && this.artistForm.videos.length > 0
        ? this.artistForm.videos.map(v => ({
            videoUrl: v.videoUrl,
            title: v.title || undefined,
            displayOrder: v.displayOrder
          }))
        : undefined
    };

    // שליחה לAPI
    this.artistService.createArtistProfile(dto).subscribe({
      next: () => {
        this.saving = false;

        // ניקוי localStorage
        localStorage.removeItem('selectedSubscriptionPlan');
        localStorage.removeItem('selectedBillingCycle');
        localStorage.removeItem('pendingProfessionalType');

        // סימון המשתמש כבעל פרופיל מקצועי (מונע הצגת הפופאפ "עוד פרטים" בהתחברות הבאה)
        this.authService.markAsProfessional();

        // מעבר לבחירת חבילה (שלב 2 בתהליך ההרשמה)
        this.router.navigate(['/subscription/select'], { queryParams: { from: 'profile-complete', type: 'artist' } });
      },
      error: (err) => {
        this.saving = false;
        this.error = err.error?.message || err.error || 'שגיאה ביצירת פרופיל האומן';
        console.error('Error creating artist:', err);

        // ניקוי localStorage גם במקרה של שגיאה (למנוע מצב מלוכלך)
        localStorage.removeItem('selectedSubscriptionPlan');
        localStorage.removeItem('selectedBillingCycle');
        localStorage.removeItem('pendingProfessionalType');
      }
    });
  }

  cancel() {
    if (confirm('האם אתה בטוח שברצונך לבטל? השינויים לא יישמרו.')) {
      this.router.navigate(['/']);
    }
  }
  selectSubscription() {
    this.router.navigate(['/subscription/select']);
  }
}
